-- LOCAL TEST HARNESS ONLY. Seeds a contended queue and defines the worker
-- and sampler procedures used by run-local.sh.
\set ON_ERROR_STOP on
\set QUIET on

create table t.claims (session text, inquiry_id uuid, claim_token uuid, email_key text, result text);
create table t.violations (seen_at timestamptz default clock_timestamp(), detail text);
create table t.samples (n bigint);
grant all on t.claims, t.violations, t.samples to service_role;

set role service_role;
select t.reset();
update public.website_crm_sync_state set lease_seconds = 60, reconcile_floor_seconds = 60;
-- 400 inquiries over 40 emails, with case/whitespace variants of the same address.
insert into public.website_inquiries (idempotency_key, fields, consent, policy_versions, pricing_version, submitted_at)
select gen_random_uuid(),
       jsonb_build_object('email', case when g % 3 = 0 then upper('user' || (g % 40) || '@example.com')
                                        when g % 3 = 1 then ' user' || (g % 40) || '@example.com '
                                        else 'user' || (g % 40) || '@example.com' end),
       '{}'::jsonb, '{}'::jsonb, 'p', now() - make_interval(secs => g)
  from generate_series(1, 400) g;
reset role;

-- One worker: claim -> "sync" -> record, with commits between steps so other
-- sessions see real interleavings. About 30% of attempts fail and are made due
-- again at once, to keep contention high.
create procedure t.work(p_session text, p_rounds int)
language plpgsql as $$
declare r record; i int; ok boolean;
begin
  for i in 1..p_rounds loop
    for r in select * from public.websites_crm_claim(p_session, 5) loop
      insert into t.claims values (p_session, r.id, r.claim_token, public.websites_crm_email_key(r.fields ->> 'email', r.id), 'claimed');
    end loop;
    commit;
    perform pg_sleep(random() * 0.01);
    for r in select c.inquiry_id, c.claim_token from t.claims c where c.session = p_session and c.result = 'claimed' loop
      if random() < 0.7 then
        ok := public.websites_crm_record_success(r.inquiry_id, r.claim_token, 'ct_' || r.inquiry_id, 'op_' || r.inquiry_id);
        update t.claims set result = case when ok then 'synced' else 'stale' end where claim_token = r.claim_token;
        -- Simulated time: this claim's reconcile window has passed (its own lease only).
        update public.website_crm_sync_leases set expires_at = clock_timestamp() - interval '1 s' where claim_token = r.claim_token;
      else
        perform public.websites_crm_record_failure(r.inquiry_id, r.claim_token, 'server', 'contact', 'unknown', 'contact:503', true);
        update public.website_inquiries set next_attempt_at = now() - interval '1 s' where id = r.inquiry_id and status = 'crm_failed';
        update t.claims set result = 'failed' where claim_token = r.claim_token;
        update public.website_crm_sync_leases set expires_at = clock_timestamp() - interval '1 s' where claim_token = r.claim_token;
      end if;
      commit;
    end loop;
  end loop;
end $$;

-- Sampler: from a separate session, checks the invariant over and over.
create procedure t.sample(p_seconds numeric)
language plpgsql as $$
declare stop_at timestamptz := clock_timestamp() + make_interval(secs => p_seconds); n bigint := 0; bad text;
begin
  while clock_timestamp() < stop_at loop
    select string_agg(k || ' x' || c, ', ') into bad from (
      select public.websites_crm_email_key(fields ->> 'email', id) k, count(*) c
        from public.website_inquiries
       where claim_token is not null and claim_expires_at > clock_timestamp()
       group by 1 having count(*) > 1) d;
    if bad is not null then insert into t.violations (detail) values ('two live claims for one email: ' || bad); end if;
    n := n + 1;
    commit;
    perform pg_sleep(0.02);
  end loop;
  insert into t.samples values (n);
  commit;
end $$;
grant execute on procedure t.work(text, int), t.sample(numeric) to service_role;

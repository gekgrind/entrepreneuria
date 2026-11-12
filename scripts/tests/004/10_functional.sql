-- LOCAL TEST HARNESS ONLY. Run by run-local.sh after 002 and 004 are applied. Synthetic data only.
\set ON_ERROR_STOP on
\set QUIET on

create schema t;
grant usage on schema t to service_role, anon, authenticated;

create function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- SQLSTATE of a statement that is expected to fail, or null if it succeeded. Rolled back either way.
create function t.err(sql text) returns text language plpgsql as $$
begin
  execute sql;
  raise exception 'NOFAIL';
exception
  when others then
    if sqlerrm = 'NOFAIL' then return null; end if;
    return sqlstate;
end $$;

-- The full next-row object for a project, with `patch` applied (what the app sends as p_project).
create function t.nxt(p uuid, patch jsonb) returns jsonb language sql as $$
  select to_jsonb(w) || patch from public.website_projects w where w.id = p
$$;

create function t.audit(ev text, from_s text, to_s text) returns jsonb language sql as $$
  select jsonb_build_object('event', ev, 'from', from_s, 'to', to_s, 'actor', 'owner:test', 'at', '2026-11-20T15:00:00Z', 'detail', null)
$$;

create function t.mk(mode_ text default 'sandbox') returns uuid language sql as $$
  insert into public.website_projects (mode) values (mode_) returning id
$$;

grant execute on all functions in schema t to service_role, anon, authenticated;

set role service_role;

-- ---------------------------------------------------------------------------
do $$
declare
  p uuid := t.mk();
  r text;
begin
  perform t.ok((select version from public.website_projects where id = p) = 0 and (select mode from public.website_projects where id = p) = 'sandbox',
               'a new project starts at version 0 in sandbox mode');

  r := public.website_lifecycle_commit(p, 0, t.nxt(p, '{"state":"qualification_pending","acknowledged_at":"2026-11-20T15:00:00Z"}'),
         'evt-1', t.audit('acknowledge_request', 'preview_requested', 'qualification_pending'), null,
         '[{"template_id":"request_acknowledgement","due_at":"2026-11-20T15:00:00Z"}]');
  perform t.ok(r = 'committed', 'commit applies the event');
  perform t.ok((select version from public.website_projects where id = p) = 1, 'version advanced by one');
  perform t.ok((select count(*) from public.website_project_events where project_id = p and event_id = 'evt-1' and mode = 'sandbox') = 1, 'audit row written with its event id and mode');
  perform t.ok((select delivery from public.website_communication_intents where project_id = p) = 'not_sent', 'intent recorded as not_sent');

  r := public.website_lifecycle_commit(p, 1, t.nxt(p, '{"state":"qualified"}'), 'evt-1', t.audit('qualify', 'qualification_pending', 'qualified'), null, null);
  perform t.ok(r = 'event_exists', 'replaying an event id is a no-op');
  perform t.ok((select state from public.website_projects where id = p) = 'qualification_pending' and (select count(*) from public.website_project_events where project_id = p) = 1,
               'replay changed nothing');

  r := public.website_lifecycle_commit(p, 0, t.nxt(p, '{"state":"qualified"}'), 'evt-2', t.audit('qualify', 'qualification_pending', 'qualified'), null, null);
  perform t.ok(r = 'version_conflict', 'a stale version is refused');
  perform t.ok((select count(*) from public.website_project_events where project_id = p and event_id = 'evt-2') = 0, 'stale commit wrote no audit row');

  perform t.ok(t.err(format($f$select public.website_lifecycle_commit(%L, 1, '{"state":"qualified"}', 'evt-3', %L, null, null)$f$,
                            p, t.audit('qualify', 'qualification_pending', 'qualified'))) = 'P0001',
               'a partial project object is refused (a missing key would null a column)');
  perform t.ok(t.err(format($f$select public.website_lifecycle_commit(%L, 1, %L, '', %L, null, null)$f$,
                            p, t.nxt(p, '{"state":"qualified"}'), t.audit('qualify', 'qualification_pending', 'qualified'))) = 'P0001',
               'an empty event id is refused');
  perform t.ok(t.err(format($f$select public.website_lifecycle_commit(%L, 1, %L, 'evt-x', %L, null, null)$f$,
                            gen_random_uuid(), t.nxt(p, '{}'), t.audit('qualify', 'qualification_pending', 'qualified'))) = 'P0001',
               'an unknown project is refused');

  -- F3: a NULL or negative expected version must never bypass the compare-and-set.
  perform t.ok(t.err(format($f$select public.website_lifecycle_commit(%L, null, %L, 'evt-null', %L, null, null)$f$,
                            p, t.nxt(p, '{"state":"qualified"}'), t.audit('qualify', 'qualification_pending', 'qualified'))) = 'P0001',
               'a NULL expected version is refused');
  perform t.ok(t.err(format($f$select public.website_lifecycle_commit(%L, -1, %L, 'evt-neg', %L, null, null)$f$,
                            p, t.nxt(p, '{"state":"qualified"}'), t.audit('qualify', 'qualification_pending', 'qualified'))) = 'P0001',
               'a negative expected version is refused');
  perform t.ok((select state from public.website_projects where id = p) = 'qualification_pending'
               and (select version from public.website_projects where id = p) = 1
               and (select count(*) from public.website_project_events where project_id = p and event_id in ('evt-null', 'evt-neg')) = 0,
               'refused NULL and negative versions changed nothing');
  r := public.website_lifecycle_commit(p, 1, t.nxt(p, '{"state":"qualified"}'), 'evt-ok-after', t.audit('qualify', 'qualification_pending', 'qualified'), null, null);
  perform t.ok(r = 'committed' and (select version from public.website_projects where id = p) = 2, 'the correct version still commits after the refusals');
  r := public.website_lifecycle_commit(p, 1, t.nxt(p, '{"state":"preview_in_progress"}'), 'evt-stale-after', t.audit('start_preview', 'qualified', 'preview_in_progress'), null, null);
  perform t.ok(r = 'version_conflict' and (select state from public.website_projects where id = p) = 'qualified',
               'a stale version cannot overwrite the newer snapshot');
end $$;

-- Payment path: one charge, one request, one provider event, one project.
do $$
declare
  a uuid := t.mk();
  b uuid := t.mk();
  r text;
  pay jsonb := '{"provider":"sandbox","type":"setup_payment.succeeded","body_sha256":"0000000000000000000000000000000000000000000000000000000000000001","verified_at":"2026-11-20T15:01:00Z","attested":{"requestId":"preq_1","chargeId":"ch_1","amountCents":19900}}';
begin
  r := public.website_lifecycle_commit(a, 0, t.nxt(a, '{"state":"setup_payment_pending","setup_payment_request_id":"preq_1","setup_payment_requested_at":"2026-11-20T15:00:00Z","setup_payment_attempts":1}'),
         'evt-req', t.audit('request_setup_payment', 'approved', 'setup_payment_pending'), null, null);
  perform t.ok(r = 'committed', 'setup payment request recorded');

  r := public.website_lifecycle_commit(a, 1, t.nxt(a, '{"state":"setup_paid","setup_charge_id":"ch_1","setup_paid_at":"2026-11-20T15:01:00Z"}'),
         'prov-evt-1', t.audit('setup_payment_succeeded', 'setup_payment_pending', 'setup_paid'), pay, null);
  perform t.ok(r = 'committed', 'verified payment recorded');
  perform t.ok((select count(*) from public.website_payment_events where provider_event_id = 'prov-evt-1' and project_id = a and mode = 'sandbox'
                  and lifecycle_event = 'setup_payment_succeeded' and attested ->> 'chargeId' = 'ch_1') = 1,
               'payment fact kept with its provenance, in the same transaction as the project update');

  -- The same charge on another project.
  perform t.ok(t.err(format($f$select public.website_lifecycle_commit(%L, 0, %L, 'prov-evt-2', %L, %L, null)$f$,
                            b, t.nxt(b, '{"state":"setup_paid","setup_charge_id":"ch_1","setup_paid_at":"2026-11-20T15:02:00Z","setup_payment_request_id":"preq_2"}'),
                            t.audit('setup_payment_succeeded', 'setup_payment_pending', 'setup_paid'), pay)) = '23505',
               'one charge cannot belong to two projects');
  -- The same payment request on another project.
  perform t.ok(t.err(format($f$select public.website_lifecycle_commit(%L, 0, %L, 'evt-dupreq', %L, null, null)$f$,
                            b, t.nxt(b, '{"state":"setup_payment_pending","setup_payment_request_id":"preq_1"}'),
                            t.audit('request_setup_payment', 'approved', 'setup_payment_pending'))) = '23505',
               'one payment request cannot belong to two projects');
  -- The same provider event id on another project, with a different charge.
  perform t.ok(t.err(format($f$select public.website_lifecycle_commit(%L, 0, %L, 'prov-evt-1', %L, %L, null)$f$,
                            b, t.nxt(b, '{"state":"setup_paid","setup_charge_id":"ch_9","setup_paid_at":"2026-11-20T15:02:00Z","setup_payment_request_id":"preq_9"}'),
                            t.audit('setup_payment_succeeded', 'setup_payment_pending', 'setup_paid'), pay)) is not null,
               'a provider event id cannot be applied twice');
  perform t.ok((select version from public.website_projects where id = b) = 0 and (select count(*) from public.website_project_events where project_id = b) = 0,
               'every refused commit rolled back completely');

  -- A recorded charge cannot be cleared or changed, even by a direct update.
  perform t.ok(t.err(format($f$update public.website_projects set setup_charge_id = null where id = %L$f$, a)) = '23001', 'a recorded charge cannot be cleared');
  perform t.ok(t.err(format($f$update public.website_projects set setup_charge_id = 'ch_other' where id = %L$f$, a)) = '23001', 'a recorded charge cannot be replaced');
  perform t.ok(t.err(format($f$update public.website_projects set setup_paid_at = now() where id = %L$f$, a)) = '23001', 'the payment time cannot be moved');
  -- A charge needs a payment request and a payment time.
  perform t.ok(t.err(format($f$update public.website_projects set setup_charge_id = 'ch_loose' where id = %L$f$, b)) = '23514', 'a charge without a request and payment time is refused');
end $$;

-- Launch and subscription.
do $$
declare
  p uuid := t.mk();
  base jsonb := '{"setup_charge_id":"ch_live","setup_paid_at":"2026-11-20T15:01:00Z","setup_payment_request_id":"preq_live","launched_at":"2026-12-02T09:00:00Z"}';
begin
  perform public.website_lifecycle_commit(p, 0, t.nxt(p, '{"state":"live"}'::jsonb || base), 'evt-live', t.audit('deployment_succeeded', 'launch_approved', 'live'), null, null);
  perform t.ok(t.err(format($f$select public.website_lifecycle_commit(%L, 1, %L, 'evt-sub', %L, null, null)$f$,
                            p, t.nxt(p, '{"subscription_id":"sub_1"}'), t.audit('subscription_activated', 'live', 'live'))) = '23514',
               'a subscription before launch verification is refused by the database');
  perform t.ok(public.website_lifecycle_commit(p, 1, t.nxt(p, '{"launch_verification":{"verifiedAt":"2026-12-02T10:00:00Z","ref":"check-1"}}'), 'evt-verify',
                 t.audit('verify_launch', 'live', 'live'), null, null) = 'committed', 'launch verification recorded');
  perform t.ok(public.website_lifecycle_commit(p, 2, t.nxt(p, '{"subscription_id":"sub_1"}'), 'evt-sub2',
                 t.audit('subscription_activated', 'live', 'live'), null, null) = 'committed', 'a subscription after a verified launch is accepted');
  perform t.ok(t.err(format($f$update public.website_projects set subscription_id = 'sub_2' where id = %L$f$, p)) = '23001', 'a recorded subscription cannot be replaced');
  perform t.ok(t.err(format($f$update public.website_projects set launched_at = launched_at + interval '1 day' where id = %L$f$, p)) = '23001', 'the launch time (billing anchor) cannot move');
  perform t.ok(t.err(format($f$update public.website_projects set launch_verification = null where id = %L$f$, p)) = '23001', 'launch verification cannot be erased');
end $$;

-- Production stays closed and mode is fixed.
do $$
declare
  prod uuid := t.mk('production');
  sbx  uuid := t.mk();
begin
  perform t.ok(t.err(format($f$update public.website_projects set setup_charge_id = 'ch_p', setup_paid_at = now(), setup_payment_request_id = 'preq_p' where id = %L$f$, prod)) = '23514',
               'a production project cannot record a charge (no live provider)');
  perform t.ok(t.err(format($f$update public.website_projects set subscription_id = 'sub_p', launched_at = now(), setup_paid_at = now(), launch_verification = '{}' where id = %L$f$, prod)) = '23514',
               'a production project cannot record a subscription');
  perform t.ok(t.err(format($f$update public.website_projects set mode = 'production' where id = %L$f$, sbx)) = '23001', 'a sandbox project cannot become production');
  perform t.ok(t.err(format($f$update public.website_projects set mode = 'sandbox' where id = %L$f$, prod)) = '23001', 'a production project cannot become sandbox');
  perform t.ok(t.err($f$insert into public.website_projects (mode) values ('staging')$f$) = '23514', 'unknown modes are refused');
  perform t.ok(t.err(format($f$update public.website_projects set state = 'bogus' where id = %L$f$, sbx)) = '23514', 'unknown states are refused');
  perform t.ok(t.err(format($f$update public.website_projects set state = 'closed' where id = %L$f$, sbx)) = '23514', 'closed needs a reason and a time');
end $$;

-- Append-only ledgers.
do $$
begin
  perform t.ok(t.err($f$update public.website_project_events set actor = 'x'$f$) = '23001', 'audit rows cannot be updated');
  perform t.ok(t.err($f$delete from public.website_project_events$f$) = '23001', 'audit rows cannot be deleted');
  perform t.ok(t.err($f$update public.website_payment_events set provider = 'x'$f$) = '23001', 'payment events cannot be updated');
  perform t.ok(t.err($f$delete from public.website_payment_events$f$) = '23001', 'payment events cannot be deleted');
  perform t.ok(t.err($f$insert into public.website_payment_events (provider_event_id, provider, type, project_id) select 'bare', 'sandbox', 'x', id from public.website_projects limit 1$f$) = '23514',
               'a payment event without provenance is refused');
  perform t.ok(t.err($f$insert into public.website_payment_events (provider_event_id, provider, type, project_id, mode, lifecycle_event, attested, body_sha256, verified_at)
                        select 'badhash', 'sandbox', 'x', id, 'sandbox', 'setup_payment_succeeded', '{}', 'not-a-hash', now() from public.website_projects limit 1$f$) = '23514',
               'the body digest must be a sha256 hex string');
end $$;

-- Rejections and intents.
do $$
declare p uuid := (select id from public.website_projects limit 1);
begin
  insert into public.website_project_rejections (event_id, project_id, event, actor, at, code, reason)
  values ('evt-r', 'p-unknown', 'qualify', 'owner:x', '2026-11-20T15:00:00.000Z', 'unknown_project', 'no project p-unknown');
  perform t.ok(true, 'a rejection is recorded, even for an unknown project id');
  perform t.ok(t.err($f$insert into public.website_project_rejections (event_id, project_id, event, actor, at, code, reason) values ('e','p','q','a','t','made_up','r')$f$) = '23514', 'unknown rejection codes are refused');
  perform t.ok(t.err(format($f$insert into public.website_project_rejections (event_id, project_id, event, actor, at, code, reason) values ('e','p','q','a','t','invalid_envelope',%L)$f$, repeat('x', 301))) = '23514', 'oversized rejection text is refused');
  perform t.ok(t.err($f$update public.website_project_rejections set reason = 'edited'$f$) = '23001', 'rejections are append-only');
  perform t.ok(t.err(format($f$insert into public.website_communication_intents (project_id, template_id, trigger_event_id, mode, due_at, delivery) values (%L,'t','e','sandbox',now(),'sent')$f$, p)) = '23514',
               'an intent can never be marked sent in this migration');
  insert into public.website_communication_intents (project_id, template_id, trigger_event_id, mode, due_at) values (p, 'dup', 'e1', 'sandbox', now());
  perform t.ok(t.err(format($f$insert into public.website_communication_intents (project_id, template_id, trigger_event_id, mode, due_at) values (%L,'dup','e1','sandbox',now())$f$, p)) = '23505', 'an intent is recorded once per project, template and event');
end $$;

-- Tenant isolation: only service_role touches any of it.
reset role;
do $$
declare tbl text; who text; fn text;
begin
  foreach who in array array['anon', 'authenticated'] loop
    foreach tbl in array array['website_inquiries', 'website_projects', 'website_project_events', 'website_payment_events',
                               'website_project_rejections', 'website_communication_intents'] loop
      execute format('set role %I', who);
      perform t.ok(t.err(format('select count(*) from public.%I', tbl)) = '42501', format('%s cannot read %s', who, tbl));
      perform t.ok(t.err(format('insert into public.%I default values', tbl)) = '42501', format('%s cannot write %s', who, tbl));
      reset role;
    end loop;
    execute format('set role %I', who);
    perform t.ok(t.err($f$select public.website_lifecycle_commit(gen_random_uuid(), 0, '{}', 'x', '{}', null, null)$f$) = '42501', format('%s cannot call the commit function', who));
    reset role;
  end loop;
  perform t.ok((select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname like 'website\_%' and relkind = 'r' and not relrowsecurity) = 0,
               'row level security is enabled on every website_* table');
  perform t.ok((select count(*) from pg_policy where polrelid::regclass::text like 'public.website\_%') = 0, 'no RLS policies: service role only');
end $$;

\echo 'FUNCTIONAL: ALL PASSED'

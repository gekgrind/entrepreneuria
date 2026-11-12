-- LOCAL TEST HARNESS ONLY. Functional tests for migration 003.
-- Runs after 00_supabase_roles.sql, 002, 003 and 05_test_helpers.sql. Each block raises on failure.
\set ON_ERROR_STOP on
\set QUIET on


-- ---------------------------------------------------------------- access ---
do $$ begin perform t.ok(
  (select relrowsecurity from pg_class where oid = 'public.website_crm_sync_leases'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.website_crm_sync_state'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.website_crm_sync_alerts'::regclass),
  'RLS enabled on the 3 new tables'); end $$;

do $$
declare r text; t_name text; f text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    foreach t_name in array array['website_inquiries', 'website_crm_sync_leases', 'website_crm_sync_state', 'website_crm_sync_alerts'] loop
      perform t.ok(not has_table_privilege(r, 'public.' || t_name, 'SELECT')
                   and not has_table_privilege(r, 'public.' || t_name, 'INSERT')
                   and not has_table_privilege(r, 'public.' || t_name, 'UPDATE')
                   and not has_table_privilege(r, 'public.' || t_name, 'DELETE'),
                   r || ' has no privileges on ' || t_name);
    end loop;
    foreach f in array array[
      'public.websites_crm_email_key(text, uuid)',
      'public.websites_crm_claim(text, integer, uuid)',
      'public.websites_crm_record_success(uuid, uuid, text, text, jsonb)',
      'public.websites_crm_record_failure(uuid, uuid, text, text, text, text, boolean, bigint, text, jsonb)',
      'public.websites_crm_release_claim(uuid, uuid)',
      'public.websites_crm_requeue(uuid)',
      'public.websites_crm_sync_health()'] loop
      perform t.ok(not has_function_privilege(r, f, 'EXECUTE'), r || ' cannot execute ' || f);
      perform t.ok(has_function_privilege('service_role', f, 'EXECUTE'), 'service_role can execute ' || f);
    end loop;
  end loop;
  perform t.ok(not has_function_privilege('public', 'public.websites_crm_claim(text, integer, uuid)', 'EXECUTE'),
               'PUBLIC cannot execute websites_crm_claim');
end $$;

-- Every new function is SECURITY INVOKER with a pinned empty search_path.
do $$ begin perform t.ok(
  (select bool_and(not p.prosecdef and p.proconfig @> array['search_path=""'])
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'websites_crm%'),
  'all websites_crm* functions are security invoker with search_path=""'); end $$;

-- Prove the denial at runtime, not just in the catalog.
set role anon;
do $$ begin
  begin perform 1 from public.website_inquiries limit 1; raise exception 'anon read inquiries';
  exception when insufficient_privilege then raise notice 'ok - anon select on website_inquiries denied'; end;
  begin perform public.websites_crm_claim('anon', 1); raise exception 'anon claimed';
  exception when insufficient_privilege then raise notice 'ok - anon execute websites_crm_claim denied'; end;
end $$;
reset role;
set role authenticated;
do $$ begin
  begin perform 1 from public.website_crm_sync_alerts limit 1; raise exception 'authenticated read alerts';
  exception when insufficient_privilege then raise notice 'ok - authenticated select on alerts denied'; end;
end $$;
reset role;

-- All remaining tests run as service_role, proving its grants are enough.
set role service_role;

-- --------------------------------------------------------- constraints ---
do $$
declare v uuid;
begin
  perform t.reset();
  v := t.mk('constraint@example.com');
  begin update public.website_inquiries set status = 'crm_synced' where id = v; raise exception 'synced without ids';
  exception when check_violation then perform t.ok(true, 'crm_synced requires CRM ids'); end;
  begin update public.website_inquiries set status = 'needs_attention' where id = v; raise exception 'attention without reason';
  exception when check_violation then perform t.ok(true, 'needs_attention requires timestamp and reason'); end;
  begin update public.website_inquiries set claim_token = gen_random_uuid() where id = v; raise exception 'half claim';
  exception when check_violation then perform t.ok(true, 'claim columns must be set together'); end;
  begin update public.website_inquiries set status = 'bogus' where id = v; raise exception 'bogus status';
  exception when check_violation then perform t.ok(true, 'unknown status rejected'); end;
  begin update public.website_inquiries set last_warnings = '{}'::jsonb where id = v; raise exception 'warnings object';
  exception when check_violation then perform t.ok(true, 'last_warnings must be an array'); end;
  -- 002-era app writes remain valid.
  update public.website_inquiries set status = 'crm_failed', crm_attempts = 1, last_error = 'contact:503' where id = v;
  update public.website_inquiries set status = 'crm_synced', crm_contact_id = 'ct', crm_opportunity_id = 'op' where id = v;
  perform t.ok(true, '002-era status updates still accepted');
end $$;

-- ----------------------------------------------------------- claiming ---
do $$
declare a uuid; b uuid; c uuid; n int; tok uuid; ok boolean;
begin
  perform t.reset();
  a := t.mk('Same@Example.com');
  b := t.mk(' same@example.com ');   -- same email, different case/whitespace
  c := t.mk('other@example.com');

  select count(*) into n from public.websites_crm_claim('w1', 10);
  perform t.ok(n = 2, 'one claim per email: 3 due rows, 2 distinct emails -> 2 claims');
  perform t.ok((select count(*) from public.website_crm_sync_leases) = 2, 'two email leases');
  perform t.ok((select crm_attempts from public.website_inquiries where id = c) = 1, 'claim counts an attempt');
  perform t.ok((select next_attempt_at between now() + interval '299 s' and now() + interval '301 s'
                  from public.website_inquiries where id = c), 'claim sets pessimistic next_attempt_at = +reconcile floor');
  perform t.ok((select count(*) from public.websites_crm_claim('w2', 10)) = 0, 'nothing more is claimable while leased');
  perform t.ok((select bool_and(expires_at between now() + interval '299 s' and now() + interval '301 s') from public.website_crm_sync_leases),
               'email lease lasts until the reconcile floor');

  -- Finish the same-email row that was claimed. Its lease is kept until the
  -- reconcile floor (GHL may need time to index the new opportunity).
  select id, claim_token into a, tok from public.website_inquiries
   where claim_token is not null and lower(btrim(fields->>'email')) = 'same@example.com';
  ok := public.websites_crm_record_success(a, tok, 'ct_1', 'op_1', '["custom_field_unmapped:business_type"]'::jsonb);
  perform t.ok(ok, 'record_success with the current token');
  perform t.ok((select status = 'crm_synced' and claim_token is null and crm_synced_at is not null
                       and last_warnings = '["custom_field_unmapped:business_type"]'::jsonb
                  from public.website_inquiries where id = a), 'synced row is unclaimed, stamped and keeps warnings');
  perform t.ok((select expires_at between now() + interval '299 s' and now() + interval '301 s'
                  from public.website_crm_sync_leases where inquiry_id = a), 'after success the email lease is held until the floor');
  perform t.ok((select count(*) from public.websites_crm_claim('w2', 10)) = 0, 'sibling waits for the floor after a success');
  update public.website_crm_sync_leases set expires_at = now() - interval '1 s' where inquiry_id = a;
  perform t.ok((select count(*) from public.websites_crm_claim('w2', 10)) = 1, 'then the second same-email inquiry is claimable');
  perform t.ok(not public.websites_crm_record_success(a, tok, 'ct_1', 'op_1'), 'a synced row cannot be recorded twice');
end $$;

do $$ begin
  begin perform public.websites_crm_claim('w', 0); raise exception 'limit 0';
  exception when raise_exception then perform t.ok(true, 'p_limit validated'); end;
  begin perform public.websites_crm_claim('w', null); raise exception 'limit null';
  exception when raise_exception then perform t.ok(true, 'NULL p_limit rejected (would mean no limit)'); end;
  begin perform public.websites_crm_claim(null, 5); raise exception 'worker null';
  exception when raise_exception then perform t.ok(true, 'NULL worker rejected'); end;
  begin update public.website_crm_sync_state set lease_seconds = 30; raise exception 'lease 30';
  exception when check_violation then perform t.ok(true, 'stored lease_seconds validated'); end;
  begin update public.website_crm_sync_state set lease_seconds = 600, reconcile_floor_seconds = 300; raise exception 'floor < lease';
  exception when check_violation then perform t.ok(true, 'stored floor must be >= lease'); end;
  begin update public.website_crm_sync_state set max_attempts = null; raise exception 'max null';
  exception when not_null_violation then perform t.ok(true, 'stored max_attempts required'); end;
  begin perform public.websites_crm_claim('', 5); raise exception 'empty worker';
  exception when raise_exception then perform t.ok(true, 'worker id validated'); end;
end $$;

-- ------------------------------------------------- stale-claim fencing ---
do $$
declare v uuid; old_tok uuid; new_tok uuid;
begin
  perform t.reset();
  v := t.mk('stale@example.com');
  select claim_token into old_tok from public.websites_crm_claim('slow-worker', 1);
  -- Simulate: the slow worker's lease and the reconcile floor both passed.
  update public.website_inquiries set claim_expires_at = now() - interval '1 s', next_attempt_at = now() - interval '1 s' where id = v;
  update public.website_crm_sync_leases set expires_at = now() - interval '1 s';
  select claim_token into new_tok from public.websites_crm_claim('fresh-worker', 1);
  perform t.ok(new_tok is not null and new_tok <> old_tok, 'expired claim is reclaimed with a new token');
  perform t.ok((select crm_attempts from public.website_inquiries where id = v) = 2, 'the interrupted attempt still counts');
  perform t.ok(not public.websites_crm_record_success(v, old_tok, 'ct_x', 'op_x'), 'stale worker cannot record success');
  perform t.ok(public.websites_crm_record_failure(v, old_tok, 'server', 'contact', 'unknown', 'contact:503', true) = 'stale_claim',
               'stale worker cannot record failure');
  perform t.ok((select claim_token = new_tok from public.website_inquiries where id = v), 'current claim untouched');
  perform t.ok((select count(*) = 1 and bool_and(claim_token = new_tok) from public.website_crm_sync_leases), 'lease belongs to the fresh worker');
  perform t.ok(public.websites_crm_record_success(v, new_tok, 'ct_y', 'op_y'), 'fresh worker records success');
end $$;

-- An expired claim alone is not enough: the reconcile floor must pass too.
do $$
declare v uuid;
begin
  perform t.reset();
  v := t.mk('crash@example.com');
  perform public.websites_crm_claim('crashed', 1);
  update public.website_inquiries set claim_expires_at = now() - interval '1 s' where id = v;
  update public.website_crm_sync_leases set expires_at = now() - interval '1 s';
  perform t.ok((select count(*) from public.websites_crm_claim('w', 1)) = 0, 'crashed attempt waits for the reconcile floor');
  perform t.due(v);
  perform t.ok((select count(*) from public.websites_crm_claim('w', 1)) = 1, 'then it is retried');
end $$;

-- A frozen worker's email lease also holds back sibling inquiries for the same email.
do $$
declare a uuid; b uuid;
begin
  perform t.reset();
  a := t.mk('frozen@example.com');
  perform public.websites_crm_claim('frozen-worker', 1);
  b := t.mk('frozen@example.com');
  -- Row lease expired (120 s) but the email lease (until the floor) has not.
  update public.website_inquiries set claim_expires_at = now() - interval '1 s' where id = a;
  perform t.ok((select count(*) from public.websites_crm_claim('w', 5)) = 0, 'sibling waits while the frozen worker''s email lease holds');
  update public.website_crm_sync_leases set expires_at = now() - interval '1 s';
  perform t.ok((select count(*) from public.websites_crm_claim('w', 5)) = 1, 'sibling proceeds once the email lease expires');
end $$;

-- ------------------------------------------------ backoff and the cap ---
do $$
declare v uuid; tok uuid; st text; i int; delays interval[] := array[
  interval '1 minute', interval '5 minutes', interval '30 minutes', interval '2 hours', interval '12 hours'];
  d interval;
begin
  perform t.reset();
  v := t.mk('backoff@example.com');
  for i in 1..5 loop
    select claim_token into tok from public.websites_crm_claim('w', 1);
    st := public.websites_crm_record_failure(v, tok, 'server', 'contact', 'unknown', 'contact:503', true, null, null, '[]'::jsonb);
    select next_attempt_at - now() into d from public.website_inquiries where id = v;
    perform t.ok(st = 'crm_failed' and d between delays[i] - interval '2 s' and delays[i] + interval '2 s',
                 format('attempt %s failed -> crm_failed, retry in %s', i, delays[i]));
    perform t.due(v);
  end loop;
  select claim_token into tok from public.websites_crm_claim('w', 1);
  st := public.websites_crm_record_failure(v, tok, 'server', 'contact', 'unknown', 'contact:503', true);
  perform t.ok(st = 'needs_attention', 'attempt 6 failed -> needs_attention');
  perform t.ok((select crm_attempts = 6 and needs_attention_reason = 'attempts_exhausted' and claim_token is null
                  from public.website_inquiries where id = v), 'reason attempts_exhausted, unclaimed');
  perform t.ok((select count(*) from public.website_crm_sync_alerts where inquiry_id = v and kind = 'needs_attention'
                  and delivery_status = 'pending') = 1, 'one pending alert queued in the same transaction');
  perform t.ok((select count(*) from public.websites_crm_claim('w', 5)) = 0, 'needs_attention is never claimed');
  perform t.ok((select payload ?& array['category', 'step', 'attempts'] and not payload ? 'email'
                  from public.website_crm_sync_alerts where inquiry_id = v), 'alert payload holds no PII');
end $$;

-- Unknown outcome at opportunity/note: at least the reconcile floor, even on attempt 1.
do $$
declare v uuid; tok uuid; d interval;
begin
  perform t.reset();
  v := t.mk('ambiguous@example.com');
  select claim_token into tok from public.websites_crm_claim('w', 1);
  perform public.websites_crm_record_failure(v, tok, 'unknown_outcome', 'opportunity', 'unknown', 'opportunity:network', true, null, 'ct_9');
  select next_attempt_at - now() into d from public.website_inquiries where id = v;
  perform t.ok(d >= interval '299 s', 'ambiguous opportunity create waits >= 5 min before re-search');
  perform t.ok((select crm_contact_id = 'ct_9' and last_failure_step = 'opportunity' and last_outcome = 'unknown'
                  from public.website_inquiries where id = v), 'contact id, step and outcome persisted');
end $$;

-- Non-retryable rejection: needs_attention immediately; alert dedupe across requeue episodes.
do $$
declare v uuid; tok uuid; st text;
begin
  perform t.reset();
  v := t.mk('rejected@example.com');
  select claim_token into tok from public.websites_crm_claim('w', 1);
  st := public.websites_crm_record_failure(v, tok, 'rejected', 'contact', 'rejected', 'contact:422', false);
  perform t.ok(st = 'needs_attention', 'non-retryable -> needs_attention on attempt 1');
  perform t.ok((select needs_attention_reason = 'non_retryable:rejected' from public.website_inquiries where id = v), 'reason recorded');
  perform t.ok(public.websites_crm_requeue(v), 'owner requeue');
  perform t.ok((select status = 'crm_failed' and crm_attempts = 0 and manual_requeues = 1 and needs_attention_at is null
                  from public.website_inquiries where id = v), 'requeue resets the attempt budget and counts the requeue');
  perform t.ok(not public.websites_crm_requeue(v), 'requeue only applies to needs_attention');
  select claim_token into tok from public.websites_crm_claim('w', 1);
  perform public.websites_crm_record_failure(v, tok, 'rejected', 'contact', 'rejected', 'contact:422', false);
  perform t.ok((select count(*) from public.website_crm_sync_alerts where inquiry_id = v) = 2, 'second episode gets its own alert');
end $$;

-- Rate limit: attempt refunded, queue paused, longer GHL wait honored.
do $$
declare a uuid; b uuid; tok uuid; d interval;
begin
  perform t.reset();
  a := t.mk('rl-a@example.com');
  b := t.mk('rl-b@example.com');
  select claim_token into tok from public.websites_crm_claim('w', 1) where id = a;
  if tok is null then
    -- The claim may have picked b first; normalize.
    select id, claim_token into a, tok from public.website_inquiries where claim_token is not null;
  end if;
  perform public.websites_crm_record_failure(a, tok, 'rate_limited', 'contact', 'rejected', 'contact:429', true, 3600000);
  select next_attempt_at - now() into d from public.website_inquiries where id = a;
  perform t.ok(d >= interval '3599 s', 'retry honors the 1 h X-RateLimit wait over the 1 min backoff');
  perform t.ok((select crm_attempts = 0 and rate_limited_until > now() + interval '59 min' from public.website_inquiries where id = a),
               'rate-limited attempt refunded and wait persisted');
  perform t.ok((select paused_until > now() + interval '59 min' and pause_reason = 'rate_limited' from public.website_crm_sync_state),
               'queue paused for the whole location');
  update public.website_inquiries set next_attempt_at = now() - interval '1 s';
  perform t.ok((select count(*) from public.websites_crm_claim('w', 10)) = 0, 'paused queue claims nothing');
  perform t.ok((public.websites_crm_sync_health() ->> 'pause_reason') = 'rate_limited', 'health reports the pause');
end $$;

-- Auth failure: refunded, paused >= 15 min, one alert per hour.
do $$
declare v uuid; tok uuid;
begin
  perform t.reset();
  v := t.mk('auth@example.com');
  select claim_token into tok from public.websites_crm_claim('w', 1);
  perform public.websites_crm_record_failure(v, tok, 'auth', 'contact', 'rejected', 'contact:401', true);
  perform t.ok((select crm_attempts = 0 and status = 'crm_failed' from public.website_inquiries where id = v), 'auth failure refunds the attempt');
  perform t.ok((select paused_until >= now() + interval '899 s' and pause_reason = 'auth' from public.website_crm_sync_state),
               'auth failure pauses the queue >= 15 min');
  update public.website_crm_sync_state set paused_until = null;
  perform t.due(v);
  select claim_token into tok from public.websites_crm_claim('w', 1);
  perform public.websites_crm_record_failure(v, tok, 'auth', 'contact', 'rejected', 'contact:401', true);
  perform t.ok((select count(*) from public.website_crm_sync_alerts where kind = 'auth_failure') = 1, 'auth alert deduped per hour');
end $$;

-- Interrupted final attempt -> needs_attention via the claim sweep.
do $$
declare v uuid;
begin
  perform t.reset();
  v := t.mk('final-crash@example.com');
  update public.website_inquiries set status = 'crm_failed', crm_attempts = 6, next_attempt_at = now() - interval '1 s' where id = v;
  perform t.ok((select count(*) from public.websites_crm_claim('w', 5)) = 0, 'exhausted row is not claimed again');
  perform t.ok((select status = 'needs_attention' and needs_attention_reason = 'attempts_exhausted_interrupted'
                  from public.website_inquiries where id = v), 'swept to needs_attention');
  perform t.ok((select count(*) from public.website_crm_sync_alerts where inquiry_id = v) = 1, 'with one alert');
end $$;

-- Graceful release.
do $$
declare v uuid; tok uuid;
begin
  perform t.reset();
  v := t.mk('release@example.com');
  select claim_token into tok from public.websites_crm_claim('w', 1);
  perform t.ok(public.websites_crm_release_claim(v, tok), 'release with the current token');
  perform t.ok((select crm_attempts = 0 and claim_token is null from public.website_inquiries where id = v), 'attempt refunded');
  perform t.ok((select count(*) from public.website_crm_sync_leases) = 0, 'lease removed');
  perform t.ok((select count(*) from public.websites_crm_claim('w', 1)) = 1, 'immediately claimable again');
end $$;

-- M3: one busy email can't starve the rest of the queue.
do $$
declare n int; e int;
begin
  perform t.reset();
  perform t.mk('busy@example.com') from generate_series(1, 40);
  update public.website_inquiries set next_attempt_at = now() - interval '1 hour';  -- busy rows are the oldest
  perform t.mk('other' || g || '@example.com') from generate_series(1, 30) g;
  select count(*), count(distinct public.websites_crm_email_key(fields ->> 'email', id)) into n, e
    from public.websites_crm_claim('w', 10);
  perform t.ok(n = 10 and e = 10, format('limit 10 claims 10 distinct emails despite 40 queued for one (%s claims, %s emails)', n, e));
  select count(*) into n from public.websites_crm_claim('w', 10);
  perform t.ok(n = 10, 'next call claims 10 more (busy email skipped while leased)');
end $$;

-- M4: claim one specific inquiry (Phase 2 fast path).
do $$
declare a uuid; b uuid; c uuid; n int; got uuid;
begin
  perform t.reset();
  a := t.mk('old@example.com');
  update public.website_inquiries set next_attempt_at = now() - interval '1 hour' where id = a;
  b := t.mk('fresh@example.com');
  select count(*), max(id::text)::uuid into n, got from public.websites_crm_claim('fast', 1, b);
  perform t.ok(n = 1 and got = b, 'p_only_id claims exactly that inquiry, not the oldest one');
  perform t.ok((select claim_token is null from public.website_inquiries where id = a), 'older inquiry left for the scheduled worker');
  c := t.mk('fresh@example.com');
  perform t.ok((select count(*) from public.websites_crm_claim('fast', 1, c)) = 0, 'p_only_id still respects the email lease');
  perform t.ok((select count(*) from public.websites_crm_claim('fast', 1, b)) = 0, 'an already-claimed inquiry is not claimed again');
end $$;

-- M2: after an ambiguous failure the email stays leased until the floor; after a clean rejection it is free.
do $$
declare a uuid; b uuid; tok uuid;
begin
  perform t.reset();
  a := t.mk('sib@example.com');
  select claim_token into tok from public.websites_crm_claim('w', 1, a);
  b := t.mk('sib@example.com');
  perform public.websites_crm_record_failure(a, tok, 'unknown_outcome', 'opportunity', 'unknown', 'opportunity:network', true, null, 'ct_1');
  perform t.ok((select count(*) from public.website_crm_sync_leases where expires_at > now() + interval '299 s') = 1,
               'ambiguous failure keeps the email lease for the floor');
  perform t.ok((select count(*) from public.websites_crm_claim('w', 5, b)) = 0, 'sibling cannot search GHL before the floor');

  perform t.reset();
  a := t.mk('sib2@example.com');
  select claim_token into tok from public.websites_crm_claim('w', 1, a);
  b := t.mk('sib2@example.com');
  perform public.websites_crm_record_failure(a, tok, 'server', 'contact', 'rejected', 'contact:400', true);
  perform t.ok((select count(*) from public.website_crm_sync_leases) = 0, 'a failure that created nothing frees the lease');
  perform t.ok((select count(*) from public.websites_crm_claim('w', 5, b)) = 1, 'sibling proceeds at once');
end $$;

-- Retry-after is capped at 24 h (no timestamp overflow).
do $$
declare v uuid; tok uuid;
begin
  perform t.reset();
  v := t.mk('cap@example.com');
  select claim_token into tok from public.websites_crm_claim('w', 1);
  perform public.websites_crm_record_failure(v, tok, 'rate_limited', 'contact', 'rejected', 'contact:429', true, 9223372036854775807);
  perform t.ok((select next_attempt_at <= now() + interval '24 hours 1 minute' from public.website_inquiries where id = v),
               'huge retry_after_ms capped at 24 h');
end $$;

-- A missing config row is an error, never a silent no-op.
do $$ begin
  perform t.reset();
  delete from public.website_crm_sync_state;
  begin perform public.websites_crm_claim('w', 1); raise exception 'claimed without config';
  exception when raise_exception then perform t.ok(sqlerrm like '%state row missing%', 'claim fails loudly without the config row'); end;
  insert into public.website_crm_sync_state (id) values (true);
end $$;

-- Health is counts only.
do $$
declare h jsonb := public.websites_crm_sync_health();
begin
  perform t.ok(h ?& array['received', 'retrying', 'needs_attention', 'claimed', 'expired_claims', 'oldest_unsynced_minutes',
                          'paused_until', 'pause_reason', 'alerts_pending', 'alerts_failed'], 'health has the expected keys');
  perform t.ok(h::text !~* '@|test person', 'health has no PII');
end $$;

-- Input validation on recording.
do $$
declare v uuid; tok uuid;
begin
  perform t.reset();
  v := t.mk('validate@example.com');
  select claim_token into tok from public.websites_crm_claim('w', 1);
  begin perform public.websites_crm_record_success(v, tok, '', 'op'); raise exception 'empty contact id';
  exception when raise_exception then perform t.ok(true, 'record_success requires ids'); end;
  begin perform public.websites_crm_record_failure(v, tok, 'bogus', 'contact', 'unknown', 'x', true); raise exception 'bogus category';
  exception when raise_exception then perform t.ok(true, 'unknown failure category rejected with a clear error'); end;
  begin perform public.websites_crm_record_failure(v, tok, null, 'contact', 'unknown', 'x', true); raise exception 'null category';
  exception when raise_exception then perform t.ok(true, 'NULL category rejected'); end;
  begin perform public.websites_crm_record_failure(v, tok, 'server', 'contact', 'unknown', 'x', null); raise exception 'null retryable';
  exception when raise_exception then perform t.ok(true, 'NULL retryable rejected'); end;
  begin perform public.websites_crm_record_failure(v, tok, 'server', null, 'unknown', 'x', true); raise exception 'null step';
  exception when raise_exception then perform t.ok(true, 'NULL step rejected'); end;
  begin perform public.websites_crm_record_failure(v, tok, 'server', 'contact', 'maybe', 'x', true); raise exception 'bad outcome';
  exception when raise_exception then perform t.ok(true, 'invalid outcome rejected'); end;
  perform t.ok((select claim_token = tok from public.website_inquiries where id = v), 'failed validation leaves the claim intact');
end $$;

reset role;
select t.reset();
\echo 'FUNCTIONAL: ALL PASSED'

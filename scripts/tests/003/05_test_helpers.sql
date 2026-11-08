-- LOCAL TEST HARNESS ONLY. Shared helpers (schema t) for the 003 test files.
\set ON_ERROR_STOP on
\set QUIET on

create schema t;
grant usage on schema t to service_role;

create function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Synthetic inquiry (example.com only).
create function t.mk(p_email text) returns uuid language sql as $$
  insert into public.website_inquiries (idempotency_key, fields, consent, policy_versions, pricing_version, submitted_at)
  values (gen_random_uuid(), jsonb_build_object('email', p_email, 'name', 'Test Person'), '{"sms_consent": false}'::jsonb,
          '{}'::jsonb, '2026-11-06.v1', now())
  returning id
$$;

-- Make a row due again without waiting (tests can't move the clock).
create function t.due(p_id uuid) returns void language sql as $$
  update public.website_inquiries set next_attempt_at = now() - interval '1 second' where id = p_id
$$;

-- Wipe queue state between tests.
create function t.reset() returns void language sql as $$
  delete from public.website_crm_sync_alerts;
  delete from public.website_crm_sync_leases;
  delete from public.website_inquiries;
  update public.website_crm_sync_state set paused_until = null, pause_reason = null,
    max_attempts = 6, lease_seconds = 120, reconcile_floor_seconds = 300;
$$;
grant execute on all functions in schema t to service_role;

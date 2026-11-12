-- LOCAL TEST HARNESS ONLY. Run by run-local.sh after 003.down: verifies 002 is restored.
\set ON_ERROR_STOP on
\set QUIET on
do $$
begin
  perform t.ok(to_regclass('public.website_crm_sync_leases') is null
               and to_regclass('public.website_crm_sync_alerts') is null
               and to_regclass('public.website_crm_sync_state') is null, '003 tables dropped');
  perform t.ok(not exists (select 1 from pg_proc where proname like 'websites_crm%'), '003 functions dropped');
  perform t.ok(not exists (select 1 from information_schema.columns
                            where table_name = 'website_inquiries' and column_name in ('next_attempt_at', 'claim_token', 'needs_attention_at')),
               '003 columns dropped');
  perform t.ok((select count(*) from public.website_inquiries where fields ->> 'email' = 'legacy-synced@example.com'
                  and status = 'crm_synced' and crm_contact_id = 'ct_legacy') = 1, '002-era row survives with CRM ids');
  perform t.ok((select status from public.website_inquiries where fields ->> 'email' = 'attention@example.com') = 'crm_failed',
               'needs_attention mapped back to crm_failed');
  begin
    update public.website_inquiries set status = 'needs_attention' where fields ->> 'email' = 'attention@example.com';
    raise exception 'needs_attention accepted after rollback';
  exception when check_violation then perform t.ok(true, '002 status check restored'); end;
  perform t.ok(to_regclass('public.website_projects') is not null, '002 tables intact');
end $$;
\echo 'ROUNDTRIP: ALL PASSED'

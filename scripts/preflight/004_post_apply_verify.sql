-- Post-apply verification for 004_websites_lifecycle.sql. READ-ONLY. Prints counts and yes/no only.
--
--   psql -X -v ON_ERROR_STOP=1 -f scripts/preflight/004_post_apply_verify.sql "$DATABASE_URL"
--
-- Compare the info counts with the preflight's. Any FAIL means: stop, do not release anything that uses 004,
-- and decide between the down migration and a restore (see docs/websites/MIGRATION-RUNBOOK-004.md).
\set ON_ERROR_STOP on
begin read only;

do $$
declare n bigint; t text; expected_not_valid constant text[] := array[
  'website_projects_subscription_after_launch', 'website_projects_charge_after_payment',
  'website_projects_no_production_money_yet', 'website_payment_events_provenance'];
begin
  foreach t in array array['website_project_rejections', 'website_communication_intents'] loop
    if to_regclass('public.' || t) is null then raise exception 'FAIL: table % is missing', t; end if;
  end loop;
  if to_regprocedure('public.website_lifecycle_commit(uuid,integer,jsonb,text,jsonb,jsonb,jsonb)') is null then raise exception 'FAIL: commit function missing'; end if;
  raise notice 'ok - new tables and the commit function exist';

  select count(*) into n from pg_class
   where relnamespace = 'public'::regnamespace and relname like 'website\_%' and relkind = 'r' and not relrowsecurity;
  if n > 0 then raise exception 'FAIL: % website_* table(s) without row level security', n; end if;
  if exists (select 1 from pg_policy where polrelid::regclass::text like 'public.website\_%') then raise exception 'FAIL: unexpected RLS policy on a website_* table'; end if;
  raise notice 'ok - RLS enabled on every website_* table, no policies';

  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and table_name like 'website\_%' and grantee in ('anon', 'authenticated');
  if n > 0 then raise exception 'FAIL: anon/authenticated hold % privilege(s) on website_* tables', n; end if;
  if has_function_privilege('anon', 'public.website_lifecycle_commit(uuid,integer,jsonb,text,jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.website_lifecycle_commit(uuid,integer,jsonb,text,jsonb,jsonb,jsonb)', 'execute') then
    raise exception 'FAIL: anon or authenticated can execute the commit function';
  end if;
  if not has_function_privilege('service_role', 'public.website_lifecycle_commit(uuid,integer,jsonb,text,jsonb,jsonb,jsonb)', 'execute') then
    raise exception 'FAIL: service_role cannot execute the commit function';
  end if;
  raise notice 'ok - only service_role has table and function access';

  select count(*) into n from pg_trigger
   where tgrelid in ('public.website_projects'::regclass, 'public.website_project_events'::regclass,
                     'public.website_payment_events'::regclass, 'public.website_project_rejections'::regclass)
     and tgname in ('website_projects_guard', 'website_project_events_append_only', 'website_payment_events_append_only', 'website_project_rejections_append_only')
     and tgenabled = 'O';
  if n <> 4 then raise exception 'FAIL: expected 4 enabled guard triggers, found %', n; end if;
  raise notice 'ok - guard and append-only triggers enabled';

  select count(*) into n from pg_constraint
   where conrelid in ('public.website_projects'::regclass, 'public.website_payment_events'::regclass)
     and conname = any (expected_not_valid) and not convalidated;
  if n <> 4 then raise exception 'FAIL: expected the 4 NOT VALID constraints, found % not validated', n; end if;
  raise notice 'ok - the 4 constraints that reach 002-era rows are NOT VALID, as designed';

  select count(*) into n from pg_constraint where conrelid = 'public.website_projects'::regclass and conname = 'website_projects_mode_check' and convalidated;
  if n <> 1 then raise exception 'FAIL: mode check missing or not validated'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'website_projects_setup_charge_uq')
     or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'website_projects_setup_request_uq') then
    raise exception 'FAIL: unique charge or request index missing';
  end if;
  raise notice 'ok - mode check and unique charge/request indexes present';

  select count(*) into n from public.website_projects where mode <> 'sandbox';
  if n > 0 then raise exception 'FAIL: % project(s) are not sandbox (nothing should be production yet)', n; end if;
  select count(*) into n from public.website_projects where setup_charge_id is not null or subscription_id is not null;
  raise notice 'info - projects holding a charge or subscription (compare with the preflight): %', n;
  select count(*) into n from public.website_projects;
  raise notice 'info - website_projects rows: %', n;
  select count(*) into n from public.website_project_events;
  raise notice 'info - website_project_events rows: %', n;
  select count(*) into n from public.website_payment_events;
  raise notice 'info - website_payment_events rows: %', n;
  select count(*) into n from public.website_project_rejections;
  raise notice 'info - website_project_rejections rows (expect 0 right after apply): %', n;
end $$;

rollback;
\echo 'POST-APPLY 004: PASSED (read-only; nothing changed)'

-- Preflight for 004_websites_lifecycle.sql. READ-ONLY: opens a read-only transaction and rolls it back.
-- Run it with psql against the target database, as the migration role, immediately before the window.
-- Prints no row contents: counts and yes/no only.
--
--   psql -X -v ON_ERROR_STOP=1 -f scripts/preflight/004_preflight.sql "$DATABASE_URL"
--
-- Any line starting FAIL stops the run (exit non-zero). Record the info lines; compare them
-- with 004_post_apply_verify.sql afterwards.
\set ON_ERROR_STOP on
begin read only;

do $$
declare n bigint;
begin
  if to_regclass('public.website_projects') is null
     or to_regclass('public.website_project_events') is null
     or to_regclass('public.website_payment_events') is null then
    raise exception 'FAIL: migration 002 is not applied';
  end if;
  if to_regclass('public.website_project_rejections') is not null then
    raise exception 'FAIL: migration 004 is already applied';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'FAIL: role service_role is missing (this is not a Supabase database?)';
  end if;
  raise notice 'ok - 002 applied, 004 not applied, service_role present';

  select count(*) into n from public.website_projects
   where state not in ('preview_requested', 'proposal_sent', 'approved', 'setup_payment_failed', 'setup_paid', 'in_progress',
                       'customer_delay', 'customer_review', 'launch_approved', 'launch_failed', 'live', 'past_due',
                       'cancellation_pending', 'canceled');
  if n > 0 then raise exception 'FAIL: % project(s) are in a state 002 does not know', n; end if;
  raise notice 'ok - every project is in a 002 state';

  if current_setting('transaction_read_only') <> 'on' then raise exception 'FAIL: this session is not read-only'; end if;
  raise notice 'ok - session is read-only';

  select count(*) into n from public.website_projects;
  raise notice 'info - website_projects rows: %', n;
  select count(*) into n from public.website_project_events;
  raise notice 'info - website_project_events rows: %', n;
  select count(*) into n from public.website_payment_events;
  raise notice 'info - website_payment_events rows: %', n;

  -- Rows the tightened constraints would reject the next time they are updated (NOT VALID, so the migration itself is unaffected).
  select count(*) into n from public.website_projects
   where subscription_id is not null and launched_at is not null and setup_paid_at is not null;
  raise notice 'info - projects with a subscription id (will need a launch verification before their next update): %', n;
  select count(*) into n from public.website_projects where setup_charge_id is not null and setup_paid_at is null;
  raise notice 'info - projects with a charge but no payment time (will fail charge_after_payment on next update): %', n;

  -- 004 takes ACCESS EXCLUSIVE locks with lock_timeout = 5s. Long transactions would make it fail fast, not hang.
  select count(*) into n from pg_stat_activity
   where pid <> pg_backend_pid() and state <> 'idle' and xact_start < now() - interval '1 minute';
  raise notice 'info - transactions open longer than 1 minute (expect 0): %', n;

  select count(*) into n from pg_locks l join pg_class c on c.oid = l.relation
   where c.relnamespace = 'public'::regnamespace and c.relname like 'website\_%' and l.pid <> pg_backend_pid();
  raise notice 'info - locks held by other sessions on website_* tables (expect 0): %', n;
end $$;

rollback;
\echo 'PREFLIGHT 004: PASSED (read-only; nothing changed)'

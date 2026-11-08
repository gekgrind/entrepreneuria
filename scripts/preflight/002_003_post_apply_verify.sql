-- Post-apply verification for migrations 002 and 003. READ-ONLY.
-- docs/websites/PRODUCTION-MIGRATION-RUNBOOK-002-003.md says when to run it:
-- after 002 (003 rows report n/a) and again after 003.
--
-- One SELECT statement. Catalog facts and counts only: no table rows, no PII,
-- no writes. Scope: exactly the seven Websites service tables and the seven
-- websites_crm_* functions. Other products' objects, such as Prospra's
-- public.website_intelligence, are out of scope.
--
-- verdict: ok = as expected; STOP = run the STOP procedure in the runbook;
-- info = recorded only; n/a = not applicable at this stage.

set transaction read only;

with
t002(name) as (values ('website_inquiries'), ('website_projects'), ('website_project_events'), ('website_payment_events')),
t003(name) as (values ('website_crm_sync_leases'), ('website_crm_sync_state'), ('website_crm_sync_alerts')),
svc(name) as (select name from t002 union all select name from t003),
webtab as (
  select c.oid, c.relname from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and c.relname in (select name from svc)
),
cols002(name, typ) as (values
  ('id', 'uuid'), ('idempotency_key', 'uuid'), ('status', 'text'), ('fields', 'jsonb'), ('consent', 'jsonb'),
  ('policy_versions', 'jsonb'), ('pricing_version', 'text'), ('utm', 'jsonb'),
  ('submitted_at', 'timestamp with time zone'), ('crm_contact_id', 'text'), ('crm_opportunity_id', 'text'),
  ('crm_attempts', 'integer'), ('last_error', 'text'),
  ('created_at', 'timestamp with time zone'), ('updated_at', 'timestamp with time zone')),
idx002(name) as (values ('website_inquiries_status_idx'), ('website_inquiries_email_idx'), ('website_project_events_project_idx')),
cols003(name) as (values
  ('next_attempt_at'), ('claim_token'), ('claimed_by'), ('claim_expires_at'), ('last_attempt_at'),
  ('last_failure_category'), ('last_failure_step'), ('last_outcome'), ('rate_limited_until'), ('last_warnings'),
  ('crm_synced_at'), ('needs_attention_at'), ('needs_attention_reason'), ('manual_requeues')),
cons003(name) as (values
  ('website_inquiries_failure_category_check'), ('website_inquiries_failure_step_check'),
  ('website_inquiries_outcome_check'), ('website_inquiries_warnings_array'),
  ('website_inquiries_attempts_nonnegative'), ('website_inquiries_claim_consistent'),
  ('website_inquiries_synced_has_ids'), ('website_inquiries_attention_has_reason'),
  ('website_inquiries_terminal_unclaimed'), ('website_crm_sync_alerts_delivered_at'),
  ('website_crm_sync_state_floor_ge_lease')),
idx003(name) as (values ('website_inquiries_due_idx'), ('website_inquiries_attention_idx'), ('website_crm_sync_alerts_pending_idx')),
fn003(sig) as (values
  ('public.websites_crm_email_key(text, uuid)'),
  ('public.websites_crm_claim(text, integer, uuid)'),
  ('public.websites_crm_record_success(uuid, uuid, text, text, jsonb)'),
  ('public.websites_crm_record_failure(uuid, uuid, text, text, text, text, boolean, bigint, text, jsonb)'),
  ('public.websites_crm_release_claim(uuid, uuid)'),
  ('public.websites_crm_requeue(uuid)'),
  ('public.websites_crm_sync_health()')),
fns as (
  select p.oid, p.prosecdef, p.proconfig, p.proacl, p.proowner from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname like 'websites\_crm\_%'
),
api(role) as (values ('anon'), ('authenticated')),
inq as (
  select case when to_regclass('public.website_inquiries') is not null then query_to_xml($q$
    select count(*) as total,
           count(*) filter (where status not in ('received', 'crm_synced', 'crm_failed', 'needs_attention')) as bad_status,
           count(*) filter (where status = 'needs_attention') as attention
      from public.website_inquiries
  $q$, false, true, '') end as x
),
p002 as (
  select case when to_regclass('public.website_projects') is not null and to_regclass('public.website_project_events') is not null
               and to_regclass('public.website_payment_events') is not null then query_to_xml($q$
    select (select count(*) from public.website_projects)       as projects,
           (select count(*) from public.website_project_events) as project_events,
           (select count(*) from public.website_payment_events) as payment_events
  $q$, false, true, '') end as x
),
s003 as (
  select case when to_regclass('public.website_crm_sync_state') is not null
               and to_regclass('public.website_crm_sync_leases') is not null
               and to_regclass('public.website_crm_sync_alerts') is not null
               and exists (select 1 from pg_attribute where attrelid = to_regclass('public.website_inquiries')
                             and attname = 'claim_token' and not attisdropped)
         then query_to_xml($q$
    select (select count(*) from public.website_crm_sync_state)  as state_rows,
           (select count(*) from public.website_crm_sync_state where paused_until is null) as state_unpaused,
           (select count(*) from public.website_crm_sync_leases) as leases,
           (select count(*) from public.website_crm_sync_alerts) as alerts,
           (select count(*) from public.website_inquiries where claim_token is not null) as claims
  $q$, false, true, '') end as x
),
cron as (
  select case when to_regclass('cron.job') is not null then query_to_xml($q$
    select count(*) filter (where active and command ~* '(website|crm|ghl|highlevel|leadconnector)') as related from cron.job
  $q$, false, true, '') end as x
),
migr as (
  select case when to_regclass('supabase_migrations.schema_migrations') is not null then query_to_xml($q$
    select count(*) filter (where name ~* '(website|crm_sync)') as website from supabase_migrations.schema_migrations
  $q$, false, true, '') end as x
),
n as (
  select
    (select count(*) from t002 where to_regclass('public.' || name) is not null)                         as t002_n,
    (select count(*) from t003 where to_regclass('public.' || name) is not null)                         as t003_n,
    (select count(*) from webtab)                                                                        as web_n,
    (select count(*) from cols002 c join pg_attribute a
        on a.attrelid = to_regclass('public.website_inquiries') and a.attname = c.name and not a.attisdropped
       and format_type(a.atttypid, a.atttypmod) = c.typ)                                                  as cols002_n,
    (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'i'
        and relname in (select name from idx002))                                                        as idx002_n,
    (select count(*) from pg_constraint where conrelid = to_regclass('public.website_projects')
        and conname = 'website_projects_subscription_after_launch')                                      as sub_check_n,
    (select count(*) from pg_constraint where conrelid = to_regclass('public.website_inquiries') and contype = 'c'
        and pg_get_constraintdef(oid) like '%crm_failed%')                                                as status_checks,
    (select count(*) from pg_constraint where conrelid = to_regclass('public.website_inquiries')
        and conname = 'website_inquiries_status_check' and pg_get_constraintdef(oid) like '%needs_attention%') as status_has_attention,
    (select count(*) from pg_attribute a where a.attrelid = to_regclass('public.website_inquiries')
        and not a.attisdropped and a.attname in (select name from cols003))                              as cols003_n,
    (select count(*) from pg_constraint where connamespace = 'public'::regnamespace
        and conname in (select name from cons003))                                                       as cons003_n,
    (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'i'
        and relname in (select name from idx003))                                                        as idx003_n,
    (select count(*) from fn003 where to_regprocedure(sig) is not null)                                  as fn_sig_n,
    (select count(*) from fns)                                                                           as fn_n,
    (select count(*) from webtab w join pg_class c on c.oid = w.oid where c.relrowsecurity)              as rls_on,
    (select count(*) from pg_policy p join webtab w on w.oid = p.polrelid)                               as policies,
    (select count(*) from webtab w join pg_class c on c.oid = w.oid, aclexplode(c.relacl) a
      where a.grantee in (select oid from pg_roles where rolname in (select role from api)))             as api_table_grants,
    (select count(*) from webtab w join pg_attribute at on at.attrelid = w.oid and at.attnum > 0, aclexplode(at.attacl) a
      where a.grantee in (select oid from pg_roles where rolname in (select role from api)))             as api_column_grants,
    (select count(*) from webtab w join pg_class c on c.oid = w.oid, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      where a.grantee = 0)                                                                               as public_table_grants,
    (select count(*) from webtab w
      where not has_table_privilege('service_role', w.oid, 'select,insert,update,delete'))               as svc_role_missing,
    (select count(*) from pg_trigger t join webtab w on w.oid = t.tgrelid where not t.tgisinternal)       as triggers,
    (select count(*) from pg_publication_tables where schemaname = 'public' and tablename in (select name from svc)) as published,
    (select count(*) from fns f cross join api
      where has_function_privilege(api.role, f.oid, 'execute'))                                          as fn_api_exec,
    (select count(*) from fns f, aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE')                                              as fn_public_exec,
    (select count(*) from fns f where has_function_privilege('service_role', f.oid, 'execute'))           as fn_svc_exec,
    (select count(*) from fns f where f.prosecdef)                                                       as fn_definer,
    (select count(*) from fns f where 'search_path=""' = any(f.proconfig))                               as fn_pinned_path,
    (select coalesce(string_agg(distinct pg_get_userbyid(f.proowner), ', '), 'none') from fns f)          as fn_owners,
    (select count(*) from pg_stat_activity
      where pid <> pg_backend_pid() and state is distinct from 'idle'
        and query ~* '(websites_crm_|website_crm_sync)')                                                as crm_sessions
),
stage as (
  select case when n.t002_n = 0 and n.t003_n = 0 then 'none'
              when n.t002_n = 4 and n.t003_n = 0 and n.cols003_n = 0 then '002'
              when n.t002_n = 4 and n.t003_n = 3 then '002+003'
              else 'partial' end as s from n
),
r(ord, area, item, observed, expected, verdict) as (
  select 1, 'A context', 'detected stage', stage.s, '002 or 002+003',
         case when stage.s in ('002', '002+003') then 'ok' else 'STOP' end from stage
  union all
  select 2, 'A context', 'transaction read-only', current_setting('transaction_read_only'), 'on',
         case when current_setting('transaction_read_only') = 'on' then 'ok' else 'STOP (run read-only)' end
  union all
  select 3, 'A context', 'server_version / user', current_setting('server_version') || ' / ' || current_user, 'recorded', 'info'

  -- B. 002 objects
  union all
  select 10, 'B 002', '002 tables present', n.t002_n || ' of 4', '4 of 4', case when n.t002_n = 4 then 'ok' else 'STOP' end from n
  union all
  select 11, 'B 002', 'website_inquiries 002 columns (name and type)', n.cols002_n || ' of 15', '15 of 15',
         case when n.cols002_n = 15 then 'ok' else 'STOP' end from n
  union all
  select 12, 'B 002', '002 indexes', n.idx002_n || ' of 3', '3 of 3', case when n.idx002_n = 3 then 'ok' else 'STOP' end from n
  union all
  select 13, 'B 002', 'website_projects_subscription_after_launch', n.sub_check_n::text, '1',
         case when n.sub_check_n = 1 then 'ok' else 'STOP' end from n
  union all
  select 14, 'B 002', 'status check constraints / includes needs_attention',
         n.status_checks || ' / ' || (n.status_has_attention = 1),
         '1 / false after 002, 1 / true after 003',
         case when n.status_checks = 1 and ((stage.s = '002' and n.status_has_attention = 0)
                                         or (stage.s = '002+003' and n.status_has_attention = 1)) then 'ok' else 'STOP' end
    from n, stage

  -- C. 003 objects
  union all
  select 20, 'C 003', '003 tables present', n.t003_n || ' of 3', '0 after 002, 3 after 003',
         case when stage.s = '002' and n.t003_n = 0 then 'n/a' when n.t003_n = 3 then 'ok' else 'STOP' end from n, stage
  union all
  select 21, 'C 003', '003 columns on website_inquiries', n.cols003_n || ' of 14', '14 of 14',
         case when stage.s = '002' and n.cols003_n = 0 then 'n/a' when n.cols003_n = 14 then 'ok' else 'STOP' end from n, stage
  union all
  select 22, 'C 003', '003 constraints', n.cons003_n || ' of 11', '11 of 11',
         case when stage.s = '002' and n.cons003_n = 0 then 'n/a' when n.cons003_n = 11 then 'ok' else 'STOP' end from n, stage
  union all
  select 23, 'C 003', '003 indexes', n.idx003_n || ' of 3', '3 of 3',
         case when stage.s = '002' and n.idx003_n = 0 then 'n/a' when n.idx003_n = 3 then 'ok' else 'STOP' end from n, stage
  union all
  select 24, 'C 003', 'websites_crm_* functions (exact signatures / all)', n.fn_sig_n || ' / ' || n.fn_n, '7 / 7',
         case when stage.s = '002' and n.fn_n = 0 then 'n/a' when n.fn_sig_n = 7 and n.fn_n = 7 then 'ok' else 'STOP' end from n, stage
  union all
  select 25, 'C 003', 'sync state row (rows / unpaused)',
         coalesce((xpath('/row/state_rows/text()', s003.x))[1]::text || ' / ' || (xpath('/row/state_unpaused/text()', s003.x))[1]::text, 'n/a'),
         '1 / 1',
         case when s003.x is null then case when stage.s = '002' then 'n/a' else 'STOP' end
              when (xpath('/row/state_rows/text()', s003.x))[1]::text = '1'
               and (xpath('/row/state_unpaused/text()', s003.x))[1]::text = '1' then 'ok' else 'STOP' end
    from s003, stage
  union all
  select 26, 'C 003', 'leases / alerts / live claims (no worker has run)',
         coalesce((xpath('/row/leases/text()', s003.x))[1]::text || ' / ' || (xpath('/row/alerts/text()', s003.x))[1]::text
                  || ' / ' || (xpath('/row/claims/text()', s003.x))[1]::text, 'n/a'),
         '0 / 0 / 0',
         case when s003.x is null then 'n/a'
              when (xpath('/row/leases/text()', s003.x))[1]::text = '0' and (xpath('/row/alerts/text()', s003.x))[1]::text = '0'
               and (xpath('/row/claims/text()', s003.x))[1]::text = '0' then 'ok' else 'STOP (something claimed: worker active?)' end
    from s003

  -- D. Security of the service tables and functions
  union all
  select 30, 'D security', 'RLS enabled on service tables', n.rls_on || ' of ' || n.web_n, 'all',
         case when n.web_n > 0 and n.rls_on = n.web_n then 'ok' else 'STOP' end from n
  union all
  select 31, 'D security', 'RLS policies on service tables', n.policies::text, '0 (service role only)',
         case when n.policies = 0 then 'ok' else 'STOP' end from n
  union all
  select 32, 'D security', 'anon/authenticated table grants (any privilege)', n.api_table_grants::text, '0',
         case when n.api_table_grants = 0 then 'ok' else 'STOP (inquiry data exposed to the API)' end from n
  union all
  select 33, 'D security', 'anon/authenticated column grants', n.api_column_grants::text, '0',
         case when n.api_column_grants = 0 then 'ok' else 'STOP' end from n
  union all
  select 34, 'D security', 'PUBLIC table grants', n.public_table_grants::text, '0',
         case when n.public_table_grants = 0 then 'ok' else 'STOP' end from n
  union all
  select 35, 'D security', 'service tables missing service_role DML', n.svc_role_missing::text, '0',
         case when n.svc_role_missing = 0 then 'ok' else 'STOP' end from n
  union all
  select 36, 'D security', 'triggers on service tables', n.triggers::text, '0',
         case when n.triggers = 0 then 'ok' else 'STOP' end from n
  union all
  select 37, 'D security', 'service tables in a realtime publication', n.published::text, '0',
         case when n.published = 0 then 'ok' else 'STOP' end from n
  union all
  select 38, 'D security', 'functions executable by anon/authenticated / by PUBLIC',
         n.fn_api_exec || ' / ' || n.fn_public_exec, '0 / 0',
         case when stage.s = '002' and n.fn_n = 0 then 'n/a'
              when n.fn_api_exec = 0 and n.fn_public_exec = 0 then 'ok' else 'STOP (RPC exposed to the API)' end from n, stage
  union all
  select 39, 'D security', 'functions executable by service_role', n.fn_svc_exec || ' of ' || n.fn_n, '7 of 7',
         case when stage.s = '002' and n.fn_n = 0 then 'n/a' when n.fn_n = 7 and n.fn_svc_exec = 7 then 'ok' else 'STOP' end from n, stage
  union all
  select 40, 'D security', 'SECURITY DEFINER functions / search_path="" pinned',
         n.fn_definer || ' / ' || n.fn_pinned_path || ' of ' || n.fn_n, '0 / 7 of 7',
         case when stage.s = '002' and n.fn_n = 0 then 'n/a'
              when n.fn_definer = 0 and n.fn_pinned_path = 7 and n.fn_n = 7 then 'ok' else 'STOP' end from n, stage
  union all
  select 41, 'D security', 'function owners', n.fn_owners, 'postgres', 'info' from n

  -- E. Data (counts only) and workers
  union all
  select 50, 'E data', 'rows: inquiries (needs_attention) / projects / project_events / payment_events',
         coalesce((xpath('/row/total/text()', inq.x))[1]::text || ' (' || (xpath('/row/attention/text()', inq.x))[1]::text || ')', 'n/a')
           || ' / ' || coalesce((xpath('/row/projects/text()', p002.x))[1]::text, 'n/a')
           || ' / ' || coalesce((xpath('/row/project_events/text()', p002.x))[1]::text, 'n/a')
           || ' / ' || coalesce((xpath('/row/payment_events/text()', p002.x))[1]::text, 'n/a'),
         'recorded; all 0 before R3 (002 rollback drops every row)', 'info' from inq, p002
  union all
  select 51, 'E data', 'rows with an unknown status', coalesce((xpath('/row/bad_status/text()', inq.x))[1]::text, 'n/a'), '0',
         case when inq.x is null then 'STOP' when (xpath('/row/bad_status/text()', inq.x))[1]::text = '0' then 'ok' else 'STOP' end from inq
  union all
  select 60, 'F workers', 'active pg_cron jobs mentioning website/CRM/GHL',
         coalesce((xpath('/row/related/text()', cron.x))[1]::text, 'pg_cron not installed'), '0',
         case when cron.x is null or (xpath('/row/related/text()', cron.x))[1]::text = '0' then 'ok' else 'STOP' end from cron
  union all
  select 61, 'F workers', 'non-idle sessions running CRM sync SQL now', n.crm_sessions::text, '0',
         case when n.crm_sessions = 0 then 'ok' else 'STOP' end from n
  union all
  select 62, 'F workers', 'website/crm_sync rows in CLI migration history',
         coalesce((xpath('/row/website/text()', migr.x))[1]::text, 'table absent'), '0 (scripts are not CLI migrations)',
         case when migr.x is null or (xpath('/row/website/text()', migr.x))[1]::text = '0' then 'ok' else 'STOP (CLI history changed)' end from migr
)
select ord, area, item, observed, expected, verdict from r order by ord;

-- Migration 003 production preflight. READ-ONLY. Run only under owner approval.
-- docs/websites/PRODUCTION-PREFLIGHT-003.md describes when and how to run it.
--
-- One SELECT statement, so the Supabase SQL editor shows every row. It reads
-- catalogs, statistics and counts only: no table rows, no email addresses or
-- other PII, and no writes. It works whether or not 002 or 003 is applied.
--
-- Supabase SQL editor: paste the whole file and run it. The editor sends it as
-- one implicit transaction, so the first line makes that transaction read-only.
-- psql:  psql --single-transaction -f scripts/preflight/003_production_preflight.sql
--
-- verdict: ok = as expected; STOP = do not apply 003; review = owner decision;
-- info = recorded only.
--
-- Scope: exactly the seven Websites service tables created by 002 and 003
-- (t002, t003 below). Other products' tables that merely start with
-- "website", such as Prospra's public.website_intelligence, are out of scope.

set transaction read only;

with
inq as (
  select case when to_regclass('public.website_inquiries') is not null then query_to_xml($q$
    select count(*)                                                                as total,
           count(*) filter (where status = 'received')                             as received,
           count(*) filter (where status = 'crm_synced')                           as synced,
           count(*) filter (where status = 'crm_failed')                           as failed,
           count(*) filter (where status not in ('received', 'crm_synced', 'crm_failed')) as other_status,
           count(*) filter (where status = 'crm_synced'
                              and (crm_contact_id is null or crm_opportunity_id is null)) as synced_missing_ids,
           count(*) filter (where crm_attempts < 0)                                as negative_attempts,
           count(*) filter (where coalesce(btrim(fields ->> 'email'), '') = '')    as no_email
      from public.website_inquiries
  $q$, false, true, '') end as x
),
cron as (
  select case when to_regclass('cron.job') is not null then query_to_xml($q$
    select count(*) as total,
           count(*) filter (where active) as active,
           count(*) filter (where active and command ~* '(website|crm|ghl|highlevel|leadconnector)') as related
      from cron.job
  $q$, false, true, '') end as x
),
net as (
  select case when to_regclass('net.http_request_queue') is not null then query_to_xml(
    'select count(*) as c from net.http_request_queue', false, true, '') end as x
),
hooks as (
  select case when to_regclass('supabase_functions.hooks') is not null then query_to_xml(
    'select count(*) as c from supabase_functions.hooks', false, true, '') end as x
),
migr as (
  select case when to_regclass('supabase_migrations.schema_migrations') is not null then query_to_xml($q$
    select count(*) as total, count(*) filter (where name ~* 'website') as website
      from supabase_migrations.schema_migrations
  $q$, false, true, '') end as x
),
t002(name) as (values ('website_inquiries'), ('website_projects'), ('website_project_events'), ('website_payment_events')),
t003(name) as (values ('website_crm_sync_leases'), ('website_crm_sync_state'), ('website_crm_sync_alerts')),
cols002(name, typ) as (values
  ('id', 'uuid'), ('idempotency_key', 'uuid'), ('status', 'text'), ('fields', 'jsonb'), ('consent', 'jsonb'),
  ('policy_versions', 'jsonb'), ('pricing_version', 'text'), ('utm', 'jsonb'),
  ('submitted_at', 'timestamp with time zone'), ('crm_contact_id', 'text'), ('crm_opportunity_id', 'text'),
  ('crm_attempts', 'integer'), ('last_error', 'text'),
  ('created_at', 'timestamp with time zone'), ('updated_at', 'timestamp with time zone')),
cols003(name) as (values
  ('next_attempt_at'), ('claim_token'), ('claimed_by'), ('claim_expires_at'), ('last_attempt_at'),
  ('last_failure_category'), ('last_failure_step'), ('last_outcome'), ('rate_limited_until'), ('last_warnings'),
  ('crm_synced_at'), ('needs_attention_at'), ('needs_attention_reason'), ('manual_requeues')),
cons003(name) as (values
  ('website_inquiries_failure_category_check'), ('website_inquiries_failure_step_check'),
  ('website_inquiries_outcome_check'), ('website_inquiries_warnings_array'),
  ('website_inquiries_attempts_nonnegative'), ('website_inquiries_claim_consistent'),
  ('website_inquiries_synced_has_ids'), ('website_inquiries_attention_has_reason'),
  ('website_inquiries_terminal_unclaimed')),
idx003(name) as (values ('website_inquiries_due_idx'), ('website_inquiries_attention_idx'), ('website_crm_sync_alerts_pending_idx')),
svc(name) as (select name from t002 union all select name from t003),
webtab as (
  select c.oid, c.relname from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and c.relname in (select name from svc)
),
n as (
  select
    (select count(*) from t002 where to_regclass('public.' || name) is not null)                       as t002_present,
    (select count(*) from t003 where to_regclass('public.' || name) is not null)                       as t003_present,
    (select count(*) from cols002 c join pg_attribute a
        on a.attrelid = to_regclass('public.website_inquiries') and a.attname = c.name and not a.attisdropped
       and format_type(a.atttypid, a.atttypmod) = c.typ)                                                as cols002_ok,
    (select count(*) from pg_attribute a
      where a.attrelid = to_regclass('public.website_inquiries') and a.attnum > 0 and not a.attisdropped
        and a.attname not in (select name from cols002) and a.attname not in (select name from cols003)) as cols_unknown,
    (select count(*) from pg_attribute a
      where a.attrelid = to_regclass('public.website_inquiries') and not a.attisdropped
        and a.attname in (select name from cols003))                                                   as cols003_present,
    (select count(*) from pg_constraint
      where conrelid = to_regclass('public.website_inquiries') and contype = 'c'
        and pg_get_constraintdef(oid) like '%crm_failed%')                                              as status_checks,
    (select count(*) from pg_constraint
      where conrelid = to_regclass('public.website_inquiries') and conname = 'website_inquiries_status_check') as status_check_named,
    (select count(*) from pg_constraint where connamespace = 'public'::regnamespace
        and conname in (select name from cons003))                                                     as cons003_present,
    (select count(*) from pg_class where relnamespace = 'public'::regnamespace
        and relname in (select name from idx003))                                                      as idx003_present,
    (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname like 'websites\_crm\_%')                                                           as fn003_present,
    (select count(*) from webtab where (select relrowsecurity from pg_class where oid = webtab.oid))   as rls_on,
    (select count(*) from webtab)                                                                      as webtab_total,
    (select count(*) from pg_trigger t join webtab w on w.oid = t.tgrelid where not t.tgisinternal)     as triggers,
    (select count(*) from pg_policy p join webtab w on w.oid = p.polrelid)                             as policies,
    (select count(*) from webtab w cross join (values ('anon'), ('authenticated')) r(role)
        cross join (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) p(priv)
      where exists (select 1 from pg_roles where rolname = r.role)
        and has_table_privilege(r.role, w.oid, p.priv))                                                as api_privs,
    (select count(*) from webtab w join pg_class c on c.oid = w.oid, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      where a.grantee = 0)                                                                             as public_privs,
    (select count(*) from pg_publication_tables where schemaname = 'public' and tablename in (select name from svc)) as published,
    (select count(*) from pg_stat_activity
      where pid <> pg_backend_pid() and backend_type = 'client backend'
        and xact_start < now() - interval '60 seconds')                                                as long_xacts,
    (select count(*) from pg_stat_activity
      where pid <> pg_backend_pid() and state like 'idle in transaction%')                             as idle_in_xact,
    (select count(*) from pg_locks
      where pid <> pg_backend_pid() and relation = to_regclass('public.website_inquiries'))            as inq_locks,
    (select count(*) from pg_stat_activity
      where pid <> pg_backend_pid() and query ~* '(websites_crm_|website_crm_sync)')                   as crm_sessions
),
r(ord, area, item, observed, expected, verdict) as (
  -- A. Environment
  select 10, 'A environment', 'server_version', current_setting('server_version'), '15.x or 17.x',
         case when current_setting('server_version_num')::int / 10000 in (15, 17) then 'ok' else 'review' end
  union all
  select 11, 'A environment', 'running as',
         current_user || ' (superuser=' || r.rolsuper || ', bypassrls=' || r.rolbypassrls || ')',
         'postgres (superuser=false)', case when current_user = 'postgres' then 'ok' else 'review' end
    from pg_roles r where r.rolname = current_user
  union all
  select 12, 'A environment', 'API roles',
         (select string_agg(rolname || ' inherit=' || rolinherit || ' bypassrls=' || rolbypassrls, '; ' order by rolname)
            from pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'authenticator')),
         'all 4 present; service_role bypassrls=true',
         case when (select count(*) from pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'authenticator')) = 4
               and (select rolbypassrls from pg_roles where rolname = 'service_role') then 'ok' else 'STOP' end
  union all
  select 13, 'A environment', 'built-ins 003 uses',
         'gen_random_uuid=' || (to_regprocedure('pg_catalog.gen_random_uuid()') is not null)
           || ', sha256=' || (to_regprocedure('pg_catalog.sha256(bytea)') is not null)
           || ', hashtextextended=' || (to_regprocedure('pg_catalog.hashtextextended(text, bigint)') is not null),
         'all true',
         case when to_regprocedure('pg_catalog.gen_random_uuid()') is not null
               and to_regprocedure('pg_catalog.sha256(bytea)') is not null
               and to_regprocedure('pg_catalog.hashtextextended(text, bigint)') is not null then 'ok' else 'STOP' end
  union all
  select 14, 'A environment', 'extensions',
         (select string_agg(extname || ' ' || extversion, ', ' order by extname) from pg_extension), 'recorded', 'info'
  union all
  select 15, 'A environment', 'role settings',
         (select string_agg(rolname || ': ' || coalesce(array_to_string(rolconfig, ', '), '(none)'), '; ' order by rolname)
            from pg_roles where rolname in ('postgres', 'authenticator', 'service_role')),
         'recorded', 'info'
  union all
  select 16, 'A environment', 'database size', pg_size_pretty(pg_database_size(current_database())), 'recorded', 'info'

  -- B. Migration 002
  union all
  select 20, 'B 002 status', '002 tables present', n.t002_present || ' of 4', '4 of 4',
         case n.t002_present when 4 then 'ok' when 0 then 'STOP (002 not applied: apply 002 first, separate approval)'
                             else 'STOP (002 partially applied)' end from n
  union all
  select 21, 'B 002 status', 'website_inquiries columns matching 002', n.cols002_ok || ' of 15', '15 of 15',
         case when n.t002_present = 0 then 'n/a' when n.cols002_ok = 15 then 'ok' else 'STOP (schema drift)' end from n
  union all
  select 22, 'B 002 status', 'unexpected extra columns on website_inquiries', n.cols_unknown::text, '0',
         case when n.t002_present = 0 then 'n/a' when n.cols_unknown = 0 then 'ok' else 'review (schema drift)' end from n
  union all
  select 23, 'B 002 status', 'status check constraints (crm_failed)',
         n.status_checks || ' (named website_inquiries_status_check: ' || n.status_check_named || ')', '1 (1)',
         case when n.t002_present = 0 then 'n/a' when n.status_checks = 1 and n.status_check_named = 1 then 'ok'
              else 'STOP (003 guard would abort)' end from n
  union all
  select 24, 'B 002 status', 'RLS enabled on Websites service tables', n.rls_on || ' of ' || n.webtab_total, 'all',
         case when n.webtab_total = 0 then 'n/a' when n.rls_on = n.webtab_total then 'ok' else 'STOP' end from n
  union all
  select 25, 'B 002 status', 'triggers on Websites service tables', n.triggers::text, '0',
         case when n.triggers = 0 then 'ok' else 'review (something reacts to inquiry writes)' end from n
  union all
  select 26, 'B 002 status', 'RLS policies on Websites service tables', n.policies::text, '0 (service role only)',
         case when n.policies = 0 then 'ok' else 'review' end from n

  -- C. Migration 003 not yet applied, no name collisions
  union all
  select 30, 'C 003 status', '003 tables present', n.t003_present || ' of 3', '0',
         case when n.t003_present = 0 then 'ok' else 'STOP (003 already or partly applied)' end from n
  union all
  select 31, 'C 003 status', '003 columns already on website_inquiries', n.cols003_present || ' of 14', '0',
         case when n.cols003_present = 0 then 'ok' else 'STOP (name collision)' end from n
  union all
  select 32, 'C 003 status', '003 constraint names in use', n.cons003_present::text, '0',
         case when n.cons003_present = 0 then 'ok' else 'STOP (name collision)' end from n
  union all
  select 33, 'C 003 status', '003 index names in use', n.idx003_present::text, '0',
         case when n.idx003_present = 0 then 'ok' else 'STOP (name collision)' end from n
  union all
  select 34, 'C 003 status', 'websites_crm_* functions present', n.fn003_present::text, '0',
         case when n.fn003_present = 0 then 'ok' else 'STOP (name collision)' end from n
  union all
  select 35, 'C 003 status', 'CLI migration history (supabase_migrations)',
         coalesce('rows=' || (xpath('/row/total/text()', migr.x))[1]::text
                  || ', website-named=' || (xpath('/row/website/text()', migr.x))[1]::text, 'table absent'),
         'recorded (002/003 are scripts/, not CLI migrations)', 'info' from migr

  -- D. Existing data vs the constraints 003 adds (counts only)
  union all
  select 40, 'D data', 'website_inquiries rows',
         coalesce((xpath('/row/total/text()', inq.x))[1]::text
                  || ' (received=' || (xpath('/row/received/text()', inq.x))[1]::text
                  || ', crm_synced=' || (xpath('/row/synced/text()', inq.x))[1]::text
                  || ', crm_failed=' || (xpath('/row/failed/text()', inq.x))[1]::text || ')', 'table absent'),
         'recorded', 'info' from inq
  union all
  select 41, 'D data', 'crm_synced rows missing contact or opportunity id',
         coalesce((xpath('/row/synced_missing_ids/text()', inq.x))[1]::text, 'n/a'), '0',
         case when inq.x is null then 'n/a' when (xpath('/row/synced_missing_ids/text()', inq.x))[1]::text = '0' then 'ok'
              else 'STOP (website_inquiries_synced_has_ids would fail; 003 rolls back)' end from inq
  union all
  select 42, 'D data', 'rows with a status outside 002''s three values',
         coalesce((xpath('/row/other_status/text()', inq.x))[1]::text, 'n/a'), '0',
         case when inq.x is null then 'n/a' when (xpath('/row/other_status/text()', inq.x))[1]::text = '0' then 'ok' else 'STOP' end from inq
  union all
  select 43, 'D data', 'rows with negative crm_attempts',
         coalesce((xpath('/row/negative_attempts/text()', inq.x))[1]::text, 'n/a'), '0',
         case when inq.x is null then 'n/a' when (xpath('/row/negative_attempts/text()', inq.x))[1]::text = '0' then 'ok' else 'STOP' end from inq
  union all
  select 44, 'D data', 'rows without an email (get an inquiry-scoped lease key)',
         coalesce((xpath('/row/no_email/text()', inq.x))[1]::text, 'n/a'), 'recorded', 'info' from inq
  union all
  select 45, 'D data', 'website_inquiries size (table + indexes)',
         coalesce(pg_size_pretty(pg_total_relation_size(to_regclass('public.website_inquiries'))), 'n/a'), 'recorded', 'info'

  -- E. Locking and activity (repeat right before the apply)
  union all
  select 50, 'E locking', 'other transactions open > 60 s', n.long_xacts::text, '0 at apply time',
         case when n.long_xacts = 0 then 'ok' else 'review (an ALTER would queue behind them)' end from n
  union all
  select 51, 'E locking', 'sessions idle in transaction', n.idle_in_xact::text, '0 at apply time',
         case when n.idle_in_xact = 0 then 'ok' else 'review' end from n
  union all
  select 52, 'E locking', 'locks held on website_inquiries by other sessions', n.inq_locks::text, '0 at apply time',
         case when n.inq_locks = 0 then 'ok' else 'review' end from n
  union all
  select 53, 'E locking', 'website_inquiries writes since stats reset',
         coalesce((select 'ins=' || n_tup_ins || ' upd=' || n_tup_upd || ' del=' || n_tup_del
                     || ' last_analyze=' || coalesce(greatest(last_analyze, last_autoanalyze)::text, 'never')
                     || ' stats_reset=' || coalesce((select stats_reset::text from pg_stat_database where datname = current_database()), 'unknown')
                     from pg_stat_user_tables where relid = to_regclass('public.website_inquiries')), 'n/a'),
         'recorded', 'info'
  union all
  select 54, 'E locking', 'this session lock_timeout / statement_timeout',
         current_setting('lock_timeout') || ' / ' || current_setting('statement_timeout'), 'recorded', 'info'

  -- F. Permissions (002 objects, Supabase defaults 003 relies on)
  union all
  select 60, 'F permissions', 'anon/authenticated privileges on Websites service tables', n.api_privs::text, '0',
         case when n.webtab_total = 0 then 'n/a' when n.api_privs = 0 then 'ok' else 'STOP (inquiry data exposed to the API)' end from n
  union all
  select 61, 'F permissions', 'PUBLIC privileges on Websites service tables', n.public_privs::text, '0',
         case when n.webtab_total = 0 then 'n/a' when n.public_privs = 0 then 'ok' else 'STOP' end from n
  union all
  select 62, 'F permissions', 'service_role DML on website_inquiries',
         coalesce(has_table_privilege('service_role', to_regclass('public.website_inquiries'), 'select,insert,update,delete')::text, 'n/a'),
         'true', case when to_regclass('public.website_inquiries') is null then 'n/a'
                      when has_table_privilege('service_role', to_regclass('public.website_inquiries'), 'select,insert,update,delete') then 'ok'
                      else 'review' end
  union all
  select 63, 'F permissions', 'default: new public functions executable by anon',
         coalesce((select string_agg(pg_get_userbyid(d.defaclrole), ', ' order by 1) from pg_default_acl d, aclexplode(d.defaclacl) a
                    where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'f'
                      and a.grantee = (select oid from pg_roles where rolname = 'anon') and a.privilege_type = 'EXECUTE'), 'none'),
         'recorded (003 revokes explicitly either way)', 'info'
  union all
  select 64, 'F permissions', 'Websites service tables in a realtime publication', n.published::text, '0',
         case when n.published = 0 then 'ok' else 'STOP (inquiry rows broadcast)' end from n

  -- G. No CRM worker or scheduler
  union all
  select 70, 'G workers', 'pg_cron jobs (total / active / CRM-related active)',
         coalesce((xpath('/row/total/text()', cron.x))[1]::text || ' / ' || (xpath('/row/active/text()', cron.x))[1]::text
                  || ' / ' || (xpath('/row/related/text()', cron.x))[1]::text, 'pg_cron not installed'),
         'CRM-related active = 0',
         case when cron.x is null or (xpath('/row/related/text()', cron.x))[1]::text = '0' then 'ok' else 'STOP' end from cron
  union all
  select 71, 'G workers', 'pg_net queued requests', coalesce((xpath('/row/c/text()', net.x))[1]::text, 'pg_net not installed'),
         'recorded', 'info' from net
  union all
  select 72, 'G workers', 'database webhooks (supabase_functions.hooks rows)',
         coalesce((xpath('/row/c/text()', hooks.x))[1]::text, 'not installed'), 'recorded; see row 25 for service-table triggers', 'info' from hooks
  union all
  select 73, 'G workers', 'sessions running CRM sync SQL now', n.crm_sessions::text, '0',
         case when n.crm_sessions = 0 then 'ok' else 'STOP' end from n
  union all
  select 74, 'G workers', 'connected clients (application_name: count)',
         coalesce((select string_agg(app || ': ' || c, ', ' order by app) from (
                    select coalesce(nullif(application_name, ''), '(none)') as app, count(*) as c from pg_stat_activity
                     where backend_type = 'client backend' and pid <> pg_backend_pid() group by 1) s), 'none'),
         'recorded', 'info'
)
select ord, area, item, observed, expected, verdict from r order by ord;

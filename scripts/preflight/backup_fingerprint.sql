-- Database fingerprint for backup restore verification. READ-ONLY.
-- docs/websites/PRODUCTION-BACKUP-RESTORE-VERIFICATION.md says how to use it:
-- run it against production right before and right after the dump, then
-- against the disposable restored copy, and diff the outputs.
--
-- Output: section | schema | object | value. It contains catalog facts, md5
-- hashes and exact row counts only: no row contents, no PII, no password
-- hashes, and no setting values other than an allowlist of operational
-- settings (all others are md5-hashed). Run it ONLY like this:
--   PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=300s -c lock_timeout=2s' \
--   psql -X --single-transaction -A -t -F '|' -v ON_ERROR_STOP=1 -f backup_fingerprint.sql
-- (--single-transaction keeps every statement below in the read-only
-- transaction.) Counts and content hashes are exact only when the role
-- bypasses RLS: check the 'role' line for the connecting role (bypassrls=true).
--
-- Functions it invokes: catalog and formatting functions (pg_get_*def,
-- pg_get_expr, format_type, has_*_privilege, pg_get_userbyid,
-- pg_total_relation_size, md5, xpath) and query_to_xml, which runs only the two
-- generated statements below: select count(*) from <table>, and select
-- md5(string_agg(<row>::text ...)) from <table>. Only ordinary and partitioned
-- tables are read (never views or foreign tables), and the transaction is
-- read-only, so nothing can be written.

set transaction read only;
-- Fixed output formats and search_path, and every text sort uses the "C"
-- collation, so the same data hashes the same in production and in the
-- restored copy regardless of session defaults or database collation.
set local search_path = pg_catalog;
set local TimeZone = 'UTC';
set local DateStyle = 'ISO, MDY';
set local IntervalStyle = 'postgres';
set local extra_float_digits = 1;
set local bytea_output = 'hex';

with
sch as (
  select n.oid, n.nspname from pg_namespace n
   where n.nspname not in ('pg_catalog', 'information_schema')
     and n.nspname not like 'pg\_toast%' and n.nspname not like 'pg\_temp%'
),
-- Supabase-managed schemas: structure is the platform's; content hashes are
-- skipped there (row counts are still reported).
managed(nspname) as (values ('auth'), ('storage'), ('realtime'), ('_realtime'), ('extensions'), ('graphql'),
  ('graphql_public'), ('vault'), ('pgsodium'), ('pgsodium_masks'), ('net'), ('cron'), ('supabase_functions'),
  ('pgbouncer'), ('_analytics')),
tabs as (
  select c.oid, s.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relacl
    from pg_class c join sch s on s.oid = c.relnamespace
   where c.relkind in ('r', 'p')
),
fns as (
  select p.oid, s.nspname, p.prokind, p.proacl, p.proowner from pg_proc p join sch s on s.oid = p.pronamespace
),
-- Role/database settings whose values are printed in clear. Every other
-- setting value is replaced by its md5 (older projects keep secrets such as
-- app.settings.jwt_secret here).
safe_setting(name) as (values ('search_path'), ('statement_timeout'), ('lock_timeout'),
  ('idle_in_transaction_session_timeout'), ('idle_session_timeout'), ('session_preload_libraries'),
  ('log_statement'), ('log_min_duration_statement'), ('log_min_messages'), ('default_transaction_read_only'),
  ('default_transaction_isolation'), ('work_mem'), ('maintenance_work_mem'), ('timezone'), ('datestyle'),
  ('client_min_messages'), ('row_security')),
r(section, schema_name, object_name, value) as (
  select 'meta', '', 'server_version', current_setting('server_version')
  union all select 'meta', '', 'database', current_database()
  union all select 'meta', '', 'connected as', current_user
  union all select 'meta', '', 'database collate / ctype',
                   (select datcollate || ' / ' || datctype from pg_database where datname = current_database())
  union all select 'meta', '', 'captured_at (ignore in diff)', clock_timestamp()::text

  -- Per-schema structure: counts plus hashes of every definition.
  union all
  select 'schema', s.nspname, 'tables / rls-enabled / rls-forced / columns',
         (select count(*) from tabs t where t.nspname = s.nspname) || ' / '
         || (select count(*) from tabs t where t.nspname = s.nspname and t.relrowsecurity) || ' / '
         || (select count(*) from tabs t where t.nspname = s.nspname and t.relforcerowsecurity) || ' / '
         || (select count(*) from pg_attribute a join tabs t on t.oid = a.attrelid
              where t.nspname = s.nspname and a.attnum > 0 and not a.attisdropped)
    from sch s
  union all
  select 'schema', s.nspname, 'columns md5',
         coalesce(md5(string_agg(t.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod)
                                 || ':' || a.attnotnull || ':' || a.attidentity::text || a.attgenerated::text
                                 || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), ''),
                                 ',' order by t.relname, a.attnum)), 'none')
    from sch s left join tabs t on t.nspname = s.nspname
    left join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   group by s.nspname
  union all
  select 'schema', s.nspname, 'constraints (count / md5)',
         count(k.oid) || ' / ' || coalesce(md5(string_agg(
             case when k.conrelid <> 0 then k.conrelid::regclass::text else 'domain ' || k.contypid::regtype::text end
             || '.' || k.conname || ':' || pg_get_constraintdef(k.oid), ','
             order by case when k.conrelid <> 0 then k.conrelid::regclass::text else 'domain ' || k.contypid::regtype::text end collate "C", k.conname)), 'none')
    from sch s left join pg_constraint k on k.connamespace = s.oid
   group by s.nspname
  union all
  select 'schema', s.nspname, 'indexes (count / md5)',
         count(i.indexrelid) || ' / ' || coalesce(md5(string_agg(pg_get_indexdef(i.indexrelid), ',' order by pg_get_indexdef(i.indexrelid) collate "C")), 'none')
    from sch s left join tabs t on t.nspname = s.nspname left join pg_index i on i.indrelid = t.oid
   group by s.nspname
  union all
  select 'schema', s.nspname, 'views+matviews+sequences (count / definitions and grants md5)',
         count(c.oid) || ' / ' || coalesce(md5(string_agg(c.relkind::text || ':' || c.relname || ':'
                                 || case when c.relkind in ('v', 'm') then coalesce(pg_get_viewdef(c.oid), '') else '' end
                                 || ':' || coalesce(c.reloptions::text, '') || ':' || coalesce(c.relacl::text, 'default'),
                                 ',' order by c.relkind, c.relname)), 'none')
    from sch s left join pg_class c on c.relnamespace = s.oid and c.relkind in ('v', 'm', 'S')
   group by s.nspname
  union all
  select 'schema', s.nspname, 'sequence positions md5',
         coalesce(md5(string_agg(q.sequencename || ':' || coalesce(q.last_value::text, 'null'), ',' order by q.sequencename::text collate "C")), 'none')
    from sch s left join pg_sequences q on q.schemaname = s.nspname
   group by s.nspname
  union all
  select 'schema', s.nspname, 'functions (count / md5)',
         count(f.oid) || ' / ' || coalesce(md5(string_agg(case when f.prokind in ('f', 'p') then pg_get_functiondef(f.oid) else f.oid::regprocedure::text end,
                                                       ',' order by f.oid::regprocedure::text collate "C")), 'none')
    from sch s left join fns f on f.nspname = s.nspname
   group by s.nspname
  union all
  select 'schema', s.nspname, 'triggers on tables and views (count / md5)',
         count(g.oid) || ' / ' || coalesce(md5(string_agg(pg_get_triggerdef(g.oid) || ':' || g.tgenabled::text, ',' order by pg_get_triggerdef(g.oid) collate "C")), 'none')
    from sch s left join pg_class c on c.relnamespace = s.oid left join pg_trigger g on g.tgrelid = c.oid and not g.tgisinternal
   group by s.nspname
  union all
  select 'schema', s.nspname, 'rules (count / md5)',
         count(w.oid) || ' / ' || coalesce(md5(string_agg(pg_get_ruledef(w.oid), ',' order by pg_get_ruledef(w.oid) collate "C")), 'none')
    from sch s left join pg_class c on c.relnamespace = s.oid left join pg_rewrite w on w.ev_class = c.oid and w.rulename <> '_RETURN'
   group by s.nspname
  union all
  select 'schema', s.nspname, 'table rls flags and options md5',
         coalesce(md5(string_agg(t.relname || ':' || t.relrowsecurity || ':' || t.relforcerowsecurity || ':' || coalesce(c.reloptions::text, ''),
                                 ',' order by t.relname)), 'none')
    from sch s left join tabs t on t.nspname = s.nspname left join pg_class c on c.oid = t.oid
   group by s.nspname
  union all
  select 'schema', s.nspname, 'policies (count / md5)',
         count(p.oid) || ' / ' || coalesce(md5(string_agg(t.relname || '.' || p.polname || ':' || p.polcmd::text || ':' || p.polpermissive
             || ':' || coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ':' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
             || ':' || (select coalesce(string_agg(case when x = 0 then 'public' else pg_get_userbyid(x) end, ',' order by (case when x = 0 then 'public' else pg_get_userbyid(x) end) collate "C"), '') from unnest(p.polroles) x),
             ',' order by t.relname, p.polname)), 'none')
    from sch s left join tabs t on t.nspname = s.nspname left join pg_policy p on p.polrelid = t.oid
   group by s.nspname
  union all
  select 'schema', s.nspname, 'types (enum/domain/composite/range) count / md5',
         count(t.oid) || ' / ' || coalesce(md5(string_agg(t.typname || ':' || t.typtype::text || ':'
             || coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid), '')
             || ':' || coalesce(format_type(t.typbasetype, t.typtypmod), '') || ':' || coalesce(t.typacl::text, 'default'),
             ',' order by t.typname)), 'none')
    from sch s left join pg_type t on t.typnamespace = s.oid and t.typtype in ('e', 'd', 'r')
                                   or (t.typnamespace = s.oid and t.typtype = 'c'
                                       and exists (select 1 from pg_class c where c.oid = t.typrelid and c.relkind = 'c'))
   group by s.nspname

  -- Ownership and grants.
  union all
  select 'schema', s.nspname, 'schema owner / acl', pg_get_userbyid(n.nspowner) || ' / ' || coalesce(n.nspacl::text, 'default')
    from sch s join pg_namespace n on n.oid = s.oid
  union all
  select 'schema', s.nspname, 'object owners md5',
         coalesce(md5(string_agg(o.k || ':' || o.owner, ',' order by o.k collate "C")), 'none')
    from sch s left join (
      select c.relnamespace as ns, c.relkind::text || ':' || c.relname as k, pg_get_userbyid(c.relowner) as owner
        from pg_class c where c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
      union all
      select f.pronamespace, 'fn:' || f.oid::regprocedure::text, pg_get_userbyid(f.proowner) from pg_proc f
    ) o on o.ns = s.oid
   group by s.nspname
  union all
  select 'schema', s.nspname, 'table grants md5',
         coalesce(md5(string_agg(t.relname || ':' || coalesce(t.relacl::text, 'default'), ',' order by t.relname)), 'none')
    from sch s left join tabs t on t.nspname = s.nspname
   group by s.nspname
  union all
  select 'schema', s.nspname, 'column grants md5',
         coalesce(md5(string_agg(c.relname || '.' || a.attname || ':' || a.attacl::text, ',' order by c.relname, a.attnum)), 'none')
    from sch s left join pg_class c on c.relnamespace = s.oid
    left join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped and a.attacl is not null
   group by s.nspname
  union all
  select 'schema', s.nspname, 'function grants md5',
         coalesce(md5(string_agg(f.oid::regprocedure::text || ':' || coalesce(f.proacl::text, 'default'), ',' order by f.oid::regprocedure::text collate "C")), 'none')
    from sch s left join fns f on f.nspname = s.nspname
   group by s.nspname
  union all
  select 'default_acl', case when d.defaclnamespace = 0 then '(all)' else d.defaclnamespace::regnamespace::text end,
         pg_get_userbyid(d.defaclrole) || ':' || d.defaclobjtype::text,
         md5(d.defaclacl::text)
    from pg_default_acl d
  union all
  select 'database', '', 'acl', coalesce((select datacl::text from pg_database where datname = current_database()), 'default')

  -- Role and database settings. Only allowlisted names show their value.
  union all
  select 'role_setting', coalesce((select datname from pg_database where oid = d.setdatabase), '(all databases)'),
         coalesce(pg_get_userbyid(nullif(d.setrole, 0)), '(all roles)'),
         array_to_string(array(
           select case when lower(split_part(x, '=', 1)) in (select name from safe_setting) then x
                       else split_part(x, '=', 1) || '=<md5:' || md5(substr(x, strpos(x, '=') + 1)) || '>' end
             from unnest(d.setconfig) x order by x collate "C"), ', ')
    from pg_db_role_setting d

  -- Roles: attributes and memberships only (never passwords).
  union all
  select 'role', '', r.rolname,
         'login=' || r.rolcanlogin || ' super=' || r.rolsuper || ' bypassrls=' || r.rolbypassrls || ' inherit=' || r.rolinherit
         || ' createrole=' || r.rolcreaterole || ' createdb=' || r.rolcreatedb || ' replication=' || r.rolreplication
         || ' memberof=' || coalesce((select string_agg(b.rolname, ',' order by b.rolname)
              from pg_auth_members m join pg_roles b on b.oid = m.roleid where m.member = r.oid), '')
    from pg_roles r where r.rolname not like 'pg\_%'

  union all
  select 'extension', e.extnamespace::regnamespace::text, e.extname, e.extversion from pg_extension e
  union all
  select 'publication', '', p.pubname,
         'alltables=' || p.puballtables || ' ins/upd/del/trunc=' || p.pubinsert || p.pubupdate || p.pubdelete || p.pubtruncate
         || ' tables=' || coalesce((select string_agg(pt.schemaname || '.' || pt.tablename, ',' order by (pt.schemaname || '.' || pt.tablename) collate "C")
             from pg_publication_tables pt where pt.pubname = p.pubname), '')
    from pg_publication p
  union all
  select 'event_trigger', '', e.evtname,
         e.evtevent || ' enabled=' || e.evtenabled::text || ' fn=' || e.evtfoid::regproc::text || ' owner=' || pg_get_userbyid(e.evtowner)
    from pg_event_trigger e
  union all
  select 'large_objects', '', 'count', (select count(*) from pg_largeobject_metadata)::text

  -- Exact row counts for every table (counts only).
  union all
  select 'rows', t.nspname, t.relname,
         case when has_table_privilege(t.oid, 'select')
              then (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', t.nspname, t.relname), false, true, '')))[1]::text
              else 'no-select-privilege' end
    from tabs t

  -- Content hash per table outside the managed schemas: md5 over every row's
  -- text, sorted. Detects changed values even when the row count matches.
  union all
  select 'rows_md5', t.nspname, t.relname,
         case when not has_table_privilege(t.oid, 'select') then 'no-select-privilege'
              when pg_total_relation_size(t.oid) > 52428800 then 'skipped (over 50 MB)'
              else (xpath('/row/h/text()', query_to_xml(format(
                     'select md5(coalesce(string_agg(x, E''\n'' order by x collate "C"), '''')) as h from (select r_::text as x from %I.%I r_) s',
                     t.nspname, t.relname), false, true, '')))[1]::text end
    from tabs t where t.nspname not in (select nspname from managed)
)
select section, schema_name, object_name, value from r
 order by section collate "C", schema_name collate "C", object_name collate "C";

#!/usr/bin/env bash
# LOCAL STAGING VERIFICATION for migrations 002 + 003 on Supabase's own Postgres
# image, with PostgREST in front of it. Disposable: everything runs in throwaway
# containers on a private Docker network and is removed on exit. It never reads
# .env files or any SUPABASE_* / DATABASE_URL variable, and never connects to a
# hosted Supabase project. Synthetic @example.com data only.
#
#   scripts/tests/003/run-supabase-staging.sh [supabase/postgres tag]   (default 17.11.0.018)
#
# The functional/concurrency/rollback suite runs separately:
#   scripts/tests/003/run-local.sh supabase/postgres:<tag>
set -euo pipefail

TAG="${1:-17.11.0.018}"
IMG="supabase/postgres:$TAG"
PGRST_IMG="postgrest/postgrest:v14.18"
ID="ent-003-stg-$RANDOM"
DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS="$(cd "$DIR/../.." && pwd)"
OUT="${STAGING_OUT:-$(mktemp -d)}"; mkdir -p "$OUT"
PW="local-staging-$RANDOM$RANDOM$RANDOM"
JWT_SECRET="local-staging-jwt-$(python -c 'import secrets;print(secrets.token_hex(24))')"

cleanup() { docker rm -f "$ID-db" "$ID-rest" >/dev/null 2>&1 || true; docker network rm "$ID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

pass=0
ok()   { echo "ok - $1"; pass=$((pass + 1)); }
fail() { echo "FAIL: $1"; exit 1; }

echo "== staging: $IMG + $PGRST_IMG  (artifacts: $OUT)"
docker network create "$ID" >/dev/null
docker run -d --name "$ID-db" --network "$ID" --network-alias db -e POSTGRES_PASSWORD="$PW" "$IMG" >/dev/null
until docker logs "$ID-db" 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 1; done
until docker exec "$ID-db" pg_isready -U postgres -d postgres -q; do sleep 1; done
sleep 2

# psql as the role migrations run as in Supabase (postgres, not superuser), or as supabase_admin for setup/inspection.
q()  { docker exec -i "$ID-db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
# qa/dump pass the disposable, per-run container password to supabase_admin through the environment
# (not their argv): newer images (17.6.1.084) require it on the local socket, older ones (17.11, 15.19)
# trust the socket. The authenticator setup and PostgREST URI below still use it in argv; it is never logged.
qa() { PGPASSWORD="$PW" docker exec -i -e PGPASSWORD "$ID-db" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
dump() { PGPASSWORD="$PW" docker exec -e PGPASSWORD "$ID-db" pg_dump -U supabase_admin -d postgres --schema-only --schema=public --no-owner | grep -vE '^\\(un)?restrict ' > "$OUT/$1.sql"; }  # drop pg_dump's random per-run restrict token

echo "-- environment"
{
  echo "image: $IMG"; docker image inspect --format '{{index .RepoDigests 0}}' "$IMG"
  echo "postgrest: $PGRST_IMG"; docker image inspect --format '{{index .RepoDigests 0}}' "$PGRST_IMG"
  q -Atc "select version()"
  q -Atc "select 'migration role: ' || current_user || ' superuser=' || rolsuper || ' bypassrls=' || rolbypassrls from pg_roles where rolname = current_user"
  q -Atc "select 'role ' || rolname || ': inherit=' || rolinherit || ' bypassrls=' || rolbypassrls || ' login=' || rolcanlogin from pg_roles where rolname in ('anon','authenticated','service_role','authenticator') order by 1"
  q -Atc "select 'role config ' || rolname || ': ' || coalesce(array_to_string(rolconfig, ', '), '(none)') from pg_roles where rolname in ('anon','authenticated','service_role','authenticator','postgres') order by 1"
  q -Atc "select 'event trigger: ' || evtname || ' on ' || evtevent from pg_event_trigger order by 1"
  q -Atc "select 'setting ' || name || '=' || setting from pg_settings where name in ('max_connections','shared_buffers','work_mem','default_transaction_isolation','statement_timeout','lock_timeout','idle_in_transaction_session_timeout','TimeZone') order by 1"
  for f in 002_websites_services.sql 002_websites_services.down.sql 003_websites_crm_sync.sql 003_websites_crm_sync.down.sql; do
    echo "sha256 $(sha256sum "$SCRIPTS/$f" | cut -d' ' -f1)  scripts/$f"
  done
} | tee "$OUT/environment.txt"

# Supabase enables pg_graphql in hosted projects; the bare image doesn't. Mirror production.
if [ "$(qa -Atc "select count(*) from pg_available_extensions where name = 'pg_graphql'")" = 1 ]; then
  qa -c "create schema if not exists graphql" -c "create extension if not exists pg_graphql with schema graphql" >/dev/null
  ok "pg_graphql enabled, as in hosted Supabase"
else
  echo "note - pg_graphql not available in this image; GraphQL exposure not checked"
fi
qa -c "alter role authenticator with password '$PW'" >/dev/null

dump 00-baseline
echo "-- apply 002 then 003 as postgres (non-superuser), capturing server messages"
q < "$SCRIPTS/002_websites_services.sql" 2>&1 | tee "$OUT/apply-002.log"
dump 01-after-002
q < "$SCRIPTS/003_websites_crm_sync.sql" 2>&1 | tee "$OUT/apply-003.log"
dump 02-after-003
if grep -qiE "error|warning" "$OUT/apply-002.log" "$OUT/apply-003.log"; then fail "warnings or errors while applying"; fi
ok "002 and 003 applied as postgres with no errors or warnings (event triggers ran)"

echo "-- catalog: RLS, privileges against Supabase's real default ACLs, function hardening"
q <<'SQL' 2>&1 | sed 's/^.*NOTICE:  //' | tee "$OUT/catalog.log"
do $$
declare r record; bad int;
begin
  -- every website table in public has RLS enabled
  select count(*) into bad from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname like 'website%' and not c.relrowsecurity;
  if bad > 0 then raise exception 'FAIL: % website tables without RLS', bad; end if;
  raise notice 'ok - RLS enabled on every website_* table';

  -- anon/authenticated: no table privilege of any kind, on any website table or column
  select count(*) into bad
    from pg_class c cross join (values ('anon'), ('authenticated')) ro(role)
         cross join (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) p(priv)
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname like 'website%'
     and has_table_privilege(ro.role, c.oid, p.priv);
  if bad > 0 then raise exception 'FAIL: % anon/authenticated table privileges', bad; end if;
  select count(*) into bad
    from pg_attribute a join pg_class c on c.oid = a.attrelid cross join (values ('anon'), ('authenticated')) ro(role)
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname like 'website%' and a.attnum > 0 and not a.attisdropped
     and has_column_privilege(ro.role, c.oid, a.attnum, 'select,insert,update,references');
  if bad > 0 then raise exception 'FAIL: % anon/authenticated column privileges', bad; end if;
  raise notice 'ok - anon and authenticated hold no table or column privilege on website tables';

  -- service_role can use the 003 tables
  select count(*) into bad from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relname like 'website_crm_sync_%' and c.relkind = 'r'
     and not has_table_privilege('service_role', c.oid, 'select,insert,update,delete');
  if bad > 0 then raise exception 'FAIL: service_role missing privileges on % tables', bad; end if;
  raise notice 'ok - service_role has DML on the 003 tables';

  -- functions: anon/authenticated/public cannot execute; service_role can; invoker; empty search_path
  for r in select p.oid, p.oid::regprocedure as sig, p.prosecdef, p.proconfig, p.proacl from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname like 'websites_crm_%' loop
    if has_function_privilege('anon', r.oid, 'execute') or has_function_privilege('authenticated', r.oid, 'execute') then
      raise exception 'FAIL: % executable by anon/authenticated', r.sig; end if;
    if r.proacl::text like '%"=X/%' or r.proacl::text like '{=X/%' or r.proacl::text like '%,=X/%' then
      raise exception 'FAIL: % executable by PUBLIC: %', r.sig, r.proacl; end if;
    if not has_function_privilege('service_role', r.oid, 'execute') then raise exception 'FAIL: % not executable by service_role', r.sig; end if;
    if r.prosecdef then raise exception 'FAIL: % is SECURITY DEFINER', r.sig; end if;
    if r.proconfig is null or not ('search_path=""' = any(r.proconfig)) then raise exception 'FAIL: % search_path %', r.sig, r.proconfig; end if;
  end loop;
  raise notice 'ok - every websites_crm_* function: no anon/authenticated/PUBLIC execute, service_role execute, SECURITY INVOKER, search_path=""';

  -- Supabase advisor equivalents over the whole public schema
  select count(*) into bad from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proconfig is null and p.prokind = 'f';
  if bad > 0 then raise exception 'FAIL: % public functions with a mutable search_path (advisor 0011)', bad; end if;
  select count(*) into bad from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity;
  if bad > 0 then raise exception 'FAIL: % public tables without RLS (advisor 0013)', bad; end if;
  select count(*) into bad from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity
     and not exists (select 1 from pg_policy where polrelid = c.oid)
     and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'));
  if bad > 0 then raise exception 'FAIL: % RLS tables readable by API roles with no policy', bad; end if;
  raise notice 'ok - advisor-equivalent checks: no mutable search_path, no RLS-disabled table, no exposed policy-less table';
end $$;
SQL
grep -q "^FAIL\|ERROR" "$OUT/catalog.log" && fail "catalog checks"
pass=$((pass + $(grep -c "^ok - " "$OUT/catalog.log")))

if [ "$(q -Atc "select count(*) from pg_extension where extname = 'pg_graphql'")" = 1 ]; then
  echo "-- GraphQL: website tables are not in the anon/authenticated schema"
  for role in anon authenticated; do
    names=$(q -Atc "set role $role" -c "select graphql.resolve('{ __schema { types { name } } }')::text")
    if echo "$names" | grep -qiE "website|crm_sync"; then fail "$role sees website types over GraphQL"; fi
    ok "GraphQL schema for $role exposes no website or crm_sync type"
  done
fi

echo "-- PostgREST $PGRST_IMG as the Data API (authenticator -> anon/authenticated/service_role by JWT)"
docker run -d --name "$ID-rest" --network "$ID" -p 127.0.0.1::3000 \
  -e PGRST_DB_URI="postgres://authenticator:$PW@db:5432/postgres" -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$JWT_SECRET" "$PGRST_IMG" >/dev/null
PORT=$(docker port "$ID-rest" 3000/tcp | head -1 | sed 's/.*://')
API="http://127.0.0.1:$PORT"
for i in $(seq 1 30); do curl -s -o /dev/null "$API/" && break; sleep 1; done
jwt() { python - "$JWT_SECRET" "$1" <<'PY'
import base64, hashlib, hmac, json, sys, time
b = lambda d: base64.urlsafe_b64encode(json.dumps(d, separators=(",", ":")).encode()).rstrip(b"=")
h, p = b({"alg": "HS256", "typ": "JWT"}), b({"role": sys.argv[2], "iss": "local-staging", "exp": int(time.time()) + 3600})
s = base64.urlsafe_b64encode(hmac.new(sys.argv[1].encode(), h + b"." + p, hashlib.sha256).digest()).rstrip(b"=")
print((h + b"." + p + b"." + s).decode())
PY
}
ANON=$(jwt anon); AUTHN=$(jwt authenticated); SVC=$(jwt service_role)
req() { # method path token body -> "status body"
  curl -s -o "$OUT/resp.json" -w '%{http_code}' -X "$1" "$API$2" -H "Authorization: Bearer $3" -H 'Content-Type: application/json' ${4:+-d "$4"}
}
expect() { # label expected-status-regex actual
  if echo "$3" | grep -qE "^($2)$"; then ok "$1 -> HTTP $3"; else echo "body: $(cat "$OUT/resp.json")"; fail "$1 -> HTTP $3, expected $2"; fi
}

for tok in ANON AUTHN; do
  t=${!tok}; exp=$([ $tok = ANON ] && echo 401 || echo 403)
  expect "$tok GET /website_inquiries" "$exp|404" "$(req GET /website_inquiries "$t")"
  for tbl in website_crm_sync_alerts website_crm_sync_leases website_crm_sync_state; do
    expect "$tok GET /$tbl" "$exp|404" "$(req GET /$tbl "$t")"
  done
  expect "$tok POST /website_inquiries" "$exp|404" "$(req POST /website_inquiries "$t" '{"fields":{}}')"
  for fn in websites_crm_sync_health websites_crm_claim websites_crm_requeue websites_crm_record_success; do
    expect "$tok POST /rpc/$fn" "$exp|404" "$(req POST /rpc/$fn "$t" '{"p_worker":"x","p_id":"00000000-0000-0000-0000-000000000000","p_claim_token":"00000000-0000-0000-0000-000000000000","p_contact_id":"c","p_opportunity_id":"o"}')"
  done
done

q -c "insert into public.website_inquiries (idempotency_key, fields, consent, policy_versions, pricing_version, submitted_at)
      select gen_random_uuid(), jsonb_build_object('email', 'rest' || g || '@example.com'), '{}', '{}', 'p', now() - make_interval(secs => g)
        from generate_series(1, 3) g" >/dev/null
expect "service_role POST /rpc/websites_crm_sync_health" 200 "$(req POST /rpc/websites_crm_sync_health "$SVC" '{}')"
python -c "import json,sys; d=json.load(open(sys.argv[1])); assert isinstance(d, dict), d" "$OUT/resp.json" && ok "health returns a JSON object (counts only)"

before=$(q -Atc "select count(*) from public.website_inquiries where claim_token is not null")
code=$(req GET "/rpc/websites_crm_claim?p_worker=get-attempt&p_limit=1" "$SVC")
after=$(q -Atc "select count(*) from public.website_inquiries where claim_token is not null")
if [ "$code" = 200 ] || [ "$before" != "$after" ]; then fail "GET /rpc/websites_crm_claim claimed (HTTP $code)"; fi
ok "GET /rpc/websites_crm_claim is refused (HTTP $code, read-only transaction) and claims nothing"

expect "service_role POST /rpc/websites_crm_claim" 200 "$(req POST /rpc/websites_crm_claim "$SVC" '{"p_worker":"rest-worker","p_limit":1}')"
read -r CID CTOK < <(python -c 'import json,sys; d=json.load(open(sys.argv[1])); assert len(d)==1, d; print(d[0]["id"], d[0]["claim_token"])' "$OUT/resp.json" | tr -d '\015')
[ "$(q -Atc "select claim_token from public.website_inquiries where id = '$CID'")" = "$CTOK" ] || fail "claim not committed by the RPC request"
ok "claim over RPC returns one row with its claim_token, committed when the request ends"

expect "stale token record_success" 200 "$(req POST /rpc/websites_crm_record_success "$SVC" "{\"p_id\":\"$CID\",\"p_claim_token\":\"00000000-0000-0000-0000-000000000000\",\"p_contact_id\":\"c1\",\"p_opportunity_id\":\"o1\"}")"
[ "$(cat "$OUT/resp.json")" = false ] || fail "stale token accepted: $(cat "$OUT/resp.json")"
ok "record_success with a stale token returns false"

expect "record_failure (JSON array warnings, bigint retry)" 200 "$(req POST /rpc/websites_crm_record_failure "$SVC" "{\"p_id\":\"$CID\",\"p_claim_token\":\"$CTOK\",\"p_category\":\"network\",\"p_step\":\"opportunity\",\"p_outcome\":\"unknown\",\"p_error\":\"timeout\",\"p_retryable\":true,\"p_retry_after_ms\":90000,\"p_contact_id\":\"c1\",\"p_warnings\":[\"w\"]}")"
st=$(python -c 'import json,sys; print(json.load(open(sys.argv[1])))' "$OUT/resp.json" | tr -d '\015')
row=$(q -Atc "select status, last_outcome, (next_attempt_at - last_attempt_at) >= interval '300 seconds', last_warnings::text, claim_token is null from public.website_inquiries where id = '$CID'")
[ "$row" = "crm_failed|unknown|t|[\"w\"]|t" ] || fail "record_failure state: $st / $row"
ok "record_failure over RPC: status $st, ambiguous outcome deferred >= reconcile floor, warnings stored, claim cleared"

expect "invalid category is rejected" "400" "$(req POST /rpc/websites_crm_record_failure "$SVC" "{\"p_id\":\"$CID\",\"p_claim_token\":\"$CTOK\",\"p_category\":\"bogus\",\"p_step\":\"contact\",\"p_outcome\":\"failed\",\"p_error\":\"x\",\"p_retryable\":true}")"

# Supabase preloads pg-safeupdate for API connections (authenticator): UPDATE/DELETE
# without WHERE fails. Exercise every write path through PostgREST, not just psql.
expect "claim for release" 200 "$(req POST /rpc/websites_crm_claim "$SVC" '{"p_worker":"rest-worker","p_limit":1}')"
read -r RID RTOK < <(python -c 'import json,sys; d=json.load(open(sys.argv[1])); assert len(d)==1, d; print(d[0]["id"], d[0]["claim_token"])' "$OUT/resp.json" | tr -d '\015')
expect "release_claim over RPC" 200 "$(req POST /rpc/websites_crm_release_claim "$SVC" "{\"p_id\":\"$RID\",\"p_claim_token\":\"$RTOK\"}")"
[ "$(cat "$OUT/resp.json")" = true ] || fail "release_claim returned $(cat "$OUT/resp.json")"
[ "$(q -Atc "select claim_token is null and crm_attempts = 0 from public.website_inquiries where id = '$RID'")" = t ] || fail "release did not refund"
ok "release_claim over RPC frees the claim and refunds the attempt"

expect "claim for rate limit" 200 "$(req POST /rpc/websites_crm_claim "$SVC" '{"p_worker":"rest-worker","p_limit":1}')"
read -r RID RTOK < <(python -c 'import json,sys; d=json.load(open(sys.argv[1])); assert len(d)==1, d; print(d[0]["id"], d[0]["claim_token"])' "$OUT/resp.json" | tr -d '\015')
expect "record_failure rate_limited over RPC" 200 "$(req POST /rpc/websites_crm_record_failure "$SVC" "{\"p_id\":\"$RID\",\"p_claim_token\":\"$RTOK\",\"p_category\":\"rate_limited\",\"p_step\":\"contact\",\"p_outcome\":\"rejected\",\"p_error\":\"429\",\"p_retryable\":true,\"p_retry_after_ms\":600000}")"
[ "$(q -Atc "select paused_until > now() + interval '9 minutes' and pause_reason is not null from public.website_crm_sync_state")" = t ] || fail "queue not paused"
ok "rate_limited over RPC pauses the queue (state-table UPDATE passes safeupdate)"
expect "claim while paused" 200 "$(req POST /rpc/websites_crm_claim "$SVC" '{"p_worker":"rest-worker","p_limit":5}')"
[ "$(tr -d '[:space:]' < "$OUT/resp.json")" = "[]" ] || fail "claimed while paused: $(cat "$OUT/resp.json")"
ok "claim over RPC returns [] while the queue is paused"
q -c "update public.website_crm_sync_state set paused_until = null, pause_reason = null where id" \
  -c "update public.website_inquiries set status = 'needs_attention', needs_attention_at = now(), needs_attention_reason = 'test', claim_token = null, claimed_by = null, claim_expires_at = null where id = '$RID'" >/dev/null
expect "requeue over RPC" 200 "$(req POST /rpc/websites_crm_requeue "$SVC" "{\"p_id\":\"$RID\"}")"
[ "$(cat "$OUT/resp.json")" = true ] || fail "requeue returned $(cat "$OUT/resp.json")"
ok "requeue over RPC moves a needs_attention row back to the queue"

echo "-- query plans and latency (auto_explain on the claim's inner statements)"
perf() { # label due-rows emails synced-rows
  qa >/dev/null <<SQL
delete from public.website_crm_sync_alerts; delete from public.website_crm_sync_leases; delete from public.website_inquiries;
insert into public.website_inquiries (idempotency_key, fields, consent, policy_versions, pricing_version, submitted_at)
select gen_random_uuid(), jsonb_build_object('email', 'perf' || (g % $3) || '@example.com'), '{}', '{}', 'p', now() - make_interval(secs => g)
  from generate_series(1, $2) g;
insert into public.website_inquiries (idempotency_key, status, fields, consent, policy_versions, pricing_version, submitted_at, crm_contact_id, crm_opportunity_id, crm_synced_at)
select gen_random_uuid(), 'crm_synced', jsonb_build_object('email', 'done' || g || '@example.com'), '{}', '{}', 'p', now() - interval '1 day', 'c', 'o', now()
  from generate_series(1, $4) g;
analyze public.website_inquiries; analyze public.website_crm_sync_leases;
SQL
  {
    echo "### $1: $2 due rows over $3 emails, $4 synced rows"
    qa <<'SQL' 2>&1 | sed -n '/Query Text/,$p' | grep -vE "^\s*$" | awk 'NR <= 200'
load 'auto_explain';
set auto_explain.log_min_duration = 5;  -- skip the per-row email-key calls set auto_explain.log_analyze = on; set auto_explain.log_buffers = on;
set auto_explain.log_nested_statements = on; set client_min_messages = log;
begin; set local role service_role;
select count(*) from public.websites_crm_claim('perf', 10);
rollback;
SQL
    echo "#### latency, 20 claims of 10 (each rolled back)"
    for i in $(seq 1 20); do
      qa -c "\timing on" -c "begin" -c "set local role service_role" -c "select count(*) from public.websites_crm_claim('perf', 10)" -c "rollback" 2>&1 | grep -E "^Time" | sed -n '3p'
    done | sed 's/Time: \([0-9.]*\) ms.*/\1/' | sort -n | awk '{a[NR]=$1} END {printf "min %.1f ms, median %.1f ms, p95 %.1f ms, max %.1f ms\n", a[1], a[int(NR/2)+1], a[int(NR*0.95)], a[NR]}'
  } | tee -a "$OUT/perf.md"
}
: > "$OUT/perf.md"
perf "typical"      5000  5000  5000
perf "hot emails"   5000    50  5000
perf "large backlog" 50000 50000 50000
med=$(grep -E "^min" "$OUT/perf.md" | tail -1 | sed 's/.*median \([0-9.]*\) ms.*/\1/')
python -c "import sys; sys.exit(0 if float('$med') < 2000 else 1)" || fail "claim median $med ms on 50k backlog"
ok "claim latency recorded for 5k, 5k-hot and 50k backlogs (50k median $med ms)"

echo "-- rollback as postgres, schema-dump comparison, re-apply"
qa -c "delete from public.website_crm_sync_alerts" -c "delete from public.website_crm_sync_leases" -c "delete from public.website_inquiries" >/dev/null
q < "$SCRIPTS/003_websites_crm_sync.down.sql" 2>&1 | tee "$OUT/rollback-003.log"
dump 03-after-rollback
diff -u "$OUT/01-after-002.sql" "$OUT/03-after-rollback.sql" > "$OUT/rollback.diff" || fail "schema after rollback differs from 002 (see rollback.diff)"
ok "public schema dump (tables, constraints, indexes, policies, grants) after rollback is identical to 002-only"
q < "$SCRIPTS/003_websites_crm_sync.sql" >/dev/null 2>&1
dump 04-reapplied
diff -q "$OUT/02-after-003.sql" "$OUT/04-reapplied.sql" >/dev/null || fail "re-applied 003 differs from first apply"
ok "003 re-applied after rollback gives an identical schema"
q < "$SCRIPTS/003_websites_crm_sync.down.sql" >/dev/null 2>&1
q < "$SCRIPTS/002_websites_services.down.sql" >/dev/null 2>&1
dump 05-after-002-down
diff -q "$OUT/00-baseline.sql" "$OUT/05-after-002-down.sql" >/dev/null || fail "002 down did not return to baseline"
ok "003 down then 002 down returns the public schema to the untouched Supabase baseline"

echo "== STAGING CHECKS PASSED on $IMG: $pass checks"

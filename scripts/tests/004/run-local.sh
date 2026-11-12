#!/usr/bin/env bash
# LOCAL TEST HARNESS for migration 004. Starts a throwaway Postgres container,
# never touches Supabase, staging or production. Synthetic @example.com data only.
#
#   scripts/tests/004/run-local.sh [postgres image]   (default postgres:17-alpine)
set -euo pipefail

IMG="${1:-postgres:17-alpine}"
NAME="ent-004-test-$RANDOM"
DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS="$(cd "$DIR/../.." && pwd)"
UP004="${MIGRATION_004:-$SCRIPTS/004_websites_lifecycle.sql}"   # override only for mutation checks
DOWN004="$SCRIPTS/004_websites_lifecycle.down.sql"

TMP="$(mktemp -d)"   # per run, so parallel runs (e.g. with and without WITH_003) cannot read each other's output
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

echo "== $IMG"
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=local-test-only -e POSTGRES_DB=t "$IMG" >/dev/null
until docker logs "$NAME" 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 1; done
until docker exec "$NAME" pg_isready -U postgres -d t -q; do sleep 1; done
sleep 2

q()  { docker exec -i "$NAME" psql -U postgres -d t -v ON_ERROR_STOP=1 -q "$@"; }
qf() { q < "$1"; }
okq() { # okq <sql returning a line that starts with ok>: print it, fail otherwise
  local out; out="$(q -Atc "$1")"; echo "$out"; [[ $out == ok* ]] || { echo "FAIL: $1"; exit 1; }
}
must_fail() { # must_fail <label> <expected message fragment> <file>
  local out
  if out="$(qf "$3" 2>&1)"; then echo "FAIL: $1 succeeded"; exit 1; fi
  if [[ $out != *"$2"* ]]; then echo "FAIL: $1 failed, but not on the guard ($2): $out"; exit 1; fi
  echo "ok - $1"
}

qf "$DIR/../003/00_supabase_roles.sql"

must_fail "004 refuses to run before 002" "requires 002_websites_services.sql" "$UP004"

qf "$SCRIPTS/002_websites_services.sql"
# Production order is 002, 003, 004. WITH_003=1 proves 004 on top of 003.
if [ -n "${WITH_003:-}" ]; then qf "$SCRIPTS/003_websites_crm_sync.sql"; echo "ok - 003 applied before 004"; fi

echo "-- 002-era rows survive 004"
q <<'SQL'
insert into public.website_projects (id, state, package_id, acceptance, approved_at)
values ('00000000-0000-0000-0000-0000000000a1', 'approved', 'starter', '{"setupPriceCents":19900}', now());
insert into public.website_project_events (project_id, event, from_state, to_state, actor)
values ('00000000-0000-0000-0000-0000000000a1', 'approve', 'proposal_sent', 'approved', 'legacy'),
       ('00000000-0000-0000-0000-0000000000a1', 'noop',    'approved',      'approved', 'legacy');
insert into public.website_payment_events (provider_event_id, provider, type, project_id)
values ('legacy-evt-1', 'sandbox', 'charge.succeeded', '00000000-0000-0000-0000-0000000000a1');
SQL
echo "-- preflight (read-only) passes on a 002 database and changes nothing"
before="$(q -Atc "select (select count(*) from public.website_projects) || ':' || (select count(*) from public.website_project_events) || ':' || (select count(*) from public.website_payment_events)")"
qf "$SCRIPTS/preflight/004_preflight.sql" 2>&1 | grep -aE "ok - |info - |PASSED|FAIL" | sed 's/^psql:[^ ]* NOTICE:  //'
[ "$(q -Atc "select (select count(*) from public.website_projects) || ':' || (select count(*) from public.website_project_events) || ':' || (select count(*) from public.website_payment_events)")" = "$before" ] || { echo "FAIL: preflight changed data"; exit 1; }
must_fail "post-apply verification fails before 004 is applied" "is missing" "$SCRIPTS/preflight/004_post_apply_verify.sql"
qf "$UP004"
echo "-- post-apply verification passes, and the preflight now refuses (004 already applied)"
qf "$SCRIPTS/preflight/004_post_apply_verify.sql" 2>&1 | grep -aE "ok - |info - |PASSED|FAIL" | sed 's/^psql:[^ ]* NOTICE:  //'
must_fail "preflight refuses once 004 is applied" "004 is already applied" "$SCRIPTS/preflight/004_preflight.sql"
okq "select case when (select count(*) from public.website_projects where id = '00000000-0000-0000-0000-0000000000a1'
                                and state = 'approved' and mode = 'sandbox' and version = 0 and preview_deliveries = '[]'::jsonb) = 1
                     and (select count(distinct event_id) from public.website_project_events) = 2
                     and (select count(*) from public.website_project_events where mode = 'sandbox') = 2
                     and (select count(*) from public.website_payment_events where provider_event_id = 'legacy-evt-1' and lifecycle_event is null) = 1
               then 'ok - legacy project, events (unique ids backfilled) and payment event intact' else 'FAIL legacy rows' end"
q -c "update public.website_projects set updated_at = now() where id = '00000000-0000-0000-0000-0000000000a1'" >/dev/null
echo "ok - a legacy project can still be updated"

must_fail "004 refuses to run twice" "004 is already applied" "$UP004"

echo "-- functional"
qf "$DIR/10_functional.sql" 2>&1 | grep -E "ok - |FAIL|PASSED|ERROR" | sed 's/^psql:[^ ]* NOTICE:  //' | tee $TMP/ent-004-functional.log
if grep -qE "FAIL|ERROR" $TMP/ent-004-functional.log || ! grep -q "FUNCTIONAL: ALL PASSED" $TMP/ent-004-functional.log; then echo "FAIL: functional suite"; exit 1; fi

echo "-- concurrency: 8 sessions commit the same version with different event ids"
PID="$(q -Atc "set role service_role; insert into public.website_projects default values returning id" | head -1)"
PID="$(echo "$PID" | grep -Eo '[0-9a-f-]{36}' | head -1)"
commit_sql() { # <expected version> <event id>
  echo "set role service_role; select public.website_lifecycle_commit('$PID', $1, to_jsonb(w) || '{\"state\":\"qualified\"}', '$2', '{\"event\":\"qualify\",\"from\":\"preview_requested\",\"to\":\"qualified\",\"actor\":\"owner:t\",\"at\":\"2026-11-20T15:00:00Z\"}', null, null) from public.website_projects w where w.id = '$PID';"
}
rm -f $TMP/ent-004-c-*.out
pids=()
for s in 1 2 3 4 5 6 7 8; do
  ( commit_sql 0 "conc-$s" | docker exec -i "$NAME" psql -U postgres -d t -At -q > "$TMP/ent-004-c-$s.out" 2>&1 ) & pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
committed="$(cat $TMP/ent-004-c-*.out | grep -c '^committed$' || true)"
conflicts="$(cat $TMP/ent-004-c-*.out | grep -c '^version_conflict$' || true)"
if [ "$committed" != 1 ] || [ "$conflicts" != 7 ]; then echo "FAIL: expected 1 committed + 7 version_conflict, got $committed + $conflicts"; cat $TMP/ent-004-c-*.out; exit 1; fi
echo "ok - exactly one of 8 concurrent commits at the same version won ($committed committed, $conflicts version_conflict)"
v="$(q -Atc "select version from public.website_projects where id = '$PID'")"
n="$(q -Atc "select count(*) from public.website_project_events where project_id = '$PID'")"
if [ "$v" != 1 ] || [ "$n" != 1 ]; then echo "FAIL: version=$v events=$n, expected 1 and 1"; exit 1; fi
echo "ok - one version bump and one audit row"

echo "-- concurrency: 8 sessions replay the same event id"
rm -f $TMP/ent-004-c-*.out
pids=()
for s in 1 2 3 4 5 6 7 8; do
  ( commit_sql 1 "same-event" | docker exec -i "$NAME" psql -U postgres -d t -At -q > "$TMP/ent-004-c-$s.out" 2>&1 ) & pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
committed="$(cat $TMP/ent-004-c-*.out | grep -c '^committed$' || true)"
replayed="$(cat $TMP/ent-004-c-*.out | grep -c '^event_exists$' || true)"
if [ "$committed" != 1 ] || [ "$replayed" != 7 ]; then echo "FAIL: expected 1 committed + 7 event_exists, got $committed + $replayed"; cat $TMP/ent-004-c-*.out; exit 1; fi
echo "ok - the same event id applied exactly once under 8-way replay"
rm -f $TMP/ent-004-c-*.out

echo "-- concurrency: 8 sessions send a NULL expected version (F3: must never commit)"
before="$(q -Atc "select version || ':' || (select count(*) from public.website_project_events where project_id = '$PID') from public.website_projects where id = '$PID'")"
pids=()
for s in 1 2 3 4 5 6 7 8; do
  ( commit_sql null "null-$s" | docker exec -i "$NAME" psql -U postgres -d t -At -q > "$TMP/ent-004-c-$s.out" 2>&1 ) & pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
refused="$(cat $TMP/ent-004-c-*.out | grep -c 'expected version must be a non-negative integer' || true)"
leaked="$(cat $TMP/ent-004-c-*.out | grep -c '^committed$' || true)"
after="$(q -Atc "select version || ':' || (select count(*) from public.website_project_events where project_id = '$PID') from public.website_projects where id = '$PID'")"
if [ "$refused" != 8 ] || [ "$leaked" != 0 ] || [ "$before" != "$after" ]; then echo "FAIL: NULL version: refused=$refused committed=$leaked before=$before after=$after"; cat $TMP/ent-004-c-*.out; exit 1; fi
echo "ok - 8 concurrent NULL-version commits were all refused; version and audit rows unchanged ($after)"
rm -f $TMP/ent-004-c-*.out

echo "-- reset to 002-era data (TRUNCATE skips the append-only triggers; this is a throwaway database)"
q <<'SQL'
truncate public.website_communication_intents, public.website_project_rejections, public.website_payment_events,
         public.website_project_events, public.website_projects cascade;
insert into public.website_projects (id, state, package_id, acceptance, approved_at)
values ('00000000-0000-0000-0000-0000000000a1', 'approved', 'starter', '{"setupPriceCents":19900}', now());
insert into public.website_project_events (project_id, event_id, event, from_state, to_state, actor, mode)
values ('00000000-0000-0000-0000-0000000000a1', 'l1', 'approve', 'proposal_sent', 'approved', 'legacy', 'sandbox'),
       ('00000000-0000-0000-0000-0000000000a1', 'l2', 'noop',    'approved',      'approved', 'legacy', 'sandbox');
insert into public.website_payment_events (provider_event_id, provider, type, project_id, mode, lifecycle_event, attested, body_sha256, verified_at)
values ('legacy-evt-1', 'sandbox', 'charge.succeeded', '00000000-0000-0000-0000-0000000000a1', 'sandbox', 'setup_payment_succeeded', '{}',
        '0000000000000000000000000000000000000000000000000000000000000001', now());
SQL
echo "-- rollback refuses while a project is in a state 002 cannot hold"
q <<'SQL'
insert into public.website_projects (id, state) values ('00000000-0000-0000-0000-0000000000b1', 'preview_approved');
SQL
must_fail "004 rollback refuses with a post-002 state" "migration 002 cannot hold" "$DOWN004"
okq "select case when to_regclass('public.website_project_rejections') is not null then 'ok - 004 intact after the refused rollback' else 'FAIL' end"
q -c "update public.website_projects set state = 'preview_requested' where id = '00000000-0000-0000-0000-0000000000b1'" >/dev/null

echo "-- rollback round trip"
qf "$DOWN004"
q <<'SQL' 2>&1 | grep -E "ok - |FAIL|ERROR"
do $$
begin
  if to_regclass('public.website_project_rejections') is not null or to_regclass('public.website_communication_intents') is not null then raise exception 'FAIL: 004 tables remain'; end if;
  if exists (select 1 from pg_proc where proname in ('website_lifecycle_commit', 'website_projects_guard', 'website_audit_append_only')) then raise exception 'FAIL: 004 functions remain'; end if;
  if exists (select 1 from information_schema.columns where table_name = 'website_projects' and column_name in ('mode', 'version', 'launch_verification', 'proposal')) then raise exception 'FAIL: 004 project columns remain'; end if;
  if exists (select 1 from information_schema.columns where table_name = 'website_project_events' and column_name in ('event_id', 'mode')) then raise exception 'FAIL: 004 event columns remain'; end if;
  if exists (select 1 from information_schema.columns where table_name = 'website_payment_events' and column_name in ('mode', 'attested', 'body_sha256')) then raise exception 'FAIL: 004 payment columns remain'; end if;
  if (select count(*) from public.website_project_events where project_id = '00000000-0000-0000-0000-0000000000a1') <> 2 then raise exception 'FAIL: legacy audit rows lost'; end if;
  if (select count(*) from public.website_payment_events where provider_event_id = 'legacy-evt-1') <> 1 then raise exception 'FAIL: legacy payment event lost'; end if;
  raise notice 'ok - 004 objects dropped, 002-era rows and audit kept';
  begin
    update public.website_projects set state = 'preview_approved' where id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'FAIL: 002 state check not restored';
  exception when check_violation then raise notice 'ok - 002 state check restored'; end;
  begin
    update public.website_projects set subscription_id = 's', launched_at = null where id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'FAIL: 002 subscription constraint not restored';
  exception when check_violation then raise notice 'ok - 002 subscription constraint restored'; end;
end $$;
SQL
qf "$UP004"
echo "ok - 004 re-applies after rollback"
qf "$DOWN004"
if [ -n "${WITH_003:-}" ]; then qf "$SCRIPTS/003_websites_crm_sync.down.sql"; fi
qf "$SCRIPTS/002_websites_services.down.sql"
okq "select case when to_regclass('public.website_projects') is null then 'ok - 004 down then 002 down leaves no website_* tables' else 'FAIL' end"

echo "== ALL 004 LOCAL TESTS PASSED on $IMG"

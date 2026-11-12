#!/usr/bin/env bash
# LOCAL TEST HARNESS for migration 003. Starts a throwaway Postgres container,
# never touches Supabase, staging or production. Synthetic @example.com data only.
#
#   scripts/tests/003/run-local.sh [postgres image]   (default postgres:17-alpine)
set -euo pipefail

IMG="${1:-postgres:17-alpine}"
NAME="ent-003-test-$RANDOM"
DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS="$(cd "$DIR/../.." && pwd)"
UP003="${MIGRATION_003:-$SCRIPTS/003_websites_crm_sync.sql}"   # override only for mutation checks

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "== $IMG"
case "$IMG" in
  # Supabase's own Postgres image: real roles, default privileges and event
  # triggers. Migrations run as the non-superuser `postgres` role, as in Supabase.
  supabase/postgres*) SUPABASE_IMG=1; DB=postgres
    docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD="local-staging-$RANDOM$RANDOM" "$IMG" >/dev/null ;;
  *) SUPABASE_IMG=; DB=t
    docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=local-test-only -e POSTGRES_DB=t "$IMG" >/dev/null ;;
esac
until docker logs "$NAME" 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 1; done
until docker exec "$NAME" pg_isready -U postgres -d "$DB" -q; do sleep 1; done
sleep 2
docker exec "$NAME" psql -U postgres -d "$DB" -Atc "select version()" -c "select 'connected as ' || current_user || ', superuser=' || rolsuper from pg_roles where rolname = current_user"

q()  { docker exec -i "$NAME" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }
qf() { q < "$1"; }

if [ -z "$SUPABASE_IMG" ]; then qf "$DIR/00_supabase_roles.sql"; fi

echo "-- precondition: 003 without 002 must fail"
if qf "$UP003" >/dev/null 2>&1; then echo "FAIL: 003 applied without 002"; exit 1; fi
echo "ok - 003 refuses to run before 002"

qf "$SCRIPTS/002_websites_services.sql"

echo "-- 002-era rows survive 003 and become due"
q <<'SQL'
insert into public.website_inquiries (idempotency_key, status, fields, consent, policy_versions, pricing_version, submitted_at, crm_attempts, last_error)
values (gen_random_uuid(), 'crm_failed', '{"email":"legacy-failed@example.com"}', '{}', '{}', 'p', now(), 1, 'opportunity:503');
SQL
qf "$UP003"
q -Atc "select case when status = 'crm_failed' and crm_attempts = 1 and next_attempt_at <= now() and last_warnings = '[]'::jsonb
               then 'ok - legacy crm_failed row intact and due' else 'FAIL legacy row' end
          from public.website_inquiries where fields->>'email' = 'legacy-failed@example.com'" | tee /dev/stderr | grep -q '^ok'

echo "-- 003 twice must fail"
if qf "$UP003" >/dev/null 2>&1; then echo "FAIL: 003 applied twice"; exit 1; fi
echo "ok - 003 refuses to run twice"

qf "$DIR/05_test_helpers.sql"
if [ -z "${SKIP_FUNCTIONAL:-}" ]; then   # SKIP_FUNCTIONAL=1 only for mutation checks of the concurrency suite
  echo "-- functional"
  qf "$DIR/10_functional.sql" 2>&1 | grep -E "ok - |FAIL|PASSED|ERROR" | sed 's/^psql:[^ ]* NOTICE:  //'
fi

echo "-- concurrency: 8 workers + sampler on a 400-row queue"
qf "$DIR/20_concurrency_setup.sql"
pids=()
q -c "set role service_role" -c "call t.sample(6)" & pids+=($!)
for s in 1 2 3 4 5 6 7 8; do
  q -c "set role service_role" -c "call t.work('w$s', 40)" & pids+=($!)
done
fail=0
for p in "${pids[@]}"; do wait "$p" || fail=1; done
if [ "$fail" -ne 0 ]; then echo "FAIL: a worker or the sampler errored (deadlock or exception)"; exit 1; fi
echo "ok - 8 concurrent workers finished without errors or deadlocks"
qf "$DIR/21_concurrency_check.sql" 2>&1 | grep -E "ok - |FAIL|PASSED|ERROR" | sed 's/^psql:[^ ]* NOTICE:  //'

echo "-- claim is non-blocking and skips a same-email claim held by an open transaction"
q <<'SQL'
set role service_role;
select t.reset();
insert into public.website_inquiries (idempotency_key, fields, consent, policy_versions, pricing_version, submitted_at)
select gen_random_uuid(), jsonb_build_object('email', 'hold' || (g % 10) || '@example.com'), '{}', '{}', 'p', now() - make_interval(secs => g)
  from generate_series(1, 20) g;
reset role;
create table if not exists t.hold (who text, email_key text, elapsed_ms numeric);
grant all on t.hold to service_role;
SQL
q <<'SQL' &
begin;
set local role service_role;
insert into t.hold select 'A', public.websites_crm_email_key(fields->>'email', id), null from public.websites_crm_claim('holdA', 1);
select pg_sleep(4);
commit;
SQL
apid=$!
sleep 1.5
q <<'SQL'
set role service_role;
do $$
declare t0 timestamptz := clock_timestamp();
begin
  insert into t.hold select 'B', public.websites_crm_email_key(fields->>'email', id), null from public.websites_crm_claim('holdB', 10);
  insert into t.hold values ('B-time', null, extract(epoch from clock_timestamp() - t0) * 1000);
end $$;
SQL
wait "$apid"
q <<'SQL' 2>&1 | grep -E "ok - |FAIL|ERROR" | sed 's/^psql:[^ ]* NOTICE:  //'
do $$ begin
  perform t.ok((select count(*) from t.hold where who = 'A') = 1, 'holder A claimed one inquiry');
  perform t.ok((select elapsed_ms from t.hold where who = 'B-time') < 1000, 'claimer B did not block on A''s open transaction');
  perform t.ok(not exists (select 1 from t.hold a join t.hold b on a.email_key = b.email_key where a.who = 'A' and b.who = 'B'),
               'B never claimed A''s email while A''s claim was uncommitted');
  perform t.ok((select count(*) from t.hold where who = 'B') >= 5, 'B still claimed other emails');
end $$;
SQL

echo "-- review M1: a locked expired lease row never stalls claimers of other emails"
q <<'SQL'
set role service_role;
select t.reset();
-- One expired lease (stale) plus 10 due inquiries for other emails.
insert into public.website_inquiries (idempotency_key, fields, consent, policy_versions, pricing_version, submitted_at)
select gen_random_uuid(), jsonb_build_object('email', 'gc' || g || '@example.com'), '{}', '{}', 'p', now() from generate_series(0, 10) g;
insert into public.website_crm_sync_leases (email_key, inquiry_id, claim_token, claimed_by, expires_at)
select public.websites_crm_email_key(fields->>'email', id), id, gen_random_uuid(), 'gone', now() - interval '1 hour'
  from public.website_inquiries where fields->>'email' = 'gc0@example.com';
update public.website_inquiries set status = 'crm_synced', crm_contact_id = 'c', crm_opportunity_id = 'o' where fields->>'email' = 'gc0@example.com';
reset role;
truncate t.hold;
SQL
q <<'SQL' &
begin;
set local role service_role;
select 1 from public.website_crm_sync_leases where expires_at < now() for update;
select pg_sleep(4);
commit;
SQL
lpid=$!
sleep 1.5
q <<'SQL'
set role service_role;
do $$
declare t0 timestamptz := clock_timestamp(); n int;
begin
  select count(*) into n from public.websites_crm_claim('gc', 10);
  insert into t.hold values ('GC-time', null, extract(epoch from clock_timestamp() - t0) * 1000);
  insert into t.hold values ('GC-count', null, n);
end $$;
SQL
wait "$lpid"
q <<'SQL' 2>&1 | grep -E "ok - |FAIL|ERROR" | sed 's/^psql:[^ ]* NOTICE:  //'
do $$ begin
  perform t.ok((select elapsed_ms from t.hold where who = 'GC-time') < 1000, 'claimer not blocked by a locked expired lease');
  perform t.ok((select elapsed_ms from t.hold where who = 'GC-count') = 10, 'all 10 other emails claimed');
end $$;
SQL

echo "-- rollback round trip"
q <<'SQL'
set role service_role;
select t.reset();
reset role;
insert into public.website_inquiries (idempotency_key, status, fields, consent, policy_versions, pricing_version, submitted_at, crm_contact_id, crm_opportunity_id)
values (gen_random_uuid(), 'crm_synced', '{"email":"legacy-synced@example.com"}', '{}', '{}', 'p', now(), 'ct_legacy', 'op_legacy');
insert into public.website_inquiries (idempotency_key, status, fields, consent, policy_versions, pricing_version, submitted_at, needs_attention_at, needs_attention_reason, crm_attempts)
values (gen_random_uuid(), 'needs_attention', '{"email":"attention@example.com"}', '{}', '{}', 'p', now(), now(), 'attempts_exhausted', 6);
SQL
echo "-- rollback refuses while a live claim exists"
q -c "insert into public.website_inquiries (idempotency_key, fields, consent, policy_versions, pricing_version, submitted_at) values (gen_random_uuid(), '{\"email\":\"live@example.com\"}', '{}', '{}', 'p', now())" \
  >/dev/null
claimed="$(q -At -c "set role service_role" -c "select count(*) from public.websites_crm_claim('live', 1)")" || claimed=error
live="$(q -Atc "select count(*) from public.website_inquiries where fields ->> 'email' = 'live@example.com' and claim_token is not null and claim_expires_at > now()")"
if [ "$claimed" != 1 ] || [ "$live" != 1 ]; then
  echo "FAIL: guard precondition: claimed=$claimed live_claims=$live, expected 1 and 1"
  q -At -c "select 'diag: status=' || status || ' attempts=' || crm_attempts || ' due_in_ms=' || round(extract(epoch from next_attempt_at - clock_timestamp()) * 1000) || ' claim=' || (claim_token is not null) from public.website_inquiries where fields ->> 'email' = 'live@example.com'" \
    -c "select 'diag: paused_until=' || coalesce(paused_until::text, 'null') || ' max_attempts=' || max_attempts from public.website_crm_sync_state" \
    -c "select 'diag: leases=' || count(*) || ' live_leases=' || count(*) filter (where expires_at >= clock_timestamp()) from public.website_crm_sync_leases" \
    -c "select 'diag: other client sessions=' || count(*) from pg_stat_activity where pid <> pg_backend_pid() and backend_type = 'client backend'" \
    -c "select 'diag: advisory locks held=' || count(*) from pg_locks where locktype = 'advisory'"
  exit 1
fi
echo "ok - live claim taken before the rollback attempt (claimed=1)"
if out="$(qf "$SCRIPTS/003_websites_crm_sync.down.sql" 2>&1)"; then echo "FAIL: rollback ran with a live claim"; exit 1; fi
if [[ $out != *'live CRM sync claims or reconcile-window leases exist'* ]]; then
  echo "FAIL: rollback failed, but not on the live-claim guard: $out"; exit 1
fi
echo "ok - rollback refused with a live claim (guard message)"
intact="$(q -Atc "select to_regclass('public.website_crm_sync_leases') is not null and to_regclass('public.website_crm_sync_state') is not null
                      and to_regclass('public.website_crm_sync_alerts') is not null
                      and (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'websites\_crm\_%') = 7
                      and exists (select 1 from pg_attribute where attrelid = 'public.website_inquiries'::regclass and attname = 'claim_token' and not attisdropped)
                      and (select count(*) from public.website_inquiries where claim_token is not null and claim_expires_at > now()) = 1")"
if [ "$intact" != t ]; then echo "FAIL: 003 not intact after the refused rollback"; exit 1; fi
echo "ok - 003 intact after the refused rollback (3 tables, 7 functions, claim columns, live claim)"
q -c "delete from public.website_inquiries where fields->>'email' = 'live@example.com'"
qf "$SCRIPTS/003_websites_crm_sync.down.sql"
qf "$DIR/30_migration_roundtrip.sql" 2>&1 | grep -E "ok - |FAIL|PASSED|ERROR" | sed 's/^psql:[^ ]* NOTICE:  //'
qf "$UP003"
echo "ok - 003 re-applies after rollback"
qf "$SCRIPTS/003_websites_crm_sync.down.sql"
qf "$SCRIPTS/002_websites_services.down.sql"
q -Atc "select case when to_regclass('public.website_inquiries') is null then 'ok - 003 down then 002 down leaves no website_* tables' else 'FAIL' end" | tee /dev/stderr | grep -q '^ok'

echo "== ALL 003 LOCAL TESTS PASSED on $IMG"

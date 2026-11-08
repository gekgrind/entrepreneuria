# Migration 003: production preflight results (read-only)

**Status:** the corrected preflight was re-run on 2026-11-08 under the owner's approval "PREFLIGHT CORRECTIONS AND TEST-HARNESS HARDENING".

**Recommendation: GO, with conditions.** It's GO to prepare an apply plan for **002 and then 003**. Applying either still needs separate approval.
- No genuine blockers remain.
- The one STOP (row 20, 002 not applied) is the expected prerequisite.

## 1. Execution record

| Item | Value |
|---|---|
| Project | `entrepreneuria-site`, ref `rifzbzaabkaeagyulxip` (the same ref as the app's `NEXT_PUBLIC_SUPABASE_URL`), Supabase Postgres 17.6.1.084 |
| Query file | `scripts/preflight/003_production_preflight.sql`, sha256 `bddf0be8acf5ac4474d1b04b760ddf5164b069e348af8a827ec6a2722ee9e9d4` (corrected; §4) |
| Sent as | The file verbatim, preceded by the execution wrapper `set local statement_timeout = '30s'; set local lock_timeout = '2s';` |
| Read-only proof | A probe in the same form returned `transaction_read_only=on`, `statement_timeout=30s`, `lock_timeout=2s`. Row 54 reports `2s / 30s`. |
| Not run | 002, 003, rollback scripts, and any write, DDL or configuration change |
| Data returned | Catalog facts and counts only. No table contents. |

**First run** (same day, original query sha256 `66a43b6d…4032`): 17 PASS, 2 STOP, 2 REVIEW, 20 INFO. Three of those results were false positives: the broad `website%` filter matched Prospra's `public.website_intelligence`. That run also included two read-only catalog lookups and a Security Advisor read (§5).

## 2. Corrected run: all 41 checks

### PASS (17)

| Row | Check | Observed |
|---|---|---|
| 10 | server_version | 17.6 |
| 11 | running as | postgres (superuser=false, bypassrls=true) |
| 12 | API roles | all 4 present; service_role bypassrls=true |
| 13 | built-ins 003 uses | gen_random_uuid, sha256, hashtextextended present |
| 25 | triggers on Websites service tables | 0 |
| 26 | RLS policies on Websites service tables | 0 |
| 30 | 003 tables present | 0 of 3 |
| 31 | 003 columns on website_inquiries | 0 of 14 |
| 32 | 003 constraint names in use | 0 |
| 33 | 003 index names in use | 0 |
| 34 | `websites_crm_*` functions | 0 |
| 50 | transactions open > 60 s | 0 |
| 51 | sessions idle in transaction | 0 |
| 52 | locks on website_inquiries | 0 |
| 64 | service tables in a realtime publication | 0 |
| 70 | pg_cron jobs | pg_cron not installed |
| 73 | sessions running CRM sync SQL | 0 |

### STOP (1)

| Row | Check | Observed | Classification |
|---|---|---|---|
| 20 | 002 tables present | 0 of 4 | **Expected prerequisite, not a blocker.** 002 was never applied; `main` has no websites code. Apply 002 under its own approval, re-run this preflight, then apply 003. |

### REVIEW (0)

None.

### INFO (23: 13 recorded, 10 not applicable until 002 exists)

| Row | Check | Observed |
|---|---|---|
| 14 | extensions | pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1 |
| 15 | role settings | authenticator: safeupdate, statement_timeout=8s, lock_timeout=8s; postgres: search_path only; service_role: none |
| 16 | database size | 22 MB |
| 35 | CLI migration history | 16 rows (Architecta, Channelwright, Prospra); 0 website-named |
| 40 | website_inquiries rows | table absent |
| 44 | rows without an email | n/a |
| 45 | website_inquiries size | n/a |
| 53 | website_inquiries write statistics | n/a |
| 54 | session lock_timeout / statement_timeout | 2s / 30s |
| 63 | default anon EXECUTE on new public functions | from postgres and supabase_admin (003 revokes explicitly) |
| 71 | pg_net queue | not installed |
| 72 | database webhooks | not installed |
| 74 | connected clients | (none): 2, postgres_exporter: 1, PostgREST 14.5: 1 |
| 21, 22, 23 | 002 columns, extra columns, status check | n/a (002 absent) |
| 24 | RLS on service tables | n/a (0 of 0) |
| 41, 42, 43 | data checks | n/a |
| 60, 61 | anon/authenticated and PUBLIC privileges on service tables | n/a (0 tables) |
| 62 | service_role DML on website_inquiries | n/a |

### Change from the first run

| | PASS | STOP | REVIEW | INFO |
|---|---|---|---|---|
| First run (`website%` filter) | 17 | 2 | 2 | 20 |
| Corrected run (7 named tables) | 17 | 1 | 0 | 23 |

What moved:
- **Row 60**, STOP → n/a. It no longer counts Prospra's 14 standard grants.
- **Rows 25 and 26**, REVIEW → ok. They no longer count Prospra's trigger and policies.
- **Rows 24 and 61**, ok → n/a. They had passed by measuring the Prospra table; now no service table exists to measure.
- **Every other row** has the same verdict and observed value.

The corrected result matches the local dry run of the "no 002, Prospra decoy present" state exactly (§4).

## 3. Answers

1. **Does 002 have to be applied first?** Yes, 0 of 4 tables exist. After 002, re-run this preflight. Expected: rows 20–24 ok (4 of 4 tables with RLS), rows 60–62 ok, rows 41–43 ok on an empty table.
2. **Can 003 be applied without changing its reviewed SQL?** Yes:
   - No name collisions in any schema.
   - The required built-ins are present.
   - It runs as `postgres` on PG 17.
   - It passes on production's exact image (§4).
3. **Does production differ materially from local staging?** No. The differences are fewer extensions, which 002/003 don't use, and other products' objects that don't overlap. The minor version is now covered by tests on 17.6.1.084.
4. **Impact on Prospra, Architecta, Channelwright and shared auth:**
   - Neither migration touches existing tables, `auth`, roles, default privileges, publications or extensions.
   - Locks fall only on the new websites tables.
   - The one shared effect is a moment-long reload of the PostgREST schema cache.
   - Prospra's `website_intelligence` is now explicitly out of the audit's scope.
5. **Remaining backup and recovery prerequisites** (owner, dashboard):
   - Backup type, last successful backup, retention, and whether point-in-time recovery is on.
   - Optionally a schema-only dump of `public`.
   - Rollback paths: `002_websites_services.down.sql` and `003_websites_crm_sync.down.sql`, both verified on all images.

**Conditions before any apply:**
- (a) Separate approval to apply 002, then 003.
- (b) The dashboard backup checklist is complete.
- (c) This preflight is re-run immediately before each apply. Rows 50–52 must be 0 at that moment.

## 4. Corrections and verification

**Preflight query.**
- The `webtab` CTE and the publication count are now limited to the 7 service tables:
  - from 002: `website_inquiries`, `website_projects`, `website_project_events`, `website_payment_events`
  - from 003: `website_crm_sync_leases`, `website_crm_sync_state`, `website_crm_sync_alerts`
- Labels on rows 24–26, 60, 61, 64 and 72 now say "Websites service tables".
- Still 41 rows, with unchanged verdict logic.

**Preflight dry run.** Run locally on 17.6.1.084, 17.11.0.018 and 15.19.0.018. Each database also had a copy of Prospra's `website_intelligence` as a decoy: 14 anon/authenticated privileges, 4 owner-only policies, and an `updated_at` trigger. Results were identical on all three images:

| State | Result |
|---|---|
| no 002 | 17 ok, 1 STOP (row 20), 23 info. Decoy not counted. |
| 002 + 300 rows | 28 ok, 13 info |
| one bad crm_synced row | STOP on row 41 |
| another session holds a lock | review on row 52 |
| 003 applied | STOP on rows 30–34 |
| write appended to the query | refused (read-only transaction) |

**Rollback-guard test** (`run-local.sh`):
- Asserts `claimed=1` and one live claim before the rollback attempt, and prints diagnostics if either is missing.
- Requires the rollback to fail on the guard's own message.
- Then asserts 003 is intact: 3 tables, 7 functions, claim columns, live claim still present.

**Staging harness** (`run-supabase-staging.sh`): the two `supabase_admin` calls get the disposable per-run password through the environment (`PGPASSWORD="$PW" docker exec -e PGPASSWORD …`). No password string appears in any log or artifact.

**Suites** (all passed, no containers or networks left behind):

| Suite | Image | Result |
|---|---|---|
| `run-local.sh` | 17.6.1.084 | 6 sequential runs, 6 runs as 3 parallel pairs, 1 run under load. All passed; 163 checks each, including the 3 new guard checks. |
| `run-local.sh` | 17.11.0.018, 15.19.0.018, postgres:17-alpine | passed |
| `run-supabase-staging.sh` | 17.6.1.084, 17.11.0.018, 15.19.0.018 | 51/51 each |

002, 003 and both down scripts are byte-identical to the committed versions.

**The intermittent failure** (first 17.6 run: "rollback ran with a live claim").
- **Not reproduced:**
  - 15 full runs on 17.6.1.084 since: 2 on the old test code, 13 on the hardened one.
  - 5,000 iterations of the original insert-then-claim sequence.
- **Mechanism:**
  - The rollback can only succeed if the claim took nothing.
  - The claim treats a row as due when `next_attempt_at <= clock_timestamp()`. `next_attempt_at` defaults to the insert transaction's `now()`.
  - The old test ran the insert and the claim back to back in one psql session.
- **Evidence for that mechanism:**
  - A probe found the Docker VM clock stepping **backwards 4 times in 200 s, by up to 5.3 ms**.
  - In the old pattern, the window between insert and claim measured **3.9 ms minimum, 7.7 ms median**, with 30% of 2,000 samples under 6 ms.
  - So a backward step can make the row look a few milliseconds early: claimed=0, and the guard correctly finds no live claim.
  - The Windows host logged no clock changes. The step happens in the Docker VM's own clock.
- **Conclusion:** the evidence is consistent with this cause, but it's not proof of that specific event. The rollback guard behaved correctly in every run where it was exercised.
- **Effect of the hardening:** the test now runs the insert and the claim in separate psql sessions, which puts at least 293 ms between them. If the problem ever recurs, the test fails at the precondition and prints the cause.
- **Production relevance:** none for correctness. On a clock step, a just-inserted row is claimed on the next call instead of this one.

**Independent review:** APPROVE WITH NITS. Two nits were applied:
- a more accurate password comment
- safer handling of an error from the claim command, and of the guard-message match

The third nit, whether 17.6 lets `postgres` use the socket without a password, was settled by the 51/51 staging run on 17.6. The fourth nit, the documentation wording, is fixed in this report and in `PRODUCTION-PREFLIGHT-003.md`.

## 5. Security Advisor baseline (first run, unchanged)

No finding on any websites object. Existing findings, none caused by this work:
- 7 mutable-search_path functions
- 12 SECURITY DEFINER functions callable from the API:
  - 11 callable by authenticated users: Channelwright, `consume_ai_credit`, `get_ai_usage` and `handle_new_user`
  - 1 callable without signing in: `public.handle_new_user()`
- 4 RLS-without-policy tables: Prospra private and Architecta rate limits
- leaked-password protection disabled

These belong to the other products' owners.

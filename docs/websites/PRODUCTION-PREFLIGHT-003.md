# Migration 003: production preflight plan (read-only)

**Status: approved and run.** The read-only preflight was run against production on 2026-11-08: first with the original query, then with the corrected seven-table scope. Results, comparison and verification are in `docs/websites/PRODUCTION-PREFLIGHT-003-RESULTS.md`. Nothing here applies 002 or 003.

This plan answers seven questions about the production Supabase project without changing anything. Its output decides whether to ask for approval to apply 003. It does not apply 002 or 003, change any setting, or start a worker.

- **Query:** `scripts/preflight/003_production_preflight.sql`. One read-only `SELECT` returns a table of checks, each with a verdict: `ok`, `STOP`, `review` or `info`. It returns counts and catalog facts only, so no inquiry contents and no email addresses.
- **Dashboard:** a short list of things to look at (§9). Only you can see these.
- **Reference:** `docs/websites/STAGING-VERIFICATION-003.md` (local staging verification, commit `9f91389`).

## 1. How it is run

| Option | Who | How read-only is enforced | Notes |
|---|---|---|---|
| **A. SQL editor (recommended)** | Owner | The file starts with `set transaction read only`. The editor sends the script as one implicit transaction, so any write would fail. | Paste the file, run it, and paste the result table back. No credentials leave the dashboard. |
| B. psql | Owner | `psql --single-transaction -f …` runs the file in one transaction. | Needs the database connection string, which stays with you. |
| C. Supabase connector | Claude | A probe first proves `transaction_read_only=on` plus statement and lock timeouts inside the same transaction. The file is then sent verbatim behind `set local statement_timeout = '30s'; set local lock_timeout = '2s';`. | Used on 2026-11-08 under owner approval. The connector itself isn't read-only, so the transaction setting is the safeguard. |

Whichever option you choose:
- Run it twice: once now, for planning, and again immediately before any apply. The locking rows (§5) only mean something at apply time.
- The query reads `pg_stat_activity`, `pg_locks` and catalog views. If the `postgres` role can't see other sessions' query text, rows 73 and 74 under-report; the dashboard's Query Performance and Roles views cover that gap.

## 2. PostgreSQL version

- **Query rows:** 10 (`server_version`) and 13 (the built-ins 003 needs: `gen_random_uuid`, `sha256`, `hashtextextended`).
- **Dashboard:** Project Settings → Infrastructure, for the Postgres version and any pending upgrade.
- **Pass:** a 15.x or 17.x release, and all built-ins present. Both majors passed every local test.
- **If a Postgres upgrade is pending:** don't schedule 003 in the same window.

## 3. Is migration 002 installed?

**What the repo tells us.** `origin/main` doesn't contain `scripts/002_*` or any websites code. The production app deploys only from `main` to the VPS (`.github/workflows/deploy.yml`). So the production app has never written to `website_*` tables, and 002 is applied only if someone ran it by hand.

**Scope.** Every table check covers exactly the seven Websites service tables: `website_inquiries`, `website_projects`, `website_project_events` and `website_payment_events` from 002, and `website_crm_sync_leases`, `website_crm_sync_state` and `website_crm_sync_alerts` from 003. Other products' tables are out of scope, even when the name starts with `website`; Prospra's `public.website_intelligence` is the case in production.

**Query rows 20–26:** the tables present, the 15 columns with their exact types, the status check constraint, RLS, triggers and policies.

| Result | Meaning | Next step |
|---|---|---|
| 4 of 4 tables, all rows `ok` | 002 is applied as written | Continue |
| 0 of 4 | 002 not applied (the likely case) | 003 can't run. Apply 002 first, under its own approval, then repeat this preflight |
| Anything else | Partial apply or drift | Stop and investigate |

Row 35 records whether the Supabase CLI migration history exists. 002 and 003 are `scripts/` files, so they won't appear there either way.

## 4. Schema compatibility

003 is one transaction. If anything fails, it rolls back completely. These checks catch the known failure causes in advance.

**No name collisions** (rows 30–34):
- 003's three tables, 14 new columns, 9 constraint names, 3 index names and 7 `websites_crm_*` functions must not exist yet.

**002 shape** (rows 21–23):
- Exactly the 002 column set and types.
- Exactly one status check constraint, named `website_inquiries_status_check`. 003 drops that check by name and re-adds it, and it aborts if a differently named one survives.

**Existing data vs the new constraints** (rows 40–44, counts only). Only relevant if 002 is applied and has rows:
- **Row 41:** `crm_synced` rows without both a contact id and an opportunity id must be **0**. Otherwise `website_inquiries_synced_has_ids` fails and 003 rolls back.
- **Row 42:** no status values outside the three allowed by 002.
- **Row 43:** no negative attempt counts.

**Side effect to note.** Existing `received` and `crm_failed` rows get `next_attempt_at` set to the apply time, so they are due as soon as a Phase 2 worker runs. Nothing claims them until then (§8).

## 5. Locking and downtime

What 003 locks, all inside its single transaction:

| Object | Lock | Held | Work done while holding it |
|---|---|---|---|
| `website_inquiries` | `ACCESS EXCLUSIVE` (blocks reads and writes) | From the first `ALTER TABLE` until `commit` | Drop and re-add the status check (one scan). Add 14 columns: metadata only, no rewrite, because every default is a constant or `now()`. Add 9 check constraints (one scan each). Build 2 partial indexes (one scan each). |
| `website_inquiries`, as foreign-key target | `SHARE ROW EXCLUSIVE` | Same window | Foreign keys from the new leases and alerts tables, which are empty. |
| New tables, new functions | New objects | n/a | No contention. |
| PostgREST schema cache | n/a | Moments | `pgrst_ddl_watch` reloads the API's schema cache, as for any DDL. |

**Expected duration.**
- About 12 table scans of `website_inquiries`. Measured locally, see §10.
- At tens to hundreds of rows, the lock lasts well under a second.

**Downtime.**
- **Main app:** none. It doesn't use `website_*` tables.
- **Website inquiries:** no user impact. The intake isn't deployed to production (§3).
- **API:** a brief schema-cache reload.

**Risk: lock queueing.** If another session holds any lock on `website_inquiries`, the `ALTER` waits. Every later query on that table then queues behind it.

Mitigations:
- Rows 50–52 must show 0 long transactions, 0 sessions idle in transaction and 0 locks, **immediately before** the apply.
- The apply session sets `lock_timeout = '5s'`, so it fails cleanly instead of waiting. In psql, use `PGOPTIONS='-c lock_timeout=5s'`. In the SQL editor, run `set lock_timeout = '5s';` as a separate line above the verified file content.

These belong to the apply step, which needs its own approval.

## 6. Backup and recovery readiness

**Dashboard (owner):** Database → Backups. Record the following:
1. The plan's backup type: daily or point-in-time recovery.
2. The time of the most recent successful backup.
3. The retention window.

**Pass:** a restorable backup less than 24 h old, or point-in-time recovery enabled.

**If neither is available:**
- Take a manual dump before the apply.
- A schema-only dump of `public` is enough to reproduce the structure.
- If `website_inquiries` has rows, also take a data dump of the `website_*` tables. That dump contains personal data, so store it encrypted and delete it after the retention period you decide.

**Recovery paths, from least to most disruptive:**
1. **`003_websites_crm_sync.down.sql`.**
   - Verified locally to restore the exact 002 schema.
   - Refuses to run while a claim is live, and takes its locks with `lock_timeout = 5s`.
   - Loses only 003's own data, which is empty before Phase 2.
   - This is the normal rollback.
2. **Restoring a Supabase backup.**
   - Restores the whole database to a point in time and loses all writes since.
   - Last resort only.

## 7. Permission verification

**Before the apply** (query rows 11, 12, 24, 26, 60–64):

| Check | Pass |
|---|---|
| Who runs the migration | `postgres`, not superuser |
| API roles | All four exist; `service_role` bypasses RLS |
| `anon` and `authenticated` on the 7 Websites service tables | No privileges |
| `PUBLIC` on the 7 Websites service tables | No privileges |
| RLS on the 7 Websites service tables | Enabled on every one, with no policies |
| `service_role` | DML on `website_inquiries` |
| Realtime publication | None of the 7 Websites service tables |

Row 63 records whether new `public` functions default to `anon` execute. 003 revokes explicitly either way.

**Dashboard (owner):**
- **Advisors → Security Advisor:** record the current findings, so new ones after the apply can be told apart.
- **Project Settings → API Keys:** record whether the project uses legacy JWT keys or the new publishable and secret keys. Phase 2 needs the server-side key name.

**After the apply** (part of the apply approval, listed here so the full check is visible):
- Run the read-only catalog block from `run-supabase-staging.sh` against production.
- It covers RLS, table and column privileges, and function execute rights, `SECURITY INVOKER` and `search_path`.
- Re-check the Security Advisor.

## 8. No CRM worker or scheduler is active

**Repo evidence (checked now):**
- No code anywhere in `app/`, `lib/` or `components/` calls `websites_crm_*` or touches the 003 tables. The Phase 2 worker doesn't exist.
- No `vercel.json`, no cron configuration, and no scheduled GitHub workflow. `deploy.yml` runs only on pushes to `main` and on manual dispatch.
- `main` contains no websites intake or GHL sync code, so production sends nothing to GHL.

**Query rows:**

| Row | Check | Pass |
|---|---|---|
| 70 | Active pg_cron jobs mentioning website, CRM or GHL | 0 |
| 71 | pg_net queue | Recorded |
| 72 | Database webhooks | Recorded |
| 25 | Triggers on the 7 Websites service tables | 0 |
| 73 | Sessions running CRM sync SQL | 0 |
| 74 | Connected clients, by application name | Recorded |

**Dashboard (owner):**
- Integrations → Cron: no website or CRM jobs.
- Database → Webhooks: none on the Websites service tables.
- Edge Functions: nothing website- or CRM-related deployed.

**Local risk to keep in mind.**
- This machine's `.env.local` contains Supabase variables, including `SUPABASE_SERVICE_ROLE_KEY`. I read only the variable names, not the values.
- Under the single-project architecture, these presumably point at production.
- If this branch runs locally with `WEBSITES_SERVICES_MODE=nonproduction` and `WEBSITES_INQUIRY_STORE=supabase`, it would write real rows to production and call GHL.
- Neither flag is set in `.env.local` today. Keep it that way until a separate approval.

## 9. Owner dashboard checklist (read-only)

| # | Where | Record |
|---|---|---|
| 1 | Project Settings → Infrastructure | Postgres version, pending upgrade (yes/no) |
| 2 | Database → Backups | Backup type, last successful backup time, retention |
| 3 | Advisors → Security Advisor | Current findings (screenshot or list) |
| 4 | Project Settings → API Keys | Legacy JWT keys or publishable/secret keys |
| 5 | Integrations → Cron | Jobs (none expected for websites/CRM) |
| 6 | Database → Webhooks | Hooks (none expected on the Websites service tables) |
| 7 | Edge Functions | Deployed functions (none expected for websites/CRM) |

## 10. Local dry run of the preflight query

Run on `supabase/postgres` 17.11.0.018 and 15.19.0.018, in disposable containers with synthetic data only. The whole file was sent as **one** query (`psql -c`), the way the SQL editor sends it. It returned all 41 rows in every state. Results were identical on both versions, apart from the version row.

| State | Rows that weren't `ok` / `info` / `n/a` |
|---|---|
| Baseline, no 002 | 20 = `STOP (002 not applied …)`, as designed |
| 002 applied, 300 rows | none |
| One `crm_synced` row with no opportunity id | 41 = `STOP (website_inquiries_synced_has_ids would fail …)` |
| Another session holding a lock on `website_inquiries` | 52 = `review` |
| 003 applied | 30–34 = `STOP` (already applied, names in use) |

**Read-only check.** A `create table` appended to the same single query was refused:

```
ERROR:  cannot execute CREATE TABLE in a read-only transaction
```

**Lock timeout.** With another session holding a lock on `website_inquiries`, applying 003 under `lock_timeout = 2s` failed fast and left nothing applied:

```
canceling statement due to lock timeout
```

**Apply time.** Applying 003 on 300 rows took 356 ms on PG 17 and 594 ms on PG 15. Both figures are wall-clock times that include `docker exec` and psql start-up, so the lock window itself is shorter.

## 11. Exit criteria and what comes next

- **Every query row is `ok`, `n/a` or `info`, and the dashboard items pass:** I write a short apply plan (exact file, checksum, lock timeout, post-apply checks, rollback trigger) for a separate approval.
- **Any `STOP`:** nothing proceeds. I report the row and its cause.
- **Any `review`:** owner decision, with my recommendation.
- **002 not applied (row 20 = 0 of 4):** the next approval request covers applying 002, then 003, in the same window, each verified by checksum.

## 12. Approvals requested

1. Run `scripts/preflight/003_production_preflight.sql` read-only in production, by option A (recommended), B or C.
2. Owner completes the dashboard checklist in §9.

**Not requested:** applying 002 or 003, any configuration change, worker activation, push or merge.

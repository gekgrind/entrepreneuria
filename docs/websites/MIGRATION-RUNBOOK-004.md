# Migration 004 runbook (draft)

Status, 2026-11-12: **draft. No production migration has been executed. Migrations 002, 003 and 004 have not been applied to production or to any hosted Supabase project.** Everything below was exercised only against throwaway local Postgres containers. This document holds no credentials, project identifiers or host names; supply them yourself at run time and never commit them. The foundation's production runbook for 002 and 003 is withheld from the public repository because it names the production project (see `FOUNDATION-LIFECYCLE-INTEGRATION.md` §9); until it is sanitized, this document is the public statement of how 004 fits in.

## 1. Order

`002` → `003` → `004`, each in its own approved window, each followed by its verification.

- 004 requires 002 and refuses to run before it. It does not depend on 003 (no shared objects), but is numbered after it and has been tested on top of it (`WITH_003=1 scripts/tests/004/run-local.sh`) and alone.
- 004 refuses to run twice. Its rollback (`004_websites_lifecycle.down.sql`) must run before 003's or 002's, in reverse order: 004 down, 003 down, 002 down.
- Nothing in the application calls 004 yet (no store, no route). Applying it changes no behavior; applying it early buys nothing and costs a window. Apply it when the store that uses it is about to ship.

## 2. Before any window

1. **Owner approval in writing** for each migration, naming the target and the time window. Not implied by this document or by a merged PR.
2. **A backup that has been restored somewhere else.** Take a logical dump of the target database (schema and data) and keep the provider's point-in-time/snapshot option available. A backup that was never restored is not a backup: restore the dump into an isolated, disposable database that is not reachable from the internet and is not the target, and confirm it loads with zero errors. Record only pass/fail and counts, never log lines (a failed load prints row contents).
3. **Fingerprint the data you are protecting.** `scripts/preflight/backup_fingerprint.sql` (from the foundation) records row counts and digests without printing rows; run it, exactly as its header instructs (read-only session options, single transaction), on the live database and on the restored copy and compare.
4. **Run the preflight** (read-only):
   `psql -X -v ON_ERROR_STOP=1 -f scripts/preflight/004_preflight.sql "$DATABASE_URL"`
   It must print `PREFLIGHT 004: PASSED`. Save the `info` lines: row counts, projects that carry a subscription or charge (they will need the new facts before their next update), long transactions and locks (expect 0).
5. **Stop writers.** 004 takes `ACCESS EXCLUSIVE` locks on three tables with a 5-second `lock_timeout`, so open transactions make it fail fast instead of hanging. Nothing should be writing to `website_*` during the window.

## 3. Staging rehearsal

Rehearse on a database that is not production, with the production procedure unchanged:

1. Restore a **sanitized** copy (or synthetic data shaped like production: 002-era projects, events and payment events). Do not restore customer data into a shared staging project.
2. Preflight → backup of the rehearsal database → `002` (if the copy does not have it) → `003` → `004` → `scripts/preflight/004_post_apply_verify.sql` (must print `POST-APPLY 004: PASSED`).
3. Run the local harness against the same Postgres major version: `bash scripts/tests/004/run-local.sh postgres:<version>` (needs Docker). It covers refusal without 002, 002-era rows surviving, 81 functional checks, 8-way concurrent commits and replays, a NULL expected version, rollback refusal and the rollback round trip.
4. Rehearse the rollback: `004` down, then verify 002-era rows and audit rows are intact.
5. Time every step. Record the Postgres version, and that the rehearsal target had Supabase's default privileges (004 revokes `anon`/`authenticated` access explicitly because Supabase grants it by default).

**Not yet done:** the harness uses plain `postgres:17-alpine` plus a role stub, not a Supabase image or a hosted staging project. Run the rehearsal on the Supabase image (and, if the owner approves a staging project, there) before the production window.

## 4. The window (owner runs it)

1. Re-run the preflight. Confirm the backup and restore evidence from §2 exist.
2. `psql -X -v ON_ERROR_STOP=1 -1 -f scripts/004_websites_lifecycle.sql "$DATABASE_URL"` over the **direct** connection (not a transaction pooler). The script is one transaction; any error rolls it back entirely.
3. Run `scripts/preflight/004_post_apply_verify.sql`. Expect `PASSED`, row counts equal to the preflight's, `website_project_rejections` empty.
4. Do **not** start any code that calls `website_lifecycle_commit` in the same window.

## 5. Recovery and rollback: what each can and cannot do

| Situation | Action | Limits |
|---|---|---|
| 004 failed part-way | Nothing to do: it is one transaction and rolled back. Re-run the preflight to confirm. | Fix the cause (usually a lock timeout from an open transaction) before retrying. |
| 004 applied, verification fails, **no 004-only data yet** | `scripts/004_websites_lifecycle.down.sql`, then re-verify 002. | Lossy by design: drops rejections and intents tables, the new project/event/payment columns and the commit function. Audit and payment rows themselves are kept. |
| 004 applied and the store has written new-state projects, rejections or intents | **Restore from the backup/point-in-time**, do not run the down script. | The down script refuses while any project is in a state 002 cannot hold, or any project is not sandbox; it cannot recreate what 002 never stored. Everything written since the apply is lost on a restore: stop writers first and export what you need. |
| Append-only data must be removed (test rows) | Run the down script (it drops the triggers), or truncate in a disposable database. | The append-only triggers block `UPDATE`/`DELETE` on audit, payment and rejection rows on purpose; there is no supported way to edit them in place. |
| NOT VALID constraints | Updating a 002-era row that violates one fails until the row is corrected (for example, a subscription without a launch verification). | Correct through a reviewed change, not by dropping the constraint. `VALIDATE CONSTRAINT` can be run later, after the data is clean. |

Rollback never touches 002 or 003 objects.

## 6. Confirmation

No production migration was executed for this work. The migrations, preflights and harness were run only against local, throwaway Postgres 17 containers started from a public image; no Supabase project, GoHighLevel account or payment provider was contacted. Applying any migration to production remains a separate, written owner approval.

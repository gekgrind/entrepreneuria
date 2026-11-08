# Production migration runbook: 002 then 003

**Status:** approved as documentation on 2026-11-08, with the backup-restoration gate (§1) added at the owner's request and revised after independent review.

**Not executed.** Running any part of it against production needs the separate approvals in §10.

| | |
|---|---|
| Project | `entrepreneuria-site`, ref `rifzbzaabkaeagyulxip`, Supabase Postgres 17.6.1.084, **Free plan** (organization `Entrepreneuria`) |
| Migrations | `scripts/002_websites_services.sql`, then `scripts/003_websites_crm_sync.sql`. Taken from commit `5614cb4` (unchanged since review commit `07eb5ae`). |
| Approved execution method | **`psql` over the direct connection** (`db.rifzbzaabkaeagyulxip.supabase.co:5432`), run by the owner. Never the transaction pooler. (§3) |
| Read-only checks | `scripts/preflight/003_production_preflight.sql` (41 checks) and `scripts/preflight/002_003_post_apply_verify.sql` (32 checks), pinned by checksum in G0.3 |
| Expected impact | The other products' tables, `auth`, roles and settings are untouched. There's a moment-long PostgREST schema-cache reload after each migration. No downtime. |
| Expected duration | 2–3 hours in total: the backup and restore verification take about 1.5–2.5 h, the migration window about 30 minutes. Each migration takes under 1 s on empty tables (0.5–0.6 s on 17.6.1.084, including client start-up). |

**This runbook replaces earlier method guidance for production.** `PRODUCTION-PREFLIGHT-003.md` §1 and the header of `003_production_preflight.sql` mention the SQL editor, the connector, and a psql command without `-X`, `ON_ERROR_STOP` or a read-only session. From here on, every production command, read-only or not, uses the §3 forms. The only exception is the dump connection approved under §10.1.

Every **bold STOP** below means:
- Change nothing more and record what you saw.
- If something was applied, *propose* the matching §7 rollback for approval.
- Neither migration can be half-applied: each one is a single transaction.

## 1. Gate G-B: backup and verified restoration (mandatory before step 1)

002 is not applied until every item below is complete and recorded in §9.
- **The step-by-step commands** are in `docs/websites/PRODUCTION-BACKUP-RESTORE-VERIFICATION.md`.
- **The fingerprint query** is `scripts/preflight/backup_fingerprint.sql`.
- **Both files are under owner review and not yet committed.** They must be approved and committed (and the fingerprint's checksum added to G0.3) before G-B runs.
- **Taking the backup needs its own approval** (§10).

### What production has, and what a logical dump is not

- **The organization is on the Free plan** (read from the Supabase organization record on 2026-11-08).
  - Per Supabase's documentation, automatic daily backups are Pro, Team and Enterprise only.
  - Point-in-time recovery (PITR) is a paid add-on for those plans.
  - Free-plan projects are expected to make their own exports with `supabase db dump`.
- **G-B.7** confirms the actual dashboard status. Until then, assume there is **no** platform backup.
- **A logical dump is not a substitute for managed PITR.** It:
  - captures one moment, so anything written after it is not in it;
  - has no write-ahead log, so it can't be replayed to a later point;
  - is several separate snapshots (roles, schema, data, migration history), so they're consistent only if nothing changes the schema while they're taken;
  - has no one-click restore into the hosted project.
- **What the CLI dump does not contain**, per Supabase's documentation:
  - Storage objects (the files themselves) and Edge Functions.
  - Auth configuration: providers, SMTP, redirect URLs.
  - JWT secrets and API keys, Data API settings, network restrictions and custom domains.
  - Passwords of custom login roles.
  - Settings of Supabase-reserved roles.
  - The `supabase_migrations` CLI history (dumped separately below).
  - The structure of Supabase-managed schemas (`auth`, `storage`, `realtime`, `vault` and so on); the platform recreates those. Their data is included.
  - Vault secrets are dumped encrypted with this project's key, so another database can't decrypt them.
- **Restoring into a disposable local database does not prove the hosted project can be recovered.** It proves the dump is complete and restorable. Hosted recovery has extra platform limits (G-B.6, §7 R4).

### The gate

| Item | Requirement | Evidence (record in §9) |
|---|---|---|
| **G-B.1 Complete backup** | `supabase db dump` of roles, schema and data (`--use-copy --data-only`), plus the `supabase_migrations` schema and data, taken back to back in a quiet period. The fingerprint query runs right before and right after. Between the two runs: (i) every `schema\|` line must be identical (no structure changed); (ii) every `rows\|` line must be identical for the product schemas, `supabase_migrations`, `auth.users`, `auth.identities`, `storage.buckets` and `storage.objects`. If not, retake the dump. Other managed-table row counts (sessions, refresh tokens, audit log, `realtime.*`) change with normal sign-ins; record their differences and accept them. The settings the dump leaves out are listed separately from the dashboard and the fingerprint, by name and setting only, never secret values: extensions, publications, Auth settings, Data API exposed schemas, Edge Functions, Storage buckets, Vault secret names, and reserved-role settings (fingerprint `role_setting` lines). | Five dump files: sizes and sha256. The before and after fingerprint comparison. The configuration inventory. |
| **G-B.2 Credentials and personal data** | `psql` gets the database password through `PGPASSWORD`, read with `read -s` (no echo), and uses a connection URL **without** the password. `supabase db dump` only accepts a URL, so its URL holds the password for the length of the dump. That's an accepted, recorded risk on the owner's single-user machine: the variables are cleared and shell history is off. The password never goes into chat, the repo, a shared file or a screenshot. If it has to be reset, that's a production change needing its own approval; deployed services must be checked first (no local repo uses it). Plaintext dumps, decrypted copies and restore logs (which can contain row text) stay on the owner's machine, in a folder that isn't cloud-synced. They're never uploaded, pasted or shared, including with Claude. | Statement in §9 |
| **G-B.3 Encryption and retention** | Encrypt at once: a 7-Zip AES-256 archive with encrypted file names, or `age`. The passphrase lives only in the owner's password manager, never next to the archive. Only the **encrypted archive** may leave the machine, to owner-controlled offline media (for example an encrypted USB drive) or one owner-named encrypted store. Two copies, at least one off this machine. **Retention ends at the earliest of:** 30 days after 003 is verified stable (step 7 passed and 7 days with no rollback or incident); 30 days after the owner decides at step 4 not to apply 003; and **60 days after the dump** in every case. Destruction covers both archive copies, every decrypted copy, the restore target (containers and volumes) and restore logs. It's recorded in §9. A longer period is the owner's call, in writing. | Archive name, sha256, both locations, destruction date, destruction record |
| **G-B.4 Restore into an isolated disposable database** | Restore the **decrypted archive** (proving the stored copy works), on the owner's machine, in the order Supabase documents: roles, schema, migration history, then data with `session_replication_role = replica`, all in one `--single-transaction` with `ON_ERROR_STOP`. Target: **T1**, a local Supabase stack from the CLI (recommended, because it runs Auth and Storage migrations so `auth.*` data has matching tables; ports must be bound to `127.0.0.1`, and its Postgres version is recorded), or **T2**, `supabase/postgres:17.6.1.084` with `--network none`. Only the edits Supabase documents for known restore errors are allowed (for example `ALTER … OWNER TO "supabase_admin"` lines). Every edit is recorded; product rows are never edited. | Target used and its version. Restore exit code 0. **ERROR count 0. Record only pass/fail and counts, never paste log lines** (a failed `COPY` prints row contents). The list of edits. |
| **G-B.5 Verify the restored copy** | Run the fingerprint on the restored copy and diff it against the second production fingerprint. **Must match exactly** for every product schema (`public`, `channelwright`, `prospra_private` and any other non-managed schema) and `supabase_migrations`. That covers: table, column, constraint and index hashes; view, sequence and type definitions; functions; triggers; policies; schema, table, column and function grants; exact row counts. **Must also match:** the row counts of `auth.users`, `auth.identities`, `storage.buckets` and `storage.objects`, and every product custom role and its attributes. Managed-schema structure, platform roles and default extensions may differ; list and explain each difference. Reserved-role settings aren't restored by the dump; compare them with the inventory instead. | Diff summary: pass/fail per category, each difference explained |
| **G-B.6 Recovery procedure and limits** | Written and agreed before step 1 (§7, R4) | Owner sign-off in §9 |
| **G-B.7 Actual dashboard backup status** | Dashboard → Database → Backups and Settings → Add-ons. Record whether any scheduled backup or PITR exists and its latest time. If the dashboard shows a usable platform backup, record it **as well as** the manual dump, not instead of it. | Notes or screenshot (no secrets) |

**STOP** if any item is incomplete, the restore exits non-zero or logs any ERROR, or the fingerprint comparison shows an unexplained difference in a category that must match.

**Local evidence for the fingerprint** (synthetic data, 17.6.1.084):
- A complete restore matched exactly.
- These were all detected:
  - a lost schema `USAGE` grant, a lost column grant, a changed enum label and a lost role setting;
  - missing schema objects and missing table data;
  - **a view on which the restored copy had re-granted `anon` access that the source had revoked.** That's a real permission regression a naive restore produced, the kind of drift G-B.5 exists to catch.

### Tooling found on 2026-11-08 (affects how G-B is done)

- **Direct connection is IPv6-only.** `db.rifzbzaabkaeagyulxip.supabase.co` has only an AAAA record, and the IPv4 add-on is paid-only. This machine has global IPv6 addresses, so native `psql` over the direct connection should work; G0.8 confirms it.
- **Docker containers here have no IPv6 egress** (tested against an IPv6-only public host). `supabase db dump` runs `pg_dump` in a container, so from this machine it can't reach the direct connection. The backup approval must choose one of:
  - **(a)** Run the dump through the **session pooler** (Supavisor session mode, IPv4, port 5432; *not* the transaction pooler). Read-only.
  - **(b)** Enable IPv6 in Docker Desktop on the owner's machine (local setting).
- **Raw `pg_dump` is not used.** Local tests reproduced the failures Supabase documents for raw dumps (`schema "public" already exists`, `permission denied to change default privileges`), plus the `anon` re-grant above.
- **Tools to install:**
  - PostgreSQL 17 client tools and the Supabase CLI (`npx supabase`), with Docker Desktop running.
  - None is installed on this machine.
  - The CLI couldn't be run here (blocked by a permission check). The CLI commands haven't been tested on this machine; the first G-B run is that test.

## 2. Preconditions (gate G0, all required)

| # | Check | How |
|---|---|---|
| G0.1 | Owner approvals recorded: backup (§1), apply 002, apply 003 | In writing, before the window |
| G0.2 | **Gate G-B passed** (§1) | §9, G-B.1–G-B.7 |
| G0.3 | The exact files to run match the reviewed checksums | Migrations: `git show 5614cb4:scripts/<file> \| sha256sum`. Read-only checks: `sha256sum` of the files in the committed tree. Run only the content checked here (saved to a file), never a CRLF working copy. |
| G0.4 | The CRM worker and scheduler stay disabled | §8, before-checks |
| G0.5 | No deploy of this branch is pending or running | `main` doesn't contain websites code; nothing has been pushed |
| G0.6 | A quiet period, with the owner present for the whole window | Avoid times when Prospra, Architecta and Channelwright are busy |
| G0.7 | Security Advisor baseline recorded | Dashboard → Advisors → Security (first-run baseline is in `PRODUCTION-PREFLIGHT-003-RESULTS.md` §5) |
| G0.8 | `psql` 17 is connected over the **direct** connection | The URL host is `db.rifzbzaabkaeagyulxip.supabase.co`, **and** `select inet_server_addr()` (read-only session, §3) returns an **IPv6** address. The port alone proves nothing: the session pooler also uses 5432. If IPv6 fails from the owner's network: **STOP.** Using any other connection for migrations needs a new approval. |

Checksums for G0.3 (sha256 of the LF content):

| File | sha256 |
|---|---|
| `scripts/002_websites_services.sql` (commit `5614cb4`) | `8a8be495fbb5f73ce8c8aa825b5e1c200463b680eaa93201becc81274d7a0b3f` |
| `scripts/003_websites_crm_sync.sql` (commit `5614cb4`) | `257e323b559939ffcd4b32322cd5aa58f273b6fb2433f3f0683a49f0915948b1` |
| `scripts/002_websites_services.down.sql` (commit `5614cb4`) | `a7bf812705c6efc4b956276ebeebf92e75df66ca0569fe5b9601170785e974cb` |
| `scripts/003_websites_crm_sync.down.sql` (commit `5614cb4`) | `9786b2aa3e24802a5c34533789d02604bcb9cc851081a01bf18ece0355f93a9f` |
| `scripts/preflight/003_production_preflight.sql` (commit `5614cb4`) | `bddf0be8acf5ac4474d1b04b760ddf5164b069e348af8a827ec6a2722ee9e9d4` |
| `scripts/preflight/002_003_post_apply_verify.sql` (this runbook's commit) | `cf619491e59f8105e335a185019437a42bd17f2dbdfcdf53f50b6bffddd9b2ad` |
| `scripts/preflight/backup_fingerprint.sql` | Added when that file is approved and committed |

## 3. Execution method (approved: psql, direct connection)

**Connection.**
- The password goes into `PGPASSWORD`, read without echo:
  ```bash
  read -rs PGPASSWORD; export PGPASSWORD
  ```
- `PROD_DB_URL` is the direct connection **without** a password: `postgresql://postgres@db.rifzbzaabkaeagyulxip.supabase.co:5432/postgres?sslmode=require`.
- Shell history is off (`set +o history`). Run `unset PGPASSWORD` at the end.
- Never use the transaction pooler (port 6543).
- All commands use `-X`, so a personal `.psqlrc` setting such as `AUTOCOMMIT off` can't change how they behave.

**Migrations and rollback scripts.** Each file is one transaction: `begin;` … `commit;`, with guard blocks that raise exceptions. Run them **without** `--single-transaction`:

```bash
PGOPTIONS='-c lock_timeout=5s -c statement_timeout=120s' psql -X "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f 002_websites_services.sql
```

(`--single-transaction` would wrap the file's own `begin`/`commit` and end the transaction early.)

**Read-only checks.** Run them **with** `--single-transaction` and a read-only session:

```bash
PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=30s -c lock_timeout=2s' psql -X "$PROD_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f scripts/preflight/002_003_post_apply_verify.sql
```

Tested locally on 17.6.1.084:
- Without `--single-transaction`, the files' `set transaction read only` covers only its own one-statement transaction, and a write added after the SELECT **succeeded**.
- With it, that write was refused.
- `default_transaction_read_only=on` makes the whole session read-only as a second safeguard.

**Never** use the connector's `apply_migration`, `supabase db push` or `supabase migration up`. They write to `supabase_migrations.schema_migrations`, the CLI history the Prospra, Architecta and Channelwright repos depend on. Their next `supabase db push` would then fail. Verification row 62 checks this.

**Not approved:** applying or rolling back anything through the Supabase connector (`execute_sql`) or the dashboard SQL editor.

## 4. Steps

"Expected" below is the full expected result, including expected STOPs. Anything else is a STOP.

| Step | Action | Expected result | If not as expected |
|---|---|---|---|
| **0. Gates** | G-B (§1) and G0 (§2) all recorded | All items complete | **STOP** |
| **1. Preflight before 002** | `003_production_preflight.sql` (read-only form, §3) | Exactly **17 ok, 1 STOP (row 20: 002 not applied), 23 info**, the 2026-11-08 baseline. Rows 50–52 = 0. | **STOP.** If only rows 50–52 are non-zero: wait 5 min and re-run once, then **STOP**. |
| **2. Apply 002** | The checksum-verified 002 (migration form, §3) | Completes without error in under 1 s. Only NOTICE-level output. | ERROR: it rolled back (§7 R1), **STOP**. Any WARNING: **STOP**. |
| **3. Verify 002** | `002_003_post_apply_verify.sql` | **Stage `002`: 19 ok, 10 n/a, 3 info, 0 STOP.** Row 50: all four tables at 0. | **STOP; propose R3 for approval** (nothing is lost while row 50 is all 0) |
| 3b. | `003_production_preflight.sql` | **28 ok, 13 info, 0 STOP, 0 review.** Rows 20–24, 41–43 and 60–62 are now ok. | **STOP; propose R3 for approval** |
| 3c. | Security Advisor | The only new finding is INFO "RLS Enabled No Policy" for the 4 websites tables, which is by design: service-role only | **STOP; propose R3 for approval** |
| **4. Hold point** | Owner confirms going ahead with 003 in the same window | | Owner says no: stop here. 002 alone is a valid, inert state. |
| **5. Preflight before 003** | `003_production_preflight.sql`, immediately before applying | 28 ok, 13 info, 0 STOP. Rows 50–52 = 0. | As in step 1 |
| **6. Apply 003** | The checksum-verified 003 (migration form: `lock_timeout=5s`) | Completes without error in under 1 s | `lock timeout`: nothing was applied. Re-check rows 50–52 and retry **once**. A second failure, or any other ERROR: **STOP** (§7 R1). |
| **7. Verify 003** | `002_003_post_apply_verify.sql` | **Stage `002+003`: 29 ok, 3 info, 0 STOP.** Row 26 = `0 / 0 / 0`, so nothing has claimed. | **STOP; propose R2 for approval** |
| 7b. | `003_production_preflight.sql` | 23 ok, 13 info, and **5 STOP on rows 30–34**. These are expected: 003's names are in use because it's applied. No other STOP. | **STOP; propose R2 for approval** |
| 7c. | Security Advisor | Still only INFO "RLS Enabled No Policy", now for 7 tables. No WARN for `websites_crm_*` functions: SECURITY INVOKER, pinned `search_path`, no anon or authenticated execute. | **STOP; propose R2 for approval** |
| 8. Optional API check | Owner, with the **publishable/anon** key only: `GET /rest/v1/website_inquiries` and `POST /rest/v1/rpc/websites_crm_sync_health` | Both refused (401/403, or a permission error) | Any data or a 200 response: **STOP; propose R2 then R3 for approval** |
| **9. Close-out** | Fill in §9. Repeat the §8 checks. | All recorded | n/a |

The expected counts come from local runs on 17.6.1.084, 17.11 and 15.19, plus the production baseline, and were re-derived from the SQL by the independent review.

**Reference: the verification query before 002** is stage `none`: 12 ok, 1 n/a, 3 info, **16 STOP**. Those STOPs are expected. The runbook doesn't run it then; use the preflight.

## 5. Transaction, timeout and lock safeguards

| | Migrations and rollbacks | Read-only checks |
|---|---|---|
| Transaction | The file's own `begin`/`commit`. **No** `--single-transaction`. | `--single-transaction`, `set transaction read only`, `default_transaction_read_only=on` |
| `lock_timeout` | 5 s (`PGOPTIONS`). The down scripts also set `lock_timeout 5s` inside. | 2 s |
| `statement_timeout` | 120 s | 30 s (fingerprint: 120 s) |
| Errors | `ON_ERROR_STOP=1`. The whole file rolls back. | `ON_ERROR_STOP=1` |
| `.psqlrc` | Ignored (`-X`) | Ignored (`-X`) |

- **Lock behaviour:**
  - 002 creates new objects only. It doesn't lock any existing table.
  - 003 holds `ACCESS EXCLUSIVE` on `website_inquiries`, which is new, empty and unused, from its first `ALTER` until commit. It holds `SHARE ROW EXCLUSIVE` there for its foreign keys.
  - No lock is taken on any other product's table.
  - With `lock_timeout`, an apply that meets a held lock fails within 5 s and applies nothing (tested on 17.6.1.084). It never queues behind the lock and blocks other sessions.
- **Never run 002 and 003 together** in one file or one command. That loses the step 3 verification point.
- **PostgREST reload.** After each apply, the `pgrst_ddl_watch` event trigger reloads PostgREST's schema cache, briefly, for every product.

## 6. STOP conditions (complete list)

Stop, change nothing more, and report if **any** of these happens. Rollback is only ever *proposed* (§7).
1. Any part of gate G-B is incomplete:
   - backup approval missing;
   - a dump file missing or empty;
   - a must-match fingerprint category differs between the before and after production runs;
   - the restore exits non-zero or logs any ERROR;
   - an unexplained difference in a must-match category of G-B.5;
   - the dashboard backup status not recorded;
   - encryption or retention not in place.
2. A checksum in G0.3 doesn't match.
3. The direct connection doesn't work (G0.8), or the operator would have to use a connection or tool other than §3. The one exception is the dump connection approved under §10.1.
4. The preflight in step 1 or step 5 shows anything other than its expected result, or rows 50–52 are non-zero after one wait.
5. Any ERROR or WARNING while applying. A `lock timeout` on 003 allows one retry.
6. Any verification or preflight result that differs from §4's expected result. The STOPs §4 lists as expected (rows 30–34 at step 7b) don't count.
7. A new WARN or ERROR in the Security Advisor on a websites object.
8. Any sign of a worker:
   - verification row 26, 60 or 61, or preflight row 73, not ok;
   - a new Cron, Webhook or Edge Function for websites or CRM.

   Preflight row 73 counts idle sessions too: if only row 73 fires, check whether the session is idle (a leftover from the step 8 RPC call or a dashboard tab) before treating it as a worker.
9. Any change to the CLI migration history (verification row 62).
10. Any unexpected effect on another product (errors reported by Prospra, Architecta or Channelwright during the window).
11. The owner is unavailable, or any step would need an approval not yet given.

## 7. Recovery and rollback

R1 is automatic. **R2, R3 and R4 run only after the owner approves them at the time** (§10). After any of them, re-run both read-only queries and record the results.

**R1. A migration failed during apply.**
- Its transaction rolled back automatically, so nothing from that file exists.
- Confirm with the preflight: after a failed 002, row 20 is still STOP (0 of 4). After a failed 003, rows 30–34 are ok.
- No data is lost.
- Don't retry without understanding the error. A `lock timeout` on 003 allows one retry (step 6).

**R2. Undo 003 after commit** (`003_websites_crm_sync.down.sql`, migration form):
- **What it does:**
  - Takes its locks with `lock_timeout 5s`.
  - **Refuses** while any live claim or reconcile-window lease exists. Verified, including on 17.6.1.084.
  - Drops the 7 functions, the 3 sync tables, 003's 9 constraints and 14 columns, and restores 002's status check.
  - Converts any `needs_attention` row back to `crm_failed`.
- **Data loss:**
  - All CRM sync metadata (claims, leases, alerts, attempt history).
  - **Before Phase 2 this is empty.** Confirm first: verification row 26 = `0 / 0 / 0`, row 50 = all 0.
- **Result:** the exact 002 schema. The staging schema dump after rollback is identical.
- If it refuses because of a live claim, something is running a worker. **STOP** and treat it as an incident (§8).

**R3. Undo 002 after commit** (`002_websites_services.down.sql`; run R2 first if 003 is applied):
- **What it does:** drops the 4 websites tables.
- **Data loss:** **every row in all four**: inquiries, projects, project events and payment events.
- At apply time they're empty. Confirm verification row 50 shows **0 for all four tables** first.
- **If any count is above 0, STOP.** Those rows are real customer personal or payment data. Exporting or discarding them needs a separate approval and an encrypted export.

**R4. Recovering the hosted project from the manual dump** (disaster recovery only, never part of this window; needs its own written plan and approval):
- **What's possible:**
  - **Targeted repair (preferred).** Recreate specific damaged objects or rows in the live project with `psql`, using definitions from `prod-schema.sql` and rows from `prod-data.sql`.
  - **Full in-place restore (last resort).** Drop and recreate every product schema and reload all data while Prospra, Architecta, Channelwright and Auth keep running against it.
- **Realistic limits:**
  - **Data loss.** Every write after the dump, across all products and `auth`, is lost. A logical dump has no point-in-time replay.
  - **Downtime and coordination.** A full in-place restore needs every product stopped or in maintenance mode. This project has no platform "restore" button on the Free plan.
  - **Permissions.** As `postgres` (not a superuser) on the hosted project, Supabase-managed schemas (`auth`, `storage` and others) can't be recreated, and reserved-role settings can't be restored. Their data may only partly reload, and that hasn't been rehearsed.
  - **Not in the dump** (§1): Storage files, Edge Functions, Auth and API configuration, custom role passwords, and Vault secrets usable outside this project.
  - **Restoring into a new project** changes URLs and keys for every product. It conflicts with the single-production-project architecture and isn't an option without a separate business decision.
  - **Time.** At 22 MB a local restore takes minutes. A hosted recovery depends on coordination and the issues above, and hasn't been rehearsed, so treat its duration as unknown.
- **What G-B proves and doesn't:**
  - It proves the dump is complete and restorable into a Supabase-built database.
  - It doesn't prove a hosted in-place recovery would succeed. That's an accepted residual risk.
  - The risk is mitigated by: both migrations being additive and transactional; the verified R1–R3 paths; and 002/003 touching no existing object.

## 8. CRM worker and scheduler stay disabled

**Why nothing can start syncing:**
- There is no worker code. Nothing in `app/`, `lib/` or `components/` calls `websites_crm_*`.
- `main`, the only branch production deploys from (`deploy.yml`), contains no websites code at all.
- After 003, the functions can only be executed by `service_role` (verification rows 38–39), and nothing calls them.
- Push, merge, deploy and worker activation are all outside this runbook's approvals.

**Before step 1:** preflight rows 70 and 73 are ok (no website or CRM pg_cron job; pg_cron isn't installed; no session running CRM sync SQL).

**After step 9:** verification rows 26, 60 and 61 and preflight row 73 are ok:
- Row 26: no claims, leases or alerts.
- Row 60: no cron job.
- Row 61: no non-idle CRM session.
- Preflight row 73: no CRM session of any state (see §6.8).

**Both times:**
- Dashboard: Integrations → Cron, Database → Webhooks and Edge Functions show nothing for websites or CRM.
- `git log origin/main` contains no websites commits, and this branch is not pushed.

**Limit:** rows 61 and 73 read `pg_stat_activity.query`. If `postgres` can't see other roles' query text on the hosted project, a worker's query would appear as `<insufficient privilege>` and wouldn't be counted. The dashboard checks and the row 26 claim counts cover that case.

**Local machine:**
- `.env.local` holds a production service-role key.
- Keep `WEBSITES_SERVICES_MODE` and `WEBSITES_INQUIRY_STORE` unset.
- Don't run this branch locally against production during or after the window. With those flags set, it would write real inquiries and call GHL.

## 9. Execution record (filled in during the work)

Record **results, counts, checksums and pass/fail only.** Never paste rows, log lines from a restore, passwords or connection strings.

| Item | Value |
|---|---|
| G-B.7 Dashboard → Backups / Add-ons shows | |
| G-B.1 Dump files (roles, schema, data, history schema, history data): size and sha256 | |
| G-B.1 Production fingerprint before and after: must-match categories identical? Accepted churn tables listed | |
| G-B.1 Configuration inventory (names and settings only) | |
| G-B.2 Credentials and personal-data handling statement | |
| G-B.3 Encrypted archive: name, sha256, two locations, retention end date | |
| G-B.4 Restore: target (T1 or T2) and Postgres version, exit code, ERROR count, edits made | |
| G-B.5 Fingerprint comparison: pass/fail per category, every difference explained | |
| G-B.6 Owner sign-off on §7 R4 limits | |
| G0.3 checksums verified (all rows) | |
| G0.8 direct connection: host and IPv6 server address confirmed | |
| Step 1 preflight counts | |
| Step 2 apply 002: start and end time, result | |
| Step 3 verification counts / 3b preflight / 3c advisor | |
| Step 4 owner decision | |
| Step 5 preflight counts | |
| Step 6 apply 003: start and end time, result | |
| Step 7 verification counts / 7b preflight / 7c advisor | |
| Step 8 API check (optional) | |
| §8 worker checks after the window | |
| G-B.3 destruction: date and what was destroyed | |
| Anything unexpected | |

## 10. Approvals this runbook needs (none given for execution yet)

1. **Production backup** (G-B), including the connection used for the dump: session pooler, or the direct connection with Docker IPv6 enabled (§1).
2. Restore verification on the owner's machine (G-B.4–G-B.5). It handles every product's personal data.
3. Apply 002 (steps 1–3).
4. Apply 003 (steps 5–7), confirmed again at the step 4 hold point.
5. Any rollback in §7 beyond R1. R4 always needs its own plan.

**Approved so far:**
- This runbook and `002_003_post_apply_verify.sql` as documentation.
- The execution method: `psql` over the direct connection.

**Not covered and still not approved:**
- Push, merge or deploy.
- CRM worker or scheduler activation.
- Production configuration changes, including a database password reset.
- Plan or add-on changes.
- Any production restore.

## Appendix: local evidence for this runbook

| Evidence | Result |
|---|---|
| `002_003_post_apply_verify.sql` dry run on 17.6.1.084, 17.11.0.018 and 15.19.0.018 | Baseline: 12 ok, 1 n/a, 3 info, 16 STOP (stage none). After 002: 19 ok, 10 n/a, 3 info. After 003: 29 ok, 3 info. The injected faults were all caught: an anon table grant (row 32), an authenticated function grant (row 38), an anon column grant (row 33) and a taken claim (row 26). A write appended to the query was refused. After 003.down: stage 002 (19 ok, 10 n/a, 3 info). After 002.down: stage none. Row 50 counts all four 002 tables (a `website_projects` row showed up). |
| Scope check against other products | With a decoy of production's other-product objects, both queries gave output identical to a clean database at every stage, on 17.6.1.084 and 15.19.0.018. The only differences were the `stats_reset` timestamps. The decoy covered: all 34 non-websites `public` tables, RLS and policies, `website_intelligence` with its trigger, the `channelwright` SECURITY DEFINER functions with authenticated execute, `prospra_private` RLS-without-policy tables, `handle_new_user` (SECURITY DEFINER, mutable `search_path`) and a realtime publication. |
| psql invocation on 17.6.1.084 | Read-only checks: with `--single-transaction`, an appended write was refused; without it, it succeeded. Migrations: psql `-f` with `PGOPTIONS` applied 002. 003 under lock contention failed after 2.7 s with `lock timeout` and nothing applied; without contention it applied in 0.56 s. 003.down under contention failed on `lock timeout` with 003 intact, then succeeded. 002.down succeeded. |
| `backup_fingerprint.sql` on 17.6.1.084 | Runs as `postgres` with no privilege gaps. A complete restore matched exactly. Detected: missing objects; missing data; a lost schema `USAGE` grant; a lost column grant; a changed enum label; a lost role setting; and an `anon` re-grant on a view introduced by a naive restore. |
| Connectivity facts | The direct host has an AAAA record only. This machine has global IPv6. Docker containers have no IPv6 egress. |
| Migration suites (commit `5614cb4`) | `run-local.sh` and `run-supabase-staging.sh` pass on 17.6.1.084, 17.11 and 15.19. See `PRODUCTION-PREFLIGHT-003-RESULTS.md` §4. |

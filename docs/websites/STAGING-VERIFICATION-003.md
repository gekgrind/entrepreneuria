# Migration 003: local staging verification

**Verdict: GO for production migration readiness**, subject to the pre-apply conditions in §8. The production migration itself is **not approved** and was not run. Phase 2 has not started.

Run on 2026-11-07 against commit `07eb5ae`. Everything ran in disposable local Docker containers. No hosted Supabase project was contacted.

## 1. Isolation

| Requirement | Evidence |
|---|---|
| No production credentials or connection strings | Both scripts connect only to containers on a private Docker network they create (`ent-003-stg-*`). Passwords and the JWT secret are random per run and never written to disk. Neither script references `.env`, `SUPABASE_*`, `DATABASE_URL` or any `*.supabase.co` host; the host shell had no such variables set. No Supabase MCP or CLI call was made. |
| No production data accessed or modified | The only data was synthetic `@example.com` rows created by the tests. All containers and networks were removed on exit (0 remaining). |
| No new paid Supabase project | None was created. Supabase's own open-source Postgres image was used locally instead. |
| Migration 002 unchanged | Working tree, `HEAD` and the checksums in §3 match. `git diff` on `scripts/002*` is empty. |

## 2. Environment

| | Run A | Run B |
|---|---|---|
| Database image | `supabase/postgres:17.11.0.018` | `supabase/postgres:15.19.0.018` |
| Image digest | `sha256:7c31363a3f7434ff14945f1b8a4880e6eca8b362e197e88b87c476c77aa3cf8c` | `sha256:eea4d56296834cd235f712dd0e7096c9ec354d81362bf4375950ab17d81a1d71` |
| `version()` | PostgreSQL 17.11 on x86_64-pc-linux-gnu, gcc 15.2.0 | PostgreSQL 15.19 on x86_64-pc-linux-gnu, gcc 15.2.0 |
| Data API | `postgrest/postgrest:v14.18` (`sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf`) | same |

Supabase-specific behavior present in both runs (from the image's own init scripts, not emulated):

- **Migration role:** `postgres`, **not superuser**, `bypassrls`. Both migrations and both rollbacks ran as this role, as they would in the Supabase SQL editor.
- **API roles:** `anon`, `authenticated` and `service_role` (with `bypassrls`), all `inherit`. `authenticator` is the login role PostgREST uses.
- **Default privileges in `public`:** for both `postgres` and `supabase_admin`, all tables, functions and sequences are granted to `anon`, `authenticated` and `service_role` by default. This is exactly what 003's explicit revokes must override.
- **Role settings:** `anon` has `statement_timeout=3s`, `authenticated` has 8s, and `service_role` has none. `authenticator` has `statement_timeout=8s` and `lock_timeout=8s`, and preloads `supautils` and `safeupdate`.
- **Event triggers:** `pgrst_ddl_watch`, `pgrst_drop_watch`, `issue_pg_graphql_access`, `issue_graphql_placeholder`, `issue_pg_cron_access` and `issue_pg_net_access`. All ran during the migrations without error.
- **pg_graphql:** enabled in schema `graphql`, matching hosted projects.

## 3. Migration checksums (sha256; identical in the working tree and `HEAD` = `07eb5ae`)

| File | sha256 | git blob |
|---|---|---|
| `scripts/002_websites_services.sql` | `8a8be495fbb5f73ce8c8aa825b5e1c200463b680eaa93201becc81274d7a0b3f` | `07ecd6cf78ae` |
| `scripts/002_websites_services.down.sql` | `a7bf812705c6efc4b956276ebeebf92e75df66ca0569fe5b9601170785e974cb` | `4163da1524f1` |
| `scripts/003_websites_crm_sync.sql` | `257e323b559939ffcd4b32322cd5aa58f273b6fb2433f3f0683a49f0915948b1` | `85536bbf851e` |
| `scripts/003_websites_crm_sync.down.sql` | `9786b2aa3e24802a5c34533789d02604bcb9cc851081a01bf18ece0355f93a9f` | `96687a6d7d60` |

Before applying in production, check the file you paste against the 003 checksum.

These are hashes of the LF content stored in Git. On a machine with `core.autocrlf=true` (this one), a fresh checkout writes the `.sql` files with CRLF line endings, and their sha256 differs; for 003 it is `aabd4d13…6333`. The git blob id doesn't change. Verify against Git, not the working copy:

```bash
git show 07eb5ae:scripts/003_websites_crm_sync.sql | sha256sum
```

The suites were re-run from a CRLF checkout and pass (§5), so line endings don't change behavior. Apply the LF content anyway, so the checksum matches.

## 4. What was run

1. `scripts/tests/003/run-local.sh supabase/postgres:<tag>`. This is the existing suite, now able to run on Supabase's image. It skips the emulated roles and connects as the non-superuser `postgres`. It covers the preconditions (003 refuses to run without 002 or twice), a 002-era row surviving 003, the functional suite, 8 concurrent workers plus a sampler, the non-blocking hold test, the locked-expired-lease test and the rollback round trip.
2. `scripts/tests/003/run-supabase-staging.sh <tag>` (new). It covers the following:
   - Environment capture and checksums.
   - Applying 002 then 003, with server messages captured.
   - Catalog checks against the real default privileges.
   - GraphQL exposure.
   - PostgREST API checks with HS256 JWTs for each role.
   - Query plans and latency.
   - Rollback with schema-dump comparison.

## 5. Results

| Suite | PG 17.11 | PG 15.19 |
|---|---|---|
| Functional, concurrency and rollback suite (`run-local.sh`), assertions | **161 / 161** | **161 / 161** |
| Concurrency: 8 workers on a 400-row queue | 0 double claims, 0 per-email violations, no deadlocks | same |
| Staging checks (`run-supabase-staging.sh`) | **51 / 51** | **51 / 51** |
| Plain `postgres:17-alpine` (regression check of the harness change) | 161 / 161 | n/a |
| **Re-run from a fresh Git checkout** (`git checkout-index` with the `.gitattributes` rule: `.sh` files LF, `.sql` files CRLF): every suite above | 161 / 161 and 51 / 51 | 161 / 161 and 51 / 51 |

What the staging checks proved:

- **Apply:** 002 and 003 apply as non-superuser `postgres` with no errors or warnings. The event triggers fire cleanly.
- **RLS:** enabled on every `website_*` table.
- **Privileges:**
  - Despite Supabase's default grants, `anon` and `authenticated` hold **no** table privilege of any kind (select, insert, update, delete, truncate, references, trigger) and no column privilege on any website table.
  - `service_role` has full DML on the 003 tables.
- **Functions:** every `websites_crm_*` function:
  - can't be executed by `anon`, `authenticated` or `PUBLIC`;
  - can be executed by `service_role`;
  - is `SECURITY INVOKER` with `search_path=""`.
- **Advisor equivalents (whole `public` schema):** no function with a mutable search_path, no table with RLS disabled, and no RLS table readable by API roles without a policy.
- **GraphQL:** the introspected schema for `anon` and `authenticated` contains no website or CRM sync type.
- **Data API, `anon` and `authenticated`:**
  - Table endpoints return **401** for `anon` and **403** for `authenticated`. This covers reading all four tables and inserting into `website_inquiries`.
  - RPC calls to `sync_health`, `claim`, `requeue` and `record_success` return **404**, and the function does not run.
- **Data API, `service_role`:**
  - `POST /rpc/websites_crm_claim` returns one row with its `claim_token`, and the claim is committed when the request ends.
  - `GET /rpc/websites_crm_claim` is refused (**405**, read-only transaction) and claims nothing. This confirms the "claims must be POSTed" rule.
  - `record_success` with a stale token returns `false`.
  - `record_failure` accepts a JSON array of warnings and a bigint `retry_after_ms`. An ambiguous `opportunity` failure is deferred by at least the 5-minute floor. An invalid category returns **400** with a clear message.
- **Every write path passes `safeupdate`:**
  - `release_claim` frees the claim and refunds the attempt.
  - `rate_limited` pauses the queue; the state-table UPDATE passes.
  - A claim during the pause returns `[]`.
  - `requeue` works.
  - All over the real API connection, which has `safeupdate` loaded.
- **Rollback (as `postgres`):**
  - The `pg_dump --schema-only` of `public` (tables, constraints, indexes, policies and grants) after the 003 rollback is **identical** to the 002-only dump.
  - Re-applying 003 gives a dump identical to the first apply.
  - The 003 down migration followed by the 002 down migration returns `public` to the untouched Supabase baseline.

## 6. Performance

Claim batches of 10, each in a rolled-back transaction, 20 runs per scenario on the local Docker host after `analyze`:

| Due backlog | PG 17.11 median (p95) | PG 15.19 median (p95) |
|---|---|---|
| 5,000 rows, 5,000 emails | 133 ms (164 ms) | 139 ms (185 ms) |
| 5,000 rows, 50 emails | 129 ms (206 ms) | 130 ms (295 ms) |
| 50,000 rows, 50,000 emails | 1,177 ms (1,535 ms) | 1,284 ms (1,530 ms) |

**Finding P-1 (non-blocking): claim cost grows linearly with the due backlog**, at about 25 µs per due row. The candidate query reaches due rows through `website_inquiries_due_idx`, which is correct, but it computes the email hash for **every** due row. It does this once for the lease anti-join and again for the `DISTINCT ON` sort, then sorts the whole set before taking 10. The hash function isn't inlined because of its `SET search_path`. Only the ≤10 returned rows are locked (`Limit → LockRows`). The sweep for interrupted final attempts is an index scan taking about 15 ms at 50k rows.

What it means in practice:

- Website inquiries arrive in the tens per month. Even a week-long GHL outage leaves a due backlog of well under 1,000 rows, where a claim takes about 25 ms or less.
- Over the API, `authenticator`'s 8 s `statement_timeout` would only be reached at roughly 300,000+ due rows.
- This is the slow-plan risk flagged in the review packet, now measured. It does not justify changing the reviewed migration before launch.
- **Recommended follow-up, not done:**
  - Have the Phase 2 health route alert when more than 1,000 rows are due.
  - If that ever fires for real, a later additive migration can store the email key as a column with a partial index on `(email_key, next_attempt_at)`. That makes a claim O(limit).

## 7. Differences between local staging and hosted Supabase production

| # | Gap | Impact / mitigation |
|---|---|---|
| G-1 | **The production Postgres major version is not known here.** I deliberately had no production access. | Both supported majors (15.19 and 17.11) pass identically. The owner should confirm the version and image under Project Settings → Infrastructure. If production is on an older 15.x or 17.x minor, nothing in 003 depends on minor-version features (`sha256()` dates from PG 11, `FOR NO KEY UPDATE SKIP LOCKED` from PG 9.5). |
| G-2 | **Whether 002 is already applied in production is not known.** | 003 refuses to run without 002, so this fails safe. Confirm before the change window; if it isn't applied, apply 002 first (it has its own approval). |
| G-3 | No API gateway (Kong) or API keys. JWTs were signed locally with HS256. | Hosted projects may sign with asymmetric keys or use the newer publishable and secret keys, but they map to the same Postgres roles, which is what was tested. The Phase 2 worker will use the secret (service-role) key server-side only. |
| G-4 | No Supavisor pooler in front of the database. | The hosted Data API connects to Postgres directly, as here. If Phase 2 ever uses a direct pooled connection instead, advisory locks are transaction-scoped (`pg_try_advisory_xact_lock`) and safe in transaction mode, and no session state is relied on. |
| G-5 | Hardware and network: a Windows Docker Desktop host, versus hosted compute plus network latency. | The §6 numbers are indicative only. A small hosted instance may be 1–3× slower; P-1's margins absorb that. |
| G-6 | Production has other objects in `public` and real data. | 003 only creates and alters `website_*` objects and functions with `websites_crm_` names. The advisor-equivalent checks ran over the whole of `public` here, but only 002 and 003 objects existed. The **post-apply checks in §8 should be re-run in production** so they cover every object there. |
| G-7 | Extensions: the image lacks some hosted defaults (for example `pg_net` may be absent or not enabled). | 003 uses no extension; `pg_graphql` was enabled and tested. |
| G-8 | Real clock-driven expiry wasn't waited out; tests move timestamps instead. | The logic is time-agnostic (it compares to `clock_timestamp()`). Phase 2 staging with a live worker will exercise real expiry. |
| G-9 | How the migration is applied: here, `psql` as `postgres`. | Production should use the SQL editor or `psql` as `postgres`, the same role. These are `scripts/` files, not `supabase/migrations/`, so they won't appear in the CLI's migration history. Record the apply in the decision register instead. |
| G-10 | The emulated harness used `noinherit` API roles; the real ones are `inherit`. | No effect: 003 grants directly to `service_role` and revokes directly from the others. The real-image runs supersede the emulation. |

## 8. Conditions before a production apply (each needs its own approval)

1. Confirm G-1 (Postgres version) and G-2 (002 applied) from the dashboard.
2. Take a backup or confirm point-in-time recovery is available, and choose a low-traffic window. The migration holds an `ACCESS EXCLUSIVE` lock on `website_inquiries` from its first `ALTER TABLE` until `commit`. Reads and writes of inquiries wait for that time. The columns are added without a table rewrite, but each new check constraint scans the table once, so the lock time grows with the row count. At the expected size (tens of rows) it is well under a second. Set a `lock_timeout` for the apply session, so a long-running transaction makes the apply fail instead of queueing inquiry traffic behind it.
3. Paste 003 only after checking it against the §3 sha256. Apply it as `postgres`, as a single transaction (the file has its own `begin`/`commit`).
4. Immediately run the catalog block from `run-supabase-staging.sh` (the "catalog" section) **read-only** against production, and check for `ok` on all five checks.
5. Keep the CRM worker and live GHL sync **off**. 003 adds no scheduler; nothing claims until Phase 2 ships and is enabled.
6. Rollback: `003_websites_crm_sync.down.sql` is verified to restore the exact 002 schema. It is lossy for 003-only data, which is empty before Phase 2.

## 9. Files from this step

- `scripts/tests/003/run-local.sh`: now also runs on `supabase/postgres:*` images, skipping the emulated roles and connecting as the non-superuser `postgres`. Plain-image behavior is unchanged (re-verified).
- `scripts/tests/003/run-supabase-staging.sh`: new. It runs the staging checks above.
- `docs/websites/STAGING-VERIFICATION-003.md`: this report.
- `.gitattributes`: `*.sh text eol=lf`. Git on this machine converts line endings to CRLF on checkout (`core.autocrlf`), and a CRLF copy of a `.sh` file fails under bash. The rule affects only shell scripts; `run-local.sh` was the only tracked one, and it was already LF.

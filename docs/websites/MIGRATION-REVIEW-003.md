# Migration 003 (CRM sync coordination): packet for independent review

**Status: revision 3. Independent review round 2: GO for requesting staging approval. NOT APPLIED.** Phase 1 of `docs/websites/CRM-SYNC-RECOVERY-PLAN.md`. Applying it to staging or production needs separate owner approval. Phase 2 (worker code) does not start until this phase is reviewed.

| File | Role |
|---|---|
| `scripts/003_websites_crm_sync.sql` | Up migration: additive, single transaction |
| `scripts/003_websites_crm_sync.down.sql` | Rollback: restores 002 exactly, but is lossy (§8) |
| `scripts/tests/003/*` | Local harness: throwaway Docker Postgres, Supabase-like roles, synthetic data |

Owner decisions this implements: **A-12** (signed-webhook alert outbox with delivery tracking), **A-13** (6 attempts; backoff 1 m, 5 m, 30 m, 2 h, 12 h; longer GHL waits honored), **A-14** (VPS cron once a minute; overlapping runs are safe), **A-15** (90-day provisional retention for needs-attention rows, with **no automatic deletion**).

## 1. Dependencies and compatibility

- **Requires migration 002** (`website_inquiries`). The up script refuses to run without it, refuses to run twice, and refuses without the Supabase `service_role` role.
- **002 is unchanged.** 003 only alters `website_inquiries` additively:
  - It widens the status check to add `needs_attention`.
  - It adds nullable or defaulted columns. Adding a column with a constant default is metadata-only on PG 11+, so there's no table rewrite.
  - It adds constraints that existing app writes already satisfy.
- **Postgres:** tested on 15.19 and 17. It uses only core functions (`sha256`, `hashtextextended`, `gen_random_uuid`, `make_interval`, advisory locks), so no extension is needed.
- **Single Supabase project:**
  - Everything lives in `public` beside the existing tables, with no cross-schema dependency.
  - PostgREST will see the new functions as RPCs, but `anon` and `authenticated` cannot execute them (§6).
  - No other app table, function or trigger is touched.
- **Existing application code (before Phase 2):**
  - `inquiry-store-supabase.ts` still inserts and PATCHes `status`, CRM ids, `crm_attempts` and `last_error`. Each of those writes passes the new constraints; this is tested ("002-era status updates still accepted").
  - Rows written by the current inline sync get `next_attempt_at = now()`, so a Phase 2 worker would pick up `crm_failed` rows. Nothing claims them until a worker exists.
- **Interim overlap:** until Phase 2 changes intake to "store, then sync after the response", the inline sync and a future worker could touch the same row. Phase 2 must route the fast path through `websites_crm_claim(worker, 1, <inquiry id>)`. **Don't run a worker against an app that still syncs inline.**

## 2. What changes

**`website_inquiries`, new columns:**
- `next_attempt_at`
- `claim_token`, `claimed_by`, `claim_expires_at`
- `last_attempt_at`
- `last_failure_category` (`rate_limited`, `auth`, `rejected`, `config`, `server`, `network`, `unknown_outcome`, `internal`)
- `last_failure_step` (`contact`, `tags`, `note`, `opportunity`)
- `last_outcome` (`rejected`, `unknown`)
- `rate_limited_until`
- `last_warnings` (JSON array)
- `crm_synced_at`
- `needs_attention_at`, `needs_attention_reason`
- `manual_requeues`

**`website_inquiries`, new constraints:**
- The value domains above.
- Claim columns are set all together or not at all.
- `crm_synced` requires both CRM ids.
- `needs_attention` requires a timestamp and a reason.
- Terminal rows can't hold a claim.
- Partial indexes for the due queue and the needs-attention list.

**New tables:**

| Table | Purpose |
|---|---|
| `website_crm_sync_leases` | Cross-process lease per email. The key is `sha256(lower(trim(email)))`, so no plaintext is stored. A lease outlives its sync until the reconcile floor whenever GHL may have created a note or opportunity. Expired rows are taken over in place, never deleted in bulk. |
| `website_crm_sync_state` | Single row: the queue-wide pause for rate limits or auth failures (GHL limits are per location), plus the **stored queue settings** `max_attempts` (6), `lease_seconds` (120) and `reconcile_floor_seconds` (300). Checked: floor ≥ lease. Every function reads them, so callers can't disagree. |
| `website_crm_sync_alerts` | Owner-alert outbox. `dedupe_key` is unique, delivery is tracked (`pending`/`delivered`/`failed`, attempts, next delivery, last error), and the payload holds **no PII**. |

**Functions** (all `SECURITY INVOKER`, `search_path = ''`, every name schema-qualified):

| Function | Contract |
|---|---|
| `websites_crm_claim(worker, limit=10, only_id=null)` | Atomically claims due rows, **at most one per email** and skipping emails with a live lease, and returns them with their `claim_token`. `only_id` claims one specific inquiry (the Phase 2 fast path). Call it with POST `/rpc` and commit before any GHL request. |
| `websites_crm_record_success(id, token, contact_id, opportunity_id, warnings)` | `false` if the token isn't current. Holds the email lease until the floor. |
| `websites_crm_record_failure(id, token, category, step, outcome, error, retryable, retry_after_ms, contact_id, warnings)` | Returns the new status, or `stale_claim`. NULL or invalid category/step/outcome/retryable raises before any row is touched. `retry_after_ms` is capped at 24 h. After an ambiguous note or opportunity step, the email lease is held until the floor; otherwise it is freed. |
| `websites_crm_release_claim(id, token)` | Graceful shutdown **before any GHL request**: refunds the attempt and frees the lease |
| `websites_crm_requeue(id)` | Owner action: needs_attention → queue, with a fresh budget, counted in `manual_requeues` |
| `websites_crm_sync_health()` | Counts only, no PII |
| `websites_crm_email_key(email, id)` | Lease key |

## 3. Concurrency model (across processes)

1. **Row selection:** the oldest due inquiry per email whose lease is free (`DISTINCT ON`), locked with `FOR NO KEY UPDATE SKIP LOCKED`. Concurrent claimers never wait on each other and never get the same row. Foreign-key `KEY SHARE` checks aren't blocked. One busy email can't fill the window and starve the others.
2. **Email exclusion within the claim transaction:** `pg_try_advisory_xact_lock(hash(email_key))`. It never blocks. If another claimer holds it, the row is skipped. This covers two claimers picking *different* inquiries with the *same* email at the same moment, when neither one's lease is committed yet.
3. **Email exclusion across transactions:** the lease row is inserted with `ON CONFLICT … DO UPDATE … WHERE expires_at < now()`. A live lease isn't taken over, so the row is skipped.
4. **Fencing:** every result write needs the current `claim_token`. A worker whose lease expired and was re-claimed gets `false` or `stale_claim`, and its result is discarded.
5. **Deadlocks:** the only statement that can wait is the lease upsert for an email whose advisory lock this claimer already holds, and claimers never delete or lock other emails' leases. Expired leases are taken over in place, so **there is no global cleanup** (the original draft's bulk delete could deadlock; review M1). Candidates are visited in email-key order. 8 parallel workers: no deadlocks. A transaction holding a lock on an expired lease row doesn't stall claimers of other emails (tested). Re-adding the bulk delete makes the stress test fail.
6. **Overlapping cron runs (A-14):** safe by construction. Overlapping runs claim disjoint rows and emails. Optionally wrap the cron line in `flock -n` to avoid pointless overlap.

Known cost: a claimer row-locks up to `limit` candidates until its transaction ends, which is milliseconds. A concurrent claimer skips them for that instant. Computing the email key means hashing each due row once per claim, which is fine at this queue size. Add an expression index if the queue ever holds thousands of due rows.

## 4. Claim expiry and interrupted sync

| Situation | Behavior |
|---|---|
| Worker crashes or is killed after claiming | The claim stays committed. `crm_attempts` was already incremented, and `next_attempt_at` was already set to now + **reconcile floor** (5 min). The row is claimable again only after the lease expires (120 s) **and** the floor passes. The interrupted attempt counts toward the cap. |
| Worker finishes GHL calls but its result write fails (DB blip) | Same as a crash. The next attempt re-runs the idempotent sync (§5), which finds the existing contact, note and opportunity. |
| Worker is slower than its lease | It may be re-claimed after lease + floor. Its late write is fenced off by the token. The **email lease lasts until the floor** (5 min), so sibling inquiries for the same email wait too. The row lease (120 s) is about 5× the adapter's 25 s sync budget, so this needs a worker frozen for more than 5 minutes. |
| Final (6th) attempt interrupted | The next claim call sweeps the row to `needs_attention` (`attempts_exhausted_interrupted`) and queues an alert. |
| Rate limited (429) | The attempt is **refunded**. The row waits `max(backoff, retry_after_ms)`, and `rate_limited_until` is persisted. The **whole queue pauses** until the wait ends. |
| Auth failure (401/403) | Refunded. The queue pauses ≥ 15 min. One `auth_failure` alert per UTC hour. |
| Non-retryable rejection (400/422 after the adapter's fallbacks) | `needs_attention` at once, with an alert. |
| Ambiguous outcome at opportunity or note (`outcome = unknown`) | The next attempt waits ≥ 5 min, **and the email lease is held for the same window**, so neither this inquiry nor a sibling with the same email searches GHL before its index has caught up (review M2). |
| Success | The email lease is held until the floor, so a sibling's opportunity search can see the new opportunity. A returning lead's next submission syncs up to 5 min later. |
| Graceful shutdown | `websites_crm_release_claim`, only before any GHL request: refunded and immediately claimable. |
| Persistent 429 or auth failure | Refunds are unbounded **by design**: the queue stays paused (with hourly auth alerts) instead of exhausting every inquiry's budget. The health route shows `pause_reason`. |

## 5. Idempotency and reconciliation: what the DB can and can't guarantee

**A database lock can't give exactly-once creation in GHL.** After a timeout, the CRM may or may not have applied a create, and no local transaction can know which. The design therefore aims for **at-most-one concurrent attempt** (database), **idempotent repeat attempts** (adapter), and **bounded, visible residual risk**. It doesn't claim exactly-once.

| Layer | Mechanism |
|---|---|
| DB (this migration) | One live claim per inquiry and per email, across processes; token fencing; after a success or ambiguous create, **no sync of that email** (same or sibling inquiry) until the reconcile floor; attempt cap → human review |
| Adapter (`lib/integrations/ghl/client.ts`, committed in `e5a7deb`) | **Contact:** upsert by email, which converges. **Tags:** additive endpoint. **Note:** carries `Reference: <idempotency_key>` and is created only if no note has it. **Opportunity:** reuses a recent in-process create, else searches for an open one for this contact and pipeline, else creates. Creates are sent at most once per attempt; ambiguous results are re-read; unreadable reads are errors, never "not found". |
| Process | Each attempt runs `syncLead` from the start. Every step is safe to repeat given the reads above. |

**Residual risk, documented and accepted for review:**
- If GHL's opportunity search lags by **more than 5 minutes** after an ambiguous create, a retry could create a second opportunity. This is bounded to at most one extra per retry, and visible in the CRM.
- A person closing or deleting the opportunity in GHL between attempts causes a new one to be created. That's arguably correct.
- Notes don't depend on the search index: the marker check reads the contact's notes directly.

## 6. Access control

- RLS is **enabled** on the three new tables, with no policies. `website_inquiries` keeps 002's RLS.
- `REVOKE ALL … FROM public, anon, authenticated` on the new tables, and on **every** new function. Supabase grants EXECUTE on new `public` functions to `anon`/`authenticated` through default privileges; the harness reproduces those defaults and proves the revokes override them, both in the catalog and at runtime ("anon execute websites_crm_claim denied").
- `GRANT EXECUTE` and table DML go to `service_role` only. The functions are `SECURITY INVOKER`, so they run with the caller's rights. Nothing escalates, and `service_role` already bypasses RLS.
- `search_path = ''` on every function closes search-path hijacking.
- **PII:** inquiry fields and consent evidence stay in `website_inquiries`, with 002's protection. The lease table stores only a hash, and alert payloads and health output carry ids, counts and categories only (asserted).
- **Retention (A-15):** needs-attention rows are kept; the provisional limit is 90 days from `needs_attention_at`. **No deletion job exists or is scheduled.** It waits for approval of the privacy and retention policy.
- **Lease hashes:** expired leases are no longer bulk-deleted, so each email's unsalted `sha256` lease key is kept for as long as its inquiry. That hash is pseudonymous personal data. It's covered by the retention policy, because leases cascade-delete with their inquiry.

## 7. Test results (local only, 2026-11-07)

`scripts/tests/003/run-local.sh <image>` starts a throwaway container, creates the Supabase roles and their default privileges, then runs everything below. Synthetic `@example.com` data only. No Supabase, staging or production.

| Suite | Postgres 17 | Postgres 15.19 |
|---|---|---|
| Preconditions (003 without 002 fails, 003 twice fails, 002-era row survives and becomes due) | pass | pass |
| Functional: access, constraints, claim, fencing, backoff and cap, ambiguous floor, rejection, requeue, alert dedupe, rate limit, auth, interrupted final attempt, release, health, validation | pass | pass |
| Concurrency: 8 parallel workers + sampler every 20 ms over 400 rows and 40 emails, about 30% of attempts failing and re-queued | pass (581 claims, 400 synced, 0 violations) | pass (565 claims, 399 synced, 0 violations) |
| Non-blocking: B's claim during A's open transaction returns in < 1 s and never takes A's email | pass | pass |
| Rollback: refuses with live claims; restores 002; maps needs_attention → crm_failed; 003 re-applies; 003 down + 002 down leaves nothing | pass | pass |
| Review M1–M4, m1 regressions: no starvation by one email, `only_id`, lease held after success or ambiguous failure, NULL/invalid input, 24 h cap, locked expired lease doesn't block | pass | pass |
| Missing config row raises (round-2 NIT) | pass | pass |
| **Total assertions** | **161 / 161** | **161 / 161** |

**Mutation checks** (`MIGRATION_003=<mutant> SKIP_FUNCTIONAL=1`):
- Email guards removed (advisory lock, lease takeover check, lease filter): fails with "never two live claims for one email (9 violations)".
- The original global expired-lease delete put back: the 8-worker stress run fails with a deadlock or exception.

The suite detects both regressions.

Not tested here: real Supabase (pooler/PgBouncer, PostgREST RPC serialization), real clock-driven expiry (tests move timestamps instead of waiting), and the app worker (Phase 2).

## 8. Rollback limitations

`003_websites_crm_sync.down.sql`:
- Refuses to run while live claims exist.
- Drops the three tables and seven functions, the new constraints and the columns.
- Maps `needs_attention` → `crm_failed`, then restores 002's three-value status check.

The script takes `ACCESS EXCLUSIVE` locks on `website_inquiries` and the lease table **before** its guard, so no claim can commit in between. It also treats leases still inside the reconcile window as live.

**Lossy:** undelivered alerts, retry timing, failure categories, warnings and needs-attention reasons are lost. Fields, consent, CRM ids, `crm_attempts` and `last_error` are kept. Before rolling back, stop the scheduler and export alerts and needs-attention rows.

## 9. Test plans still to run (need approval)

**Staging migration verification** (after approval to apply to a staging Supabase project):
1. Take a snapshot or branch, apply 002 then 003, and confirm that the precondition checks pass.
2. Through PostgREST as `anon` (publishable key): `rpc/websites_crm_claim` → 401/403; `select` on each new table → denied.
3. As `service_role`: claim, record success, and record failure on synthetic rows; read `rpc/websites_crm_sync_health`.
4. Confirm `pg_get_functiondef` shows `search_path=""` and `prosecdef = false`.
5. Run `analyze public.website_inquiries` and `EXPLAIN (ANALYZE, BUFFERS)` of `websites_crm_claim('staging-check', 10)` on a seeded backlog (e.g. 5,000 synthetic rows), and record the plan and timing.
6. Stop any scheduler, run the rollback on the staging copy, confirm 002 is restored, then re-apply.

**Concurrency in staging** (Phase 2 code): two worker processes through the Supabase pooler on the same queue → no duplicate claims, and GHL test sub-account contents match one opportunity and one note per submission.

**Failure recovery in staging** (Phase 2/5): kill a worker mid-sync and confirm a retry after lease + floor; force a 429 (or simulate one) and confirm the queue pauses; revoke the test token and confirm `auth_failure` alerts and recovery after restoring it.

## 10. Independent review: round 1 and how it was resolved

Round 1 verdict: **REVISE**. It confirmed: two workers can never hold one inquiry; the rollback restores 002 exactly (identical `pg_dump -s`); FOUND/ON CONFLICT semantics; advisory xact locks are safe through the pooler; access is service-role only with no PII.

| Finding | Resolution |
|---|---|
| **M1** Global expired-lease delete could deadlock and stall claimers | Removed. Expired leases are taken over in place under the email's advisory lock. Regression test plus mutation check added. |
| **M2** Lease dropped right after success or ambiguous failure, so a sibling could duplicate an opportunity through index lag | The lease is held until the reconcile floor after success, and after ambiguous note or opportunity failures. Tested. |
| **M3** Head-of-line starvation by one busy email | One candidate per email; emails with live leases excluded. Tested: 40 queued for one email plus 30 others gives 10 distinct emails per call of 10. |
| **M4** No way to claim one specific inquiry | `p_only_id` parameter. Tested. |
| m1 NULL arguments got past validation; an invalid category raised a confusing error | Explicit NULL and value checks on every parameter, with clear errors before any row is touched. Tested. |
| m2 Cap and floor passed per call | Stored in `website_crm_sync_state` with check constraints. Tested. |
| m3 Racy rollback guard | `ACCESS EXCLUSIVE` locks before the guard; leases in the reconcile window count as live. |
| m4 `FOR UPDATE` blocked FK key-share checks | `FOR NO KEY UPDATE` everywhere |
| Nits | `retry_after_ms` capped at 24 h (tested); unbounded systemic refunds documented as intended; claims must be POSTed and committed before GHL calls (documented in the function comment and §2); `<` vs `<=` at the exact boundary is harmless; `begin`/`commit` kept consistent with 002 |

### Round 2 (revision 2): verdict **GO**, no blockers, no majors

Verified by running SQL:
- The rollback dump is identical to 002-only with the new signatures.
- `FOR NO KEY UPDATE OF i SKIP LOCKED` over the `DISTINCT ON` derived table is valid, and the plan is Limit → LockRows (only returned rows are locked).
- The starvation fix holds: 10, 10 and 10 rows across three calls, where it used to be 1 per call. A claim over 5,000 due rows takes 134 ms.
- The M2 and M4 behavior and the m1 NULL check work as described.

By reasoning: no new deadlock path, and no stuck rows or orphaned leases.

| Round-2 NIT | Resolution |
|---|---|
| Rollback could deadlock with a running claim, because a claim touches the state table first | The rollback now locks the state table, then inquiries, then leases, all before the guard, with `lock_timeout = 5s` (it fails fast instead of blocking app traffic). It should still run with the scheduler stopped. |
| A missing config row made claim and record_failure silent no-ops | All three functions raise `website_crm_sync_state row missing`. Tested. |
| Lease hashes are kept as long as their inquiry | Documented under §6 retention |
| Possible slow plan on a cold table with a large backlog | Added to the staging plan: run `EXPLAIN (ANALYZE)` of a claim after `analyze`. If it isn't a PK lookup, add an `(id)`-driven rewrite or an expression index on the email key. |

## 11. Questions for the reviewer

1. Is 120 s lease / 300 s floor / 6 attempts right for the expected volume? All three are stored in `website_crm_sync_state` and can be tuned with one checked `update`, no migration needed.
2. Is the queue-wide pause on 429 too broad if more locations are ever added? It's per-location in effect, because there's one intake location today.
3. Should `websites_crm_requeue` record who did it? Today the app's audit log is expected to (D-12).

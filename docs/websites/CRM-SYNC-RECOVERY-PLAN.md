# CRM sync recovery: implementation plan

Status: **PLAN ONLY.** Nothing here is built, migrated or deployed.
Branch: `feat/websites-commercial-foundation` (after `e5a7deb`).
Closes: release gate **`crm-sync-recovery`**, and with it the D-04 condition ("retries, monitoring and owner alerts before production"). Also closes the items the GHL remediation deferred: cross-process locking, persisted retry timing, and acknowledging after store.

## Outcome

Every stored inquiry reaches GHL exactly once, or ends up visibly in a **needs-attention** state with an owner alert, whichever process or instance handles it. The visitor's confirmation never waits on GHL.

## Approvals this milestone needs

| # | Approval | Needed before | Owner |
|---|---|---|---|
| P-1 | Review migration `003_websites_crm_sync.sql`. It's additive to 002, so 002's review stays valid. | Phase 1 merge | Owner + reviewer |
| P-2 | Apply 002 + 003 to a **staging** Supabase project (not production) | Phase 5 | Owner |
| P-3 | Choose the alert channel (A-12 below) and supply its secret | Phase 3 | Owner |
| P-4 | Owner creates a GHL test sub-account and a Private Integration token there (four scopes: `contacts.write`, `contacts.readonly`, `opportunities.readonly`, `opportunities.write`). Only synthetic `@example.com` data. | Phase 5 | Owner |
| P-5 | Scheduler on the server (crontab or pm2 cron calling the protected run route every minute) | Phase 5 (staging) / production later | Owner + ops |
| P-6 | Push / PR | Any time after phases 1–4 | Owner |

No production migration, flag change, GHL account change or live service is part of this plan.

## Phase 1: schema (migration 003, not applied)

Additive to `website_inquiries`. Never applied without P-2.

| Change | Purpose |
|---|---|
| Widen `status` check to `received`, `crm_synced`, `crm_failed`, `needs_attention` | Terminal "a human must look" state |
| `next_attempt_at timestamptz` (default `now()`) | When the worker may try next. Honors `retryAfterMs`. |
| `lease_until timestamptz`, `lease_owner text` | Per-row claim, so a crashed worker's row becomes claimable again |
| `last_outcome text` (`rejected` / `unknown`), `last_step text` | Drives backoff and triage |
| `last_warnings jsonb` | Persists the adapter's sync warnings (unmapped fields, `phone_rejected`, …). No PII. |
| `alerted_at timestamptz` | One alert per failure episode |
| New table `website_crm_sync_leases (email_hash text primary key, lease_until timestamptz, lease_owner text)` | **Cross-process lock per email** (closes F-7). The key is a salted hash, not the email. |
| Function `claim_website_inquiries(p_owner text, p_limit int, p_lease_s int)` | Atomic claim. Selects due rows (`status in ('received','crm_failed') and next_attempt_at <= now() and (lease_until is null or lease_until < now())`) with `for update skip locked`, takes the email lease with `insert … on conflict do update where lease_until < now()`, skips rows whose email is leased elsewhere, and returns the claimed rows. `security invoker`; `execute` granted to `service_role` only. |
| Function `release_website_crm_lease(p_email_hash text, p_owner text)` | Releases only the caller's own lease |
| Partial index on `(next_attempt_at)` where status is `received` or `crm_failed` | Cheap due-row scan |
| Down migration `003_…down.sql` | Rollback |

RLS stays on with no policies (same model as 002). Add a review packet `MIGRATION-REVIEW-003.md` in the same format as 002.

## Phase 2: worker and acknowledge-after-store

**New `lib/services/websites/crm-sync-worker.ts`**, pure orchestration with injected store, CRM, clock and alert:

- `runCrmSync({ limit, leaseSeconds })`: claim → for each row, `buildCrmLead(row)` → `syncLead` → record the result → release the lease. Returns counts only.
- On success: `crm_synced`, CRM ids, `last_warnings`, clear the error and lease.
- On `GhlError`:
  - `rejected` and not retryable (400/401/403/422): `needs_attention` at once.
  - 429: `next_attempt_at = now + max(backoff, retryAfterMs)`.
  - `unknown` at the opportunity or note step: **at least 5 minutes**, so GHL's search index catches up before the re-search that guards against duplicates.
  - Otherwise: backoff schedule **1 m, 5 m, 30 m, 2 h, 12 h**. After 6 attempts: `needs_attention`.
  - Every attempt records `crm_attempts`, `last_error` (`step:status`), `last_outcome` and `last_step`.
- 401/403 also raises a **token alert**, since the PIT may have expired or been rotated.

**Store** (`inquiry-store-supabase.ts`): add `claimDue`, `recordSyncResult` and `releaseLease`, using PostgREST `rpc/claim_website_inquiries`. Same service-role, server-only pattern and timeout.

**Intake** (`intake.ts`, `route.ts`), finishing D-04:
- **With a store:** insert → respond `200 received` straight away → schedule a fast-path sync with Next's `after()`, so it runs after the response is sent. The fast path calls the same worker for that row id and respects the leases. If it fails, the scheduled worker picks the row up. F-8 is closed: the visitor never waits on GHL.
- **Without a store:** unchanged. Inline sync, and a 502 when it fails, because there's nothing durable to recover from.
- Public form behavior and copy stay unchanged.

## Phase 3: trigger, monitoring and alerts

| Item | Design |
|---|---|
| Run route | `POST /api/services/websites/crm-sync/run`. Returns 404 unless `WEBSITES_SERVICES_MODE` ≠ `off`. Requires `Authorization: Bearer $WEBSITES_CRON_SECRET` (timing-safe compare, 401 otherwise). Runs one batch (limit 20, 25 s budget). Responds with counts only. |
| Health route | `GET /api/services/websites/crm-sync/health`, same auth. Returns `pending`, `failed_retrying`, `needs_attention`, `oldest_unsynced_minutes`, `last_run_at`. No PII. |
| Thresholds | Alert when a row enters `needs_attention`; any row has been unsynced for more than 60 minutes; the run route hasn't been called for 10 minutes (checked by the health route); or a token alert fires. |
| Dedupe | One alert per row per episode (`alerted_at`). A digest when more than 5 rows are affected. |
| Channel (A-12) | Default proposal: a signed **webhook** (`WEBSITES_ALERT_WEBHOOK_URL`, e.g. Slack or Discord) plus structured error logs. Email needs a transactional provider the repo doesn't have yet (see D-06), so it's a separate decision. GHL itself is **not** used as the alert channel: it's the system being monitored. |
| Logs | `[websites-crm-sync]` lines carry the row id, step, status, outcome, attempt and `retryAfterMs`. Never names, emails, phones or messages. |

## Phase 4: owner queue hook (optional in this milestone)

D-12's "Retry GHL sync" server action calls `runCrmSync` for a single row id: same leases, same idempotent adapter. Building the full admin page (D-12) can be a follow-up. This milestone only exposes the function.

## Phase 5: verification

**Automated (no network), added with each phase:**
- Worker: success path; 429 → `next_attempt_at` honors `retryAfterMs`; `unknown` opportunity → ≥5 min; 4xx → `needs_attention` immediately; cap → `needs_attention` plus one alert; alert dedupe; 401 → token alert.
- **Two workers in parallel** over a memory store with real lease semantics, plus the fake GHL with `searchLag`: one opportunity, one note per submission. This is the cross-process control test from the remediation, now passing.
- Lease expiry: a crashed claim becomes claimable again after `lease_until`.
- Intake: with a store, a 200 comes back before any CRM call, and `after()` is scheduled. Without a store, behavior is unchanged.
- Routes: 404 when mode is off, 401 without the secret, counts-only bodies.
- SQL: a reviewed test script for `claim_website_inquiries`, run only in staging after P-2.

**Staging (after P-2, P-4, P-5):**
1. Submit 5 synthetic inquiries, including one returning contact with pre-seeded tags. Confirm tags are kept, one opportunity, one note each, and custom fields by id.
2. Break the token: confirm `needs_attention`, a token alert, and recovery after restoring it.
3. Use a wrong field id: confirm the `custom_fields_rejected` warning is persisted and the lead still syncs.
4. Run two worker invocations at the same time: no duplicates.
5. Confirm the D-19 notification trigger fires for a returning lead.
6. Record all of this as evidence on gate `crm-sync-recovery`. The gate flips **only** with that evidence and owner sign-off.

## Order and size

| Phase | Depends on | Rough size |
|---|---|---|
| 1 Schema + review packet | — | 0.5 day |
| 2 Worker + store + after()-ack | 1 (code only; no applied DB needed) | 1–1.5 days |
| 3 Routes, health, alerts | 2, A-12 | 0.5–1 day |
| 4 Owner-queue hook | 2 | 0.25 day |
| 5 Staging verification | P-2, P-4, P-5 | 0.5 day + owner time |

Phases 1–4 can be built and tested locally with no approvals beyond this plan. Commits happen per phase on owner request.

## Decisions to make

| ID | Decision | Recommendation |
|---|---|---|
| A-12 | Alert channel | A signed webhook now; transactional email later together with D-06 |
| A-13 | Retry cap and schedule | 6 attempts: 1 m, 5 m, 30 m, 2 h, 12 h, then needs-attention |
| A-14 | Scheduler | Server crontab calling the run route every minute (no new dependency). pm2 cron is the alternative. |
| A-15 | Data retention for `needs_attention` rows | Keep until handled. A retention policy belongs with the privacy notice (legal review). |

## Out of scope

Payment provider, the owner lead-queue UI (beyond the hook), API v3 migration, SMS DND (A-07), and anything in production.

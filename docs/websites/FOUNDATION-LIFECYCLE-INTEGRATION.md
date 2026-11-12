# Commercial foundation + preview-to-payment: integration candidate

Status, 2026-11-12: **review candidate, sandbox only, nothing applied or deployed.** Branch `integrate/websites-foundation-lifecycle`, draft PR into `review/ghl-s8-remediation`. No production Supabase, GHL or payment call was made. Every gate is still closed.

## 1. What this depends on

| Dependency | Ref (verified by fetch, 2026-11-12) | How this branch holds it |
|---|---|---|
| Integration base `review/ghl-s8-remediation` | `4cb7d7f` (origin). The local branch of the same name was stale at `2a12dac`. | Branch cut from `origin/…@4cb7d7f`. |
| PR #39 `feat/websites-preview-lifecycle` (draft, open, base = R) | `2028f0c` (2 commits) | **Merged into this branch** (`113d631`), clean. This PR therefore also shows #39's diff until #39 merges; review it after #39. |
| Commercial foundation `feat/websites-commercial-foundation` | **local `cad8ae0` (6 commits, not pushed). Origin is still `ffa977c`.** Based on `87e0b68`, 52 commits behind R. | Only its non-conflicting assets are **copied** (`974c191`), not merged: migration 003 + rollback + preflight SQL + tests + 003 review/staging docs + `ghl-audit` docs + `.gitattributes`. The three `PRODUCTION-*` runbook/results docs are **withheld** (they name the production project; public repo). |

Do not merge #39 or the foundation because of this PR. Merge order when ready: #39 → foundation (rebased, §3) → this PR's remaining commits (or fold them into those).

## 2. Dependency map

```
002_websites_services.sql  (on R, NOT applied anywhere)
   ├── 003_websites_crm_sync.sql   (foundation)  touches website_inquiries + website_crm_sync_*      
   └── 004_websites_lifecycle.sql  (this branch) touches website_projects, _project_events, _payment_events + 3 new tables
        ▲ implements the "Persistence delta" that PR #39's state-machine doc defers to a later migration
PR #39 code (lifecycle.ts, workflow.ts, activation-gates.ts, billing.ts, payments/*)
   └── in-memory LifecycleStore only; no route, page or job imports it
foundation code (ghl client/config/server, intake, phone)  ← superseded on R (§3)
```

- **#39 ↔ foundation: no shared files and no shared tables.** The file sets are disjoint; 003 changes only `website_inquiries`, 004 only the project, event and payment tables. The two migrations are order-independent. `WITH_003=1 scripts/tests/004/run-local.sh` proves 002 → 003 → 004 and the reverse rollback.
- **#39 → 004 is a hard dependency.** #39's own doc says persistence needs "a migration after 002 and 003, so it would be 004". Without it the lifecycle cannot be stored, so no real project can move.
- **foundation → R is the conflict.** Merging the foundation as-is conflicts in 12 files (add/add or content): `lib/integrations/ghl/{client,client.test,config,fake-ghl.test-helper,server}.ts`, `lib/services/websites/{form-rules,inquiry-schema,intake,intake.test,phone,phone.test}.ts`, and `docs/websites/DECISION-REGISTER.md`. R already holds newer, divergent versions of all of them (R's `client.ts` is 622 lines with read-before-create reconciliation; the foundation's is 466). Only commit `e5a7deb` (the older adapter hardening) touches them. The migration commits (`07eb5ae`, `9f91389`, `5614cb4`, `0f91b39`, `cad8ae0`) do not.
- **Type mismatch found and fixed:** 003 adds the `needs_attention` inquiry status; `InquiryStatus` in `intake.ts` did not include it.
- **Lifecycle assumption found:** 003 says duplicate CRM creation after an ambiguous GHL timeout is handled by the adapter's read-before-create reconciliation. R's adapter has that; the foundation's older adapter is not what runs. Not re-verified against a live sub-account (no GHL calls were made).

## 3. Reconciliation done, and the recommended structure

Done: carried the foundation's SQL, tests and docs; added `needs_attention` to `InquiryStatus`; added migration 004; fixed the gaps in §5. Migrations 002 and 003 are byte-identical to their sources. 004 is additive and numbered after them.

**Recommendation (needs your decision, not done here):** rebase `feat/websites-commercial-foundation` onto R and drop `e5a7deb` (superseded), keeping the 003 commits. That removes all 12 conflicts and leaves the foundation as migration-only. Then push it: it exists only on this machine today. If you prefer, this PR's `974c191` already contains the same files, so the foundation PR could simply be closed in favour of it.

## 4. Migration 004: what it does and where it differs from #39's delta

Follows #39's eight-item delta, plus: an atomic `website_lifecycle_commit` function (row lock, `(project_id, event_id)` idempotency, version compare-and-set, audit + verified payment fact + intents in one transaction); append-only audit, payment and rejection ledgers; immutable `mode`, charge, subscription, launch and agreement facts; `CHECK`s that a subscription needs a verified launch and a charge needs a request and payment time; **`website_projects_no_production_money_yet`** (a production project cannot hold a charge or subscription until a reviewed migration removes it). Differences from the delta:

- `website_payment_events` holds **accepted** facts only. Rejected callbacks go to `website_project_rejections`, so a transient rejection never blocks a redelivery on the provider-event-id primary key.
- Intents can only be `not_sent` (`CHECK`), until a later migration for Gate D.
- Two constraints reach old columns (`subscription_after_launch`, `charge_after_payment`) and the provenance check are `NOT VALID`: a 002-era row is not rewritten, only checked when next updated.

**Owner call:** `no_production_money_yet` is an engineering backstop matching D-07 ("no live provider"), not a legal decision. Drop the constraint if you disagree; the app-level gates do not depend on it.

## 5. Security findings

Each fixed item has a regression test in `hardening.test.ts` that failed on #39's head before the fix.

| # | Finding | Fix |
|---|---|---|
| F1 | **One-month minimum was quoted, not enforced.** `request_cancellation` accepted any `effectiveAt`, so a cancellation could take effect on day 2. | Rejected unless `effectiveAt` ≥ launch + `minimumTermMonths`; unparseable dates rejected. |
| F2 | **Event time came from the caller.** A backdated `at` could accept an expired proposal; a future one could skip a minimum. | `applyLifecycleEvent` rejects `at` more than 5 min from the server clock (`now` injectable for tests). |
| F3 | **Gate clearances never expired.** Closing a gate (or changing a project) did not invalidate a clearance already issued. | Clearances expire after 15 min, checked in `transition()` and the billing guards. |
| F4 | **Subscription facts weren't bound.** The activation callback attested no amount (a $1 plan would be accepted); payment failed/recovered named no subscription and worked with none recorded. | `amountCents` must be signed and equal the accepted $75; failed/recovered must name the recorded subscription. |
| F5 | **Rejection rows stored unbounded caller text.** | Capped (200/300 chars), also enforced by `CHECK`s in 004. |
| F6 | **No place for provenance.** The store contract had no field for the verified callback. | `verifyProviderCallback` records a SHA-256 of the signed body; `commit` carries the callback so the store writes it with the project. Raw body, signature and secret are never stored or logged (tested). |
| F7 | Persistence races. Version CAS and replay existed only in the memory store. | 004's commit function; proven under 8-way concurrency in Postgres. |

Verified without change: forged or copied payment provenance, wrong project/mode/request/charge/amount, duplicate callbacks (same id or new id), a second different charge (`possible_double_payment`), concurrent approvals and charges, expired-proposal acceptance, gate clearance reuse across project/gate/mode, subscription before verified launch, production closed with every flag on, no `console` logging in the payment path.

**Observed, not changed (decide before Gate B):**
1. Idempotency is by event id only. Re-using an owner event id for a *different* event type is treated as a replay and dropped silently. Generate one id per action.
2. Provider `reason` text (≤200 chars) is stored in audit detail. Restrict it to a code list when the GHL adapter exists.
3. **Ownership is not enforceable yet.** Projects carry no user/tenant column and no route exists. A project is bound to its customer through its inquiry, and a payment through the signed project id and the open request id. When routes are built they must authorize the actor (D-12 allowlist) and set `at` from the server clock.
4. The customer-binding of a payment is transitive (signed `requestId` was issued for this project's customer); GHL's real callback should also be checked for a contact id.

## 6. Customer journey, verified (sandbox, in code)

`journey.test.ts` drives all eleven steps through the idempotent workflow with the sandbox provider: request → acknowledge/qualify → concept delivered → revision then approval of the latest revision → proposal only after approval (an earlier proposal is refused) → agreement (Gate A) → $199 request, no link (Gate B) → signed confirmation recorded once, owner cannot record it by hand → build, launch approval, deployment → Gate C closed until `verify_launch` → $75/month subscription anchored to the launch time, recorded once → cancellation inside month one refused. Messages are intents (`not_sent`) only.

## 7. Tests

| Check | Result |
|---|---|
| Targeted: `scripts/tests/004/run-local.sh` (throwaway Postgres 17) | **pass**: refusal without 002, legacy rows, 76 functional checks, 8-way concurrency (×2), rollback refusal and round trip |
| Chain: `WITH_003=1 …/004/run-local.sh` | **pass** (002 → 003 → 004 → down) |
| Carried: `scripts/tests/003/run-local.sh` | **pass** |
| Mutation: remove the version compare-and-set from 004 | **caught** ("a stale version is refused") |
| Lifecycle/payment security: `lib/services/websites` | **418 / 418** pass (baseline on #39 head: 393) |
| Full unit suite `npm test` (`lib/**`, `components/**`) | **731 / 731** pass |
| `tsc --noEmit` | exit 0 |
| `eslint` on changed files | 0 problems |
| `next build` (Next 16.4.3, Turbopack) | exit 0 |
| Not run | the Supabase staging harness (`run-supabase-staging.sh`, remote), GHL sandbox scripts, Playwright e2e (no UI changed), full repo lint (pre-existing errors outside this diff) |

## 8. Remaining before any customer can pay

1. Decide the foundation structure (§3) and push it.
2. Owner review of 002/003/004 together, then a staged apply with a backup/preflight runbook. The foundation's runbook covers 002 and 003 only and needs 004 added. **It is not in this PR:** `PRODUCTION-MIGRATION-RUNBOOK-002-003.md`, `PRODUCTION-BACKUP-RESTORE-VERIFICATION.md` and `PRODUCTION-PREFLIGHT-003-RESULTS.md` name the production Supabase project, and this repository is public, so they stay on the local foundation branch until they are sanitized or you approve publishing them. The `scripts/preflight/*.sql` comments still point at them.
3. A Supabase `LifecycleStore` that calls `website_lifecycle_commit`, and the routes that call the workflow (owner actions, GHL webhook) with actor authorization.
4. The GHL payment adapter and its real `verifyWebhook` (Gate B/C prerequisites), tested in GHL test mode.
5. Owner-approved final agreement, entity reinstatement and templates (Gates A/D). No pricing or legal copy was changed here.

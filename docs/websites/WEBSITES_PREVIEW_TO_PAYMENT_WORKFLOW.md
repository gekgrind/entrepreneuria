# Websites preview-to-payment workflow

Addresses **UX-01**: there was no defined path from free preview request to concept, proposal, agreement and payment (`docs/websites/ux-audit/WEBSITES_CUSTOMER_JOURNEY_AUDIT.md` on `claude/sleepy-hopper-k6270b@4fec65c`).

- **Branch:** `feat/websites-preview-lifecycle`, cut from `review/ghl-s8-remediation@2a12dac`, the newest Websites integration branch.
- **Status:** foundations implemented and tested in sandbox. **Agreement acceptance, payment collection, subscription activation, production intake and real customer messages all remain disabled.**

Companion documents:
- `WEBSITES_LIFECYCLE_STATE_MACHINE.md`: states, transitions, invariants, duplicates, persistence delta
- `WEBSITES_LEGAL_PAYMENT_ACTIVATION_GATES.md`: Gates A–D and how each one opens
- `WEBSITES_CUSTOMER_COMMUNICATION_TEMPLATES.md`: the 11 draft messages

## 1. What already existed (inspection, 2026-11-12)

| Stage | Before this branch | Now |
|---|---|---|
| 1. Free preview request | **Implemented, gated off.** Intake form, Turnstile, GHL contact and opportunity, manual review store, alerts | Reused unchanged. Intake still starts projects at `preview_requested` |
| 2. Acknowledgment | Partial: a reference-only owner alert. No customer acknowledgment, no state | `acknowledge_request` event, `qualification_pending` state, template 1 |
| 3. Research and qualify | Missing | `qualify` / `close_inquiry(disqualified)` |
| 4. Create preview | Missing | `start_preview`, `preview_in_progress` |
| 5. Deliver preview | Missing | `deliver_preview`: numbered revisions, opaque references, template 2 |
| 6. Changes or approval | Missing | `request_revision` / `approve_preview`, with customer evidence. Approval must name the latest revision |
| 7. Proposal and agreement | Partial: `send_proposal` existed, but from `preview_requested` with no preview, expiry or agreement version | Requires preview approval, an offered package, the current agreement version and an expiry. `proposal_expired` and reissue added |
| 8. Agreement accepted | Partial: `approve` with versioned `AcceptanceRecord` (kept) | Behind **Gate A** clearance. Also checks the proposed package and agreement version and expiry |
| 9. Setup payment requested and confirmed | Partial: a direct server charge (`chargeSetupFee`) at approval | Replaced with a **GHL-hosted payment request** behind **Gate B**. Confirmation must match the request and the accepted $199 |
| 10. Build begins | Implemented (`start_implementation`) | Unchanged, plus template 8 |
| 11. Review and launch approval | Implemented | `approve_launch` now requires customer evidence |
| 12. Launch | Implemented (`deployment_succeeded` sets `launchedAt`) | Unchanged, plus owner `verify_launch` |
| 13. Subscription after launch | Partial: billing guard on `live` | Behind **Gate C** clearance plus verified launch |
| Cancel, reject, expire, abandon | Post-launch cancellation and `cancel_before_launch` existed | `close_inquiry` with reasons for pre-agreement states. `cancel_before_launch` is limited to post-agreement states |
| Idempotency | `ProcessedEventLedger` for webhooks only | `workflow.ts`: event ids, semantic duplicates, actor rules, rejection log, bounded retry |
| Payment provenance | Signature check in the sandbox provider only | `payments/verified-event.ts`: payment and subscription facts need a verified provider callback that matches the event |
| Sandbox and production separation | Release flags plus a sandbox-only provider | Plus a project `mode` and mode-bound clearances |

Reused: `packages.ts` (prices, `OFFERED_PACKAGE_IDS`), `policies.ts` (versions, publishability), `acceptance.ts` (`AcceptanceRecord`, `isAcceptanceCurrent`), `flags.ts` (`resolveServicesMode`, `resolvePaymentsMode`), `release-gates.ts` (via production mode), `billing.ts` (subscription anchor, idempotency keys, cancellation quote, webhook signing), the sandbox provider, the GHL client and opportunity as the CRM of record, and migration 002's schema (not changed).

Not touched: PR #38 legal drafts, the intake route and form, page UI, GHL client and sandbox harness, migrations, env, flags.

## 2. Owner runbook (once the gates are open)

Each step records one lifecycle event with a unique `eventId`. GHL remains where the owner works. The app records the auditable facts.

| # | Owner does | Event recorded | Message (template) | Gate |
|---|---|---|---|---|
| 1 | Prospect submits the form (intake creates the project) | — (`preview_requested`) | — | Gate D for production intake |
| 2 | Send the acknowledgment within 2 business days | `acknowledge_request` | 1 | D |
| 3 | Research the business; qualify or close | `qualify` / `close_inquiry` | — | — |
| 4 | Build the homepage concept | `start_preview` | — | — |
| 5 | Send the concept link | `deliver_preview` | 2 | D |
| 6 | Prospect asks for changes → revise → redeliver; or approves | `request_revision` → `deliver_preview`; `approve_preview` (with the message reference) | 3 / 4 | D |
| 7 | Prepare and send the proposal with the versioned agreement | `send_proposal` | 5 + 6 | **A** + D |
| 8 | Prospect accepts via GHL checkbox or e-signature | `approve` | — | **A** |
| 9 | Issue the GHL-hosted $199 request; GHL confirms payment | `request_setup_payment`, then `setup_payment_succeeded` (provider) | 7 | **B** + D |
| 10 | Start the build; collect assets | `start_implementation` | 8 | D |
| 11 | Send the site for review; customer approves | `submit_for_review`, `approve_launch` | 9 | D |
| 12 | Deploy; check the live site | `deployment_succeeded`, `verify_launch` | 10 | D |
| 13 | GHL starts $75/month from the launch date | `subscription_activated` (provider) | 11 | **C** + D |

Exits: `close_inquiry` (disqualified, prospect_declined, abandoned, withdrawn_by_prospect, duplicate_request) before agreement; `expire_proposal` then reissue; `cancel_before_launch` after agreement (records setup-paid and build-started facts for the refund decision).

## 3. Sandbox dry run (available now)

With `WEBSITES_SERVICES_MODE=nonproduction` and `WEBSITES_PAYMENTS_MODE=sandbox`, a synthetic project can run the full path through `applyLifecycleEvent` and the sandbox provider:
- The sandbox payment request has `hostedUrl: null`, so no link exists.
- `simulateSetupPayment` returns the signed event a GHL webhook would deliver.

`workflow.test.ts` › "sandbox end to end" is that dry run, including a failed payment and a retry. Nothing is sent and nothing reaches GHL.

## 4. Remaining blockers and owner actions

### External or legal (owner)
1. **Entity reinstatement:** verify Entrepreneuria Global, LLC on the Georgia SOS registry and record status and date (D-OWN-01a, LGL-04). Prerequisite for every commercial gate. The LLC must not be described as active until verified.
2. **Final service agreement:** finalize the PR #38 drafts and publish an immutable, versioned file. Promote `service_agreement`, `cancellation`, `setup_fee_refund` and `privacy_notice` in `policies.ts` (E-6).
3. **Owner decisions in PR #38:** D-OWN-05 (refunds), D-OWN-06 (cancellation), D-OWN-13 (customer delay), D-OWN-21 (setup-fee trigger wording), D-OWN-23 (taxes), and the acceptance method (checkbox or e-signature).
4. **GHL payments:** connect the processor in the LLC's name and verify a $199 test-mode invoice and a $75/month subscription that starts at a given launch date (D-07, E-8).
5. **Proposal validity period:** choose how long a proposal stays open. Code requires an expiry but sets no default.
6. **Template wording:** approve templates 1–4 and 8–10. Fill the `[OWNER: …]` placeholders (timings, onboarding checklist).
7. **Authorizations:** separate written authorization for each of Gates A, B, C and D.

### Engineering (next)
1. **Persistence:** the migration after 002 and 003 (see the state-machine doc, § Persistence delta) and a Supabase `LifecycleStore`. Needs owner approval (D-03 pattern).
2. **Owner console or actions** to record events, behind the D-12 allowlist. Not built: no customer portal is proposed.
3. **GHL payment adapter** implementing `createSetupPaymentRequest` and subscriptions, tested against the existing GHL sandbox guard before any live use.
4. **Webhook route**: read the raw body, call `verifyProviderCallback(provider, rawBody, signature)`, and pass its result as `provenance` with the provider event id as `eventId`. The workflow already rejects any payment fact without it (`unverified_provenance`).
5. **Opportunity stage sync** from `crm-stages.ts` to configured GHL stage ids, through the sandbox guard (D-10).
6. **Intake hook:** create the lifecycle project in the same step that stores the lead. Today intake and lifecycle aren't connected.

## 5. Recommended next integration step

1. Review this branch against `review/ghl-s8-remediation` (it touches only `lib/services/websites/{lifecycle,billing,activation-gates,workflow,communications,crm-stages}.ts`, the payment provider files, tests and docs).
2. Merge it into the Websites integration branch before the s8 branch goes to `main`.
3. The first follow-up is the persistence migration plus Supabase store, because every other engineering item depends on durable events.

Note: `feat/websites-commercial-foundation` has five later commits (CRM sync queue migration 003, GHL adapter hardening, runbooks) that aren't on the s8 branch. Reconcile them before numbering the next migration.

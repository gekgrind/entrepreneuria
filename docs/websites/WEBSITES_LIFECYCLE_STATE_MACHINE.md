# Websites lifecycle state machine

Status: **implemented in code, sandbox only.** Nothing is persisted to a live database, nothing is sent to GHL, and every commercial gate is closed. Code: `lib/services/websites/lifecycle.ts` (pure transitions), `workflow.ts` (idempotent processing), `activation-gates.ts` (Gates A–D), `crm-stages.ts` (GHL stage mapping).

This extends the existing §10D lifecycle rather than replacing it. Every state that existed before keeps its name, so migration 002's review and the billing guards stay valid. The new states cover the free-preview stage that UX-01 found missing.

## States

The prompt suggested conceptual names. The code keeps existing names where they already meant the same thing.

| Conceptual state | Code state | Notes |
|---|---|---|
| request_received | `preview_requested` | Created by intake. Unchanged. |
| qualification_pending | `qualification_pending` | **New.** Acknowledgment sent; owner researching. |
| qualified | `qualified` | **New.** |
| preview_in_progress | `preview_in_progress` | **New.** |
| preview_sent | `preview_sent` | **New.** Each delivery is a numbered revision. |
| revision_requested | `revision_requested` | **New.** |
| preview_approved | `preview_approved` | **New.** Records the approved revision and evidence. |
| proposal_pending | (owner work inside `preview_approved`) | No separate state: preparing the proposal has no customer-visible effect. |
| agreement_pending | `proposal_sent` | Existing name. Now requires preview approval, an offered package, the current agreement version and an expiry. |
| (expired proposal) | `proposal_expired` | **New.** Can be reissued. |
| agreement_accepted | `approved` | Existing name. Now behind **Gate A**. |
| setup_payment_pending | `setup_payment_pending` | **New.** A GHL-hosted payment request was issued, behind **Gate B**. |
| (failed setup payment) | `setup_payment_failed` | Existing. A new request is needed to retry. |
| setup_payment_confirmed | `setup_paid` | Existing. Only from a confirmation that matches the open request and the accepted amount. |
| build_in_progress | `in_progress` | Existing. |
| (customer delay) | `customer_delay` | Existing. No billing effect (D-13). |
| launch_approval_pending | `customer_review` | Existing. |
| launch_approved | `launch_approved` | Existing. Now requires customer evidence. |
| (deployment failed) | `launch_failed` | Existing. |
| launched | `live` | Existing. Only via `deployment_succeeded`, which sets `launchedAt` (the billing anchor). |
| subscription_pending | `live` with no `subscriptionId` | Derived by `subscriptionStatus()`. No extra state. |
| subscription_active | `live` with `subscriptionId` | Recorded by `subscription_activated`, behind **Gate C** and an owner-recorded `verify_launch`. |
| — | `past_due`, `cancellation_pending`, `canceled` | Existing, unchanged. |
| rejected / abandoned | `closed` + `closedReason` | **New** terminal pre-sale state: `disqualified`, `prospect_declined`, `abandoned`, `withdrawn_by_prospect`, `duplicate_request`. |

A project also has a fixed `mode`: `sandbox` (default) or `production`. Sandbox projects can only use sandbox gates and the sandbox provider. Production projects can only use production gates, which are all closed.

## Transitions

Actors: **O** owner, **C** customer (via a GHL form or page), **P** payment provider (verified webhook), **S** system job. Customer decisions can also be recorded by the owner with an evidence reference.

| Event | From | To | Actors | Requires |
|---|---|---|---|---|
| `acknowledge_request` | preview_requested | qualification_pending | O | — |
| `qualify` | qualification_pending | qualified | O | — |
| `start_preview` | qualified | preview_in_progress | O | — |
| `deliver_preview` | preview_in_progress, revision_requested | preview_sent | O | Opaque concept reference. Revision number increments. |
| `request_revision` | preview_sent | revision_requested | O, C, P | Customer evidence reference |
| `approve_preview` | preview_sent | preview_approved | O, C, P | Evidence; revision must equal the latest delivered revision |
| `send_proposal` | preview_approved, proposal_sent, proposal_expired | proposal_sent | O | Preview approval; offered package (Starter only); `agreementVersion` = current `service_agreement` version; expiry in the future |
| `expire_proposal` | proposal_sent | proposal_expired | O, S | Expiry reached |
| `close_inquiry` | any pre-agreement state | closed | O | Reason from the list above |
| `approve` (agreement acceptance) | proposal_sent | approved | O, C, P | **Gate A clearance**; preview approval; unexpired proposal; acceptance for the proposed package, agreement version and current pricing and policy versions |
| `request_setup_payment` | approved, setup_payment_failed | setup_payment_pending | O | **Gate B clearance**; preview approval; acceptance; amount = accepted setup fee ($199); not already paid |
| `setup_payment_succeeded` | setup_payment_pending | setup_paid | P, O | Matches the open request id and the accepted amount |
| `setup_payment_failed` | setup_payment_pending | setup_payment_failed | P, O | Matches the open request id |
| `start_implementation` | setup_paid | in_progress | O | — |
| `flag_customer_delay` / `resolve_customer_delay` | in_progress, customer_review ⇄ customer_delay | | O | — |
| `submit_for_review` | in_progress | customer_review | O | — |
| `request_changes` | customer_review | in_progress | O, C, P | — |
| `approve_launch` | customer_review | launch_approved | O, C, P | Customer evidence reference |
| `deployment_succeeded` | launch_approved, launch_failed | live | O, S | Launch approval and setup payment on record. Sets `launchedAt`. |
| `deployment_failed` | launch_approved, launch_failed | launch_failed | O, S | — |
| `verify_launch` | live | live | O | Once. Opaque verification reference. |
| `subscription_activated` | live | live | P, O | **Gate C clearance**; verified launch; none recorded yet |
| `subscription_payment_failed` / `_recovered` | live ⇄ past_due | | P, O | — |
| `request_cancellation` / `withdraw_cancellation` / `cancellation_effective` | live, past_due → cancellation_pending → canceled | | O (S for effective) | Effective date reached |
| `cancel_before_launch` | approved … launch_failed | canceled | O | Records whether setup was paid and build had started (refund assessment, D-14) |

## Invariants (tested)

- No proposal before preview approval. No agreement acceptance before a proposal. No setup payment request before agreement acceptance. No build before setup confirmation. No `live` without customer launch approval and setup payment. No subscription before a verified launch.
- Preview approval, agreement acceptance and setup payment never set `subscriptionId` or `launchedAt`.
- The setup amount is always the **accepted** amount (D-16), and a confirmation for any other amount or request is refused.
- Gate clearances cannot be forged, used for another project, used for another gate, or used across modes.
- `transition()` never mutates its input. Audit entries carry mode, actor, from, to, time and data-minimal detail: opaque references, never message content or personal data.

## Idempotency and duplicates (`workflow.ts`)

| Situation | Result |
|---|---|
| Same `eventId` replayed | `duplicate`, nothing changes |
| Same preview approval (same revision), new id | `duplicate` |
| Preview approval for a different revision after approval | `rejected: conflicting_duplicate` |
| Same setup charge confirmed again, new id | `duplicate` |
| A **different** charge confirmed after setup is paid | `rejected: possible_double_payment`, recorded for owner review and possible refund |
| Late failure for a request that has since been paid | `duplicate` |
| Second `deployment_succeeded` | `duplicate`; `launchedAt` doesn't move |
| Second `verify_launch` | `duplicate` |
| Same subscription id again / a different subscription id | `duplicate` / `rejected: conflicting_duplicate` |
| Unknown project, malformed envelope, unknown event | `rejected`, recorded |
| Event from a disallowed actor | `rejected: actor_not_permitted` |
| Store failure during commit | Error thrown, nothing written; retrying with the same `eventId` applies once |
| Concurrent writer | Reload and re-evaluate; `LifecycleConcurrencyError` after 3 attempts |

Every applied event returns the communication **intents** it calls for (never a send) and the GHL stage to mirror.

## GHL stage mapping (`crm-stages.ts`)

GHL stays the owner's CRM. Intake already creates one opportunity per new lead. The mapping says where that opportunity should sit as the lifecycle advances. **No code moves opportunities yet.** Stage ids aren't configured or verified (D-10), and any future sync must go through the existing sandbox guard first.

| Lifecycle states | GHL stage (logical) | Opportunity status |
|---|---|---|
| preview_requested | new_request | open |
| qualification_pending, qualified | qualifying | open |
| preview_in_progress, preview_sent, revision_requested | preview | open |
| preview_approved | preview_approved | open |
| proposal_sent, proposal_expired | proposal | open |
| approved, setup_payment_pending, setup_payment_failed | awaiting_setup_payment | open |
| setup_paid … launch_failed | build | won |
| live, past_due, cancellation_pending | live | won |
| closed | lost | lost (abandoned → abandoned) |
| canceled | canceled | lost |

## Persistence delta (not applied)

The code is pure and has an in-memory store only. Persisting it needs a migration **after** 002 (under review, D-03) and 003 (CRM sync queue, on `feat/websites-commercial-foundation`). Don't edit 002 in place while it is under independent review. The next migration would need to:

1. Extend the `website_projects.state` check with the new states: `qualification_pending`, `qualified`, `preview_in_progress`, `preview_sent`, `revision_requested`, `preview_approved`, `proposal_expired`, `setup_payment_pending`, `closed`.
2. Add `mode` (`sandbox|production`, not null, default `sandbox`), `acknowledged_at`, `qualified_at`, `preview_started_at`, `preview_deliveries jsonb`, `revision_requests jsonb`, `preview_approval jsonb`, `proposal jsonb`, `closed_at`, `closed_reason`, `setup_payment_request_id`, `setup_payment_requested_at`, `setup_payment_attempts`, `launch_approval_evidence jsonb`, `launch_verification jsonb`, and `version integer` for compare-and-set.
3. Add `event_id text not null` and `mode` to `website_project_events`, with `unique (project_id, event_id)`.
4. Add a `website_project_rejections` table (same columns as `Rejection` in `workflow.ts`).
5. Tighten `website_projects_subscription_after_launch` to also require `launch_verification is not null`.

A Supabase `LifecycleStore` would implement `commit` as one transaction: update with `version = expected`, insert the event row (the unique key makes replays safe), and insert intents.

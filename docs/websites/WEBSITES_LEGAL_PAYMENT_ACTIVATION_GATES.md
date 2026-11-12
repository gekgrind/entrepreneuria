# Websites legal and payment activation gates

Status, 2026-11-12: **every gate is closed.** Code: `lib/services/websites/activation-gates.ts`. Tests: `activation-gates.test.ts` (closed with every flag on, missing GHL configuration, sandbox and production isolation, forged clearances).

Not legal advice. This file lists the conditions engineering enforces. It doesn't judge whether the terms are legally sufficient. That stays with the owner and the PR #38 review.

## How a gate works

- A legally or financially consequential lifecycle event needs a **clearance**: `approve` needs Gate A, `request_setup_payment` needs Gate B, `subscription_activated` needs Gate C.
- `clearGate()` issues a clearance only when every condition holds. Otherwise it throws `GateClosedError` listing each unmet condition by code (setting names, never values).
- A clearance is tied to one gate, one project and one mode. `transition()` and the billing functions refuse anything `clearGate()` didn't issue.

### Two modes, never mixed

| | Sandbox | Production |
|---|---|---|
| Projects | Synthetic. `newProject()` defaults to sandbox | Explicit `mode: "production"` |
| Services mode | `WEBSITES_SERVICES_MODE=nonproduction` | `production`, which already requires every release gate in `release-gates.ts` plus `WEBSITES_OWNER_RELEASE_AUTHORIZED=true` |
| Payments | `WEBSITES_PAYMENTS_MODE=sandbox`, in-memory provider, **no payment links**, no network | No live provider exists. `WEBSITES_PAYMENTS_MODE` has no live value (D-07) |
| Legal and payment prerequisites | Not required: nothing binds anyone and no money moves | All required, with evidence |
| Messages | Never sent | Need approved templates plus Gate D |

## Gate A: agreement acceptance

Opens (production) only when **all** of these hold:

| Code when unmet | Condition | Owner |
|---|---|---|
| `state:*`, `preview_approval_missing`, `proposal_missing`, `proposal_expired` | Project is `proposal_sent` with a recorded preview approval and an unexpired proposal | engineering (enforced) |
| `prerequisite:final-agreement-approved` | Final service agreement approved and published as an immutable, versioned file | owner |
| `prerequisite:legal-entity-name-confirmed` | Agreement, proposal, GHL checkout and invoices name **Entrepreneuria Global, LLC** | owner |
| `prerequisite:customer-disclosures-present` | Order summary discloses: $199 setup; $75/month from launch; one-month minimum; cancellation; setup-fee refunds; hosting included; customer owns domain and business content; Entrepreneuria keeps its templates and reusable code | legal / owner |
| `prerequisite:acceptance-evidence-defined` | Acceptance method (GHL checkbox or e-signature), agreement version, and evidence record are defined and tested (PR #38 legal UX §5) | engineering |
| `policy_not_approved:<id>` | Every policy in `PROJECT_APPROVAL_POLICIES` is `approved` in `policies.ts`. Today `service_agreement`, `cancellation`, `setup_fee_refund` and `privacy_notice` are not | owner (task E-6) |
| `prerequisite:owner-authorized-agreement-acceptance`, `owner_authorization:WEBSITES_AGREEMENT_ACCEPTANCE_AUTHORIZED` | Owner's written authorization, recorded as evidence and set in env | owner |
| Gate D conditions | See below, including entity reinstatement | owner |

Engineering also checks that the acceptance is for the proposed package, the proposed agreement version, and the current pricing and policy versions (`isAcceptanceCurrent`).

## Gate B: $199 setup payment request

| Code when unmet | Condition | Owner |
|---|---|---|
| `state:*`, `preview_approval_missing`, `agreement_acceptance_missing`, `setup_already_paid` | Project is `approved` or `setup_payment_failed` with preview approval and agreement acceptance recorded | engineering (enforced) |
| `prerequisite:ghl-payment-processor-verified` | GHL payment processor connected **in the LLC's name** and verified with a test-mode $199 setup invoice. GHL-hosted only, no custom checkout | owner |
| `prerequisite:ghl-payment-adapter-built` | A GHL payment-request adapter implements `PaymentProvider` and passes the sandbox contract tests | engineering |
| `ghl_config_missing:GHL_API_TOKEN`, `…:GHL_LOCATION_ID` | GHL settings present | owner |
| `no_live_payment_provider` | Always present today. Removed only when the adapter exists **and** the owner approves a live payments mode | engineering + owner |
| `prerequisite:owner-authorized-setup-payment`, `owner_authorization:WEBSITES_SETUP_PAYMENT_AUTHORIZED` | Owner authorization | owner |
| Gate D conditions | | owner |

Engineering also requires the request amount to equal the **accepted** setup fee. Payment is confirmed only by an event matching the open request and amount. A different, second charge is rejected as `possible_double_payment` for owner review.

## Gate C: $75/month subscription

| Code when unmet | Condition | Owner |
|---|---|---|
| `state:*`, `setup_payment_unconfirmed`, `build_not_recorded`, `launch_approval_missing`, `launch_not_recorded`, `launch_not_verified`, `subscription_exists` | Project is `live`; setup confirmed; build recorded; customer launch approval recorded; deployment recorded; launch verified by the owner (`verify_launch`); no subscription yet | engineering (enforced) |
| `prerequisite:ghl-subscription-at-launch-verified` | GHL subscription verified in test mode to start only at the recorded launch date | owner |
| `no_live_payment_provider` | As in Gate B | engineering + owner |
| `prerequisite:owner-authorized-subscription`, `owner_authorization:WEBSITES_SUBSCRIPTION_AUTHORIZED` | Owner authorization | owner |
| Gate D conditions | | owner |

The subscription is anchored to `launchedAt` and created once per project (idempotency key plus provider check). Preview approval, agreement acceptance and setup payment can't start recurring billing: tested in `lifecycle.test.ts`.

## Gate D: production

Applies to production intake, real customer notifications, legal acceptance, payment collection and subscription activation.

| Code when unmet | Condition |
|---|---|
| `services_mode_not_production` | Production services mode, which already needs every release gate and `WEBSITES_OWNER_RELEASE_AUTHORIZED` |
| `prerequisite:entity-reinstatement-verified` | Entrepreneuria Global, LLC reinstatement verified on the Georgia SOS registry, with status and date recorded (D-OWN-01a). **Nothing in this repo describes the LLC as active or in good standing.** |
| `prerequisite:customer-templates-approved` | Templates approved for sending |
| `prerequisite:owner-authorized-production`, `owner_authorization:WEBSITES_CUSTOMER_MESSAGES_AUTHORIZED` | Separate owner authorization |

Customer messages also need `status: "approved"` on the template in `communications.ts`. Legal and payment templates additionally need their gate. Sandbox never sends.

## How to open a gate later

1. Complete the external work, for example the signed agreement or the processor test.
2. In `activation-gates.ts`, set that prerequisite's `passed: true` with an `evidence` reference, in its own reviewed commit and with written owner approval. Never set `passed` without evidence: the gate counts it as open either way.
3. Promote the related policies in `policies.ts` with a version bump (E-6).
4. Only then set the gate's authorization env var in production.

Each gate is independent. Opening A never opens B or C.

## Current state

| Gate | Open in sandbox (nonproduction plus sandbox payments) | Open in production |
|---|---|---|
| A: agreement acceptance | yes, synthetic only | **no** |
| B: setup payment | yes, synthetic only, no payment link | **no** |
| C: subscription | yes, synthetic only | **no** |
| D: production | n/a | **no** |

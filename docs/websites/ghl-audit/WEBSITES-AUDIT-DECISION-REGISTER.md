# Websites GHL audit: decision register

Audit date: 2026-11-07. This extends `docs/websites/DECISION-REGISTER.md` (D-01 to D-18) and doesn't replace it. IDs are prefixed **A-**.

## Recommendation

**CONDITIONAL GO.** Proceed toward commercial launch; nothing blocks the commercial model in principle. Production launch stays **NO-GO** until the launch blockers (B-) below are closed and the existing §11 release gates pass with evidence.

## Owner decisions

| ID | Decision | Options | Recommendation | Why it matters |
|---|---|---|---|---|
| A-01 | GHL plan | — | **SETTLED (owner, 2026-11-07): keep the Founder plan.** Not reopened. | The cost model uses the $497/month allocation |
| A-02 | Delivery architecture | A native / B external / C hybrid | **C hybrid**: per-customer sub-account plus a code-based site. AI Studio + Git Sync (C1) if the spike passes, otherwise external static hosting with embedded GHL forms (C2). | Decides labor, transfer rights and ops burden |
| A-03 | Approve the AI Studio spike (creates a free test sub-account and project; no paid features) | Approve / defer | Approve | It's the only way to verify C1 |
| A-04 | Usage overage policy | Absorb up to caps, then quote / rebill at cost / rebill with markup (Founder only) | Caps plus quote-based upgrades at first, with no automated rebilling | Rebilling needs sub-account payment methods and more disclosures |
| A-05 | Package matrix (WEBSITES-PACKAGE-RECOMMENDATIONS.md) | Approve / amend | Review limits, especially labor caps and SMS | Release gate `features-verified` |
| A-06 | Transfer-rights policy | e.g. on cancellation, deliver the repo/ZIP and DNS handover after the minimum term with no balance owed; CRM data export as CSV, or sub-account eject on request | Define before launch, with counsel (policy `content_export` is still PROPOSED) | Approved ownership terms promise this |
| A-07 | SMS DND default for contacts without SMS consent | Set DND on contacts without consent / rely on workflow gating | Set DND (fail-closed) | TCPA exposure |
| A-08 | Labor rate and setup-hour budget | Owner value | Set a real rate; confirm templated builds within 4 / 5 / 7 h | Setup fees don't cover more at $50/hour |
| A-09 | Payment provider (existing D-07) | Stripe direct / GHL Payments in Entrepreneuria's own sub-account / HighLevel native provider | **Stripe direct**: it fits the existing `PaymentProvider` interface and has published rates. The native HighLevel provider has no published rates. | Release gates `setup-fee-flow` and `no-prelaunch-billing` |
| A-10 | Who registers customer domains | Customer / Entrepreneuria on the customer's behalf / GHL purchase | The customer, at their own registrar | Ownership. Release of GHL-purchased domains needs a request form. |
| A-11 | GitHub organization for customer repos and Git Sync | Create / reuse | Dedicated org, least-privilege Lead Connector app install | Credential and transfer hygiene |

## Evidence gaps (ACCOUNT VERIFICATION REQUIRED)

| ID | Gap | How to close it (read-only unless noted) |
|---|---|---|
| E-01 | Trial end date, next charge, sub-account limit on this account | V-1 |
| E-02 | Whether creating a sub-account triggers any charge | V-3 (open the dialog, read it, cancel) |
| E-03 | Rebilling options available on the trial | V-4 |
| E-04 | Private Integrations available on the intake sub-account | V-5 |
| E-05 | Duplicate-contact and duplicate-opportunity settings | V-6, V-7 |
| E-06 | Custom field ids, keys and dropdown option values | V-8 |
| E-07 | AI Studio availability, Git Sync and publish cost; whether agency users in a sub-account get free AI Studio usage | V-9, then the spike (A-03) |
| E-08 | Page, bandwidth and storage limits; SSL renewal; trial sending restrictions; domain release | V-10 (a written support answer) |
| E-09 | Workflow Pro billed per agency or per sub-account | V-10 |
| E-10 | Difference between "Basic" and "Advanced" API access | V-10 |

## Launch blockers

| ID | Blocker | Owner | Ties to |
|---|---|---|---|
| B-01 | **F-1:** contact upsert overwrites all tags on existing contacts | Engineering | Gate `style-to-crm`, `form-states` |
| B-02 | **F-2:** custom field key format unverified; switch to field ids | Engineering + E-06 | Gate `style-to-crm` |
| B-03 | **F-3/F-4/F-5/F-7:** phone normalization, 429 handling, non-idempotent retries, duplicate-opportunity race | Engineering | Gate `form-states` |
| B-04 | CRM sync recovery (async sync, retry job, monitoring, owner alerts) not built; migration 002 not applied | Engineering + owner (D-03, D-04) | Gate `crm-sync-recovery` |
| B-05 | Team notification workflow on `web-preview-request` not confirmed (D-06) | Owner | §8 step 5 |
| B-06 | Package matrix not approved (A-05); entitlements empty | Owner | Gate `features-verified` |
| B-07 | Payment provider not selected (A-09); only the sandbox exists | Owner + engineering | Gates `setup-fee-flow`, `no-prelaunch-billing`, `cancellation-works` |
| B-08 | Transfer-rights, cancellation, refund, SMS and privacy wording not approved | Owner + legal | Gates `ownership-disclosed`, `legal-approved`, `terms-disclosed` |
| B-09 | Delivery channel unproven (A-02 / A-03) | Owner + engineering | `deployment_succeeded` has no real source yet |
| B-10 | Session reliability (D-18) still blocked | Ops | Gate `session-reliability` |

## Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-01 | Labor overrun on free previews and revisions makes the base packages unprofitable | Templated styles, preview time-box, revision caps (A-05, A-08) |
| R-02 | Uncapped usage (premium workflows, AI, SMS) | Caps, Workflow Pro if volumes justify it, AI excluded |
| R-03 | AI Studio and Git Sync are recent features; behavior or pricing may change | Keep C2 ready; source of truth stays in Entrepreneuria's Git |
| R-04 | GHL marketing claims ("unlimited", Founder perks) aren't contractual | Get written support answers (E-08); never echo them to customers |
| R-05 | API v2 (`2021-07-28`) goes into maintenance now that v3 exists | Isolated adapter; plan the v3 migration after launch |
| R-06 | A single PIT on one location is a single point of failure | Durable store first, rotation runbook, alert on 401/403 |
| R-07 | A2P rejection delays SMS features for Growth/Business | Sell SMS as "enabled after carrier approval"; don't promise it at launch |

## Engineering readiness (current branch vs the recommended architecture)

| Area | Current state | Gap / change needed | Dependency |
|---|---|---|---|
| Lead-intake reliability | Store-first design and idempotency key are good. The CRM sync runs inline in the request. | F-1 to F-8; async sync; retry job; monitoring; alerts | Migration 002 (D-03), B-04 |
| Client/sub-account isolation | One intake location only, which is correct for previews | Nothing for intake. Customer data lives in each customer's sub-account and never in the intake location. Add a `ghl_location_id` column to `website_projects` when projects are persisted. | A-02 |
| Secure credential storage | One PIT in server env | Rotation runbook (90 days, 7-day overlap). Per-customer tokens are **not** needed under C. If provisioning is automated later, use encrypted storage (e.g. Supabase Vault) after a security review. | A-02 |
| API scopes | Not configured | Intake PIT on the intake sub-account with exactly `contacts.write`, `opportunities.readonly`, `opportunities.write` | V-5 |
| Billing lifecycle | Guards, lifecycle and sandbox are complete and tested. No live provider. | Stripe adapter implementing `PaymentProvider`, webhook ledger persisted (migration 002 tables), a decision on Stripe Billing vs scheduled charges | A-09 |
| Domain onboarding | None | Checklist plus a DNS verification step: customer-owned domain, A or CNAME per GHL Domain Hub, Cloudflare proxy off, SSL confirmed before `deployment_succeeded` | A-10 |
| Website deployment workflow | `deployment_succeeded` event exists with no real source | C1: commit to the AI Studio-synced repo → publish → record the deploy ref (commit SHA + publish URL). C2: CI deploy to the static host. Either way, an owner-recorded launch event plus an automated HTTP 200/SSL check. | A-02, A-03 |
| Monitoring and alerts | None for websites | Uptime + SSL-expiry checks per customer domain, weekly synthetic form submission, `crm_failed` queue alerts, 401/403 token alerts | B-04 |
| Offboarding and transfer | Lifecycle supports `canceled`. No export path. | Runbook: repo/ZIP handover, DNS handover, contacts CSV export or sub-account eject, data-retention timer; then the policy text (A-06) | A-06 |

## Recommended next actions (in order)

1. **Owner (this week):** run read-only checks V-1 to V-8 and record the results here.
2. **Owner:** approve the A-03 spike, then decide A-02.
3. **Engineering (needs approval to change code):** fix B-01 to B-03 in `lib/integrations/ghl/client.ts`, with tests against a fake fetch. Switch custom fields to ids (`GHL_CUSTOM_FIELD_IDS`).
4. **Engineering:** build the async CRM sync, retry job, monitoring and owner alert (B-04). This depends on applying migration 002 (D-03).
5. **Owner:** approve the package matrix (A-05) and set the labor rate (A-08).
6. **Engineering:** select and implement the payment adapter after A-09.
7. **Owner + legal:** transfer rights and policy wording (A-06, B-08).
8. **Engineering:** customer onboarding runbook (sub-account from snapshot, domain DNS checklist with Cloudflare "DNS only", A2P submission, Git repo from template, deploy, uptime/SSL monitor), plus an offboarding runbook.

> **DRAFT. Not legal advice. Not attorney-reviewed. Not privileged.** This follows the installed `gc-review` skill ("General Counsel forcing questions"), used because the requested `governance-compliance-review` skill isn't installed. Its stated limit: it surfaces the right questions and doesn't replace counsel. Its vendor scripts aren't installed and weren't run.

# GC review: Entrepreneuria Websites (Starter) launch

**Date:** 2026-11-11

## Document

- **Type:** a launch plan, plus the commercial terms of a recurring B2B managed-website service. No signed contract exists to review. The "documents" are the approved business terms, the policy registry (`policies.ts`), the release gates (`release-gates.ts`), the decision register, and the live legal pages.
- **Counterparties:**
  - Customers: small local-service businesses.
  - Vendors: HighLevel/LeadConnector, Cloudflare, Google Workspace, the VPS host, `vibepreview.app`.
- **Value and scope per customer:** $199 setup plus $75/month, one-month minimum. Well under the skill's $100k / 1-year threshold, so the review is scaled down to fit.

**Calibration note:** enterprise controls (SOC 2, DPIAs, formal risk committees, vendor security questionnaires) are **not legally required** at this size and are not recommended here. Each item below says whether it is a **verified deficiency** (evidence in the repo or the live pages) or a **hypothetical risk** (could matter, no evidence it does yet).

---

## The six GC questions

### 1. IP ownership: who owns what's created?

| Item | Status | Type |
|---|---|---|
| Customer content and domain owned by the customer | Approved term; no contract text yet (`policies.ts:50`, gate `ownership-disclosed` open) | **Verified deficiency** (LGL-11) |
| Design, layout, templates, code | Not addressed anywhere | **Verified deficiency** (LGL-11) |
| AI-generated components | Copyright may not exist to assign: *Thaler* (D.C. Cir. 2025), cert. denied 2026 `[web search — verify]` | Hypothetical, until the owner confirms AI use (D-OWN-09) |
| Customer-supplied photos | Page says "We use photos you provide" | Needs a customer rights warranty (agreement §6.4) |
| Contractors or freelancers building sites | Unknown whether any are used | **Hypothetical.** If used, get a written IP assignment before they touch customer work |
| Open-source in the app | Not audited (outside launch scope) | Hypothetical, P2 |

### 2. Liability and indemnity: what's capped and what's carved out?

- **Today:** `/terms` excludes indirect damages but has **no cap amount** and no governing law. There is no Websites agreement.
- **Recommendation**, matched to a $75/month service:
  - Cap at fees paid in the prior 12 months (the skill's standard).
  - Carve out the customer's payment obligations and each side's indemnity for its own content or IP.
  - Customer indemnifies for content it supplies (photos, claims, licences).
  - Entrepreneuria indemnifies only for its own original material infringing third-party IP. Cap that indemnity too `[OWNER]`.
- **Georgia enforceability:** the clause must be "explicit, prominent, clear and unambiguous". Use its own heading, a separate paragraph, and bold or caps (*Warren Averett*, 2019; *SFG Venture*, 2015) `[web search — verify]`.
- **Type:** verified deficiency (LGL-02, LGL-21).

### 3. Data processing: what personal data, and is a DPA needed?

| Item | Evidence | Type |
|---|---|---|
| Data inventory | Inquiry fields, consent evidence, IP hash, UA, UTM (`inquiry-schema.ts`, `intake.ts`) `[repo]` | Known |
| Privacy notice coverage | Missing for Websites (LGL-01) | **Verified deficiency** |
| GDPR | No EU targeting; Georgia local-service focus `[inference]` | Not applicable. Don't build for it |
| CCPA/CPRA | Thresholds (about $26.6M revenue, 100k consumers, or 50% of revenue from selling) not met `[inference; verify the current threshold]` | Not applicable |
| CalOPPA | Applies to any commercial site collecting California residents' PII `[web search — verify]` | Applicable; satisfied by the LGL-01 fix |
| Vendor DPA, HighLevel | HighLevel publishes a DPA (April 2023 version found), incorporated into its ToS `[web search — verify]` | Owner confirms the current version applies to the agency account. No negotiation needed |
| Entrepreneuria as processor for customer sites | Customer sites' forms collect *their* visitors' data | Hypothetical until Stage B. Handled in agreement §8 (a short data-processing clause, not a separate DPA) |
| Retention | Undefined (`MANUAL-INTAKE.md:23`) | **Verified deficiency** (LGL-07) |

### 4. Termination and renewal: notice period, auto-renew traps?

- **Approved:** month-to-month after a one-month minimum. That's no trap: the shortest possible term.
- **Missing** (verified deficiency, LGL-02 and LGL-03):
  - the cancellation method;
  - the effective date rule (proposed in D-08: the later of the current period end and launch + 1 month);
  - setup-fee refund rules;
  - the failed-payment process;
  - the exit and export package.
- **Renewal notices:** Georgia's renewal-notice statutes likely don't apply. They cover consumers, or renewals longer than one month `[web search — verify]`. ROSCA's reach to B2B is uncertain; comply anyway (LGL-03).

### 5. Regulatory surface: new regimes triggered?

| Regime | Triggered? |
|---|---|
| HIPAA, GLBA, FERPA, COPPA | No. Customers aren't covered entities through this service; the service isn't directed to children `[inference]`. Watch for a medical, dental or financial customer wanting forms that collect health or financial data. Agreement §8.3 excludes sensitive-data collection without written agreement |
| Money transmission | No. A merchant collecting its own fees through a processor `[inference]` |
| CAN-SPAM | **Yes** (LGL-09) |
| TCPA / GA no-call | **Yes**, if calls or texts are used (LGL-10, LGL-19) |
| ROSCA / FTC §5 | Yes / uncertain (LGL-03) |
| ADA Title III (websites) | Unsettled in the 11th Circuit (*Gil* vacated) `[web search — verify]`. Risk, not a defined requirement (LGL-20) |
| Georgia sales tax | Uncertain; likely not taxable (LGL-22) |

### 6. Employment and equity

- No hiring, equity or contractor arrangement is in the launch scope `[inference]`.
- **Hypothetical:** if a freelancer or VA handles customer data or builds sites, they need:
  - a short written contractor agreement with an IP assignment;
  - a confidentiality clause;
  - an agreement to follow the retention and deletion rule.
- Contractor-vs-employee classification is outside this review.

---

## Governance evaluation

These are the prompt's six dimensions, sized for a solo-founder business.

### A. Governance and accountability

| Control | Present? | Evidence | Gap type |
|---|---|---|---|
| Single owner of launch decisions | **Yes** | Decision register D-01 to D-22 with owner rulings and dates `[repo]` | — |
| Versioned policy registry, so wording changes don't re-bind past customers | **Yes**, strong | `policies.ts` versions plus `acceptance.ts` snapshot `[repo]` | — |
| Fail-closed release gates | **Yes**, strong | `release-gates.ts`, `gate.ts` `[repo]` | — |
| Gate criteria match the funding reality | **No** | `leads-privacy` requires "approved by counsel" `[repo]` | Verified deficiency (LGL-18) |
| Named person for privacy requests | Partly | `privacy@` listed; monitoring unconfirmed | Verified deficiency (LGL-17) |

### B. Data handling and vendor dependencies

| Dependency | Risk | Type | Mitigation (no cost) |
|---|---|---|---|
| HighLevel (CRM, payments, likely hosting) | One vendor holds lead data, billing and customer sites | Hypothetical: a HighLevel outage, price change or account suspension | Agreement §9 discloses the dependency. Keep monthly exports of customer content `[OWNER]` |
| VPS review store | The only copy of manual-review leads | Known design | Backup and access rule (D-OWN-04) |
| Google Workspace mailbox | Showcase inquiries and alerts | Low | Mailbox protected with MFA `[OWNER confirm]` |
| Cloudflare Turnstile | Bot check sees visitor signals | Low | Disclose it (LGL-05) |
| `vibepreview.app` demos | Links could break; terms unknown | **Verified unknown** (`LAUNCH-READINESS.md`) | Verify the terms, or self-host static demo screenshots only (LGL-15) |

### C. Privacy and security controls

Already strong in code; see "Checked and cleared" in `CONSOLIDATED_LEGAL_FINDINGS.md`.

Not covered by code (operational):
- MFA on the GHL, Google Workspace and VPS accounts `[unverified]`;
- who has SSH access to the review store `[unverified]`;
- backup encryption `[unverified]`.

These are hypothetical gaps, not legal requirements at this size. Confirm them in the incident note (§E).

### D. Compliance evidence and documentation

- **Present:** decision register, launch-readiness doc, gate list, test records, migration review packet.
- **Missing (verified):**
  - published privacy and vendor disclosures;
  - an agreement;
  - an acceptance record process for GHL (LGL-16);
  - a record that the owner reviewed each `legal-review/` item.

  Suggested: tick-boxes in `LEGAL_LAUNCH_BLOCKERS.md`, committed with dates.

### E. Operational and contractual risks

| Risk | Likelihood | Impact | Type |
|---|---|---|---|
| Customer disputes a charge because terms weren't shown | Medium without LGL-03 | Chargebacks, processor holds | Verified gap → fixable |
| Customer leaves and demands the "whole website" built in GHL | Medium | Dispute, reputation | Verified gap (LGL-11) → define the exit package |
| Customer's site lacks a privacy page or accessibility | Medium | Claim against the customer, who looks to Entrepreneuria | Hypothetical → agreement §7 |
| Cold calls to personal cell numbers | Depends on the outreach plan | GA private right of action, up to $1,000 per violation `[web search — verify]` | Hypothetical → email-first |
| Capacity overload breaks the 2-business-day reply promise | Low (limit 5, alerts) | Credibility | Mitigated in code (D-21) |

**Minimal incident note (template):** keep it in the private operations notes, not in this repo.

```
Incident note — Entrepreneuria Websites
Accounts with customer/lead data: GHL [MFA y/n], Google Workspace [MFA y/n], VPS [key-only SSH y/n], payment processor [MFA y/n]
Who has access: [names]
If data is exposed: (1) contain (rotate keys, revoke sessions); (2) record what/when/who;
(3) check notice duties — GA O.C.G.A. 10-1-912 [likely n/a; verify], the affected person's state law, GHL/processor terms;
(4) tell affected customers promptly in plain language; (5) log the fix.
Review date: [ ]
```

### F. Launch readiness and unresolved obligations

- **Stage 0/A:** one verified legal deficiency (LGL-01, plus the LGL-05, -06 and -07 inputs).
- **Stage B:** three more (LGL-02, -03, -04).
- Engineering gates the repo already tracks (session reliability, GHL sandbox run, alert receiver) aren't legal items and are out of scope here.

---

## Issues

| # | Issue | Risk | Recommendation |
|---|---|---|---|
| 1 | No Websites agreement; cancellation, refund, export and suspension undecided | **HIGH** (Stage B) | Finish `drafts/MANAGED_WEBSITE_SERVICE_AGREEMENT_DRAFT.md`; owner decisions D-OWN-05 to D-OWN-08, D-OWN-10 |
| 2 | Privacy and vendor disclosures don't cover Websites data or vendors | **HIGH** (Stage 0/A) | Publish the drafted section and lists |
| 3 | Contracting entity: name resolved as Entrepreneuria Global, LLC (Georgia LLC). It is administratively dissolved per the owner; reinstatement is unverified | **HIGH** (Stage B) | Owner completes reinstatement; verify on GA SOS; put the payment account in the LLC's name |
| 4 | Recurring billing flow undefined in GHL | **HIGH** (Stage B) | ROSCA-grade disclosure, checkbox, cancellation |
| 5 | Exit and export from GHL undefined | MED | Define the exit package |
| 6 | "Approved by counsel" gates | MED (process) | Redefine as owner-approved against this package |

## Regulatory trigger

- **New regime triggered?** Yes: CalOPPA disclosure duty for the new data collection; CAN-SPAM and TCPA for outreach; ROSCA (uncertain scope) for recurring billing.
- **Frameworks:** CalOPPA, FTC Act §5, ROSCA, CAN-SPAM, TCPA, GA no-call. GA UETA supports e-acceptance.

## Outside counsel action items

None are legally required. These are the top three if free or low-cost help becomes available:

- [ ] ROSCA's applicability to sole-proprietor B2B buyers, and adequacy of the planned flow
- [ ] Prominence and enforceability of the agreement's limitation-of-liability section under Georgia law
- [ ] Exit and export commitment for GHL-built sites (what to promise, and the wording)

## Verdict

🟡 **NEGOTIATE / FIX FIRST.** The approved business terms are customer-friendly and low-risk: month-to-month, one-month minimum, customer owns content and domain. What's missing is the paperwork carrying them, not the terms themselves. Close issues 2 (Stage 0/A) and 1, 3 and 4 (Stage B). No item requires paid counsel.

## Routing

The skill suggests `/c-level-agents:ciso-review`, `cfo-review` and `decide`. Those commands aren't installed. Log the owner's decisions in `docs/websites/DECISION-REGISTER.md` (new D-23+ entries) once made.

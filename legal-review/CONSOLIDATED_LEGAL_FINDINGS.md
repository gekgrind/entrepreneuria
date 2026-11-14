# Consolidated legal findings: Entrepreneuria Websites (Starter)

> Draft, 2026-11-11. Not legal advice, not attorney-reviewed, not privileged. Combines `PRODUCT_LEGAL_LAUNCH_REVIEW.md` and `GOVERNANCE_COMPLIANCE_REVIEW.md` into one deduplicated list. Citation tags are explained in `README.md`.

## Launch stages

A finding only blocks the stage where it first matters.

| Stage | What is live | Personal data collected | Money |
|---|---|---|---|
| **0: Showcase** (PR #37) | Page with pricing and demos. Requests arrive by email (`mailto:`), no form | Whatever a person emails | None |
| **A: Leads-only** | Page plus the inquiry form (Turnstile, GHL or manual review store, alerts) | Name, email, phone, business details, message, consent evidence, IP hash, user agent, UTM | None |
| **B: First paid customer** | Proposal, agreement acceptance, $199 setup fee, $75/month from launch, hosting | The above, plus billing data held by GHL and its processor | Yes |

## Priority definitions

The prompt's definitions, applied with the zero-budget rule: lack of attorney review is never a blocker on its own.

- **P0:** a verified gap that makes that stage unsafe or not legally supportable.
- **P1:** a significant risk that needs prompt fixing or an explicit owner decision.
- **P2:** can be scheduled after launch.

## Totals

| Priority | Count | IDs |
|---|---|---|
| P0 | 4 | LGL-01 (Stage 0/A), LGL-02, LGL-03, LGL-04 (Stage B) |
| P1 | 14 | LGL-05 to LGL-18 |
| P2 | 7 | LGL-19 to LGL-25 |
| **Total** | **25** | |

**Does any finding legally require an attorney?** No. I found no item in this scope that only a licensed attorney can resolve `[inference]`. Each item lists where an attorney is *recommended*.

## Summary matrix

| ID | P | Blocks stage | Finding | Type | Attorney | Owner | Status |
|---|---|---|---|---|---|---|---|
| LGL-01 | **P0** | 0, A | Privacy Policy doesn't cover Websites inquiries, GHL, Turnstile, the review store or retention | Verified gap. Legal requirement (CalOPPA) where California residents submit. FTC §5 accuracy | Not required | Owner + Eng | Draft ready |
| LGL-02 | **P0** | B | No customer agreement exists. Cancellation, refund, export and payment-recovery terms are still "proposed" | Verified gap | Recommended, not required | Owner | Draft ready, needs decisions |
| LGL-03 | **P0** | B | Recurring-billing disclosure, express consent and cancellation path aren't defined in the GHL payment flow | Verified gap. Law is uncertain for B2B (ROSCA). Card-network rules apply regardless | Not required | Owner + Eng | Spec + draft ready |
| LGL-04 | **P0** | B | Contracting entity: the name is now confirmed as Entrepreneuria Global, LLC, a Georgia LLC (live pages wrongly say "Inc."). The LLC is administratively dissolved; reinstatement is unverified | Name: resolved. Status: owner-reported fact with legal consequence | Not required | Owner | Name resolved; reinstatement outstanding |
| LGL-05 | P1 | A | The Cookie Policy claims analytics and marketing cookies the code doesn't set, and omits Turnstile | Verified inaccuracy | Not required | Owner + Eng | Draft ready |
| LGL-06 | P1 | A | Subprocessors page omits HighLevel/LeadConnector and Cloudflare. The VPS host and payment processor are unconfirmed | Verified gap | Not required | Owner | Draft ready |
| LGL-07 | P1 | A | No retention or deletion rule for lead data (review store, GHL, mailbox) | Verified gap. Best practice, no specific statute found | Not required | Owner | Decision needed |
| LGL-08 | P1 | B | "Setup fee due upon preview approval" must stay consistent with "free concept" and "pay nothing until you accept the proposal" | Risk (FTC "free" guide) | Not required | Owner | Wording proposed |
| LGL-09 | P1 | A/B | GHL follow-up and outreach email must meet CAN-SPAM (postal address, opt-out) | Legal requirement for commercial email, B2B included | Not required | Owner | Checklist ready |
| LGL-10 | P1 | Outreach | Cold calls or texts hit TCPA and Georgia's no-call law | Legal requirement where it applies | Recommended *if* phone outreach is planned | Owner | Restrict channel |
| LGL-11 | P1 | B | IP and ownership: content, domain, design, AI-generated parts, export at exit | Risk / contract design | Recommended, not required | Owner | Draft ready, needs decisions |
| LGL-12 | P1 | B | Who owns legal compliance of the customer's own site (privacy page, accessibility, content, form data) | Risk / contract design | Not required | Owner | In draft agreement |
| LGL-13 | P1 | B | "Hosting included" has no defined scope, uptime position or wind-down plan | Risk | Not required | Owner | Decision needed |
| LGL-14 | P1 | B | Failed-payment and suspension schedule is only proposed (D-15) | Risk | Not required | Owner | Decision needed |
| LGL-15 | P1 | 0 | Demo sites on `vibepreview.app`: commercial-use terms, permanence, and whether lead data goes into AI tools | Unverified | Not required | Owner | Verify |
| LGL-16 | P1 | B | Proof of agreement acceptance isn't wired. GHL must record which version was accepted | Verified gap | Not required | Eng + Owner | Spec ready |
| LGL-17 | P1 | 0 | `privacy@`, `legal@` and the public inbox must be confirmed as monitored | Unverified | Not required | Owner | Verify |
| LGL-18 | P1 | A | Release gates say "approved by counsel", which conflicts with the zero-budget decision | Process | Not required | Owner, then Eng | Decision needed |
| LGL-19 | P2 | Later | SMS must stay off. Turning it on needs TCPA written consent and A2P 10DLC registration | Legal requirement when enabled | Recommended at enablement | Owner | Gated off in code |
| LGL-20 | P2 | Later | Accessibility statement. Keep up WCAG AA practice | Best practice. ADA web standard unsettled in the 11th Circuit | Not required | Owner | Draft ready |
| LGL-21 | P2 | Later | Site Terms lack governing law/venue and a Websites carve-out | Best practice | Recommended, not required | Owner | Draft ready |
| LGL-22 | P2 | Later | Georgia sales-tax treatment of design + hosting not confirmed | Uncertain (tax, not legal launch) | Accountant optional | Owner | Verify |
| LGL-23 | P2 | Later | No written incident-response or access note | Best practice | Not required | Owner | Template ready |
| LGL-24 | P2 | 0 | Back up "Georgia-based team" / "Based in Georgia" | FTC §5 truthfulness | Not required | Owner | Confirm |
| LGL-25 | P2 | Later | DMCA designated agent ($6) for hosted customer content | Optional safe harbor | Not required | Owner | Optional |

---

## Finding detail

### LGL-01: Privacy Policy does not cover Websites data (P0 for Stages 0 and A)

- **Evidence:**
  - The form links only to `/privacy` (`review/ghl-s8-remediation:components/websites/InquiryForm.tsx:741`) `[repo]`.
  - `/privacy` on `main` lists the SaaS products and their AI processing. It doesn't mention Websites, inquiry data, GoHighLevel, Cloudflare Turnstile, the on-server review store, alert email, or retention (`main:app/privacy/page.tsx`) `[repo]`.
  - The intake sends name, email, phone, business, business type, website, interests, contact method, message, consent evidence and UTM to GHL (`lib/services/websites/intake.ts:142-196`). It stores the full submission plus IP hash and user agent in the review store (`review-store.ts:33-49`) `[repo]`.
  - The repo's own audit lists this as open: `LAUNCH-READINESS.md:38,57`, and gate `leads-privacy` (`release-gates.ts:56`) `[repo]`.
- **Requirement:**
  - **CalOPPA** (Cal. Bus. & Prof. Code §22575) requires a commercial website operator that collects PII from California residents to post a privacy policy. The policy must state the categories of PII collected, the categories of third parties it is shared with, how users are told about changes, its effective date, how Do Not Track is handled, and whether third parties may collect PII across sites `[web search — verify]`. A public form can receive California submissions, so treat this as applicable `[inference]`.
  - **FTC Act §5** (15 U.S.C. §45) makes a privacy policy that misdescribes practices deceptive `[settled]`.
  - **Georgia:** I found no comprehensive privacy statute in force. SB 111 (2025–26) shows as "passed" on trackers, but JD Supra reports its text was replaced with unrelated tax provisions `[web search — verify: read the enrolled SB 111 at legis.ga.gov]`.
- **Launch impact:** The form points visitors to a policy that doesn't describe what the form does. Fixing it costs nothing.
- **Remediation:** Publish the Websites section in `drafts/PRIVACY_POLICY_WEBSITES_SECTION_DRAFT.md` after the owner fills the retention and vendor facts (LGL-06, LGL-07).
- **Attorney:** not required.

### LGL-02: No customer agreement (P0 for Stage B)

- **Evidence:** `policies.ts:50-61` sets `service_agreement` to `legal_review`, and `cancellation`, `setup_fee_refund`, `content_export`, `customer_delay` and `payment_recovery` to `proposed`. `acceptance.ts:12-21` requires acceptance of eight policies, none of which exist as text `[repo]`.
- **Requirement:**
  - No statute requires a written services contract.
  - Charging a card or ACH every month without stated cancellation, refund and ownership terms is not legally supportable. Disputes would be decided on implied terms, and processors and card networks require disclosed terms for recurring charges `[inference]`.
  - E-acceptance is valid: Georgia UETA (O.C.G.A. §10-12-7) and federal E-SIGN (15 U.S.C. §7001) `[web search — verify]`.
- **Remediation:** `drafts/MANAGED_WEBSITE_SERVICE_AGREEMENT_DRAFT.md` and `drafts/PROPOSAL_ORDER_SUMMARY_AND_BILLING_TERMS_DRAFT.md`. The owner makes the bracketed decisions.
- **Attorney:** recommended for a one-time read-through when affordable. Not required.

### LGL-03: Recurring-billing disclosure, consent and cancellation (P0 for Stage B)

- **Evidence:**
  - No live payment adapter exists. `WEBSITES_PAYMENTS_MODE` has no `live` value (`DECISION-REGISTER.md` D-07). Payment collection will run in GHL, which isn't in the repo `[repo]`.
  - Gates `terms-disclosed`, `cancellation-works` and `no-prelaunch-billing` are all unpassed (`release-gates.ts:20-30`) `[repo]`.
  - I have no evidence of how the GHL subscription will be started at launch rather than at checkout `[unverified]`.
- **Requirement:**
  - **ROSCA**, 15 U.S.C. §8403 `[web search — verify]`, covers online sales with a negative-option feature. It requires:
    - clear and conspicuous disclosure of material terms before billing information is collected;
    - express informed consent before the charge;
    - a simple way to stop recurring charges.
  - Whether ROSCA's "consumer" covers business buyers is **uncertain**. The FTC has used ROSCA against charges to small businesses in a settled case. The 2024 Negative Option Rule, which expressly covered B2B, was **vacated by the 8th Circuit on 2025-07-08**. The FTC published an ANPRM in March 2026 asking about B2B scope `[web search — verify]`.
  - **Georgia, likely not applicable:**
    - The Online Automatic Renewal Transparency Act (O.C.G.A. §10-1-439.5 et seq.) defines "consumer" as a natural person acting for personal, family or household purposes `[web search — verify]`.
    - O.C.G.A. §13-12-1 et seq. covers renewals longer than one month and excludes business contracting `[web search — verify]`.
    - The Georgia FBPA is limited to consumer transactions (O.C.G.A. §10-1-392) `[web search — verify]`.
- **Zero-budget call:** meet ROSCA's three elements anyway. It costs nothing, removes the uncertainty, and also satisfies card-network expectations.
- **Remediation:** `LEGAL_UX_IMPLEMENTATION.md` §4 plus the order summary draft. Cancellation by email or by replying to any invoice; written confirmation within 2 business days `[OWNER]`.
- **Attorney:** not required.

### LGL-04: Contracting legal entity (P0 for Stage B; name resolved, status outstanding)

- **Original finding (2026-11-11):** Every live legal page names "Entrepreneuria Global, Inc." (`main:app/privacy/page.tsx`, `terms`, `cookies`, `subprocessors`) `[repo]`. That registration couldn't be verified from this session.
- **Name: resolved.** On 2026-11-12 the owner confirmed the legal name and type: **Entrepreneuria Global, LLC**, a domestic limited liability company in Georgia, United States. "Inc." on the live pages is a naming error, because Georgia reserves corporate designators such as "Inc." for corporations (O.C.G.A. §14-2-401) `[web search — verify]`. Every `legal-review/` draft now uses "Entrepreneuria Global, LLC". The live pages are unchanged; that is engineering task E-1.
- **Status: outstanding.**
  - The owner reports that the LLC is currently **administratively dissolved** and that they are handling reinstatement separately `[owner-reported; not independently verified]`.
  - This review doesn't describe the LLC as active, reinstated or in good standing.
  - Its effect on the LLC's capacity to take on new customer contracts wasn't researched (out of scope for this update). The conservative position is not to start Stage B until reinstatement is verified.
- **Remediation:**
  1. The owner completes reinstatement.
  2. Verify the status on the Georgia SOS eCorp search (free) and record the date in `LEGAL_LAUNCH_BLOCKERS.md`.
  3. Confirm the GHL payment account, and the processor account behind it, are in the name "Entrepreneuria Global, LLC".
- **Attorney:** not required for the name fix. Optional for reinstatement questions.

### LGL-05: Cookie and tracking disclosures inaccurate (P1)

- **Evidence:**
  - The code sets only these: the Supabase auth cookie `entrepreneuria-auth-token` (`lib/supabase/cookie-options.ts:4`), `sidebar_state` (`components/ui/sidebar.tsx:28`), and `localStorage` in one tool (`app/tools/hiring-assistant/page.tsx:147`). The Turnstile widget loads on the Websites form `[repo]`.
  - `@vercel/analytics` is a dependency (`package.json:49`) but is never imported. I found no analytics or ad pixels `[repo]`.
  - The Cookie Policy (`app/cookies/page.tsx:66,75`) and Privacy Policy (`app/privacy/page.tsx:38,150`) still claim analytics and marketing tracking, and don't mention Cloudflare `[repo]`.
- **Requirement:**
  - CalOPPA requires disclosure of whether third parties may collect PII about a user's activity over time and across sites `[web search — verify]`.
  - FTC §5 accuracy `[settled]`.
  - Overstating tracking is a low legal risk. Leaving out Turnstile is the real gap.
- **Remediation:** `drafts/COOKIE_AND_TRACKING_DISCLOSURE_DRAFT.md`. Before publishing, confirm whether Turnstile sets `cf_clearance` in this deployment. Sources disagree on that `[web search — verify]`.
- **Attorney:** not required.

### LGL-06: Subprocessors page incomplete (P1)

- **Evidence:**
  - `main:app/subprocessors/page.tsx` lists Supabase, OpenAI, Anthropic, Google, Stripe, LinkedIn, Meta, X, Notion and Hostinger. It omits HighLevel/LeadConnector (CRM and payments) and Cloudflare (Turnstile) `[repo]`.
  - Production runs on a VPS with nginx and pm2 (`LAUNCH-READINESS.md`) `[repo]`. That the VPS is Hostinger is `[inference]`.
  - Vercel preview deployments exist (PR #37 comments) `[repo]`.
  - HighLevel's own subprocessor list (September 2025) names Google Cloud, AWS, Twilio, Mailgun and Chargebacks91 `[web search — verify]`. Which processor sits behind GHL payments is `[unverified]`.
- **Requirement:** no US statute requires a subprocessor page at this size. Once published, it must be accurate (FTC §5).
- **Remediation:** `drafts/SUBPROCESSORS_UPDATE_DRAFT.md`.

### LGL-07: Lead data retention undefined (P1)

- **Evidence:** `MANUAL-INTAKE.md:23` says "Agree on data retention and backup access", and nothing sets a period. Review-store records persist until they are manually resolved, and resolution doesn't delete them (`review-store.ts`) `[repo]`.
- **Requirement:** I found no Georgia or federal statute setting a retention period for this data at this business's size `[inference]`. CCPA thresholds aren't met `[inference]`. This is best practice plus FTC data-security expectations.
- **Remediation, owner decision:** for example, delete non-converted leads 12 months after last contact. Customer records are kept for the life of the agreement plus [7] years for tax and accounting `[OWNER]`. State the rule in the privacy section.

### LGL-08: Setup-fee trigger wording (P1)

- **Evidence:** The approved term is "$199 due upon personalized preview approval." Page copy says the preview is free, that a written proposal follows, and "You pay nothing until you accept it" (`WebsitesPage.tsx:40,59`). In the code, the fee is chargeable only after `approved` with an acceptance record (`billing.ts`, `lifecycle.ts`) `[repo]`.
- **Risk:** The FTC guide on "free" says every condition of a free offer must be disclosed clearly at the outset (16 CFR §251.1) `[web search — verify]`. The page does this today. The risk is the fee being presented as triggered by approving the *free* concept.
- **Remediation:** Define the trigger in the agreement and on the invoice as acceptance of the written proposal and agreement, which happens after the customer approves the preview. Don't change the page copy.

### LGL-09: CAN-SPAM for follow-up and outreach email (P1)

- **Requirement:** CAN-SPAM (15 U.S.C. §7701 et seq.; 16 CFR Part 316) covers commercial email with no B2B exception `[web search — verify]`. It requires accurate headers, non-deceptive subject lines, a valid physical postal address, a working opt-out honored within 10 business days, and identification as an ad where applicable. Penalties reach roughly $53k per email `[web search — verify]`.
- Replying one-to-one to a person's own request is transactional or relationship content. Nurture sequences and cold outreach are commercial `[inference]`.
- **Remediation:** Configure GHL templates with a footer that includes the postal address and an unsubscribe link (checklist in `ZERO_BUDGET_LEGAL_LAUNCH_PLAN.md`). The owner chooses the postal address (a PO box or registered commercial mail agency may qualify) `[web search — verify]`.

### LGL-10: Phone and SMS outreach (P1 if outreach includes phone)

- **Requirement:**
  - **TCPA** (47 U.S.C. §227) `[settled]` restricts autodialed, prerecorded and artificial-voice calls and texts, and calls to Do-Not-Call numbers.
  - **Georgia's no-call law** (O.C.G.A. §46-5-27) was amended in 2024 by SB 73 to make sellers liable for calls made on their behalf and to allow class actions, with up to $1,000 per violation `[web search — verify]`. The Georgia list incorporates the federal registry and covers wireless numbers `[web search — verify]`.
  - The Georgia consumer office says B2B calls aren't covered, but secondary sources conflict, and many sole proprietors use personal cell phones `[web search — verify]`.
- **Remediation:** Run outreach by email only (LGL-09), or by in-person visits. If phone outreach is planned, use manual dialing only, scrub against the DNC registry, and keep an internal do-not-call list. No AI voice, no prerecorded messages, no texts.
- **Attorney:** recommended only if phone or SMS outreach at volume is planned.

### LGL-11: IP and ownership (P1)

- **Evidence:** `domain_content_ownership` is "approved" but still `requiresLegalReview` (`policies.ts:50`). `content_export` is proposed. Gate `ownership-disclosed` is unpassed `[repo]`.
- **Risk:**
  - The customer's own content and domain are straightforward.
  - Open questions: who owns the design, layout and code, and what the customer can take at exit when the site is built on GHL.
  - Works generated solely by AI are not copyrightable: *Thaler v. Perlmutter* (D.C. Cir. 2025-03-18), cert. denied 2026-03-02. The Copyright Office's January 2025 report says prompts alone are not authorship `[web search — verify]`. The agreement must not promise to assign copyright that may not exist.
- **Remediation:** Draft agreement §6. The owner decides what is exported at exit (LGL-11 decisions in `LEGAL_OWNER_DECISIONS.md`). Register domains in the customer's name.

### LGL-12: Compliance of the customer's own site (P1)

- **Risk:** Entrepreneuria builds and hosts sites whose forms collect the customer's own customers' data. Those sites need their own privacy pages (CalOPPA applies to them too) and raise accessibility exposure `[inference]`.
- **Remediation:** The agreement makes the customer responsible for their content, legal pages and business compliance. Entrepreneuria handles visitor data only as the customer's service provider. Whether Starter includes a basic privacy-page template is an owner decision.

### LGL-13: Scope of "Hosting included" (P1)

- **Evidence:** `hosting_maintenance` status is `verify` (`policies.ts:56`). Page copy promises only that hosting is included `[repo]`.
- **Remediation:** The agreement states hosting on Entrepreneuria's chosen platform with no uptime guarantee [OWNER may offer one], defines what maintenance is and isn't included, and sets a wind-down notice period if the service ends (§9 of the draft).

### LGL-14: Failed-payment schedule (P1)

- **Evidence:** D-15 proposes retries on days 1, 3 and 7, grace through day 14, then suspension becomes eligible. Suspension is disabled in code (`payment-recovery.ts`) `[repo]`.
- **Remediation:** The owner approves or edits the schedule. It goes into agreement §5.

### LGL-15: Demo hosting and AI tools (P1)

- **Evidence:** All three demo sites link to `*.vibepreview.app` preview URLs (`demos.ts:66,79,92`). Their permanence is "unverified" (`LAUNCH-READINESS.md`). They are correctly labeled "Fictional example" (`DesignGallery.tsx:121`) `[repo]`.
- **Risk:**
  - The platform's terms on commercial use and output ownership are `[unverified]`.
  - If prospects' business details are typed into AI tools to build concepts, the privacy section must say so `[inference]`.
- **Remediation:** The owner reads the platform's terms and confirms commercial use is allowed. Decide which tools may receive lead data. The privacy draft has a bracketed clause for this.

### LGL-16: Acceptance evidence for Stage B (P1)

- **Evidence:** `acceptance.ts` captures policy versions, IP hash and user agent. The lifecycle isn't connected to GHL, and gate `policy-acceptance` is unpassed `[repo]`.
- **Remediation:** Use GHL's document or proposal e-signature, or an acceptance checkbox on the GHL order form, that records the agreement version, date and time, and signer. Keep a PDF of the accepted version. Spec in `LEGAL_UX_IMPLEMENTATION.md` §5.

### LGL-17: Monitored contact inboxes (P1)

- **Evidence:** `privacy@` and `legal@entrepreneuria.io` appear on the legal pages. D-20 says the public inbox is unconfirmed. The page code refuses to render without `WEBSITES_CONTACT_EMAIL` (`app/services/websites/page.tsx`) `[repo]`.
- **Remediation:** The owner sends a test message to each address and confirms it is received and monitored. Otherwise change the policies to the confirmed inbox.

### LGL-18: Gates require counsel approval (P1, process)

- **Evidence:** `leads-privacy` requires "the form's privacy wording is approved by counsel" (`release-gates.ts:56`). `legal-approved` is owner `"legal"` (`release-gates.ts:31`) `[repo]`.
- **Remediation:** An owner decision to redefine both as "owner-approved after review against `legal-review/` requirements", followed by an engineering change. This review did not make that change.

### LGL-19 to LGL-25 (P2)

- **LGL-19 SMS:** server-side gated off (`intake.ts:211-213`) `[repo]`. Leave it off. Enabling it needs prior express written consent for marketing texts under the TCPA `[settled]` and carrier A2P 10DLC registration through GHL `[web search — verify]`.
- **LGL-20 Accessibility:**
  - No Title III web regulation exists for private businesses. DOJ paused that rulemaking `[web search — verify]`.
  - The 11th Circuit's *Gil v. Winn-Dixie* holding was vacated as moot in December 2021, so the law there is unsettled `[web search — verify]`.
  - Recent commits show WCAG AA work on the header and form `[repo]`.
  - A statement isn't legally required. A draft is supplied.
- **LGL-21 Terms:** add Georgia governing law and venue, a "Websites is governed by its own agreement" clause, and a prominent liability section. Georgia enforces limitation clauses only if they are "explicit, prominent, clear and unambiguous" (*Hall v. Skate Escape* line, *Warren Averett* (2019)) `[web search — verify]`.
- **LGL-22 Sales tax:**
  - Georgia DOR letter rulings treat hosting as non-taxable (LR SUT-2014-05, 2017-04, 2019-09) and treat separately stated custom design as a non-taxable professional service (LR SUT-2016-01) `[web search — verify]`.
  - Letter rulings bind only the taxpayer that requested them.
  - The registry already treats prices as tax-exclusive (`packages.ts`). Write "plus applicable taxes, if any".
- **LGL-23 Incident note:**
  - Georgia's breach statute applies to "information brokers" and covers name plus SSN, driver's license or account numbers (O.C.G.A. §10-1-911). Email and phone alone likely aren't covered `[web search — verify]`.
  - A one-page incident and access note is still cheap insurance. Template in the governance review.
- **LGL-24 Claims:** confirm "Georgia-based team" (`WebsitesPage.tsx:452`) and "Based in Georgia" are literally true. If the business is one person, "team" may overstate it `[inference]`.
- **LGL-25 DMCA agent:** $6 per designation with the Copyright Office, plus a public notice. It gives the 17 U.S.C. §512(c) safe harbor for customer-supplied content Entrepreneuria hosts `[web search — verify]`. Optional.

---

## Checked and cleared

These were verified in code or copy and need no action.

| Item | Evidence |
|---|---|
| "Free" preview conditions disclosed up front (homepage concept only; no other pages, revisions or publishing; no purchase required) | `WebsitesPage.tsx` FAQ, metadata description |
| Demo sites labeled fictional, never presented as clients | `demos.ts` (`fictional: true`), `DesignGallery.tsx:121` |
| No outcome guarantees ("Results are never guaranteed") | `WebsitesPage.tsx:34` |
| SMS consent wording and the text option kept out of the client bundle until approved | `legal-copy.ts`, `intake.ts:211` |
| Alerts carry counts and references only, no personal data | `alerts.ts`, `RETURNING-CONTACTS.md` |
| IP address stored only as a keyed hash with a server secret | D-17, `intake.ts:278` |
| Review store: 0600 files, 0700 directory, outside the web root, SSH-only | `review-store.ts` header |
| Returning contacts get the same response, so the CRM can't be enumerated | `RETURNING-CONTACTS.md` |
| No analytics or ad pixels on the site | `grep`, see LGL-05 |
| Page is `noindex` until legal and owner review | `app/services/websites/page.tsx` metadata |
| Card data never touches the app (GHL-hosted payment) | No live adapter; D-07 |
| Prices come from a single registry; charge uses the *accepted* price | `packages.ts`, `billing.ts` (D-16) |

## Codex audit mapping

The Codex audit wasn't found; see `README.md`. These are the legal items in the repo's own launch-readiness baseline and where each is handled:

| Baseline item | Source | Addressed by |
|---|---|---|
| Privacy notice and subprocessors must cover lead data and GHL | `LAUNCH-READINESS.md:57`, gate `leads-privacy` | LGL-01, LGL-06 + drafts |
| Form privacy sentence still open | `LAUNCH-READINESS.md:38`, `policies.ts:59` | LGL-01, `drafts/LEAD_INTAKE_DISCLOSURES_DRAFT.md` |
| SMS consent wording still open | `LAUNCH-READINESS.md:38`, `policies.ts:60` | LGL-19 (keep off; draft wording provided for later) |
| Service agreement under legal review | `policies.ts:61` | LGL-02 + draft agreement |
| Cancellation, setup-fee refund, content export, customer delay, payment recovery "proposed" | `policies.ts:51-58` | LGL-02, LGL-11, LGL-14 + owner decisions |
| Gate `terms-disclosed`, `cancellation-works` | `release-gates.ts` | LGL-03 |
| Gate `ownership-disclosed` | `release-gates.ts:29` | LGL-11 |
| Gate `legal-approved` | `release-gates.ts:31` | LGL-18 |
| Demo hosting permanence unverified | `LAUNCH-READINESS.md` | LGL-15 |
| Public inbox unconfirmed (D-20) | `DECISION-REGISTER.md` | LGL-17 |
| Data retention not agreed | `MANUAL-INTAKE.md:23` | LGL-07 |

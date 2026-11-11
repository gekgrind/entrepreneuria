> **DRAFT. Not legal advice. Not attorney work product. Not privileged.** AI-assisted review following the installed `launch-review` skill workflow. That skill would normally add a privileged header. It is omitted on purpose: this file lives in a shared repository, and no attorney-client relationship exists.

# Launch review: Entrepreneuria Websites (Website Starter)

**Reviewed:** 2026-11-11 | **Launch date:** not set | **Reviewer:** AI assistant (owner to confirm)
**Sources:**
- branch `review/ghl-s8-remediation` @ `2a12dac`, including:
  - `docs/websites/LAUNCH-READINESS.md`
  - `DECISION-REGISTER.md`
  - `lib/services/websites/*`
  - `components/websites/*`
- PR #37 (showcase mode)
- `main` @ `c75c06b` (live legal pages)

**Ticket:** none connected (no tracker MCP available)
**Calibration:** the skill's calibration file (`~/.claude/plugins/config/claude-for-legal/product-legal/CLAUDE.md`) is absent. Severity follows the prompt's P0/P1/P2 rules and the owner's zero-budget instruction. Items that don't fit a known pattern are marked **Novel, needs a human call**.

---

## Bottom line

**Stage 0 (showcase, email requests) and Stage A (leads-only form):** one legal gap stands in the way. The Privacy Policy doesn't describe Websites inquiries or the vendors that handle them (LGL-01). Publishing the drafted Websites privacy section, the corrected cookie disclosure and the updated subprocessor list closes it at no cost. Everything else at these stages is operational hygiene, and the code is unusually well guarded: SMS is off, alerts contain no personal data, and IPs are hashed.

**Stage B (first paid customer):** three more gaps, all verified:

- No customer agreement exists (LGL-02).
- The GHL recurring-billing flow has no defined disclosure, consent or cancellation path (LGL-03).
- The contracting entity isn't verified (LGL-04).

None of these needs an attorney to resolve. Each needs owner decisions, which are listed in `LEGAL_OWNER_DECISIONS.md`.

**Call:**
- Stage 0/A: **Blocked pending LGL-01** (publish the privacy and vendor disclosures).
- Stage B: **Blocked pending LGL-02, LGL-03, LGL-04.**

> **Non-lawyer gate (from the skill).** The skill won't issue "Clear to ship" or "Ship with conditions" without the owner confirming attorney review. The owner has said no budget for counsel exists. This memo therefore issues only "Blocked pending X" calls: these are review calls, not clearances. Once the blockers are closed, the owner decides whether to launch. Clearing a launch commits the business to the legal position documented here. The one-page attorney brief at the end is there if free or low-cost counsel becomes available.

---

## Step 2: What's launching

| Question | Answer |
|---|---|
| What does it do? | A done-for-you website service for local service businesses. A free homepage concept, then a written proposal, a $199 setup fee, build and launch, then $75/month with hosting included |
| Who uses it? | A new segment: small local-service business owners, mostly sole proprietors in Georgia `[inference from page copy]` |
| What's new vs. already reviewed? | All new. Existing legal pages were written for the SaaS products (Architecta, Prospra, etc.) |
| New data? | Yes: inquiry PII, consent evidence, IP hash, user agent, UTM |
| New vendors? | HighLevel/LeadConnector (CRM, payments), Cloudflare Turnstile, Google Workspace SMTP for alerts, `vibepreview.app` (demo hosting) |
| New claims? | Price, "hosting included", "free homepage concept", "Georgia-based", reply within 2 business days |
| New jurisdictions? | US and Georgia. A public form may reach California residents |

**AI detection:** the Websites page makes no AI claims `[repo]`. Demo sites are hosted on `vibepreview.app`, which may be an AI site builder `[unverified]`. Concept and site production may be AI-assisted `[unverified]`. Category 8 applies. The skill's `/ai-governance-legal:use-case-triage` handoff isn't installed, so AI triage is done inline in §8.

---

## Findings by category

### 1. Contractual commitments

**Checked:** page copy, FAQ, `packages.ts`, `policies.ts`, `acceptance.ts`, live `/terms`.
**Finding:** **Blocker (Stage B)**
**Detail:**
- The page promises a written proposal with price, inclusions and change terms before any payment (`WebsitesPage.tsx:40,46,52,59`). No proposal or agreement template exists.
- Eight policies must be accepted (`acceptance.ts:12-21`). One is approved; the rest are proposed, verify, or legal_review.
- Live `/terms` defers billing terms to "the time of purchase". It has no governing law.

**Calibration:** verified gap, P0 for Stage B (LGL-02). Terms gaps are P2 (LGL-21).
**Action:**
- Owner completes `drafts/MANAGED_WEBSITE_SERVICE_AGREEMENT_DRAFT.md` and `drafts/PROPOSAL_ORDER_SUMMARY_AND_BILLING_TERMS_DRAFT.md`.
- Promote the policies in `policies.ts` (engineering, after owner approval).

### 2. Privacy

**Checked:**
- `inquiry-schema.ts`, `intake.ts`, `review-store.ts`, `alerts.ts`, `InquiryForm.tsx`, `legal-copy.ts`
- `main:app/privacy`, `cookies`, `subprocessors`
- a grep for analytics, cookies and storage

**Finding:** **Blocker (Stage 0/A)**
**Detail:**
- **Collected:** name, email, phone (optional), business, business type, website, package and style interest, contact method, message, SMS consent flag, page URL, UTM, keyed IP hash, user agent (≤400 chars).
- **Sent to GHL:** everything except the IP hash and user agent (note, fields, tags, opportunity).
- **Stored on the VPS:** the full record goes to the review store when the contact already exists, the lookup fails, delivery fails, or delivery is in manual mode.
- **Showcase mode:** emails arrive in the Google Workspace mailbox.
- **The live Privacy Policy covers none of this.** It also claims analytics the site doesn't run, and it omits Cloudflare, HighLevel and retention.

**Calibration:** P0 (LGL-01). Cookie and vendor accuracy is P1 (LGL-05, LGL-06). Retention is P1 (LGL-07).
**Action:** publish the drafted Websites privacy section, cookie correction and subprocessor update after the owner fills the `[OWNER]` facts.
**Regimes:**
- CalOPPA (Bus. & Prof. Code §22575) `[web search — verify]`
- FTC Act §5 `[settled]`
- Georgia has no comprehensive privacy law in force; SB 111's status conflicts between sources `[web search — verify]`
- CCPA thresholds not met `[inference]`

### 3. Security

**Checked:** `review-store.ts`, `alerts.ts`, `alert-receiver.ts`, `smtp-mailer.ts`, `request-guards.ts`, `turnstile.ts`, `gate.ts`, D-17, D-18.
**Finding:** **Clear for the launch scope** (no legal blocker). Process improvement only.
**Detail:**
- Defense in depth is in place: Turnstile, honeypot, rate limits, a body cap, the host allowlist, HMAC-signed personal-data-free alerts, TLS-mandatory SMTP, 0600/0700 review files, an SSH-only review CLI, and a keyed IP hash.
- The open session-reliability gate (D-18) is an engineering gate, not a legal one.
- Georgia's breach law (O.C.G.A. §10-1-910 to -912) likely doesn't reach this data or business `[web search — verify]`.
- Card data stays on GHL-hosted pages.

**Calibration:** P2 (LGL-23): write a one-page incident and access note.
**Action:** owner, after launch.

### 4. IP

**Checked:** `demos.ts`, `DesignGallery.tsx`, page copy, `policies.ts` (`domain_content_ownership`, `content_export`), the open-source dependency list (not a full licence audit).
**Finding:** **Needs work (Stage B)**
**Detail:**
- **Content and domain:** customer ownership is approved. The agreement must spell out what Entrepreneuria keeps (templates, code, know-how), what transfers, and what the customer gets at exit from a GHL-hosted build.
- **AI-generated material:** if parts of a site are generated by AI, copyright may not exist to assign: *Thaler v. Perlmutter* (D.C. Cir. 2025), cert. denied 2026 `[web search — verify]`.
- **Demos:** fictional businesses, correctly labeled. Third-party demo host terms `[unverified]`.
- **Photos:** the page says "We use photos you provide." The agreement needs a customer warranty that they hold rights to their photos.

**Calibration:** P1 (LGL-11, LGL-15). **Novel, needs a human call:** what exactly is exportable from GHL at exit.
**Action:** owner decisions D-OWN-07 and D-OWN-08.

### 5. Third parties

**Checked:** `lib/integrations/ghl/*`, `GHL-SANDBOX-CHECK.md`, `ALERT-RECEIVER.md`, `subprocessors` page, HighLevel's public subprocessor list `[web search — verify]`.
**Finding:** **Needs work**
**Detail:**
- New vendors:
  - HighLevel/LeadConnector: CRM, workflows, payments, and probably site hosting `[unverified]`
  - Cloudflare: Turnstile
  - Google Workspace: SMTP relay
  - `vibepreview.app`: demos
- HighLevel publishes a DPA (April 2023 version found) and a subprocessor list (September 2025) `[web search — verify]`.
- The payment processor behind GHL is `[unverified]`.
- The core business dependency: if GHL is down, or ends the agency's account, customer sites and billing are affected.

**Calibration:** P1 (LGL-06, LGL-13).
**Action:** the owner confirms the vendor list and reads HighLevel's current terms on agency responsibilities. The agreement discloses the platform dependency.

### 6. Regulatory

**Checked:** auto-renewal, consumer protection, e-signature, telemarketing and email rules (research below).
**Finding:** **Needs work (Stage B), Blocker element in LGL-03**
**Detail:**

| Regime | Applies? | Basis |
|---|---|---|
| ROSCA, 15 U.S.C. §8401-8405 | **Uncertain for B2B.** Comply anyway at no cost | FTC used it in a B2B settlement. The B2B-explicit 2024 rule was vacated on 2025-07-08, and an ANPRM followed in March 2026 `[web search — verify]` |
| FTC Negative Option Rule (2024 amendments) | **No.** Vacated | 8th Circuit, 2025-07-08 `[web search — verify]` |
| GA Online Automatic Renewal Transparency Act, §10-1-439.5 et seq. | **Likely no** | Consumer = natural person, personal/family/household purposes `[web search — verify]` |
| GA service-contract auto-renewal, §13-12-1 et seq. | **Likely no** | Covers renewals longer than one month; excludes business contracting `[web search — verify]` |
| GA Fair Business Practices Act, §10-1-390 et seq. | **Likely no** for B2B | Consumer transactions only `[web search — verify]` |
| FTC Act §5 | **Yes** | Applies to all commerce `[settled]` |
| GA UETA §10-12-7 / E-SIGN | **Yes (helps)** | E-acceptance is valid `[web search — verify]` |
| FTC Cooling-Off Rule (16 CFR 429) | **Likely no** | Consumer purchases at home only `[inference]`. Re-check if selling door-to-door to a person for personal use |
| GA sales tax | **Uncertain** | DOR letter rulings say hosting and custom design aren't taxable `[web search — verify]` |

**Calibration:** P0 for the billing-flow element (LGL-03). Tax is P2 (LGL-22).
**Action:** implement ROSCA-grade disclosure, consent and cancellation in the GHL flow (`LEGAL_UX_IMPLEMENTATION.md` §4).

#### 6a. Sector overlay: consumer, retail and marketing

The skill's sector table names "Consumer/retail/marketing". It fires because of outreach and email follow-up.

| Regime | Applies? | Action |
|---|---|---|
| CAN-SPAM, 15 U.S.C. §7701; 16 CFR 316 | **Yes**, no B2B exception `[web search — verify]` | Postal address plus opt-out on all GHL marketing email (LGL-09) |
| TCPA, 47 U.S.C. §227 | **Yes** for calls and texts `[settled]` | SMS stays off. No autodialer, prerecorded or AI voice (LGL-10, LGL-19) |
| GA no-call, §46-5-27 (amended 2024) | **Yes** for calls to residential and wireless numbers. B2B status conflicting `[web search — verify]` | Email-first outreach, DNC scrub if phoning (LGL-10) |
| FTC "free" guide, 16 CFR 251 | **Yes** | Currently compliant. Keep the setup-fee trigger at proposal acceptance (LGL-08) |
| FTC Consumer Reviews and Testimonials Rule, 16 CFR 465 | **Not triggered.** The page has no reviews or testimonials | Re-check before adding any |

### 7. Marketing claims

**Checked:** all page copy (`WebsitesPage.tsx`), metadata, demo cards.
**Finding:** **Clear, with one item to confirm.**
**Detail:**
- Claims are specific and backed: the price comes from the registry, the free concept's scope is spelled out, and "Results are never guaranteed" is stated.
- Demos are labeled "Fictional example". No testimonials, rankings or outcome promises appear.
- Confirm "Georgia-based team" and "Based in Georgia" (LGL-24).
- "Hosting included" is backed by an entitlement marked `committed`, but its scope is undefined (LGL-13).

**Calibration:** P2.
**Action:** owner confirms.

### 8. AI governance

**Checked:** page copy, privacy and terms pages, demo hosting, intake code paths.
**Finding:** **Needs work (disclosure accuracy only)**
**Detail:**
- Intake data isn't sent to any AI provider in code `[repo]`.
- Whether the owner pastes lead or customer data into AI tools while making concepts or sites is unknown `[unverified]`.
- No US federal or Georgia law requires telling business customers that web design is AI-assisted `[inference]`. Colorado's and Utah's AI statutes target high-risk decisions and consumer chatbots, not this use `[inference]`.
- The real duties are:
  - accurate privacy disclosure if customer data goes to AI vendors;
  - not over-promising copyright in AI output (see §4);
  - the customer's approval of all content before launch, which the page already says.

**Calibration:** P1 (LGL-15).
**Action:** owner decision D-OWN-09. The privacy and agreement drafts carry bracketed AI clauses.

---

## Action items

| # | Item | Owner | Due | Blocking? |
|---|---|---|---|---|
| 1 | Fill `[OWNER]` facts and publish the Websites privacy section, cookie correction and subprocessor update | Owner, then Eng | Before Stage 0/A | **Yes** |
| 2 | Decide retention periods | Owner | Before Stage A | Yes (feeds #1) |
| 3 | Verify the legal entity on the GA SOS registry; align the GHL payment account name | Owner | Before Stage B | **Yes** |
| 4 | Complete agreement and order-summary decisions (refund, cancellation, export, suspension, hosting scope) | Owner | Before Stage B | **Yes** |
| 5 | Configure GHL: disclosure above payment, unticked consent checkbox, subscription starting at launch, cancellation route | Owner + Eng | Before Stage B | **Yes** |
| 6 | GHL acceptance record with agreement version and PDF | Owner + Eng | Before Stage B | Yes |
| 7 | CAN-SPAM footer in GHL templates; email-first outreach | Owner | Before outreach | Yes, for outreach |
| 8 | Confirm `privacy@`, `legal@` and the public inbox are monitored | Owner | Before Stage 0 | No |
| 9 | Redefine the "counsel" gates (LGL-18) | Owner, then Eng | Before Stage A | No (process) |
| 10 | Verify `vibepreview.app` terms, or self-host demos | Owner | Before Stage 0 | No |
| 11 | Accessibility statement, Terms update, tax check, incident note, DMCA agent | Owner | Post-launch | No |

## Escalations

None routed. No tracker or counsel is connected. The items marked **Novel** (GHL exit/export; ROSCA's reach to B2B) are the best use of any free legal clinic time (see the brief below).

## Notes for next time

- Create the product-legal calibration file, so later reviews calibrate to this business rather than to defaults.
- Add a `legal-review/` section to the PR template for Websites changes that touch data, price or copy.

## Citation check

Statutes, regulations and cases here came from model knowledge or web search. Direct fetches of primary sources (Cornell LII, Justia) were blocked by this session's network policy. Every citation carries a source tag. Check `[web search — verify]` items against the official text (uscode.house.gov, ecfr.gov, legis.ga.gov, leginfo.legislature.ca.gov) before relying on them. Treat pinpoint subsections as unverified.

---

## One-page attorney brief

For a free clinic, SBDC referral or bar referral consult, if one becomes available.

**Business:** Entrepreneuria Websites. A Georgia-based done-for-you website service for local service businesses, B2B.

**Offer:**
- Free homepage concept.
- If accepted: a $199 setup fee at proposal acceptance, then $75/month from launch.
- One-month minimum. Hosting included; the customer owns their content and domain.
- Payments collected on GoHighLevel-hosted pages.

**Three questions:**
1. Does ROSCA (15 U.S.C. §8403) apply to our sales to sole proprietors buying for their business? We plan to comply anyway. Is the planned disclosure, checkbox and email-cancellation flow enough?
2. Is our limitation-of-liability section (draft agreement §11) prominent and clear enough for Georgia courts (*Warren Averett*, 2019)?
3. For a site built on GoHighLevel, what should we promise at exit? Our draft offers a content export plus domain transfer, not the platform build.

**Residual risk after our fixes:** low for Stages 0/A. Moderate for Stage B until the owner decisions are made.

**Where to look for free or low-cost help** `[unverified, check availability]`:
- the Georgia Small Business Development Center (UGA SBDC; business, not legal, advice)
- SCORE mentors
- law-school transactional clinics in Georgia
- the State Bar of Georgia's lawyer referral service (usually a low fixed-fee first consult)

---

## Next steps

1. **Draft the remaining text:** done; see `drafts/`. The owner fills the brackets.
2. **Escalate:** optional. Use the brief above if free help becomes available.
3. **Get more facts:** entity registration, GHL payment configuration, demo-host terms, inbox monitoring.
4. **Watch and wait:** the FTC negative-option rulemaking (ANPRM, March 2026) and Georgia privacy bills in the 2027 session.
5. **Something else:** engineering tasks in `LEGAL_UX_IMPLEMENTATION.md`.

---

## SAFE TO POST TO TRACKER

**Launch status:**
- Stage 0/A (showcase, leads-only): blocked pending condition 1.
- Stage B (paid customers): blocked pending conditions 2–5.

**Conditions:**
- [ ] Publish the updated Privacy (Websites section), Cookie and Subprocessor pages: Owner + Eng, before showcase or leads launch
- [ ] Set lead-data retention periods: Owner, before leads launch
- [ ] Confirm the exact registered business name and match the payment account to it: Owner, before the first paid customer
- [ ] Finalize the service agreement and order summary (refund, cancellation, export, suspension, hosting scope): Owner, before the first paid customer
- [ ] Configure GHL checkout: terms shown above payment, unticked agreement checkbox, subscription starts at launch, cancellation route working: Owner + Eng, before the first paid customer
- [ ] Record the accepted agreement version for every customer: Owner + Eng, before the first paid customer
- [ ] Add a postal address and unsubscribe link to all GHL marketing emails: Owner, before any outreach

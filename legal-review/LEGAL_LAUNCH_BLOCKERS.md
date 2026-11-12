# Legal launch blockers (P0): Entrepreneuria Websites (Starter)

> Draft, 2026-11-11. Not legal advice. A P0 is a **verified** gap that makes that stage not legally supportable. The lack of attorney review is **not** a blocker on its own. Generic-checklist items were excluded. Full detail is in `CONSOLIDATED_LEGAL_FINDINGS.md`.

**Count:** 4 P0 items. 1 blocks Stage 0/A; 3 block Stage B. LGL-04's naming question is now resolved; its entity-status checkpoint (reinstatement) is still open.
**Requiring a paid attorney to resolve:** none `[inference]`.

---

## Stage 0 (showcase) and Stage A (leads-only form)

### LGL-01: Privacy Policy must cover Websites inquiries

- **Why it blocks:** the form links to `/privacy`, which doesn't describe the data the form collects or the vendors that receive it. CalOPPA (Cal. Bus. & Prof. Code §22575) requires the posted policy to state the categories collected and the categories of third parties they are shared with `[web search — verify]`. A policy that doesn't match practice is a deception risk under FTC Act §5 `[settled]`. Showcase mode still collects personal data by email, so this applies there too.
- **Verified evidence:** `main:app/privacy/page.tsx` (no Websites, GHL, Cloudflare or retention). `review/ghl-s8-remediation:lib/services/websites/intake.ts:142-196`, `review-store.ts:33-49`. Gate `leads-privacy` is open (`release-gates.ts:56`).
- **Cost to fix:** $0.
- **Attorney:** not required.

**Done when:**
- [ ] Owner fills D-OWN-02 (retention), D-OWN-03 (postal address), D-OWN-09 (AI tools), D-OWN-16 (inbox)
- [ ] `drafts/PRIVACY_POLICY_WEBSITES_SECTION_DRAFT.md` published to `/privacy#websites` with a new effective date
- [ ] Cookie disclosure corrected (LGL-05, P1, same release) and the subprocessor list updated (LGL-06, P1, same release)
- [ ] Owner signs off here with a date: `________`

---

## Stage B (first paid customer)

### LGL-02: Customer agreement

- **Why it blocks:** recurring charges with no written cancellation, refund, ownership or hosting terms. Five of the eight policies a customer must accept (`acceptance.ts:12-21`) are still proposed or under review (`policies.ts:50-61`).
- **Cost to fix:** $0.
- **Attorney:** recommended for one read-through when affordable. Not required.

**Done when:**
- [ ] Owner decisions D-OWN-05, -06, -07, -08, -10, -11, -12, -13, -18, -19, -21, -22, -23 made
- [ ] `drafts/MANAGED_WEBSITE_SERVICE_AGREEMENT_DRAFT.md` finalized, versioned (e.g. `2026-12-01.v1`), and saved as a PDF
- [ ] `policies.ts` statuses promoted with matching versions (engineering task E-6)

### LGL-03: Recurring-billing disclosure, consent and cancellation in GHL

- **Why it blocks:** ROSCA (15 U.S.C. §8403) requires three things before an online recurring charge: clear disclosure of the material terms, express informed consent, and a simple cancellation path `[web search — verify]`. Its reach to business buyers is uncertain. Complying costs nothing, while ignoring it exposes the business to FTC risk and chargebacks. The GHL flow doesn't exist yet, so this is unverified, and the gates `terms-disclosed`, `cancellation-works` and `no-prelaunch-billing` are open.
- **Cost to fix:** $0.
- **Attorney:** not required.

**Done when:**
- [ ] The GHL checkout or invoice shows the order summary (`drafts/PROPOSAL_ORDER_SUMMARY_AND_BILLING_TERMS_DRAFT.md`) **above** the payment fields
- [ ] An unticked "I agree" checkbox linking the agreement; the payment can't proceed without it
- [ ] The $199 is charged once. The $75 subscription is **created at launch**, not at checkout (verified with a GHL test-mode transaction)
- [ ] The cancellation route works end to end (test: request, confirmation within 2 business days, no further charge)
- [ ] A confirmation email restates the terms and how to cancel

### LGL-04: Contracting entity (name resolved; status outstanding)

LGL-04 now has two parts.

**Part 1, legal name: resolved (owner-confirmed 2026-11-12).**
- The contracting party is **Entrepreneuria Global, LLC**, a Georgia domestic limited liability company.
- The live legal pages say "Entrepreneuria Global, Inc." That was a naming error: the entity is an LLC, not a corporation. Georgia reserves "Inc." for corporations (O.C.G.A. §14-2-401) `[web search — verify]`.
- Every draft in `legal-review/` now uses the LLC name.

**Part 2, entity status: OUTSTANDING. This is the remaining P0 for Stage B.**
- The owner reports that the LLC is currently **administratively dissolved** and that they are handling reinstatement separately.
- This review hasn't verified the LLC's status and doesn't describe it as active, reinstated or in good standing.
- **Why it blocks:** the service agreement and payment account must name an entity whose status supports entering new customer contracts and collecting payment. Until reinstatement is confirmed, Stage B shouldn't start.
- **Cost:** reinstatement filing and fees are the owner's separate process. Checking status on the Georgia SOS eCorp search is free.
- **Attorney:** not required for the naming fix. Optional if the reinstatement filing raises questions.

**Done when:**
- [x] Legal name confirmed by the owner: **Entrepreneuria Global, LLC**, Georgia domestic LLC (2026-11-12)
- [x] All `legal-review/` drafts use the LLC name
- [ ] **Reinstatement verified:** the Georgia SOS record shows the LLC as active, or the equivalent status. Status `__________`, checked on `__________`, by `__________`
- [ ] GHL agency or sub-account billing name and processor account match "Entrepreneuria Global, LLC"
- [ ] Live legal pages changed from "Inc." to "LLC" (engineering task E-1; not done in this PR)

---

## Not blockers (on purpose)

| Item | Why it isn't P0 |
|---|---|
| No attorney review | Owner instruction. No law requires attorney-drafted policies or contracts |
| Accessibility statement | Not legally required; ADA web standard unsettled in the 11th Circuit (P2) |
| SMS consent wording | SMS is off in code; stays off (P2) |
| Sales tax | Likely non-taxable; doesn't affect the legality of launching (P2) |
| GDPR, CCPA, DPIA, SOC 2 | Not applicable at this size and market |
| Site-wide Terms gaps | Websites customers are bound by the separate agreement (P2) |

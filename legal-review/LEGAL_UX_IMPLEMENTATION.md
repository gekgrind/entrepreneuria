# Legal UX implementation: Entrepreneuria Websites

> Draft, 2026-11-11. Not legal advice. These are recommendations only. **No application behavior was changed** in this review.
>
> Everything below respects AGENTS.md UI protection:
> - It reuses existing components and classes (`LegalShell`, `s.formFine`, the existing footer link style).
> - It adds no new visual patterns.
> - Every item that changes visible UI is marked **[UI change]** and needs an owner ruling before it is built.

## Current state

| Surface | Legal elements today | Evidence |
|---|---|---|
| `/services/websites` page | Price, setup fee, one-month minimum and "free concept" scope all stated clearly. Fictional-demo badges. Global footer links to Privacy and Terms | `WebsitesPage.tsx`, `DesignGallery.tsx:121`, `components/footer.tsx:151-157` |
| Inquiry form | "See our Privacy Policy" link under the submit button. Privacy sentence and SMS consent hidden until approved | `InquiryForm.tsx:739-742`, `legal-copy.ts` |
| Showcase CTA (PR #37) | `mailto:` button, no notice | PR #37 `WebsitesPage.tsx` |
| Proposal, acceptance, payment | **Do not exist yet** (GHL, outside the repo) | D-07 |
| Legal pages | Privacy, Terms, Cookies, Subprocessors, Acceptable Use, Compliance, Vulnerability Disclosure, all in `LegalShell` | `main:app/*/page.tsx` |

---

## 1. Where the legal pages sit

| # | Recommendation | Why | UI impact |
|---|---|---|---|
| 1.1 | Put the Websites privacy text **inside `/privacy` at `#websites`**, not on a new page | One posted policy is what CalOPPA expects; it reuses `LegalShell` | Content only |
| 1.2 | Change the form's privacy link from `/privacy` to `/privacy#websites` | It lands the visitor on the relevant section | Content only (an href) |
| 1.3 | Add **Cookies** and **Accessibility** links to the global footer's legal row, after "Terms of Service", with the same classes as the existing links | Discoverability. The footer has room; the row already flexes | **[UI change]**: two extra links in an existing row, same style |
| 1.4 | Link the Service Agreement **only** from the GHL proposal and checkout, not from the marketing page | The agreement applies to buyers. It's versioned per acceptance | None in this repo |
| 1.5 | Keep `/services/websites` `noindex` until LGL-01 is published | Already in place (`page.tsx` metadata) | None |

## 2. Privacy notices

| # | Where | Text | Implementation |
|---|---|---|---|
| 2.1 | Form, beside submit | `drafts/LEAD_INTAKE_DISCLOSURES_DRAFT.md` §1 | Replace `PRIVACY_SENTENCE` in `legal-copy.ts`. Set `privacy_notice` to `approved` with a new version in `policies.ts`. It renders in the existing `s.formFine` paragraph. The version is already recorded per submission (`intake.ts:163`) |
| 2.2 | Showcase `mailto:` CTA | §2 of the same draft | One line in `s.formFine` style under the button. **[UI change]**: one line of fine print |
| 2.3 | Success state | §5 of the same draft | One sentence added to the existing success copy. Owner copy ruling |

**Accessibility of notices:**
- Keep the notice as visible text **before** the submit button, not a tooltip or a collapsed panel.
- Keep it in the form's DOM order, so screen readers reach it before submitting.
- Check contrast: `.formFine` is `#4a566e` on the page background. Confirm it is at least 4.5:1 for 13px text.

## 3. Consent language

| # | Item | Recommendation |
|---|---|---|
| 3.1 | Privacy | **Notice only, no checkbox.** US and Georgia law don't require opt-in consent to contact someone who asked to be contacted `[inference]`. A checkbox adds friction without adding legal protection |
| 3.2 | SMS | Keep it **off** (code-enforced). When enabled later, it must be a separate, unticked, optional checkbox with the wording in `LEAD_INTAKE_DISCLOSURES_DRAFT.md` §4. The current code already enforces separate, optional and not required |
| 3.3 | Marketing email | Only if D-OWN-03 and the privacy section say follow-up marketing emails are sent. Every one must carry an unsubscribe link and postal address in GHL (CAN-SPAM). No checkbox needed for B2B email `[web search — verify]` |

## 4. Recurring-billing disclosure (GHL checkout or invoice)

This is the LGL-03 blocker. It lives in GHL, so it is owner plus engineering configuration, not repo code.

| # | Requirement | Acceptance test |
|---|---|---|
| 4.1 | The Order Summary (`drafts/PROPOSAL_ORDER_SUMMARY_AND_BILLING_TERMS_DRAFT.md` §A) appears **above** card fields, in body-size text, not in a link or collapsed panel | Screenshot at 375px and 1440px shows the summary before card fields without scrolling past them |
| 4.2 | The amount charged now ($199) and the recurring amount, start and frequency ($75/month from Launch Date) are both in the summary **and** on or next to the pay button | Button reads "Pay $199" |
| 4.3 | Unticked agreement checkbox; the payment can't proceed unticked; the link opens the exact versioned agreement | Test: submitting unticked is blocked with an accessible error message |
| 4.4 | No subscription charge before launch | GHL test-mode transaction: only $199 at checkout. $75 is created at the Launch Date |
| 4.5 | Cancellation path works: email or reply, confirmed within 2 business days, subscription stopped in GHL | Test cancellation in test mode; no further invoice is generated |
| 4.6 | Confirmation, launch-day and cancellation emails sent (drafts §B–D) | Test-mode emails received |

Gate mapping (`release-gates.ts`): `terms-disclosed`, `policy-acceptance`, `no-prelaunch-billing`, `cancellation-works`, `preview-free`.

## 5. Customer agreement acceptance

| # | Recommendation |
|---|---|
| 5.1 | Store the agreement as a **versioned PDF**, e.g. `websites-agreement-2026-12-01.v1.pdf`, never edited after use. A new version gets a new file |
| 5.2 | Accept via the checkbox on the GHL payment page (§4.3) **or** a GHL Documents and Contracts e-signature `[verify GHL feature availability]`. Either is valid under GA UETA §10-12-7 and E-SIGN `[web search — verify]` |
| 5.3 | Record per customer: agreement version, timestamp, the name and email of the person accepting, business name, amount, and the IP or GHL audit trail if available. This mirrors `AcceptanceRecord` in `acceptance.ts` |
| 5.4 | Email the customer a copy, or link to the exact version (draft §B) |
| 5.5 | If the agreement changes: new version, 30-day notice to existing customers (agreement §13.3); existing customers keep their accepted version until then |

## 6. Accessible presentation, across all of the above

- Real text, not images of text, for every legal notice.
- Links must say where they go ("Privacy Policy", "Service Agreement (PDF)"), not "click here".
- Checkbox: a native `<input type="checkbox">` with an associated `<label>`. Errors announced, as the existing form already does with `aria-invalid` and `aria-describedby`.
- PDFs should be tagged or accessible, or provide the agreement as an HTML page as well.
- Minimum 4.5:1 contrast for fine print. Don't drop below the existing `.formFine` size (0.8125rem).

---

## Engineering task list

Each task needs its owner decision first. None is done in this branch.

| ID | Task | Depends on | UI change? | Priority |
|---|---|---|---|---|
| E-1 | Update live legal pages: `/privacy` Websites section and edits; `/cookies` corrections; `/subprocessors` rows; verified entity name; new effective dates. Content inside existing `LegalShell` only | D-OWN-01, -02, -03, -09, -16 | Content only | **P0** (Stage 0/A) |
| E-2 | Change the form's privacy link to `/privacy#websites`. Add an `id="websites"` anchor on the new section | E-1 | Content only | P1 |
| E-3 | Showcase CTA notice line (PR #37 branch) | E-1 | **Yes**: one fine-print line | P1 |
| E-4 | Footer legal row: add Cookies and Accessibility links | Owner ruling; accessibility statement approved | **Yes**: two links | P2 |
| E-5 | `legal-copy.ts`: approved privacy sentence. `policies.ts`: `privacy_notice` → `approved` with a new version | Owner approval of the wording | Visible sentence appears (slot already exists) | **P0** (Stage A) |
| E-6 | `policies.ts`: promote `service_agreement`, `cancellation`, `setup_fee_refund`, `content_export`, `customer_delay`, `payment_recovery`, `domain_content_ownership`, `hosting_maintenance` to `approved` with versions matching the final agreement. Set the `minimum_term` and `pricing` versions | Agreement finalized | None (server data) | P0 (Stage B) |
| E-7 | `release-gates.ts`: change the `leads-privacy` and `legal-approved` criteria from "counsel" to owner-approved against `legal-review/` | D-OWN-14 | None | P1 |
| E-8 | GHL configuration per §4–§5 (checkout summary, checkbox, subscription at launch, cancellation, emails) | D-OWN-05/06/10/21 | GHL only | **P0** (Stage B) |
| E-9 | `demos.ts`: remove the live-demo links or self-host, if `vibepreview.app` terms or permanence fail | D-OWN-17 | **Yes**, if links are removed | P1 |
| E-10 | Remove the unused `@vercel/analytics` dependency, **or** document it if analytics will be added (then update the cookie disclosure first) | Owner | None | P2 |
| E-11 | GHL email templates: postal address and unsubscribe footer; email-first outreach | D-OWN-03, D-OWN-15 | GHL only | P1 (before outreach) |
| E-12 | Review-store retention: a script or schedule that deletes resolved records after 90 days. Document it in `MANUAL-INTAKE.md` | D-OWN-02 | None | P1 |

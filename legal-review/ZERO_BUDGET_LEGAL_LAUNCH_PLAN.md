# Zero-budget legal launch plan: Entrepreneuria Websites (Starter only)

> Draft, 2026-11-11. **Not legal advice. Not attorney-reviewed. No guarantee of compliance, and no removal of liability.** The aim is an accurate, appropriately protected small-business launch that meets the requirements that actually apply. Paid counsel is not assumed.

## The short answer

**A legally supportable launch is achievable without paid counsel.** `[inference from the findings; not a guarantee]` I found **no** issue in this scope that only a licensed attorney can resolve.

The work is mostly paperwork and configuration:

- **4 blockers (P0):**
  - **Stage 0/A:** publish accurate privacy and vendor disclosures (LGL-01).
  - **Stage B:**
    - confirm the LLC's reinstatement (LGL-04: name resolved as Entrepreneuria Global, LLC; administratively dissolved status still to be cleared);
    - finish the customer agreement (LGL-02);
    - set up GHL checkout with clear terms, a checkbox and a cancellation path (LGL-03).
- **Total out-of-pocket cost: $0** for the legal documentation work. LLC reinstatement fees are a separate owner process and not counted here. Optional extra: $6 for a DMCA agent.
- **Owner time, rough estimate `[inference]`:**
  - Stage 0/A: 2–4 hours of decisions and edits.
  - Stage B: 4–8 hours, plus a GHL test-mode run.

## How each finding is classified

| Field | Meaning |
|---|---|
| **Requirement type** | **Legal requirement** (a statute or rule applies) · **Uncertain** (applicability unsettled) · **Risk** (no rule, but real exposure) · **Best practice** |
| **Attorney** | **Required** (none in scope) · **Recommended** (worth it if free or cheap help appears) · **Not required** |
| **Sources** | Tagged `[web search — verify]`, `[settled]`, `[repo]` or `[inference]`. Primary-law sites were blocked in this session. Check the official text before relying on any citation |

---

## The smallest supportable launch scope

Launch in three steps. Each step needs only the items listed for it.

```
Stage 0  SHOWCASE    page + email requests          needs: LGL-01
Stage A  LEADS-ONLY  + inquiry form (no payments)   needs: LGL-01 (+ P1s recommended)
Stage B  FIRST SALE  + agreement, $199, $75/mo      needs: LGL-02, LGL-03, LGL-04 (LLC reinstatement verified)
```

Showcase (PR #37) is the lowest-exposure option: no form and no CRM writes. Personal data arrives only by email. If the GHL sandbox run and the alert receiver aren't ready, Stage 0 lets marketing start legally as soon as LGL-01 is published.

---

## 1. Can be done now

No decisions needed beyond accepting the drafts.

| # | Item | Type | Jurisdiction / source | Attorney | No-cost remedy |
|---|---|---|---|---|---|
| N-1 | Correct the cookie and tracking claims (no analytics or ads on site; disclose Turnstile) | Legal requirement (accuracy) | FTC Act §5 `[settled]`; CalOPPA §22575 `[web search — verify]` | Not required | `drafts/COOKIE_AND_TRACKING_DISCLOSURE_DRAFT.md` |
| N-2 | Add HighLevel/LeadConnector and Cloudflare to subprocessors | Best practice; accuracy once published | FTC §5 `[settled]` | Not required | `drafts/SUBPROCESSORS_UPDATE_DRAFT.md` |
| N-3 | Keep SMS off | Legal requirement **if** texting starts | TCPA 47 U.S.C. §227 `[settled]` | Not required | Already enforced in code |
| N-4 | Email-only outreach with a CAN-SPAM footer | Legal requirement for commercial email, B2B included | CAN-SPAM 15 U.S.C. §7701; 16 CFR 316 `[web search — verify]` | Not required | Checklist below |
| N-5 | **Name: resolved (2026-11-12).** The contracting party is Entrepreneuria Global, LLC, a Georgia LLC, and the drafts are updated. **Status: outstanding.** The LLC is administratively dissolved; the owner is reinstating it separately. Re-check the Georgia SOS eCorp search after filing | Name: legal requirement (no "Inc." for an LLC). Status: see O-6 | O.C.G.A. §14-2-401 `[web search — verify]` | Not required | Free status check after reinstatement |
| N-6 | Test-send to `privacy@`, `legal@` and the public inbox | Risk | — | Not required | 5 minutes |
| N-7 | Read the `vibepreview.app` terms (commercial use, permanence) | Risk | — | Not required | Or self-host the screenshots only |

**CAN-SPAM checklist for GHL templates** (N-4):
- [ ] The From name and address identify Entrepreneuria
- [ ] The subject line matches the content
- [ ] Postal address in the footer (D-OWN-03)
- [ ] One-click unsubscribe link; GHL marks the contact as unsubscribed; honored within 10 business days
- [ ] Cold outreach emails are identifiable as promotional (for example, "We build websites for local businesses. Reply 'no thanks' and we won't email again.")
- [ ] No purchased email lists `[best practice]`

---

## 2. Needs an owner decision

Full options are in `LEGAL_OWNER_DECISIONS.md`.

### Before Stage 0/A

| # | Decision | Type | Source | Attorney | Recommended default |
|---|---|---|---|---|---|
| O-1 | Retention periods (D-OWN-02) | Best practice; no specific statute found | `[inference]` | Not required | 12 months for non-converted leads; 90 days for resolved review files |
| O-2 | Postal address (D-OWN-03) | Legal requirement for marketing email | CAN-SPAM `[web search — verify]` | Not required | PO box or commercial mailbox |
| O-3 | AI tools and lead data (D-OWN-09) | Legal requirement (accurate disclosure) | FTC §5 `[settled]` | Not required | Business details only; never contact data |
| O-4 | Replace "approved by counsel" gates (D-OWN-14) | Process | `[repo]` `release-gates.ts:31,56` | Not required | Owner-approved against this package |
| O-5 | Outreach channels (D-OWN-15) | Legal requirement where calls or texts are used | TCPA `[settled]`; GA §46-5-27 (2024 amendments; up to $1,000 per violation) `[web search — verify]` | **Recommended** only if phone or SMS outreach is planned | Email and in-person only |

### Before Stage B

| # | Decision | Type | Source | Attorney | Recommended default |
|---|---|---|---|---|---|
| O-6 | **Entity status: reinstatement checkpoint (D-OWN-01a).** The name was resolved under D-OWN-01: Entrepreneuria Global, LLC | Risk with legal consequence. Status is owner-reported; its effect on contracting capacity wasn't researched | Owner report, 2026-11-12 | Not required (optional for reinstatement questions) | Verify reinstatement before the first paid customer; put the GHL and processor accounts in the LLC's name |
| O-7 | Setup-fee trigger and refund (D-OWN-21, -05) | Risk (FTC "free" guide) | 16 CFR §251.1 `[web search — verify]` | Not required | Fee at proposal acceptance; full refund before build starts |
| O-8 | Cancellation method and effective date (D-OWN-06) | **Uncertain**: ROSCA for B2B. Comply anyway | 15 U.S.C. §8403 `[web search — verify]`; 2024 rule vacated 2025-07-08; ANPRM March 2026 `[web search — verify]`. GA auto-renewal laws likely n/a (consumer or longer-than-one-month only) `[web search — verify]` | Not required | Email or reply to cancel; end of the paid month after the 1-month minimum |
| O-9 | Failed payment and suspension (D-OWN-10) | Risk | `[repo]` D-15 | Not required | D-15 schedule plus 3-day notice |
| O-10 | Exit package and IP (D-OWN-07, -08, -12) | Risk; AI-copyright limit | *Thaler v. Perlmutter* (D.C. Cir. 2025), cert. denied 2026 `[web search — verify]` | **Recommended** (novel GHL-export question) | Content, page text and domain help; platform build not transferable; domain in the customer's name |
| O-11 | Hosting scope and post-launch changes (D-OWN-11) | Risk | — | Not required | No uptime guarantee; small monthly updates allowance |
| O-12 | Liability cap and venue (D-OWN-19) | Risk (enforceability) | Georgia "explicit, prominent, clear and unambiguous" test `[web search — verify]` | **Recommended** | 12-month fees cap; Georgia law; owner's county |
| O-13 | Customer-site legal pages (D-OWN-18) | Risk | CalOPPA applies to customer sites too `[inference]` | Not required | Customer is responsible; Entrepreneuria places pages the customer provides |
| O-14 | Customer delay, price-change notice, taxes (D-OWN-13, -22, -23) | Risk / uncertain (tax) | GA DOR letter rulings `[web search — verify]` | Not required (accountant optional for tax) | 60-day stall rule; 30-day price notice; "plus applicable taxes, if any" |

---

## 3. Can reasonably be deferred

| # | Item | Type | Why deferral is reasonable | Revisit when |
|---|---|---|---|---|
| D-1 | Accessibility statement (LGL-20) | Best practice | No Title III web regulation exists; the 11th Circuit standard is unsettled `[web search — verify]` | Within 30 days of launch. Draft ready |
| D-2 | Site Terms amendments (LGL-21) | Best practice | Websites customers are bound by the separate agreement | With the next legal-page update |
| D-3 | Sales tax confirmation (LGL-22) | Uncertain | DOR rulings point to non-taxable `[web search — verify]` | Before revenue is meaningful; optional free DOR letter-ruling request |
| D-4 | Incident and access note (LGL-23) | Best practice | GA breach law likely doesn't cover email and phone `[web search — verify]` | First month |
| D-5 | DMCA agent, $6 (LGL-25) | Optional safe harbor | Only matters for third-party claims about hosted customer content | When there are several customers |
| D-6 | SMS texting (LGL-19) | Legal requirement when enabled | Not needed for launch | Before any GHL texting workflow |
| D-7 | FTC negative-option rulemaking; Georgia privacy bills | Watch | No current rule `[web search — verify]` | Quarterly check |

---

## Genuine launch-blocking issues that need professional help

**None identified** for the Starter-only scope `[inference]`.

Situations that **would** change this, where an attorney becomes strongly recommended:

1. A customer in a regulated field (health, legal, financial) wants forms collecting sensitive data. The agreement draft §8.3 forbids this without a written agreement.
2. Cold-call or SMS outreach at volume (TCPA and Georgia no-call private actions).
3. A dispute, demand letter or chargeback pattern.
4. Expanding beyond Starter: e-commerce, payments for customers' own customers, or ad management.
5. A decision to enforce the liability cap against a customer.

---

## Order of work

1. **Today:** N-6 (inboxes), N-7 (demo host terms). In parallel, the owner pursues LLC reinstatement (N-5 / O-6).
2. **Owner decisions O-1 to O-5:** fill the brackets in `drafts/PRIVACY_POLICY_WEBSITES_SECTION_DRAFT.md`, `COOKIE_…`, `SUBPROCESSORS_…` and `LEAD_INTAKE_…`.
3. **Engineering E-1, E-2, E-5** (and E-3 for showcase): publish. Stage 0/A is then legally ready, assuming the engineering gates pass.
4. **Owner decisions O-6 to O-14:** finalize the agreement and order summary as a versioned PDF.
5. **Engineering E-6, E-8:** GHL test-mode run of the full paid flow (`LEGAL_UX_IMPLEMENTATION.md` §4 tests). Stage B is then legally ready.
6. **Within 30 days:** D-1, D-2, D-4.

## What this plan does not do

- It doesn't certify compliance or replace legal advice.
- It doesn't verify facts the owner must supply (entity, vendors, AI tools, addresses).
- It doesn't audit the other Entrepreneuria products' legal pages beyond the edits needed for accuracy.
- It doesn't change code, GHL, production configuration or published pages.

# Websites Starter: conversion audit and opportunities

Audit date 2026-11-12. Primary build audited: `review/ghl-s8-remediation@2a12dac` ("s8"). Showcase findings use `feat/websites-showcase-mode@d95e974` (PR #37). The method and the limits of what was verified are in `WEBSITES_CUSTOMER_JOURNEY_AUDIT.md`.

Priority key:
- **P0:** prevents a critical journey from completing.
- **P1:** significant confusion, accessibility or conversion problem.
- **P2:** optional post-launch enhancement.

No testimonials, customer counts, guarantees or performance claims are proposed anywhere in this audit. Suggested copy uses only terms already approved by the owner:
- Website Starter
- $199 setup after the preview is approved
- $75/month from launch
- one-month minimum
- hosting included
- the customer owns their domain and content
- free homepage concept
- reply within 2 business days

## 1. Assessment by dimension

| Dimension | Rating | What works | What doesn't |
|---|---|---|---|
| First-screen clarity | **Good** | The H1 states what it is, who it's for and the price. At 375px the setup fee and "Hosting included" sit directly under the H1 (`03`). At ≥960px the offer card repeats both (`01`, `02`) | The global header competes on the same screen (UX-03) |
| Value proposition | **Adequate** | "Without the hassle of building it yourself" plus "No website builder to learn" is the right promise for a handyman. The "Why" section is concrete and trade-specific | It's generic in places ("modern, mobile-friendly"). The real differentiator, *you see your homepage before you pay anything*, sits in the preview strip and step 2, not in the hero lede. That's a copy opportunity, not a defect, so it's left to the owner |
| Trust and credibility | **Adequate, thin** | Fictional demos are clearly labelled twice. The "cannot promise rankings, leads or sales" line is honest and differentiating. "Based in Georgia" | No named person (UX-14). Demo URLs are unbranded third-party preview hosts (UX-10). The header pushes an unrelated AI product (UX-03). No real work exists yet, which is correct: don't fake it |
| Pricing transparency | **Good, two gaps** | Price, setup and minimum term on the page; "pay nothing until you accept a written proposal" | **When the $75 starts** and **who owns the site** aren't said (UX-04). These are the two questions a $75/month buyer asks before signing |
| Free preview explanation | **Good** | The FAQ defines the concept precisely (one homepage; no other pages, revisions or publishing). The s8 "What happens after I request a preview?" is clear | When the concept arrives isn't said (UX-09). The showcase build loses the visitor's style choice (UX-06) |
| CTA placement | **Weak on phones** | Desktop: the sub-nav "Free preview" is always visible, plus CTAs in the preview strip, package card, How-it-works, final band | Phones: the dock never appears (UX-02). Every CTA lands more than a screen above the first field (UX-05). The hero preview link sits 27px below the 375×667 fold (UX-13) |
| Objections and friction | **Mixed** | "No phone call needed", "no purchase or commitment", "pay nothing until you accept" cover the commitment fear | Lock-in and ownership aren't covered (UX-04). The form doesn't ask for service area or services, so the first reply has to ask (UX-08) |
| Mobile conversion | **Weak until UX-02 and UX-05 are fixed** | No horizontal overflow; 52px buttons; gallery tabs work | See `WEBSITES_MOBILE_UX_FINDINGS.md` |
| Accessibility | **Good (automated)** | axe-core WCAG 2.2 AA: **0 violations** at 390 and 1440 in both builds. Fine print is 13px `#4a566e` on white, about 7.4:1. Focus, error summary and live regions are e2e-covered | The dock is tab-reachable while off-screen (fixed by UX-02). Manual screen-reader pass not done |
| Legal disclosure readability | **Good on the page** | Fictional-demo disclosure in plain language; "Results are never guaranteed" | The privacy link goes to a policy that doesn't cover this page (LGL-01, already a P0 in #38) |
| Delivery and service expectations | **Partial** | The reply SLA is a reply, not a delivery, which is correctly worded | Nothing past the reply is defined for the customer (UX-01, UX-09) |

## 2. Recommendations

### UX-01 (P0, Stage B): design the post-request experience: reply, concept, proposal, acceptance, onboarding

- **Screen / component:** outside the page. Covers the owner's reply email, the concept handoff, the proposal and payment step, and post-payment onboarding. Touches `lib/services/websites/lifecycle.ts` only if a state is added (optional).
- **Current behavior:**
  - The page promises a reply within 2 business days, then a concept, then a written proposal.
  - Nothing defines:
    - what the reply asks for
    - how the concept is delivered (hosted link, image, PDF)
    - how the prospect says yes
    - what they receive next
  - `lifecycle.ts` goes from `preview_requested` straight to `proposal_sent`, with no concept step.
  - The legal drafts (#38) cover the order summary, the confirmation email after payment, and the launch and cancellation emails. They don't cover the reply or the concept/proposal message.
- **Evidence:**
  - `lifecycle.ts:114-154`
  - `MANUAL-INTAKE.md` (operator steps only)
  - `legal-review/drafts/PROPOSAL_ORDER_SUMMARY_AND_BILLING_TERMS_DRAFT.md` §A–E
  - No other docs found: a repo-wide search for "concept" and "proposal" turned up nothing else
- **Proposed improvement:** a zero-code playbook of three message templates plus one onboarding checklist, kept in the owner's mail or GHL snippets. It shouldn't live in this public repo if it contains internal effort limits.
  - **A. Reply (within 2 business days):** confirms the request and asks only for what the concept needs.
  - **B. Concept and proposal (one message):** shows the concept, states the approved terms in plain words, and gives one action to accept. The action is a GHL payment page that meets LGL-03 (order summary above card fields, unticked agreement checkbox, "Pay $199").
  - **C. Onboarding checklist (after payment):** logo, photos of their own work, services and prices they want shown, service area, domain access or registration choice, contact details for the site.
- **Suggested copy:** drafts. Owner to edit. Align the terms wording with LGL-08 and the final agreement.

  > **A. Subject: Your free homepage concept — a few quick questions**
  > Hi {first name}, thanks for asking about a website for {business}. To design your free homepage concept I need a few details:
  > 1. The main services you want customers to see (up to 6).
  > 2. The towns or area you serve.
  > 3. Your logo, if you have one, and any photos of your own work (optional).
  > Just reply to this email. Once I have these, I'll send your concept with next steps. There's nothing to buy and no commitment.

  > **B. Subject: Your homepage concept for {business}**
  > Here is your free homepage concept: {link or attached image}.
  > If you'd like to go ahead, here is what it costs and how it works:
  > • Website Starter: $199 one-time setup, paid when you accept.
  > • $75/month, starting only when your website goes live. One-month minimum. Hosting included.
  > • You own your domain name and your content.
  > The full terms are here: {agreement link}. To accept and pay the setup fee: {payment link}.
  > If it's not for you, no problem: you don't need to do anything.

- **Acceptance criteria:**
  - All three templates and the checklist exist and are owner-approved.
  - The wording of B matches the final agreement and the LGL-03 order summary.
  - A dry run with a test contact goes from request to reply, then concept and proposal, then test-mode payment, then onboarding checklist. No step needs improvised wording.
  - Optional: `lifecycle.ts` gains a `concept_sent` state between `preview_requested` and `proposal_sent`, with tests. Only do this if the owner wants the state tracked.
- **Complexity:** low for the templates. GHL payment-page configuration is already E-8 (medium). Optional lifecycle state: low.
- **Owner approval:** **yes** (copy and commercial wording). Depends on LGL-02, LGL-03 and LGL-04.

### UX-03 (P1): the global header sells a different product on this page

- **Screen / component:** `components/Header.tsx`, the primary CTA (`getPrimaryCta()` from `lib/launch.ts`) and the "Pricing" nav item, on `/services/websites` only.
- **Current behavior:**
  - At ≥1024px the header shows "Join the Waitlist →" in orange (`/waitlist`, Prospra).
  - Directly below it, the page sub-nav shows an orange "Free preview".
  - Two "Pricing" links are visible together: the header's goes to `/pricing` (AI products), the sub-nav's to `#packages`.
  - On phones the menu has the same items.
  - AGENTS.md reserves orange for the primary action. Here two primary actions point at two products.
- **Evidence:** `evidence/01-s8-1440-first-screen-header-ctas.webp`, `02-s8-1024-first-screen.webp`. The DOM probe at 1440 and 1024 lists the header links as `Products, Resources, About, Pricing, Log In, Join the Waitlist`.
- **Proposed improvement:** make the header route-aware for `/services/websites`. Minimum change:
  - Hide the launch-state CTA.
  - Hide the "Pricing" item.
  - Keep Products, Resources, About and Log In.
  - No new component, styles or copy.
  - Alternative (also needs approval): replace the CTA with "Free preview" pointing to `#preview`.
- **Suggested copy:** none (removal). Alternative label: "Free preview".
- **Acceptance criteria:**
  - On `/services/websites` at 1440, 1024, 390 and 375 (menu open), no element links to `/waitlist` or `/pricing`.
  - Every other route renders the header unchanged; snapshot or DOM test on `/`, `/pricing`, `/about`.
  - No layout shift in the header row.
- **Complexity:** low (a `usePathname()` check in `Header.tsx`).
- **Owner approval:** **yes** (global component, visible change).

### UX-04 (P1): say when billing starts and who owns the website

- **Screen / component:** `components/websites/WebsitesPage.tsx`:
  - package footer (`pkgFoot`)
  - the setup-fee FAQ answer passed to `faqs()`
  - one new FAQ item
- **Current behavior:**
  - The page says "One plan: $199 one-time setup, then $75 a month" and "Billed monthly, with a one-month minimum". It never says the $75 starts at launch, so "then" reads as starting right after setup.
  - Domain ownership is deferred to "your written proposal". Content ownership isn't mentioned.
- **Evidence:** s8 `WebsitesPage.tsx` package footer and `faqs()`. The approved business terms in this brief: "$75/month beginning at website launch", "customer owns their domain and content".
- **Proposed improvement:** add both facts where the price is explained. Don't add new terms.
- **Suggested copy:**
  - Package footer: *"Your $75 monthly fee starts the day your website goes live, not before, with a one-month minimum. You own your domain name and your content. Your written proposal confirms the pages and features for your business, how changes work, and the full terms before you pay anything."*
  - Setup-fee FAQ: *"Yes. There is a one-time $199 setup fee, paid when you accept your proposal. The $75 monthly price starts when your website goes live, with a one-month minimum."* (Check "paid when you accept your proposal" against LGL-08.)
  - New FAQ, "Do I own my website?": *"You own your domain name and the content you give us, like your text, photos and logo. Your written proposal sets out the details, including what happens if you cancel."*
- **Acceptance criteria:**
  - Both facts are visible in the Pricing section without opening anything.
  - The FAQ answers match the final agreement wording (LGL-02, LGL-11) word for word on the commercial terms.
  - The registry still drives the prices (`formatUsd`). No hard-coded "$75" or "$199".
- **Complexity:** low.
- **Owner approval:** **yes**. Legal alignment is needed for the ownership sentence (LGL-11).

### UX-06 (P1, showcase only): make the email request carry the details

- **Screen / component:** `components/websites/WebsitesPage.tsx` (showcase branch), the `#preview` right column; `requestEmailHref()` in `submit-outcome.ts`; `StyleSelectionNote` in `DesignGallery.tsx`.
- **Current behavior:**
  - The CTA is `mailto:` with the body `"Hi, I'd like a free website preview."` and nothing else. It's server-rendered with `requestEmailHref(contactEmail, [])`.
  - A style picked with "Use this style for my preview" is dropped, and the note still says "You can change it in the request form."
  - Copy that describes a form that doesn't exist in showcase:
    - Step 1: "Fill out a short form…"
    - FAQ: "Add its address to the request form"
    - FAQ: "the short form below"
    - "using the contact method you choose"
    - "You can change it in the request form"
  - PR #37 lists only two of these.
  - On desktop the lone button floats top-right of an empty column (`07`). On phones it sits *below* the "Prefer email? Ask a question" box, which has its own `mailto:` (`08`). Two email actions are stacked, and the secondary one comes first.
  - A `mailto:` link does nothing visible when no mail app is configured. The copy-address button is the only fallback. This wasn't tested on devices.
- **Evidence:**
  - DOM probe: the `#preview` CTA `href` is `mailto:preview@example.test?subject=Free%20website%20preview%20request&body=Hi%2C%20I'd%20like%20a%20free%20website%20preview.%0A`
  - `evidence/07`, `evidence/08`
- **Proposed improvement:**
  1. Build the `mailto:` body on the client from `useSelection()`: the chosen style label and labelled blank prompts. Reuse `requestEmailHref` and its `EmailLine` type.
  2. Showcase copy variants for the five lines above.
  3. Put the request CTA before the email box on phones. Under the button, add a one-line fallback: "Or email us at {address}".
- **Suggested copy:**
  - Mail body: `Hi, I'd like a free website preview.` / `Business name:` / `What you do (main services):` / `Towns or area you serve:` / `Phone (optional):` / `Current website (optional):` / `Style I liked: {style or blank}`.
  - Step 1: *"Email us your business name, what you do and the area you serve."*
  - FAQ: *"Include its address when you request your preview."* (s8 already uses this.)
  - Style note: *"Style selected for your preview: {name}. It's added to your email request."*
- **Acceptance criteria:**
  - In showcase, after choosing a style, the CTA `href` body contains `Style I liked: <label>`.
  - No visible text contains "form" in showcase mode. Test: `page.locator('text=/form/i')` count is 0 inside `.page`.
  - At 375px the request CTA appears before `#email-addr` in DOM and visual order.
  - The URL stays under 2,000 characters.
- **Complexity:** low to medium (a client wrapper for one link plus copy branching on `intake`).
- **Owner approval:** **yes** (copy).

### UX-07 (P1, showcase only): rebase showcase onto the s8 branch before launch

- **Screen / component:** branch topology. `components/websites/WebsitesPage.tsx` and `PageChrome.tsx` conflict.
- **Current behavior:**
  - #37 is based on `feat/websites-launch-form-states` (#34).
  - The s8 branch merged #34, #35 and #36 and then changed the same files. The changes include "Hosting included", the proposal step, "What happens after…", the setup price in the dock, "View Pricing", and the "Other local business" type.
  - Deploying #37's stack would ship the older copy.
- **Evidence:** `git log origin/review/ghl-s8-remediation ^origin/feat/websites-showcase-mode` shows 40 commits. `git merge-base --is-ancestor` confirms #37 is not in s8.
- **Proposed improvement:** decide which mode launches first (showcase or manual `leads`), then put showcase mode on top of s8 so that both modes render the same approved copy.
- **Acceptance criteria:**
  - One branch renders s8 copy in `leads` mode and in `showcase` mode, with UX-06 applied.
  - The existing gate and route tests from #37 pass.
  - The e2e suite passes in both modes.
- **Complexity:** medium (manual conflict resolution in two components).
- **Owner approval:** owner chooses the launch mode. The merge itself is engineering.

### UX-08 (P1): ask for service area and services up front

- **Screen / component:** `components/websites/InquiryForm.tsx` message field (`f-msg`); `lib/services/websites/form-rules.ts`; the showcase mail body (UX-06).
- **Current behavior:**
  - The form asks for name, business, email, phone, type, website, style, contact method and an optional free-text message ("Anything we should know about your business or what you need?").
  - Every demo homepage leads with a service list and a town (the Red Clay demo's hero reads "Handyman Services in" plus a town name).
  - Without those details the first reply has to ask for them. That adds a full round trip before concept work can start and eats into the capped preview effort.
- **Evidence:** DOM probe field list (`f-name`, `f-biz`, `f-email`, `f-phone`, `f-type`, `f-site`, `f-style`, `f-contact-*`, `f-msg`); `evidence/` demo thumbnails.
- **Proposed improvement:** cheapest option first.
  - **(a)** Relabel the optional message field. No schema change.
  - **(b) (Later)** Add an optional "Towns or area you serve" field mapped to a GHL custom field.
- **Suggested copy (a):**
  - Label: *"Your main services and the towns you serve (optional)"*
  - Placeholder: *"e.g. drywall repair, deck staining, small remodels, in and around your town"*
- **Acceptance criteria:**
  - Label and placeholder render.
  - The field stays optional.
  - The email-fallback body carries the new label.
  - The e2e field-order test still passes.
- **Complexity:** low for (a), medium for (b).
- **Owner approval:** **yes** (form copy).

### UX-09 (P2): set an expectation for when the concept arrives

- **Screen / component:** `WebsitesPage.tsx`, the FAQ "What happens after I request a preview?" (s8).
- **Current behavior:** it promises a reply within 2 business days, "with any questions and next steps". Concept timing isn't stated.
- **Proposed improvement:** state it in reply template A (UX-01) first. Add it to the page only once the owner has measured a timing they can keep.
- **Suggested copy:** *"…Once we have what we need, your homepage concept usually follows within {N} business days."* Leave `{N}` unset until it's measured. Don't publish a number that's a guess.
- **Acceptance criteria:** the number appears only after the owner signs off on it, and it lives in one constant beside `REPLY_WITHIN`.
- **Complexity:** low.
- **Owner approval:** **yes**.

### UX-10 (P1): demo links point at unbranded preview hosts

- **Screen / component:** `lib/services/websites/demos.ts` (`url`); "View Live Demo" in `DesignGallery.tsx`.
- **Current behavior:**
  - Each demo opens `https://preview-17939…vibepreview.app/` in a new tab.
  - A prospect sees a numeric preview subdomain on an AI-builder domain. That works against "We build your website for you" and can expire in the middle of an outreach campaign.
  - Reachability is **unverified**: the sandbox proxy blocked the host.
- **Evidence:** `demos.ts:385,398,411`. `LAUNCH-READINESS.md` lists "permanence unverified". LGL-15 and E-9 cover terms and permanence.
- **Proposed improvement:** this adds the trust angle to E-9.
  - Preferred: serve the demos from an Entrepreneuria-controlled host (e.g. `demos.entrepreneuria.io/<id>`, or static exports under `/services/websites/examples/<id>`).
  - Fallback: remove "View Live Demo" and keep the screenshots.
- **Acceptance criteria:**
  - Every demo URL is on an Entrepreneuria domain, or there's no external link.
  - A scheduled or manual check confirms each URL returns 200 before outreach starts.
  - The `demos.ts` schema still enforces `https://` and `fictional: true`.
- **Complexity:** medium for self-hosting, low for removal.
- **Owner approval:** **yes**.

### UX-12 (P2): tighten the FAQ (s8)

- **Screen / component:** `faqs()` in `WebsitesPage.tsx`.
- **Current behavior:**
  - 11 questions.
  - "What is included in the monthly price?" and "Is hosting included?" both open with "hosting is included".
  - The commitment questions (setup fee, what happens next, ownership) are scattered.
- **Proposed improvement:**
  - Merge the two hosting questions into "What is included in the monthly price?"
  - Order: included → setup fee and billing start → ownership (UX-04) → what happens after a request → is the preview free → domains → changes → existing site → technology → phone call.
- **Acceptance criteria:** at most 10 items; no two answers repeat the same fact; the order matches the list above.
- **Complexity:** low.
- **Owner approval:** **yes** (copy order and merge).

### UX-13 (P2): hero conversion path

- **Screen / component:** hero `ctaRow` and `heroAlt` in `WebsitesPage.tsx`.
- **Current behavior:**
  - The filled primary button is "See Website Examples".
  - The preview request is an arrow link whose bottom edge sits at 694px (s8) or 670px (showcase) on a 667px-tall phone screen, just below the fold.
- **Evidence:** `evidence/03-s8-375-first-screen.webp`; DOM probe.
- **Proposed improvement:** **don't change this before launch.** Examples-first suits cold-outreach visitors who need proof. Once UX-02 makes the dock work, phones get a persistent request CTA anyway. After launch, compare dock taps with hero-link taps before deciding.
- **Complexity:** n/a.
- **Owner approval:** n/a for now.

### UX-14 (P2): put a name to the service

- **Screen / component:** the `#preview` side panel or the final CTA band.
- **Current behavior:** "from a Georgia-based team". No person is named anywhere on the page. LGL-24 already asks the owner to substantiate "team".
- **Proposed improvement:** one plain line naming who designs and replies. Local trades buy from people. Owner decision. Don't add a photo or bio unless the owner wants one.
- **Suggested copy:** *"Your concept is designed by {owner name}, who replies to every request personally."* Use it only if true. Replace "team" if LGL-24 resolves that way.
- **Complexity:** low.
- **Owner approval:** **yes**.

### UX-15 (P2): tell people what to have ready

- **Screen / component:** the `InquiryForm` success state ("Thanks, {name}. Your request is in.").
- **Proposed improvement:** add one sentence.
- **Suggested copy:** *"If you have a logo or photos of your own work, have them handy. We may ask for them."*
- **Complexity:** low.
- **Owner approval:** **yes**.

### UX-16 (P2): footer LinkedIn link

- **Screen / component:** `components/footer.tsx` `SOCIALS` (site-wide, on `main`).
- **Current behavior:** the LinkedIn icon links to `https://linkedin.com`, the LinkedIn home page.
- **Proposed improvement:** link to the real company or owner profile, or remove the icon.
- **Complexity:** trivial.
- **Owner approval:** **yes** (site-wide).

The mobile-specific findings (UX-02, UX-05, UX-11) are in `WEBSITES_MOBILE_UX_FINDINGS.md`.

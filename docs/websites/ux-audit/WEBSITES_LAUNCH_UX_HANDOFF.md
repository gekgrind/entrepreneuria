# Websites Starter: launch UX handoff

Audit date 2026-11-12. This is the engineering and owner handoff for the findings in this folder.

**Base:** the next implementation branch should start from `review/ghl-s8-remediation`. #37's showcase mode needs to move onto that branch (UX-07). Nothing here changes pricing, approved terms, PR #38, GHL, or any deployment.

## Owner verdict

### Must fix before launch

- **UX-01 (P0, before the first paid sale, not before the page goes live).**
  - There's no designed path from "reply" to "concept" to "proposal" to "pay $199".
  - Write the three templates and the onboarding checklist, then do one dry run in test mode.
  - Depends on the existing legal P0s: LGL-02 (agreement), LGL-03 (checkout), LGL-04 (LLC reinstatement).

The existing P0s still apply and aren't repeated here:
- LGL-01: privacy policy, before any lead is collected
- D-20: inbox confirmation

### Should fix before launch

These are low effort and directly affect lead capture.

| ID | Fix | Effort |
|---|---|---|
| UX-02 | Phone CTA dock is invisible. Portal it to `<body>` | low |
| UX-03 | Remove "Join the Waitlist" and the AI "Pricing" link from the header on this page | low |
| UX-04 | State "$75 starts when your site goes live" and "you own your domain and content" | low (copy) |
| UX-05 | Put the form directly under the heading on phones | low |
| UX-07 | If showcase is the launch mode: put it onto the s8 branch | medium |
| UX-06 | If showcase is the launch mode: structured email template, keep the style choice, remove the "form" lines | low–medium |
| UX-08 | Relabel the message field to ask for services and service area | low |
| UX-10 | Move demos to an Entrepreneuria domain, or drop the external links (with E-9) | low–medium |

### Safe to defer

- UX-09: concept timing, once measured
- UX-11: desktop pricing row layout
- UX-12: FAQ merge and reorder
- UX-13: hero CTA hierarchy (needs data first)
- UX-14: named person
- UX-15: "what to have ready" on success
- UX-16: footer LinkedIn link

### Three highest-impact improvements

1. **UX-02: make the phone dock appear.** Local service owners will mostly arrive on phones from outreach. Right now no request button follows them down the page. It's a bug fix, needs no copy decisions, and restores an approved design.
2. **UX-01: script the after-request path.** Every sale goes through the reply and the proposal message. Today neither exists, and the first prospect would get improvised terms.
3. **UX-04 + UX-03: answer the subscription objections and remove the competing offer.**
   - A $75/month buyer's first questions are "when do I start paying?" and "do I own it?".
   - Meanwhile the header asks them to join an AI product's waitlist.
   - Both fixes are small.

## Engineering tickets

Apply each ticket only after its owner approval, where approval is marked as required. Keep each ticket a separate commit so it can be reviewed and reverted on its own.

### T-1: Portal the mobile dock (UX-02). Owner approval: no.

- **Files:**
  - `components/websites/PageChrome.tsx` (`MobileDock`)
  - `e2e/websites.spec.ts` (the dock test at line ~116)
- **Change:**
  - Wrap the dock in `createPortal(node, document.body)` behind a `mounted` state, so the server render returns `null`.
  - Leave the CSS and the show/hide logic unchanged.
  - Do not touch `.scroll-reveal-wrapper` in `app/globals.css`.
- **Acceptance:**
  - At 375×667 and 390×844, after `#why h2` scrolls into view, `dock.getBoundingClientRect().bottom` equals `innerHeight` (±1).
  - It still hides over the hero, `#preview`, the footer and the open menu.
  - Add the geometry assertion to the e2e test.
  - No hydration or console errors (the existing test).
  - axe shows 0 violations.

### T-2: Route-scoped header on `/services/websites` (UX-03). Owner approval: yes.

- **Files:** `components/Header.tsx`, both the desktop row (~L494–520) and the mobile menu (~L674–746).
- **Change:**
  - Use `usePathname()`. When it starts with `/services/websites`, don't render the launch CTA (`getPrimaryCta()`) or the "Pricing" link.
  - Option, if the owner prefers: replace the CTA with the existing `ctaClass` link "Free preview" pointing to `#preview`.
  - Every other route stays unchanged.
- **Acceptance:**
  - On `/services/websites` (desktop, and the mobile menu open) there are 0 links to `/waitlist` or `/pricing`.
  - `/`, `/pricing` and `/about` render the same header as before (DOM snapshot).
  - No layout shift at 1024 or 1440.

### T-3: Billing start and ownership copy (UX-04, UX-12). Owner approval: yes. Legal alignment: LGL-08, LGL-11.

- **Files:** `components/websites/WebsitesPage.tsx`:
  - the `pkgFoot` text
  - the `setupNote` passed to `faqs()`
  - `faqs()`: add "Do I own my website?", merge the two hosting questions, reorder per UX-12
- **Change:** copy from `WEBSITES_CONVERSION_OPPORTUNITIES.md` UX-04, adjusted to the final agreement wording. Prices still come from `formatUsd(starter.*)`.
- **Acceptance:**
  - Both facts are visible in `#packages` without interaction.
  - The FAQ has at most 10 items, with no repeated facts.
  - Update the `e2e` "Website Starter is the only offer" test if it asserts footer text.
  - Typecheck and unit tests pass.

### T-4: Form first on phones (UX-05). Owner approval: yes.

- **Files:**
  - `components/websites/WebsitesPage.tsx` (`#preview`): split the `stickyHead` column into a heading block and a details block (`nextList` and `emailBox`)
  - `components/websites/websites.module.css` (`formGrid`)
- **Change:**
  - Below 960px: heading block, then `InquiryForm`, then the details block.
  - At 960px and up: the same visual as today, with the heading and details in the left column.
- **Acceptance:**
  - At 375 and 390, `#f-name` top minus `#preview` top is ≤ 450px.
  - The desktop screenshot of `#preview` at 1440 matches today's.
  - DOM order equals visual order.
  - axe shows 0 violations.

### T-5: Showcase onto the s8 branch (UX-07). Owner approval: launch-mode choice.

- **Files:**
  - Port #37's changes onto s8: `lib/services/websites/flags.ts`, `gate.ts`, `app/services/websites/page.tsx`, `WebsitesPage.tsx`, `gate.test.ts`, `inquiry-route.test.ts`.
  - Resolve conflicts in favor of s8 copy.
- **Acceptance:**
  - All of #37's gate and route tests pass on the new base.
  - In `showcase` mode the page shows s8 copy ("Hosting included", the proposal step, "What happens after…").
  - The e2e suite passes in `nonproduction` mode.

### T-6: Showcase email request (UX-06). Depends on T-5. Owner approval: yes (copy).

- **Files:**
  - `components/websites/WebsitesPage.tsx` (showcase branch of `#preview`)
  - a new small client component in `PageChrome.tsx`, for example `EmailRequestLink`, that reads `useSelection()`
  - `lib/services/websites/submit-outcome.ts` (reuse `requestEmailHref`)
  - `DesignGallery.tsx` (`StyleSelectionNote` text when `intake` is false)
- **Change:**
  - Labelled body lines, plus the chosen style.
  - Showcase copy variants for step 1, the two FAQ lines, the "contact method" tick and the style note.
  - On phones, the request button comes before the email box.
  - Add a one-line "Or email us at {address}" under the button.
- **Acceptance:**
  - After a style is chosen, the `href` body contains `Style I liked: <label>`.
  - In showcase mode, 0 visible occurrences of "form" inside `.page`.
  - At 375 the button precedes `#email-addr`.
  - URL length is under 2,000 characters.
  - Unit test for the body builder.

### T-7: Message field prompt (UX-08). Owner approval: yes (copy).

- **Files:**
  - `components/websites/InquiryForm.tsx` (`f-msg` label and placeholder)
  - `lib/services/websites/form-rules.ts` (`FIELD_LABELS`, so the email fallback uses the new label)
- **Acceptance:**
  - The label reads "Your main services and the towns you serve (optional)".
  - The field stays optional.
  - The e2e field-order and fallback tests pass.

### T-8: Demo hosting (UX-10, with E-9 in #38). Owner approval: yes.

- **Files:** `lib/services/websites/demos.ts` (`url`), plus hosting outside the repo, or removal of the "View Live Demo" link in `DesignGallery.tsx`.
- **Acceptance:**
  - Every demo URL is on an Entrepreneuria-controlled host and returns 200, or there's no external link.
  - The zod schema still enforces `https://` and `fictional: true`.
  - Update the e2e demo test.

### Owner-only (no code): UX-01 playbook

- **Deliverables:**
  - reply template A
  - concept and proposal template B
  - onboarding checklist C
  - one test-mode dry run: request → reply → concept → proposal → GHL test payment → checklist

  Drafts are in `WEBSITES_CONVERSION_OPPORTUNITIES.md` UX-01.
- **Where:** in GHL snippets or the owner's mail, not this public repository.
- **Acceptance:**
  - All three are approved.
  - The B terms match the agreement and the LGL-03 order summary.
  - The dry run needs no improvised wording.
  - The concept delivery format (hosted link, image or PDF) is decided and written down.

## Suggested order

1. T-1. No approval needed; can start now.
2. Owner rulings on T-2, T-3, T-4, T-7 and the launch mode. One review session covers all of them.
3. T-2, T-3, T-4, T-7, then T-5 and T-6 if showcase launches first.
4. T-8 before outreach starts.
5. UX-01 playbook before the first proposal is sent.

## Assumptions and items for manual review

- **The s8 branch is the intended launch base.** It has no PR. If the owner intends to launch from the #28→#33→#34→#37 stack instead, apply UX-07 first.
- **Real-device check needed.** Results come from Chromium emulation. Before launch, check iOS Safari (dock safe area, `mailto:` with no mail account configured) and Android Chrome.
- **Demo reachability is unverified** (the sandbox egress proxy blocked it).
- **This repository is public.** Keep UX-01 templates that mention internal effort limits, capacity numbers or margins out of it.
- **No UI was changed by this audit.** Every UI change proposed above is marked in the "Owner approval" field.

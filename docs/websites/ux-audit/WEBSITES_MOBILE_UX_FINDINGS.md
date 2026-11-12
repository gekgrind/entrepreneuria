# Websites Starter: responsive and mobile UX findings

Audit date 2026-11-12.

## Setup

**Builds:**
- `review/ghl-s8-remediation@2a12dac` ("s8") in `nonproduction` mode, using the same env as `playwright.config.ts`
- `feat/websites-showcase-mode@d95e974` (PR #37) in `showcase` mode

Both ran on `next dev` (Turbopack) on localhost.

**Browser:** Playwright Chromium.
- 1440×900 and 1024×768 on desktop.
- 390×844 and 375×667 with `isMobile` and `hasTouch` set.
- Screenshots at 1× scale.
- **Not tested:** real devices, Safari/WebKit, or any production build.

## Artifacts to ignore in the evidence

| Artifact | Cause |
|---|---|
| Red "The verification check could not load" banner in the s8 form | The sandbox can't reach Cloudflare Turnstile. The fallback behaved correctly, so this is not a defect. |
| Round "N" badge at bottom left | Next.js dev-mode indicator |
| White strip at the top of some mid-page captures | Caught during the header's hide transition. A settled capture (`04`) shows no strip. Not a defect. |
| `preview@example.test` | Test inbox from the e2e config |

## Results by viewport

| Check | 1440 | 1024 | 390 | 375 |
|---|---|---|---|---|
| Horizontal overflow (`scrollWidth` vs `innerWidth`) | none | none | none | none |
| axe-core WCAG 2.2 AA (both builds) | 0 | not run | 0 | not run |
| Price visible on first screen | yes (H1 and offer card) | yes | yes (H1, setup line) | yes |
| Preview-request action fully on first screen | yes (sub-nav, hero link) | yes | yes (hero link) | **no**: link bottom at 694px (s8) and 670px (showcase) on a 667px viewport |
| Persistent request CTA while scrolling | sub-nav "Free preview" | sub-nav | **no: dock never on screen (UX-02)** | **no (UX-02)** |
| Distance from `#preview` to the first form field (s8) | 378px | — | **1,110px** | **1,110px** |
| Distance from `#preview` to submit (s8) | 1,189px | — | 2,338px | 2,338px |
| Competing header CTA "Join the Waitlist" (UX-03) | visible | visible | in menu | in menu |
| Page height (s8 / showcase) | 9,708 / 8,759 | 9,317 / 8,422 | 12,655 / 10,353 | 12,728 / 10,484 |

## Findings

### UX-02 (P1): the phone CTA dock never reaches the screen

- **Screen / component:**
  - `MobileDock` in `components/websites/PageChrome.tsx`
  - `.dock` in `components/websites/websites.module.css:425-439`
  - `.scroll-reveal-wrapper` in `app/globals.css:629-631`, which is on `main`
  - `<main>` in `app/RootClientLayout.tsx:183`
- **Current behavior:**
  - `.dock` is `position: fixed; bottom: 0`.
  - Its ancestor `<main class="… scroll-reveal-wrapper">` has `perspective: 1000px`. A non-`none` `perspective` makes that element the containing block for fixed descendants.
  - So the dock is pinned to the bottom of `<main>`, roughly 11,600px down the page, not to the bottom of the viewport.
  - When the IntersectionObserver logic "shows" it (`data-show="true"`, `aria-hidden="false"`, link `tabindex=0`), it is off-screen.
  - It's hidden again before the user can scroll to it, because the footer comes into view.
  - Net effect: phone visitors never see the approved sticky CTA.
  - Keyboard users can tab to an invisible control.
- **Evidence:**
  - s8 at 390×844, scrolled to Pricing and settled for 2.5s: dock `data-show="true"`, computed `position: fixed`, but `getBoundingClientRect().top` is 6,309px against an 844px viewport. Showcase gives 4,101px.
  - `evidence/04-s8-390-mid-page-no-dock.webp` shows the Pricing section with no dock.
  - The ancestor scan found only `MAIN.scroll-reveal-wrapper`, with `perspective: 1000px`.
  - The existing e2e test (`e2e/websites.spec.ts:116`) asserts attributes only, so it passes.
- **Proposed improvement:**
  - Render `MobileDock` through `createPortal(…, document.body)` after mount.
  - This is a client component, so render nothing on the server.
  - Don't remove `perspective` from the global wrapper: it is site-wide and may be relied on elsewhere.
  - No visual or copy change. This restores the approved design.
- **Acceptance criteria:**
  - At 390×844 and 375×667, after scrolling to `#why h2`, the dock's `getBoundingClientRect().bottom` equals `window.innerHeight` (±1px) and it is visible in a screenshot.
  - It still hides over the hero, `#preview` and the footer, and while the menu is open.
  - Add a geometry assertion to the existing e2e test.
  - The dock link is not focusable when hidden (unchanged).
  - No hydration warnings (the existing console test).
- **Complexity:** low.
- **Owner approval:** no. This is a defect fix that restores approved behavior.

### UX-05 (P1): on phones, the form starts more than a screen below every request CTA

- **Screen / component:** the `#preview` section in `components/websites/WebsitesPage.tsx` (`formGrid`: left column `stickyHead` holds the heading, lede, `nextList` and `emailBox`; the right column holds `InquiryForm`). The column order comes from `websites.module.css`.
- **Current behavior:**
  - Below 960px the columns stack. Every request CTA lands on `#preview`: hero link, preview strip, package card, "Start with step 1", final band, and the dock once UX-02 is fixed.
  - The visitor then reads the heading, a 4-line lede and three tick items, then sees an email box with its own "Open in my email app" link. Only after that does the first field appear, 1,110px down: about 1.7 screens at 375×667.
  - The secondary path (email) comes before the primary one (form).
- **Evidence:**
  - DOM probe (s8): `#preview` → `#f-name` is 1,110px at 375 and 390; 378px at 1440.
  - `evidence/05-s8-375-preview-section-before-form.webp`: the whole first screen after tapping a CTA, with no field visible.
- **Proposed improvement:** below 960px, show the heading and lede, then the form, then the tick list and email box.
  - Use a CSS `order` or `display: contents` change on the existing grid. No markup change is needed if the left column is split into two blocks.
  - Desktop is unchanged.
- **Acceptance criteria:**
  - At 375×667 and 390×844, `#f-name` top minus `#preview` top is ≤ 450px.
  - Desktop (≥960px) positions are unchanged (screenshot diff).
  - DOM order still matches visual order (no `order`-only reordering that breaks reading order; split the markup if needed).
  - axe stays at 0 violations.
- **Complexity:** low.
- **Owner approval:** **yes** (layout change on phones).

### UX-11 (P2): desktop, the single package card leaves most of its row empty

- **Screen / component:** `#packages` in `WebsitesPage.tsx`; `.pkgs.pkgsSingle` (max about 420px wide).
- **Current behavior:**
  - At 1024 and 1440 the one card sits on the left and the rest of the 1,200px row is empty.
  - The billing and terms note (`pkgFoot`) sits below the card, where it is easy to miss.
  - The space is unused at the very moment the buyer is reading the price.
- **Evidence:** `evidence/06-s8-1440-single-card-empty-row.webp`.
- **Proposed improvement:** at ≥960px, place `pkgFoot` beside the card as a short "How billing works" list:
  - setup when you accept
  - monthly from launch
  - one-month minimum
  - you own your domain and content

  This uses existing type and tick styles, and the copy from UX-04.
- **Acceptance criteria:** at 1440 and 1024 the card and the terms column share the row. Phones are unchanged. No new tokens or components.
- **Complexity:** low.
- **Owner approval:** **yes** (layout).

### Showcase-only mobile notes (covered in UX-06)

- At 375 the showcase request button appears *after* the "Prefer email? Ask a question directly" box and its own `mailto:` link (`evidence/08`). There are two email actions, and the secondary one comes first.
- On desktop the button floats alone at the top of an empty right column (`evidence/07`).

## What is working (keep)

- No horizontal overflow at any tested width. The s8 hero overflow guard e2e covers the real font.
- The gallery switches to ARIA tabs below 1000px; tabs are 52px tall.
- Buttons are at least 52px tall (the dock button 48px). The only control under 24px is the inline "Privacy Policy" link (82×17), which is acceptable for an inline text link under WCAG 2.5.8.
- Fine print contrast is about 7.4:1.
- On phones the setup fee and "Hosting included" sit directly under the H1, so the price is never shown without its setup fee.

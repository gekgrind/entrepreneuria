# Website template gallery: inventory, salon status, open items

Updated 2026-11-17, after the owner's review of PR #47. Branch `claude/sleepy-planck-5vk71j`. Draft. Not merged, not deployed.

## Owner decisions (2026-11-17)

| Decision | Status |
|---|---|
| Gallery architecture and layout | **Approved** |
| Gallery copy, including "Gilded Editorial" for Aurelle | **Approved** |
| GHL AI Studio is the source of truth for demo and customer websites | **Approved** |
| Clone reusable AI Studio projects for customer delivery | **Approved, subject to** verifying real hosting costs and account limits (GHL-DELIVERY-ASSESSMENT) |
| Handyman templates, launch gates, disabled intake, payment restrictions | Unchanged (required) |
| Salon visitors kept away from home-service messaging, without changing CRM business types or style ids | Done (§2) |
| Aurelle corrections | GHL AI Studio work: brief in §4; screenshots refreshed after the fix |
| CALA NOIR and the third salon demo | Owner is building them in AI Studio. They enter the registry once URLs and screenshots exist. **No replacement designs are built here.** |
| Plan upgrades, customer sub-accounts, DNS, intake, payments | Not done, and not to be done |

## 1. What was built

| Route | What it shows |
|---|---|
| `/services/templates` | Directory of industries with at least one published design, then the free-preview CTA and the offered price |
| `/services/industries/handyman` | The three approved handyman demos |
| `/services/industries/salons` | Aurelle |

**Registry.** `lib/services/websites/templates.ts` (zod-validated):

- Handyman entries are **derived from `demos.ts`**, so their copy, URLs, screenshots and style ids cannot drift.
- Only `status: "published"` renders. Publishing requires an https URL, both screenshots and `verifiedOn`.
- An industry page exists only while it has a published design.

**Gating.** Both routes use `resolveWebsitesPageAccess`, the same gate as `/services`, and return 404 wherever it does. They render no form and never call the inquiry route. They are `noindex`. No flag, mode, payment or intake setting changed.

**Unchanged.** `demos.ts`, `styles.ts`, `content.ts` (`BUSINESS_TYPES`), the Services page and its gallery, the six handyman screenshots, every gate and flag, the inquiry route.

**Tools.**

- `npm run templates:verify` checks every published demo link: HTTP 200 and the business name present.
- `npm run templates:capture -- <id> <url>` writes a template's two screenshots at the approved spec. It refuses the three handyman ids.

## 1a. Industry pages as a stacking portfolio deck (2026-11-19)

Each industry page presents its designs as a deck of large website cards. As the visitor scrolls, each card pins under the header, the next one slides over it, and the earlier card recedes (scale 96%, darkened), leaving its tab row (index, business name, design) visible as a layered stack. Reference studied: the "Our Work" stack on ghlprime.com/industries/entrepreneurs (sticky cards at 96px + 22px steps, JS-driven `scale` 1 → 0.93, no darkening). Behaviour was adapted, not copied; visual design is Entrepreneuria's.

| Piece | File |
|---|---|
| Deck (server component, no client JS) | `components/websites/templates/TemplateDeck.tsx` |
| Deck geometry and animation | `components/websites/templates/deck.module.css` |
| Industry filter pills | `IndustryNav` in `GalleryParts.tsx` |
| E2E (5 viewports) | `e2e/websites-gallery-deck.spec.ts` |

**How it works.** Pure CSS. Every card is `position: sticky` at `header + 16px + min(i, 3) × 64px`. The recede is a scroll-driven animation on one `view-timeline` on the list; each card's range is computed in CSS from the card height, gap and peek, so it starts when the next card reaches its bottom edge and ends exactly when that card pins. Stacking depth is capped at three peeks, so long collections keep their cards large. The whole stack releases together when the list ends, with no trailing space. With no scroll listeners or state, nothing can leak or go stale across filter changes, resizes or back navigation; the deck is also keyed by industry.

**Who gets what.**

| Condition | Presentation |
|---|---|
| 2+ designs, 1000px+ wide and 700px+ tall, or 768px+ wide and 900px+ tall, motion allowed | Stacking deck; recede where scroll-driven animations are supported (Chrome/Edge 115+, Safari 26+, Firefox 159+); plain stacking elsewhere (decorative only, no JS fallback) |
| Phones, short screens, 768–999px under 900px tall | Plain vertical list, same content |
| `prefers-reduced-motion: reduce` | Plain list: no pinning, scaling or shading |
| One design (salons today) | One full card, no stack |

**Accessibility.** Semantic `ol` of `article`s with headings; keyboard focus inside a covered card brings that card to the front at full size and brightness; CTAs keep visible focus; the preview link is `aria-hidden` with `tabindex=-1` (the CTA is the accessible link), as on the Services page; desktop shot alt is empty (the heading names it), phone shot alt names the business.

**Copy.** "Explore Live Demo" (owner brief, replaces "View Live Demo" in the gallery only); everything else is approved registry copy. The card shows business name, industry, design name (the descriptor), the one-line position and the CTAs; the longer description and palette swatches are no longer shown.

## 2. Keeping salon visitors off home-service messaging

**Problem.** `/services` is written for home-service businesses: the hero kicker "Built for local service businesses", the trust bar "Made for home-service businesses", the "Why a better website" trades, and `BUSINESS_TYPES`. The first build of the salon page linked there three ways: the breadcrumb, "View Pricing" and (for the Services form) the preview CTA.

**Fix: the smallest one that needs no CRM change.** One rule in `templates.ts`:

> `servicesPageFits(industry)` is true only when the industry has an approved inquiry `businessType`.

Where it is false (salons today), the industry page never links into `/services`:

| Element | Handyman (fits) | Salons (does not fit) |
|---|---|---|
| Breadcrumb | Services / Website examples / Handyman | Website examples / Hair salons |
| "Request a preview in this style" | `/services?style=…&type=…#preview` | Prefilled email naming the design |
| Closing "Request My Free Website Preview" | `/services?type=…#preview` | Prefilled email ("Type of business: Hair salons") |
| Closing secondary button | "View Pricing" → `/services#packages` | "Ask a Question by Email" (existing approved label). The price is already stated inline. |

The rule follows the data: once the owner approves a salon business type, the salon page starts using the Services form automatically. Tests assert that the salon page produces **no** `/services` link and that the handyman links are exactly as before.

**Not covered (by design, see §6 R1 and R2):** the global header's "Services" link, and the directory page `/services/templates`, which serves every industry and keeps its `/services` links.

## 3. Template inventory (link check 2026-11-17)

| Industry | Template | Design | Live demo | Link | Screenshots |
|---|---|---|---|---|---|
| Handyman | Red Clay Handyman Co. | Local Professional | `preview-1793923076658549724.vibepreview.app` | 200, name found | approved originals (D-01), unchanged |
| Handyman | Porch Light Handyman | Neighborhood Pro | `preview-1793924044171507186.vibepreview.app` | 200, name found | approved originals (D-01), unchanged |
| Handyman | Ashford & Pine Carpentry | Modern Craftsman | `preview-1793936518728832266.vibepreview.app` | 200, name found | approved originals (D-01), unchanged |
| Salons | Aurelle Salon | Gilded Editorial | `preview-1794740742139640803.vibepreview.app` | 200, name found | captured 2026-11-16, **pre-correction**; refresh after §4 |
| Salons | CALA NOIR | none yet | none yet | none | none: no registry entry |
| Salons | Third salon (Spoke & Weal structure) | none yet | none yet | none | none: no registry entry |

All demos are AI Studio projects on `vibepreview.app` preview domains, with images on `vibe.filesafe.space`.

## 4. Aurelle correction brief (GHL AI Studio work)

These changes are made in the Aurelle AI Studio project, not in this repo. Live status was re-checked on 2026-11-17: **none has been made yet.**

| # | Change in AI Studio | Done when |
|---|---|---|
| A1 | **Replace the mismatched photos.** The image used for the "Color" step and for stylist "Nadia Brooks" is the same file (`52259809…jpg`): a male barber in a face mask. The lavender-hair image appears three times, once with alt text saying "copper color". Five image files are used more than once. Choose one art direction (warm, close, color-forward) and confirm the license for every photo. | Each stylist photo matches the stylist's name. No image file is used twice. Every alt text describes its own photo. |
| A2 | **Hero contrast.** Darken the photo overlay, or put the copy on a solid field. | The lede, eyebrow and header phone number reach at least 4.5:1 at 1440 and 390 px. |
| A3 | **Clipped headline.** The H1 line masks use `overflow: hidden` and cut the descenders of "Beauty," and "gilded.". | The "y" and "g" tails are fully visible, during and after the reveal. |
| A4 | **Mobile disclaimer bar.** At 390 px the "fictional business" bar wraps to two lines, and the second line overlaps the logo row. | One line at 390 px, or the header sits below the bar without overlapping. |
| A5 | **Remove the "Studio note".** It names HighLevel and promises integrations (Vagaro, Boulevard, GlossGenius, Square, Fresha) plus automatic confirmations and reminders, which the commercial spec treats as unverified. | No platform or competitor names and no unverified feature promises in visible copy. |
| A6 | **Caption contrast.** Small grey captions on near-black throughout. | At least 4.5:1. |

**After the fix (repo side):**

1. Run `npm run templates:verify` (expect 4/4 pass).
2. Run `npm run templates:capture -- aurelle https://preview-1794740742139640803.vibepreview.app/`. In a container without Playwright's own browser, set `CHROMIUM_PATH`.
3. Look at both WebPs, then set Aurelle's `verifiedOn` to that day.
4. Run `npm test` and commit. If the project's URL changes (for example, to an owned domain), update `url` in the same commit.

## 5. CALA NOIR and the third salon demo

Both are being built in AI Studio by the owner. **Nothing is built or registered for them here.** Adding each one is a data change:

1. Publish the AI Studio project and share the URL.
2. Run `npm run templates:capture -- <id> <url>`, with a lowercase-letters id such as `calanoir`.
3. Add an entry to `RAW_TEMPLATES` in `templates.ts`: `industry: "salons"`, `status: "published"`, `url`, `verifiedOn`, design name, business name, position, description and palette. Copy needs owner approval, as Aurelle's did.
4. Run `npm test` and `npm run templates:verify`. The salons page then shows "Design 01 of 02" (and later "of 03") with no code change. The salon CTA rule from §2 applies automatically.

**Two checks before adding them**, so the salon page shows three distinct options rather than one design three times:

- **CALA NOIR next to Aurelle.** Aurelle is already near-black, gold, serif-led and editorial. If CALA NOIR is also dark ("noir"), it needs to differ clearly in layout, type and the business model it is pitched to. A palette change alone won't read as a different option.
- **The third demo next to Aurelle.** Spoke & Weal's public positioning (consultation-led, color-director-led, published price ranges) is close to Aurelle's. Borrowing its *structure* (team, stylist levels, locations) is the differentiator. Its mood is not.

As with every template, both stay fictional: no real salon's name, copy or photos.

## 6. Remaining issues

| # | Issue | Owner decision? |
|---|---|---|
| R1 | **The directory page links to `/services`** (breadcrumb, preview CTA, View Pricing). A salon visitor who goes from the salon page to "Website examples" and then to the general CTA lands on home-service copy. It is two clicks away and not the page prospects are sent. Fix with R3. | — |
| R2 | **The global header "Services" link** goes to `/services` from every page, the salon page included. It was not changed: it is site navigation outside this PR. | — |
| R3 | **The proper fix for R1 and R2:** generalize the Services page copy (hero kicker, trust bar, examples heading, WHY list) for local businesses broadly, or add `Hair salon or beauty` to `BUSINESS_TYPES` and salon style ids to `styles.ts`. Both are outside this PR. The second changes CRM values and GHL mappings (D-09, D-10). | **Yes** |
| R4 | Aurelle corrections A1–A6 (§4), then a screenshot refresh. | GHL work |
| R5 | **Demo hosting.** All demos are on `vibepreview.app` preview domains. Moving them to owned subdomains needs DNS, which this PR does not touch. | **Yes**: DNS |
| R6 | No link from `/services` or the header into the gallery. Adding one changes an approved page. | **Yes** |
| R7 | `templates:verify` needs network, so it is not in CI. Run it before each release, or on a schedule. | No |
| R8 | **Independent Codex review** of this PR is required before it leaves draft. | Process |
| R9 | **Not this PR's:** `next build` with the installed Next.js 16.4.3 now stops after compiling with `SecurityFatalError`, a Next.js advisory check, and suggests `next upgrade --agent=security`. A retry completes the build with every route. It affects `main` equally. A dependency upgrade is outside this PR's scope and was not run. | **Yes**: separate upgrade PR |

## 7. Verification (2026-11-17)

- `tsc --noEmit`: 0 errors. ESLint on changed paths: 0 problems. `next build`: passes on retry after the Next.js advisory stop (R9).
- `npm test`: **1018/1018 pass**.
- Deck (2026-11-19): `e2e/websites-gallery-deck.spec.ts` 31 passed, 4 skipped (stack-only checks on phone viewports) across 375×667, 390×844, 768×1024, 1024×768 and 1440×900. Also measured: recede timing at 1440×900 and with a temporary 9-card collection (reverted), CTAs inside cards at 8 viewport sizes, focus into a covered card, client-side filter switch, back navigation and live resize. `templates.test.ts` has 10 tests, including the §2 rule: salons produce no `/services` link, handyman links are unchanged, and a styled template in a non-fitting industry falls back to email.
- Showcase-mode dev server: `/services/templates` and `/services/industries/{handyman,salons}` → 200. Unknown industry → 404. Disallowed host → 404. Inquiry route → 404.
- `templates:verify`: 4/4.
- `templates:capture`: refused `redclay` (exit 2). Wrote both Aurelle files at 1440×900 and 390×844 in a dry run, which was then reverted, because Aurelle is not corrected yet.

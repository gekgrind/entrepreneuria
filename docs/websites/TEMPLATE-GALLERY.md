# Website template gallery: inventory, salon review, next designs

Updated 2026-11-16. Branch `claude/sleepy-planck-5vk71j`. Not merged, not deployed.

## 1. What was built

| Route | What it shows |
|---|---|
| `/services/templates` | Directory of industries that have at least one published design: count, screenshots, link to the industry page, then the free-preview CTA with the offered price. |
| `/services/industries/handyman` | The three approved handyman demos as large rows (desktop and phone screenshots, description, palette, Live Demo, Request a preview in this style). |
| `/services/industries/salons` | Aurelle, in the same layout. |

**Data.** `lib/services/websites/templates.ts` is the registry (zod-validated at import):

- `INDUSTRIES` holds slug, name, headline, intro, and the approved inquiry `businessType` when one exists.
- `WEBSITE_TEMPLATES` holds every template. The handyman entries are **derived from `demos.ts`**, so their copy, URLs, screenshots and style ids are not duplicated and cannot drift.
- Only `status: "published"` templates render. The schema refuses to publish a template without an https URL, both screenshots and a `verifiedOn` date.
- An industry page exists only while its industry has a published template. Unknown slugs return 404.

**Gating.** Both routes call `resolveWebsitesPageAccess`, the same gate as `/services`. They return 404 wherever the Services page does. Neither route renders a form or calls the inquiry route. Showcase mode, `WEBSITES_SERVICES_MODE`, payments and intake are unchanged. The pages are `noindex`, like `/services`.

**Personalized-preview action.**

| Template has | Action |
|---|---|
| An approved `styleInterest` (all handyman designs) | `/services?style=<id>&type=<business type>#preview`. The existing page already reads both params, in intake and showcase modes. |
| No style id (Aurelle) | A prefilled `mailto:` built with the existing `requestEmailHref`, naming the design. The inquiry form has no salon style or business type, and adding one changes CRM values (see §6). |

**Verification.** `npm run templates:verify` fetches every published demo URL and requires HTTP 200 plus the business name in the HTML. In this sandbox, Node needs `NODE_USE_ENV_PROXY=1` to use the proxy.

**Not changed.** `demos.ts`, `styles.ts`, the Services page, its gallery, the six handyman screenshots, every gate and flag, and the inquiry route.

## 2. Template inventory (verified 2026-11-16)

| Industry | Template | Design name | Live demo | Link check | Screenshots |
|---|---|---|---|---|---|
| Handyman | Red Clay Handyman Co. | Local Professional | `preview-1793923076658549724.vibepreview.app` | 200, name found | approved originals (D-01) |
| Handyman | Porch Light Handyman | Neighborhood Pro | `preview-1793924044171507186.vibepreview.app` | 200, name found | approved originals (D-01) |
| Handyman | Ashford & Pine Carpentry | Modern Craftsman | `preview-1793936518728832266.vibepreview.app` | 200, name found | approved originals (D-01) |
| Salons | Aurelle Salon | Gilded Editorial *(new name, needs approval)* | `preview-1794740742139640803.vibepreview.app` | 200, name found | **new**: captured 2026-11-16 at 1440×900 and 390×844, 1x, WebP q80 |
| Salons | *(Minor Rose-inspired)* | not built | none | none | none: no registry entry |
| Salons | *(Spoke & Weal-inspired)* | not built | none | none | none: no registry entry |

Aurelle screenshot sha256: desktop `b051c7355d9e165b…`, mobile `c44c99ec4ffc17b0…`.

All four demos are GHL AI Studio projects on `vibepreview.app` preview domains, which load images from `vibe.filesafe.space`. **Preview domains are not a permanent home**: put each demo on an owned domain before outreach, for example `aurelle.demos.entrepreneuria.io` (§6).

## 3. Aurelle: what works, what to fix before showing it to a prospect

**Works.** Restrained palette (near-black, soft gold, cream) with a clear serif/sans pairing (Cormorant Garamond + Jost). The service menu shows real starting prices, which salon guests look for first. There is a free-consultation promise, an extension section, an FAQ, booking, and a phone call/book bar that stays on screen. The page has no horizontal scroll at 390px, and content renders with reduced motion.

**Fix, in priority order** (all verified in the captures):

1. **Photography contradicts the positioning.** The "Color" step photo shows a male barber in a face mask, which reads as barbershop and dates the site to 2020. The same photo is reused as stylist "Nadia Brooks", so a woman's name sits on a man's photo. One lavender-hair shot appears three times, once with alt text saying "copper color". The hero is a grayscale industrial interior on a site selling dimensional color. Each issue alone undermines credibility, and together they make the site look assembled rather than designed. Use one consistent art direction (warm, close, color-forward), with no reuse, and alt text that matches each image. Confirm the license for every photo.
2. **Hero contrast.** The overlay is too light behind the bright windows. The lede, eyebrow and header phone number fail contrast on desktop and are close to unreadable on mobile. Darken the overlay, or put the copy on a solid field.
3. **Clipped descenders.** The H1 line masks use `overflow: hidden`, which cuts the tails of "y" in *Beauty* and "g" in *gilded*. Add bottom padding to the mask, or remove the clip once the reveal animation ends.
4. **Mobile disclaimer bar collides with the header.** At 390px the "fictional business" bar wraps to two lines and its second line overlaps the logo row. Shorten it ("Design sample · fictional business") or let the header sit below the bar.
5. **The "Studio note" box is sales copy inside a demo.** It names HighLevel and promises integrations with Vagaro, Boulevard, GlossGenius, Square and Fresha, plus automatic confirmations and reminders. The commercial spec treats those features as unverified (PAGE-BUILD-NOTES A1–A9). Remove it from the demo, and decide separately whether any of it belongs in the package.
6. Small grey caption text on near-black throughout. Raise it to at least 4.5:1.

## 4. Salon designs 2 and 3: what makes each one different

Aurelle covers the **high-ticket, consultation-led color and extension salon**: dark, editorial, luxe. Salons 2 and 3 should differ from it in **business model and structure**, not just palette. Otherwise the gallery shows one salon three times.

Two warnings about the inspiration:

- **Spoke & Weal overlaps Aurelle.** Its public positioning is consultation-led, color-director-led, with published price ranges. A build that copies its look will read as "Aurelle, but light". Take its *structure* (team, multiple locations, stylist levels), not its mood.
- Use both sites for principles only. Use no names, copy, photos or layouts, and keep the businesses fictional. I did not inspect either live site: the sandbox only reaches allow-listed hosts. These directions come from public descriptions (Wallpaper* on Minor Rose's interior; Spoke & Weal's own services and about pages).

| | Aurelle (built) | Salon 2: Minor Rose-inspired | Salon 3: Spoke & Weal-inspired |
|---|---|---|---|
| Buyer | Established color/extension salon, high ticket | Small modern studio or suite (1–4 chairs), precision cut and color | Team salon with 5–15 stylists, possibly a second location |
| Promise | "Consult first, clear price" | "See the menu, book in two taps" | "Find the right stylist for you" |
| Hero | Full-bleed photo, oversized serif headline | **No photo hero.** Service picker and next open times above the fold | Stylist grid as the hero ("Meet the team"), with a booking CTA on each stylist |
| Palette | Near-black, gold, cream | Bone white, stone grey, brushed steel, one ink accent | Warm light ground with a saturated berry or oxblood accent (**not** cream and terracotta, which belong to Porch Light) |
| Type | High-contrast serif + geometric sans | Grotesk sans only, tight grid, tabular prices | Rounded or humanist sans for body, a friendly display face |
| Structure | Long scrolling editorial page | Short single page: menu, booking, location | Team → levels pricing (New Talent / Senior / Master) → reviews → locations |
| Proof | Transformations gallery | Interior and detail photography | Reviews by stylist, before/after per stylist |

**Why this mix.** A $75/month buyer is more often a small studio or team salon than a luxury color house. Salons 2 and 3 are the likelier sales, so build salon 3 (team salon) next if only one more design can be prioritized.

**Same rules for both:** a fictional business, a "fictional" bar that doesn't wrap at 390px, a photo set with one art direction and licensed images, booking connected to a GHL calendar only once that feature is a verified package entitlement, and no platform or competitor names in visible copy.

## 5. Adding salon 2 and 3 to the gallery (a data change, not a code change)

1. Publish the AI Studio project (ideally on an owned demo subdomain) and send the URL.
2. Capture `demo-<id>-desktop.webp` (1440×900) and `demo-<id>-mobile.webp` (390×844), 1x, after fonts and images load, into `public/marketing/websites-demos/`.
3. Add an entry to `RAW_TEMPLATES` in `templates.ts` with `industry: "salons"`, `status: "published"`, the URL, `verifiedOn`, copy and palette.
4. Run `npm test` and `npm run templates:verify`. The salons page shows the new design, numbered "Design 02 of 02", with no other change.

## 6. Outstanding dependencies for Claude Engineering

| # | Item | Owner decision? |
|---|---|---|
| E1 | **Salon intake values.** Add `Hair salon or beauty` to `BUSINESS_TYPES` and salon style ids to `styles.ts`, so Aurelle can prefill the form instead of using email. This changes CRM values and GHL tags, and needs the GHL `business_type`/`style_interest` mapping updated (D-09, D-10). | **Yes**: changes customer-delivery data |
| E2 | **Services page copy is home-service only** (trust bar "Made for home-service businesses", the WHY list, BUSINESS_TYPES). A salon prospect sent to `/services` reads that it isn't for them. Either generalize the copy or keep sending salon prospects to `/services/industries/salons`. | **Yes**: approved copy |
| E3 | Link the gallery from the Services page ("Browse designs by industry") and the header. Not done, because it would change the approved page. | Yes |
| E4 | Move the demos off `vibepreview.app` to owned subdomains, then update the URLs (D-01 "demo hosting" blocker). | Yes: DNS |
| E5 | Aurelle fixes in §3 (in AI Studio), then re-capture its screenshots. | No |
| E6 | Copy review: "Gilded Editorial", Aurelle's position and description lines, the industry headlines and intros, and the directory title. These are new; everything else on the pages reuses approved strings. | Yes: wording |
| E7 | Run `templates:verify` in CI or on a schedule (it needs network), so a demo GHL unpublishes is caught. | No |

## 7. Verification (2026-11-16)

- `tsc --noEmit`: 0 errors. ESLint on changed paths: 0 problems.
- Unit tests: see the PR. `templates.test.ts` adds 7 tests: registry contents, handyman parity with `demos.ts`, screenshots on disk, published-only industries, preview actions, and schema publishing rules.
- `next dev` in showcase mode on an allow-listed host: `/services/templates`, `/services/industries/{handyman,salons}` → 200. `/services/industries/plumbers` → 404. Disallowed host → 404 on both routes. Inquiry route → 404 (intake still closed).
- Playwright at 1440×900 and 390×844: no horizontal scroll, one `h1` per page, no broken images, no console errors.
- `npm run templates:verify`: 4/4 demo links pass.

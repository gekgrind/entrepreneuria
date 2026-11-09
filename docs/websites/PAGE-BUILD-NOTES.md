# /services/websites: production build notes

Source design: `docs/websites/design/websites-page.sprint2.html`, the approved Sprint 2 file copied unmodified. Its sha256 (`ed1e7a6d5ac86d51…`) and the six WebPs' hashes were verified against DECISION-REGISTER D-01 before and after copying.

## Where things live

| Piece | File |
|---|---|
| Route (server, runtime-gated, `noindex`) | `app/services/websites/page.tsx` |
| Sections (server-rendered) | `components/websites/WebsitesPage.tsx` |
| Gallery and tabs, live style note | `components/websites/DesignGallery.tsx` |
| Sub-nav, mobile dock, package links, copy button | `components/websites/PageChrome.tsx` |
| Gallery ↔ form shared state | `components/websites/SelectionContext.tsx` |
| Inquiry form (react-hook-form, Sprint 2 rules and copy) | `components/websites/InquiryForm.tsx`, `lib/services/websites/form-rules.ts` |
| Demo registry (zod, fictional-only) | `lib/services/websites/demos.ts` |
| Styles (Sprint 2 CSS on repo tokens) | `components/websites/websites.module.css` |
| Assets (original captures, unmodified) | `public/marketing/websites-demos/demo-{id}-{desktop,mobile}.webp` |

All prices come from `lib/services/websites/packages.ts` via `formatUsd`. The form posts to the existing `/api/services/websites/inquiry` intake.

## Release gating

- The page calls `notFound()` and the API returns 404 unless `WEBSITES_SERVICES_MODE=nonproduction`, the request `Host` is listed in `WEBSITES_NONPRODUCTION_HOSTS` (production hosts never qualify), and `WEBSITES_IP_HASH_SALT`, `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are set (`resolveRequestServicesGate` in `flags.ts`). Production mode is refused while any §11 gate is open. Nothing here changes a production flag.
- `robots: noindex, nofollow`.

## Deviations from the approved Sprint 2 design

### A. Content removed to satisfy the commercial spec

These are removals, not rewrites: no new marketing copy was written. Each one returns as a data or policy change once approved.

| # | Sprint 2 content | Why removed | Comes back when |
|---|---|---|---|
| A1 | Hero offer panel: four ✓ lines (mobile-friendly site, contact form, hosting and maintenance, follow-up tools) | Package entitlements are VERIFY (spec §2, §7) | Entitlements marked `verified` in `packages.ts` (they render automatically) |
| A2 | Package card blurbs and "Includes / Everything in …, plus" feature lists, including the † features | Same; the † features are unverified GHL capabilities | Same |
| A3 | † footnote ("Set up and tested before launch…") | Describes unverified features | Same |
| A4 | "Compare packages side by side" toggle and table | Feature rows unverified; price-only rows would duplicate the cards | A verified feature matrix exists |
| A5 | Packages lede, 2nd sentence: "Start with a website and add follow-up tools as your business grows." | Unverified follow-up tools | Follow-up tools verified |
| A6 | Why Entrepreneuria → "Grow when you are ready" item (lead capture, follow-up). The grid now has 2 columns. | Unverified services | Services verified |
| A7 | Why Entrepreneuria → "Professionally managed": removed "We build your website and look after its hosting and routine maintenance, within the scope of your package." The heading and "You do not have to learn a website builder." remain. | Hosting and maintenance scope is PROPOSED/VERIFY (spec §7) | §7 approved |
| A8 | Whole section 6, "More than just a website" (7 services, AI receptionist, link to `/services/automation`) | Unverified services, and `/services/automation` doesn't exist (404) | Services verified and the Sprint 3 page exists |
| A9 | FAQ "What is included in the monthly price?" | Hosting, maintenance and higher-tier tools are unverified | Entitlements verified |
| A10 | FAQ "Do I need to understand technology?": removed the middle sentence "We handle the setup, hosting and routine maintenance." | §7 | §7 approved |
| A11 | Form: "Text message" contact option and the SMS consent checkbox | SMS consent wording is under legal review (spec §9). The server also rejects `contact_method: "text"` and `sms_consent: true` until `sms_consent` is approved. | `policies.ts` → `sms_consent: approved` (the option and checkbox render automatically) |
| A12 | Form fine print "We will use your details to respond to this request." | Privacy notice under legal review (§9). The "See our Privacy Policy." link remains. | `privacy_notice: approved` |
| A13 | Package select option "Follow-up and automation services" | Unverified service | Service verified |

### B. Production integration (expected by the handoff)

| # | Change |
|---|---|
| B1 | The prototype header, mobile nav and footer are replaced by the global `Header` and `Footer`. The page sub-nav is a desktop-only second sticky row that tucks to `top: 0` when the global header auto-hides. |
| B2 | Removed the `data-proto` form note, `window.__simOutcome`, the placeholder-link toast, and the prototype "Local Growth" brand suffix. |
| B3 | The SVG sprite icons are replaced by `lucide-react` equivalents (Check, ArrowRight, ExternalLink, Plus, AlertCircle). |
| B4 | Turnstile renders above the submit button when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set (it wasn't in the prototype). The server always enforces it (with a 5 s timeout, and hostname and action checks); without `TURNSTILE_SECRET_KEY` the route is off. |
| B5 | The success state appears only after the intake returns `ok: true`. The error banner covers network errors, 429, 5xx and Turnstile failure. Server field errors map onto fields and the summary. |
| B6 | Package card buttons are `?package=<id>#preview` links (they work without JS). With JS they set the package, scroll to the form and focus "Your name", as in the design. |

### C. Fixes the Sprint 2 QA could not catch (it ran on fallback fonts)

| # | Issue found with real fonts | Fix |
|---|---|---|
| C1 | The hero "Starting at $75/month." was kept unbroken. With Playfair it ran past the viewport at 375/390px (clipped) and overran its column at 960–1100px. | Only "$75/month." stays unbroken; "Starting at" may wrap. Verified it fits at 375, 390, 960, 1024, 1100 and 1440. |
| C2 | globals.css forces `span/li/a` to the body face (@layer base) and `label` to DM Mono (unlayered), so the hero price rendered in DM Sans and the form labels in mono. | Module-scoped `font-family: inherit` for span/li/a and DM Sans for labels, restoring the design's type. |

### D. Not implemented from the handoff

- **Analytics events** (hero CTA, demo click, tab change, style toggle, package request, form start, success, error). `@vercel/analytics` is a dependency, but `<Analytics />` isn't mounted anywhere in the app, so `track()` would be a no-op. Left for a separate decision.
- **`components/ui/tabs` and `components/ui/accordion`**: not used. The gallery needs all cards visible with no tab roles at ≥1000px and no-JS, which Radix Tabs can't express. The FAQ uses native `<details name="faq">`, which is exclusive, works without JS, and is what Sprint 2 specified. The form uses native controls styled to the approved paper form rather than the shadcn inputs, which have a different look.

### E. Copy not in the Sprint 2 file (minimal, functional)

| # | Text | Why |
|---|---|---|
| E1 | `<title>` "Professional websites for local businesses \| Entrepreneuria"; meta description "Request a free, personalized website preview inspired by your business, services and preferred style. No purchase or commitment required." | Sprint 2 had only a prototype title. Both are assembled from approved H1 and preview-strip copy; no new claims. |
| E2 | Phone help: "Only used if you choose phone below." (was "text or phone") | Follows from A11: there's no text option while SMS is unapproved. It reverts automatically when SMS is enabled. |
| E3 | Banner: "Please complete the verification check. / It sits just above the send button. Your answers are still here." | Turnstile wasn't in the prototype (B4). |
| E4 | Server error for text contact: "Text messages are not available yet. Please choose email or phone." | Defence in depth for A11. Not reachable from the UI. |

### F. Contract change to the committed intake

`inquiry-schema.ts` `package_interest` now also accepts `"unsure"` (the design's "Not sure yet" option). The CRM note shows "not sure yet", and no `pkg-*` tag is added. **VERIFY:** if the GHL `package_interest` custom field is a picklist, add an "unsure" option.

## Browser regression record (local dev, 2026-11-07, Chromium in the app's browser pane, real fonts)

The local run used `WEBSITES_SERVICES_MODE=nonproduction` via a git-ignored `.env.development.local`, which was deleted afterwards. Turnstile was disabled locally after confirming its client gate blocks submission; I can't complete the challenge.

- **Layout at 1440, 1024, 800, 390 and 375:**
  - no horizontal overflow; all 6 images load
  - three cards from 1000px up, tabs below with one panel
  - sub-nav from 960px up; dock hidden from 760px up, 48px tall on phones
  - the hero price fits its column at 375, 390, 960, 1024, 1100 and 1440 (C1)
- **Gallery:**
  - style toggles and the form select stay in sync both ways
  - "Not sure yet" clears the toggles; the polite note announces the chosen style
  - tab keys work (arrows with wrap, Home, End) with roving tabindex
- **Prefill:**
  - `?package=`, `?style=` and `?type=` prefill the form
  - package cards set the package, scroll and focus "Your name"
  - FAQ panels are exclusive
- **Dock:**
  - hidden over the hero, form and footer
  - shown over examples, packages and FAQ
  - hidden while the global menu is open
  - Observation (existing global behaviour, not this page): opening the mobile menu resets scroll to the top. Verify on a device.
- **Form:**
  - the empty-submit summary is focused and lists 5 items in the approved copy; `aria-invalid` and `aria-describedby` are wired, and summary links focus their field
  - the phone requirement follows the contact method, and errors clear while typing
  - with no store or CRM configured, the real server's 503 shows the banner, focuses it, and keeps every entry including style, package and toggle
  - a mocked 400 shows field errors in the summary; mocked 429 and network failure show the banner
  - a mocked 200 shows the busy state, then success, focused, with the right follow-up wording
  - the request body carries `style_interest`, `package_interest`, a UUID idempotency key, `page_url` and UTMs, and nothing extra
  - "Send another request" clears everything, including the toggles, and focuses the name field
- **API (local):** 503 when unconfigured; 200 quietly for the honeypot; 400 for an unknown style, text contact, extra keys or malformed JSON; 413 when oversized; 405 for GET.
- **Gate:** with the services mode at its default (off), `/services/websites` returns **404** and the API returns **404**.
- **Accessibility structure:**
  - 1 H1, no heading skips, no unnamed controls, no duplicate ids, every image has alt
  - every external link has `noopener`; labelled landmarks
  - the only sub-44px target is the inline Privacy Policy link, which matches the design and is exempt as inline under WCAG 2.5.8
- **Not verified:** a screen reader pass, real devices, and a live GHL or Turnstile submission.

## Independent review (2026-11-07)

A fresh-context reviewer read the full diff against the Sprint 2 file, the spec registries and the intake contract. It found no blockers. Every code-level finding was fixed before commit:

| # | Finding | Fix |
|---|---|---|
| R1 | Before hydration or without JS, a native submit would GET the form, putting personal data in the URL | `method="post"` with `action` set to the intake endpoint, and the submit button disabled until hydrated |
| R2 | A server phone error was erased by a re-validation on `isSubmitted`; the client phone rule was looser than the server's | Re-validate only when the contact method changes; the client rule now also enforces the server's character set (tested) |
| R3 | A spent Turnstile token was resent on retry | Reset the token after every response past validation and rate limiting |
| R4 | The metadata had new "managed" copy | Replaced with approved copy (E1) |
| R5 | Server errors on unrendered fields were swallowed | Only fields the summary renders count as handled; the rest show the banner |
| R6 | `display:none` on the empty live region | It stays in the accessibility tree |
| R7 | Dead CSS backstop (`[hidden]` preflight is `!important`) | Removed |
| R8 | Undocumented copy | Section E above |
| R9 | Unapproved SMS and privacy wording shipped in the client JS | Moved to the server-only `lib/services/websites/legal-copy.ts`, passed as props only when approved |
| R10 | Package links dropped `utm_*`; alt-click was intercepted | The link keeps the current query after mount; alt-click passes through |
| R11 | A pre-submit error didn't clear while typing | Live re-check while a field is invalid |
| R12 | Radios and consent lacked scroll margins under the sticky header | Added |
| R14 | Future SMS consent UI didn't match the design | Design `.consent` box, with the global input override |

Not changed: R13. The shared `TurnstileWidget` shows developer-facing error text in dark-theme colours. It's an existing shared component used by auth, so it's flagged for a separate change.

### Owner decisions raised by the review (no code change made)

1. **Consistency of the unverified-feature standard.** A1 and A2 removed "mobile-friendly website" and "contact form" from the *included* lists. Approved descriptive copy still says the site is mobile-friendly (hero lede) and has a request form (Why section), and the headline "A website that is managed for you" remains. My reading: descriptive copy about the service is approved, while itemised "included" lists are entitlements and stay VERIFY. Confirm or tighten.
2. **Revisions.** The FAQ "Can I request changes? Yes…" and How it works step 2 describe a review/change step, while `revisions` is VERIFY. Both defer details to the written proposal.
3. **GHL picklist** for `package_interest: "unsure"` (section F).
4. **CRM-only idempotency.** Until migration 002 is applied (D-03), a retry after a lost response can create a second CRM lead. The second submission matches the contact the first created, so it is held as an unverified match: one more note for manual review, no new tags and no opportunity. A retry of the same submission with the same content writes no duplicate note.
5. **Turnstile env pairing.** Both `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are required for the page to be served at all. The site key is also inlined into the client bundle at build time, so it must be present for the build as well as at runtime. The server checks the hostname and action the challenge reports, so a non-production host needs a widget configured for that host; Cloudflare's always-pass test keys may not report either, and would then be rejected.
6. **CRM: unverified matches.** A submission whose email matches an existing GHL contact never changes that contact and never creates or reuses an opportunity. It adds one review tag (`web-preview-unverified-match`) and a note that starts with `UNVERIFIED:` and holds every submitted detail, for manual review. Confirm no GHL workflow triggers on that tag or on notes being added. A retry of the same submission completes normally only when the same server process remembers creating that contact (a few minutes, same content). Notes are never trusted as proof, because they can be edited, merged or contain typed text, so a retry served by another process is held as unverified for manual review.
7. **GHL sandbox check.** Before live traffic, run `scripts/ghl-sandbox-check.mts` against a sandbox sub-account (it refuses to start unless `GHL_SANDBOX_CONFIRM` equals `GHL_LOCATION_ID`). It creates and deletes one synthetic contact and checks the duplicate-search response shape, the upsert `new` flag and that note bodies round-trip exactly, which the adapter relies on. Its guard cannot tell a sandbox from production; confirm the location yourself.

## Shared component change

`components/Header.tsx` gains two **non-visual** attributes, `data-visible` and `data-menu-open`, so the sub-nav and dock can follow the header. There's no styling or behaviour change.

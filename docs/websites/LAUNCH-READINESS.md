# /services/websites — launch readiness (2026-11-09)

Goal: publish the services page in **leads-only mode** (free preview requests only, no payments) before any outreach.

Audited: `main`, PRs #26, #28, #29, #30, #31, #33, `docs/websites/*`, the Sprint 2 design, the three demo registrations and the live site (entrepreneuria.io).
Not possible in this session: building or rendering the app (package installs blocked), opening the demo URLs (they block automated fetches), and anything against GHL, Turnstile or the VPS.

## 1. Complete

| Area | State |
|---|---|
| Page | Sprint 2 design built (`app/services/websites`): hero, examples gallery with tabs, packages, how it works, FAQ, form, final CTA, mobile dock, sub-nav. Browser-checked at 375–1440 on 2026-11-07 (PAGE-BUILD-NOTES). |
| Prices | Read from `packages.ts`. Starter $199 setup + $75/mo matches the approved terms. |
| Demos | 3 fictional demos, labelled fictional, 6 screenshots, style ↔ form sync. |
| Form | Validation, error summary, server field errors, busy state, success state, retry with idempotency key, honeypot, Turnstile, no-JS safety. |
| Intake | Gate, host allowlist, rate limits, body cap, Turnstile host/action checks, GHL adapter, capacity limit, signed alerts (PR #30, #33). |
| Release control | Fails closed: 404 unless `WEBSITES_SERVICES_MODE=leads` + `WEBSITES_LEADS_RELEASE_AUTHORIZED=true` + all 13 leads gates passed with evidence + config complete. |
| **New, this branch** | Distinct form states for capacity (paused/full), rate limit, failed verification and a verification check that cannot load; prefilled "Email my request" fallback on every dead-end state; Turnstile developer error text hidden on this form; one-month minimum disclosed under packages. |

## 2. Owner decisions (block launch; answers change what ships)

| # | Decision | Recommendation |
|---|---|---|
| O1 | **Pricing structure.** The brief approves $199 + $75/mo. The page shows three tiers ($199/$75, $249/$149, $399/$249). Every entitlement is unverified, so the cards show three prices and **nothing that explains the difference**, with the 2× price marked "Recommended". | Launch with **Starter only**. Restore the tiers once the GHL feature matrix is verified. It's a registry change plus three copy edits (see E1). |
| O2 | **Preview scope.** 20–30 min of effort means a homepage concept, but the page only says "personalized website preview". Visitors may expect a full site. | Add to the FAQ answer "Is the website preview free?": *"Your preview is a first look at a homepage designed around your business and the style you chose. It's a starting point to react to, not a finished website."* The 75-minute ceiling stays internal. |
| O3 | **Response time.** The success state says "We will follow up by email." with no timeframe. | Choose a commitment you can keep at the cap, e.g. "within 2 business days", and add it to the success state and the FAQ. |
| O4 | **Open-request cap** (`WEBSITES_PREVIEW_MAX_OPEN_REQUESTS`, proposed 5). | Set it from real capacity: 5 open × 30 min is fine; 75-min qualified previews count against the same pool. |
| O5 | **Public inbox.** The page shows `misti@entrepreneuria.io` (handoff §7.3 still open). | Confirm, or use a services alias before printing it on outreach. |
| O6 | Open rulings in PAGE-BUILD-NOTES "Owner decisions" 1–2 (descriptive copy, revision wording). Required by gate `leads-offer-copy`. | Approve as written; both defer details to the written proposal. |
| O7 | Approve the new form copy on this branch (section 1, last row). | — |

## 3. Design blockers

| # | Issue | Status |
|---|---|---|
| D1 | Capacity / rate-limit / verification responses showed "Please try again". With a cap of 5, "full" is routine and retrying never works, so the lead was lost. | **Fixed** on `feat/websites-launch-form-states`. |
| D2 | Turnstile failing to load (ad blockers) left no way to submit, and showed "Check your Turnstile site key…" to customers. | **Fixed** (same branch). Auth pages unchanged. |
| D3 | One-month minimum not disclosed. | **Fixed** (packages footer, from the registry). |
| D4 | Three tiers with no differentiation. | Waiting on O1. |
| D5 | Preview scope and response time. | Waiting on O2, O3. |
| D6 | Real-device pass (iOS Safari, Android Chrome) of the deployed page, including the mobile dock, the menu scroll reset noted on 2026-11-07, and the new banners. | Do it on staging before launch. |
| D7 | No link to the services page from entrepreneuria.io. | Not a blocker for direct outreach links. Add a footer link after launch. |

## 4. Engineering, GHL, infrastructure and legal blockers

**Code**
- **E1 (if O1 = Starter only):** limit `WEBSITE_PACKAGES` to `starter`. The registry's `.length(PACKAGE_IDS.length)` and "exactly one recommended" rules need relaxing, or the page should filter instead. Then change the hero aside link "Compare all three packages" to "See package details", and the packages lede so it doesn't imply several packages. The form select then offers Starter plus "Not sure yet". Update `page.test.ts`.
- **E2: Reconcile PR #29 with #30/#33.** They are two different intake-hardening lines. In #29, an existing contact gets only a review tag and an `UNVERIFIED:` note. In #30/#33 (which leads mode is built on), it gets tags, a note and an opportunity. Pick one behaviour, close the other PR, and rebase #33 if needed. Merging both will conflict.
- **E3:** Run the full CI suite (typecheck, lint, tests) on this branch. Only the new unit tests (8/8) and a syntax check ran here.
- **E4:** Flip each of the 13 `LEADS_RELEASE_GATES` with an evidence reference. This is a code commit and a deploy.

**GoHighLevel**
- G1: Live sandbox run (`npx tsx scripts/ghl-sandbox-check.mts --live --cleanup`) → evidence for `leads-crm-delivery`.
- G2: Production sub-account: pipeline and stage, custom field ids (`GHL_CUSTOM_FIELD_IDS`), and a `package_interest` picklist that includes "unsure".
- G3: Owner notification workflow on the `web-preview-request` tag, for new **and** returning contacts (`leads-notification`, D-06).

**Infrastructure (VPS / Cloudflare)**
- I1: Env in `/var/www/entrepreneuria/.env.local`: `WEBSITES_SERVICES_MODE=leads`, `WEBSITES_LEADS_RELEASE_AUTHORIZED`, `WEBSITES_IP_HASH_SALT`, Turnstile keys, `GHL_*`, `WEBSITES_ALERT_WEBHOOK_URL` and `_SECRET` (32+ chars), `WEBSITES_PREVIEW_INTAKE`, `WEBSITES_PREVIEW_MAX_OPEN_REQUESTS`.
- I2: A receiver for the alert webhook. None exists yet, and the mode stays off without it.
- I3: nginx must **overwrite** `X-Real-IP` and forward `Host`. Add the canonical host to the Turnstile widget's allowed domains.
- I4: Session reliability (`leads-session-reliability`): PR #26 and nginx stage 0b are unmerged or unapplied (D-18).
- **I5: Demo hosting.** All three demos live on `preview-…vibepreview.app` URLs. If those expire or change, the portfolio breaks mid-outreach, and they sit on a third-party domain. Move them to an Entrepreneuria-owned host (e.g. `demos.entrepreneuria.io`), or get written confirmation that the URLs are permanent, then update `demos.ts`.

**Legal**
- L1: `/privacy` and `/subprocessors` don't mention GoHighLevel or lead data (checked). Required for `leads-privacy`. The form's privacy sentence is also awaiting counsel.

## 5. Shortest safe path

1. **Today (owner):** answer O1–O7.
2. **Engineering (about 1 day):** E2 reconcile → E1 (if chosen) and O2/O3 copy → CI green → merge #33 and this branch into `feat/websites-commercial-foundation` → merge #28 into `main`. That deploys, but everything stays **gated off** and returns 404.
3. **In parallel:** G1–G3, I1–I3, I5, L1.
4. **Staging:** set `leads` mode on an allowlisted staging host. Run synthetic submissions through every state (success, capacity, rate limit, Turnstile blocked, GHL down) and the device pass (D6).
5. **Evidence:** flip the 13 leads gates with references (E4) and deploy.
6. **Release:** set `WEBSITES_LEADS_RELEASE_AUTHORIZED=true` on production and restart. Submit one real request and confirm it reaches GHL, the notification and the inbox. **Then** start outreach.

Pre-outreach smoke test: the page loads on a phone, all three demo links open, a test request arrives in GHL, the owner notification fires, and pausing intake (`WEBSITES_PREVIEW_INTAKE=paused`) shows the capacity message with a working email fallback.

# /services/websites: launch readiness (updated 2026-11-09, after owner decisions)

Goal: publish the services page in **leads-only mode** (free preview requests only, no payments) before any outreach.

## 1. Owner decisions applied (D-19 to D-21 in DECISION-REGISTER)

| Decision | Where it lives |
|---|---|
| One package: Website Starter, $199 setup + $75/mo, one-month minimum | `packages.ts`: Growth and Business keep their full config with `offered: false`. The page renders `OFFERED_PACKAGES` only, and intake rejects unoffered ids. Copy that says "starting at", "compare" or "Recommended" switches off automatically while one package is offered and returns if more are offered. |
| Preview = homepage concept, not a complete website | Preview strip, FAQ "Is the website preview free?", How it works step 2, form side panel, final CTA, meta description |
| Reply "within 2 business days" | A single constant (`REPLY_WITHIN`) used in the preview strip, FAQ, form side panel, success state, capacity banner and final CTA. It promises a reply, never delivery of the concept. |
| Open-request limit 5, not advertised | Set by env (`WEBSITES_PREVIEW_MAX_OPEN_REQUESTS=5`). No page copy mentions the number. The capacity banner keeps the email fallback. |
| Inbox not public until confirmed | No address in code. `WEBSITES_CONTACT_EMAIL` is required; without it the page returns 404 and leads mode stays off. |

### How the owner is notified before capacity runs out

1. **One slot left** (4 of 5 open): a `capacity_near` alert.
2. **Limit reached**, or a visitor is refused as full: a `capacity_full` alert. The visitor sees the capacity banner with "Email my request".
3. **Each new lead** also triggers the GHL notification workflow on the `web-preview-request` tag (gate `leads-notification`, still to be built in GHL).

The alerts are signed webhooks (HMAC-SHA256) and carry counts only (`status: "4:5"`), never lead data. They are deduplicated per 15 minutes. **A receiver is still required** (`WEBSITES_ALERT_WEBHOOK_URL`) that forwards alerts to the owner by email or SMS. Leads mode cannot start without one.

The count is open opportunities in the GHL intake pipeline (or `WEBSITES_PREVIEW_COUNT_STAGE_ID`). **A slot frees only when the opportunity leaves that pipeline or stage**, so moving or closing finished previews in GHL is part of the preview playbook. To stop intake immediately, set `WEBSITES_PREVIEW_INTAKE=paused` and restart.

## 2. Copy rulings still open

Your approval in principle covers the form messages and the minimum-term line. These still need explicit wording sign-off before the `leads-offer-copy` gate can pass:

| # | Copy | Why it needs you |
|---|---|---|
| C1 | **H1 changed** from "Starting at $75/month." to "$75/month." | Edits approved Sprint 2 headline copy (forced by the single package) |
| C2 | Homepage-concept wording in 6 places, and How it works step 2: "Review your homepage concept. We share a free homepage concept for you to look over, with next steps for building your full website." | New customer-facing copy. Step 2 deliberately does not promise free changes to the concept. |
| C3 | "within 2 business days" in 6 places, including the success message: "We will reply by email within 2 business days." | New commitment, repeated |
| C4 | Banners: capacity, rate limit, verification failed, verification unavailable, generic failure | Final wording review (approved in principle) |
| C5 | Packages footer "The plan has a 1-month minimum." and FAQ "…has a 1-month minimum." | Final wording review (approved in principle). The number comes from the registry, so it renders as "1-month". Say if you want "one-month" spelled out. |
| C6 | **"A website that is managed for you"** (headline), "Professionally managed", and "modern, mobile-friendly website" in the hero (PAGE-BUILD-NOTES owner decision 1) | Hosting and maintenance scope is still PROPOSED (spec §7). "Managed for you" reads as a service commitment. **Highest-risk open ruling.** |
| C7 | Revisions: FAQ "Can I request changes? Yes…" (PAGE-BUILD-NOTES owner decision 2) | `revisions` is VERIFY. The copy defers the number of rounds to the written proposal. |
| C8 | CTA label "Request My Free Website Preview" (6 places) | Optional. It still says "website preview". The FAQ now defines it as a homepage concept. Keep it, or change to "Request My Free Homepage Concept". |

Not owner copy (legal): the form privacy sentence, SMS consent wording, and `/privacy` + `/subprocessors` coverage of GHL (gate `leads-privacy`).

## 3. Remaining blockers

**Owner:** confirm the inbox is monitored, then set `WEBSITES_CONTACT_EMAIL` (D-20). Rule on C1–C8.

**Code:** reconcile PR #29 with #30/#33. They implement different returning-contact behaviour in GHL, and merging both will conflict. After that, flip the 13 leads gates with evidence references.

**GoHighLevel:** live sandbox run; production pipeline, stage and custom field ids (`package_interest` picklist with `starter` and `unsure`); owner notification workflow for new and returning leads.

**Infrastructure:**
- env on the VPS
- **alert webhook receiver** (none exists; this blocks leads mode and capacity notification)
- nginx overwriting `X-Real-IP`
- Turnstile allowed domains
- session reliability: PR #26 and nginx stage 0b
- **demo hosting**: three `vibepreview.app` preview URLs, permanence unverified

**Legal:** privacy notice and subprocessors must cover lead data and GHL.

## 4. Verification of this branch (2026-11-09)

- Unit tests: **377 pass, 0 regressions** across `lib/**` and `components/**`, 15 of them new. Two files fail identically on the base branch (`lib/command-center/apps.test.ts` and `lib/supabase/oauth-session-cookies.test.ts`). They fail only because packages that couldn't be installed in the authoring session are missing.
- Typecheck of `lib/services/websites`, `lib/integrations/ghl` and `lib/rate-limit.ts` with real `zod` and Node types: 0 errors.
- Components got a syntax check plus a stubbed typecheck. Full typecheck and lint run in CI.
- Not browser-tested. Before launch: render on staging at 375 / 390 / 1024 / 1440 and check the single package card (max 420px wide), the H1 without "Starting at", and every banner.

## 5. Shortest safe path

1. Owner: inbox confirmation (D-20) and C1–C8.
2. Build the alert receiver (the next engineering task; see the PR description).
3. Reconcile #29 against #33. Merge #34 → #33 → `feat/websites-commercial-foundation` → #28 → `main`. Everything stays gated off and returns 404.
4. GHL setup and live sandbox run; env on the VPS; demo hosting; privacy and subprocessor pages.
5. Staging run of every state on real devices. Flip the leads gates with evidence. Set `WEBSITES_LEADS_RELEASE_AUTHORIZED=true`. Send one real request end to end. Then start outreach.

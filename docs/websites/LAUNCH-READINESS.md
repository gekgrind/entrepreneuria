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

## 2. Copy status (owner rulings, 2026-11-09 evening)

| # | Copy | Status |
|---|---|---|
| C1 | H1 "$75/month." (no "Starting at") | **Approved** |
| C2 | Free homepage concept wording | **Approved.** The FAQ now spells out what the concept includes ("one homepage designed around your business name, the services you offer and the style you chose") and what it excludes ("other pages, revisions or publishing"). The exclusion sentence is new: final wording review. |
| C3 | "within 2 business days" | **Approved** |
| C4 | Form banners | Approved in principle; final wording review |
| C5 | "one-month minimum" (packages footer, FAQ) | **Approved.** It now renders as "one-month". |
| C6 | Managed-hosting/maintenance claims | **Revised.** The headline is now "A professional website without the technical headaches." (owner wording). "Professionally managed" became "No website builder to learn: We build your website for you. You tell us about your business and approve the result." The hero lede dropped "or managing". No hosting, maintenance or "managed" claims remain in page copy. The new sub-item text needs final wording review. |
| C7 | Free revisions | **Revised.** FAQ "Can I request changes?" now reads: "Changes are covered in your written proposal: what is included before launch, and how changes after launch work. You see those terms before you pay anything." No "Yes", and no promise of rounds. Step 2 doesn't promise changes. Final wording review. |
| C8 | CTA "Request My Free Website Preview" | **Approved, unchanged** |

Still open (legal, not owner copy): the form privacy sentence, SMS consent wording, and `/privacy` + `/subprocessors` coverage of GHL.

## 3. Remaining blockers

**Owner:** get SMTP access for the existing mailbox (PR #35: the first test alert proves the inbox receives mail), then set `WEBSITES_CONTACT_EMAIL` (D-20). Final wording review of C2, C4, C6 and C7.

**Code:** returning contacts are handled in PR #36 (no CRM writes, durable on-server review, reference-only notice). It replaces #29's existing-contact behaviour; close #29 only after #36 is approved. After that, flip the 13 leads gates with evidence references.

**GoHighLevel:** live sandbox run; production pipeline, stage and custom field ids (`package_interest` picklist with `starter` and `unsure`); owner notification workflow for new and returning leads.

**Infrastructure:**
- env on the VPS
- **alert receiver**: PR #35, not deployed. It runs on the app server (loopback only) and emails through the existing mailbox's SMTP. No DNS change. Needs the env file, a pm2 process and the shared secret.
- **review store directory** (PR #36): an absolute `<review dir>` outside the web root and release directories, owned by the app user, mode 0700; `WEBSITES_REVIEW_DIR` in the app env.
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
2. Alert receiver: draft PR #35 (not deployed), on the app server with existing-mailbox SMTP. Setup: `docs/websites/ALERT-RECEIVER.md` on that branch.
3. Review and merge #36, #34 and #35 into #33 (they merge cleanly in any order), then #33 → `feat/websites-commercial-foundation` → #28 → `main`. Everything stays gated off and returns 404. Close #29 after #36 is approved.
4. GHL setup and live sandbox run; env on the VPS; demo hosting; privacy and subprocessor pages.
5. Staging run of every state on real devices. Flip the leads gates with evidence. Set `WEBSITES_LEADS_RELEASE_AUTHORIZED=true`. Send one real request end to end. Then start outreach.

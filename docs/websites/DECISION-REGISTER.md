# Entrepreneuria Websites — engineering decision register

Spec: *Commercial Terms & Engineering Implementation Specification* v1.0 (2026-11-06).
Branch: `feat/websites-commercial-foundation`. Nothing here is deployed, migrated or live.

Status keys: **ESCALATE** = needs an owner/legal decision before it ships · **DEFAULT** = engineering chose a fail-closed default that can be changed by config · **VERIFY** = needs evidence from a third party (GHL, payment provider).

## What exists

| Area | Files |
|---|---|
| Package registry (approved prices, integer cents, `pricingVersion`) | `lib/services/websites/packages.ts` |
| Policy registry (approved / proposed / verify / legal_review, versions) | `lib/services/websites/policies.ts` |
| Release flags + §11 gates (production fail-closed) | `lib/services/websites/flags.ts`, `release-gates.ts` |
| `style_interest` ids | `lib/services/websites/styles.ts` |
| Inquiry schema (shared client/server) + intake pipeline | `inquiry-schema.ts`, `intake.ts`, `app/api/services/websites/inquiry/route.ts` |
| GHL adapter (upsert contact → reuse/create opportunity → note) | `lib/integrations/ghl/client.ts`, `server.ts` |
| Durable inquiry store (Supabase REST, opt-in) | `inquiry-store-supabase.ts`, `scripts/002_websites_services.sql` (**not applied**) |
| Acceptance evidence, project lifecycle, billing guards | `acceptance.ts`, `lifecycle.ts`, `billing.ts` |
| Payment boundary + sandbox provider (no live adapter) | `payments/provider.ts`, `payments/sandbox.ts` |
| Tests (36) | `lib/services/websites/*.test.ts` |

## Decisions

| # | Topic | Status | What was done / what is needed |
|---|---|---|---|
| D-01 | Sprint 2 page | **BUILT (2026-11-07), gated off** | Built as `app/services/websites/page.tsx` from the files below. Checksums were re-verified before copying. The HTML is now `docs/websites/design/websites-page.sprint2.html` and the WebPs are in `public/marketing/websites-demos/`, both unmodified. Deviations, review and owner items are in `docs/websites/PAGE-BUILD-NOTES.md`. Original record follows. |
| D-01 (record) | Sprint 2 page | LOCATED | The approved Sprint 2 files are in `Downloads/entrepreneuria-websites-sprint2-final/` (all dated 2026-11-06 19:10), with handoff rev 7. `websites-page.html` (82,220 B, sha256 `ed1e7a6d5ac86d51…`) contains the Sprint 2 `DEMOS` registry, the style toggle and the approved "Request My Free Website Preview" CTA. Six WebPs (sha256 prefixes): `demo-redclay-{desktop 57d066c5d17d4743, mobile 801f4c77099d374a}`, `demo-porchlight-{desktop 0e3588f96ac4011f, mobile f68099009e4d058e}`, `demo-ashford-{desktop 15a92c9e3e31bf8d, mobile 28f9263f88f899a9}`. The demo id → `style_interest` mapping (redclay → local-professional, porchlight → neighborhood-pro, ashford → modern-craftsman) and the option labels match `lib/services/websites/styles.ts` exactly. The Sprint 1 file `Downloads/websites-page.html` is **not** to be used. **Neither the page nor the assets are copied into the repo in this commit.** That's the next, separate step: copy the originals unchanged and build `app/services/websites/page.tsx` from this file. |
| D-02 | Minimum term | DEFAULT | The earlier brief said "no minimum multi-month commitment"; spec §3 says a one-month minimum. These don't conflict. Every package carries `minimumTermMonths: 1`. |
| D-03 | Inquiry/consent store | **IN REVIEW** | `scripts/002_websites_services.sql` creates `website_inquiries`, `website_projects`, `website_project_events` and `website_payment_events`, with RLS on and access for the service role only. The rollback is `scripts/002_websites_services.down.sql` and the review packet is `docs/websites/MIGRATION-REVIEW-002.md`. **Not applied** (owner, 2026-11-06: prepare it for independent review, do not apply). Until it's applied (`WEBSITES_INQUIRY_STORE` unset), intake runs CRM-only. |
| D-04 | Confirmation when GHL fails but the store succeeded | **CONDITIONALLY APPROVED** | Owner, 2026-11-06: acknowledging a durably stored inquiry while GHL sync is pending is approved, **provided retries, monitoring and owner alerts are implemented before production.** This is enforced by the new release gate `crm-sync-recovery` (open), which keeps production mode off. The design is in `OWNER-LEAD-QUEUE-PLAN.md` § "Ties to D-04". Without a store, a GHL failure still returns 502 (retryable). |
| D-05 | SMS automation | DEFAULT | Consent is recorded as evidence: boolean, timestamp, disclosure version, page URL, IP hash and UA. The `sms-consent` tag that could trigger GHL workflows is **withheld** until `sms_consent` is approved in `policies.ts`. |
| D-06 | Team notification (§8 step 5) | **VERIFY** | There's no email provider in the repo. Notification is expected from a GHL workflow on the `web-preview-request` tag. Confirm the workflow and recipient. |
| D-07 | Payment provider | **VERIFY** | Not selected. Only the sandbox provider exists, `WEBSITES_PAYMENTS_MODE` has no `live` value, and payments are disabled outside `nonproduction`. A real adapter must implement `PaymentProvider` and pass the same tests. |
| D-08 | Cancellation rule | DEFAULT (proposed) | `quoteCancellation`: the effective date is the later of the current period end and launch + 1 month. It discloses the next billing date, the effective date and remaining charges. It throws unless the policy is approved or `WEBSITES_PROPOSED_POLICY_FLOWS` includes `cancellation` in nonproduction. |
| D-09 | `style:<value>` tag placement | **RESOLVED (2026-11-07)** | The v2 opportunity create schema has no `tags` field, so tags stay on the **contact**. They're added through `POST /contacts/{id}/tags`, which is additive, never through upsert `tags`, which overwrites (audit F-1). `style_interest` is also sent as a custom field and written in the note. |
| D-10 | GHL field ids and endpoints | **VERIFY (staging)** | Endpoint shapes were checked against the official v2 OpenAPI specs (`docs/websites/ghl-audit/GHL-API-COMPATIBILITY.md`), but nothing has been tested against a real sub-account. Custom fields go **by field id** from `GHL_CUSTOM_FIELD_IDS` (JSON, validated). `GHL_CUSTOM_FIELD_KEYS` is rejected. Unmapped, rejected or ignored fields are reported as sync warnings and kept in the note. Never guessed. |
| D-19 | Returning-lead notifications | **VERIFY (owner)** | Tags are now additive, so a returning contact who already has `web-preview-request` won't fire a GHL "tag added" trigger again, and an existing open opportunity is reused rather than created. The D-06 team-notification workflow should trigger on **note added / contact updated** or be checked against this. Every submission still writes exactly one new note. |
| D-11 | Rate limiting | DEFAULT | In-process limits: 5 per 10 min per IP and 3 per hour per email. They're per pm2 instance. An nginx `limit_req` backstop needs owner approval for the production config. |
| D-12 | Owner lead queue (§10F) | **PLANNED** | Owner, 2026-11-06: use the existing Supabase authentication plus an explicit, server-verified allowlist. The plan is in `docs/websites/OWNER-LEAD-QUEUE-PLAN.md`: `getAuthenticatedUser()`, a `WEBSITES_ADMIN_USER_IDS` allowlist of user ids (empty list denies everyone, unknown users get a 404), checked in every page, action and route, with service-role reads only. Not built. |
| D-13 | Customer delay | DEFAULT | The `customer_delay` state pauses and resumes work. It has **no billing effect** and no deemed-launch rule (spec §2 PROPOSED). |
| D-14 | Setup-fee refunds | DEFAULT (proposed) | No refund flow. `cancel_before_launch` records whether the setup fee was paid and whether implementation had started (`implementationStartedAt`), so a refund can be assessed under §4 once the policy is approved. |
| D-15 | Failed recurring payments | **PROPOSED** | Owner, 2026-11-06: document a proposed schedule of three retries over seven days, plus an additional seven-day grace period. It's encoded in `lib/services/websites/payment-recovery.ts` as policy `payment_recovery` (status `proposed`, legal review). Day 0: failure moves the project to `past_due`. Days 1, 3 and 7: automatic retries. Days 7 to 14: grace, service continues. Day 14: suspension becomes *eligible*. **Suspension is not activated**: `suspensionEnabled: false`, and `isSuspensionAllowed()` is always false until the policy is approved and the rule is explicitly enabled. Nothing schedules these retries yet. |
| D-16 | Price changes after acceptance | DEFAULT | Charges use the **accepted** price. If the registry price differs, `chargeSetupFee` refuses and re-approval is required. |
| D-17 | IP hashing | DEFAULT | Set `WEBSITES_IP_HASH_SALT` (a server secret). Without it, hashes are unsalted. |
| D-18 | Session reliability gate | **BLOCKED (coordinated)** | Owner, 2026-11-06: coordinate with the existing nginx reliability work and keep the gate blocked until verification is complete. That work is tracked in `output/ops/shared-auth-remediation-plan.md` (local ops notes) and `nginx-stabilization-plan.md`. As recorded there, stage **0a** (`large_client_header_buffers 4 32k`) is live and verified, so this supersedes the 8k finding in `implementation-plan.md` R1. Stage **0b** (proxy buffers, `nginx-proxy-buffers.v3.sh`) is not applied, the Node 16 KB/431 ceiling remains, and PR #24/#26 are unmerged. This branch makes no nginx change. Gate `session-reliability` stays `passed: false` until the ops plan's verification steps (no new `too big header`, all hosts 200/307, signed-in large-cookie probe) are recorded as evidence. |

## Verification record

| Run | Typecheck (`tsc --noEmit`) | Lint (`eslint` on new paths) | Tests (`node --import tsx --test lib/** components/**`) |
|---|---|---|---|
| Reviewed build, 2026-11-06 | pass, 0 errors | pass, 0 problems | **140 / 140 pass** (36 new) |
| Pre-commit, after the owner's rulings (D-15 schedule test added), 2026-11-06 | pass, exit 0 | pass, exit 0 | **141 / 141 pass**, 0 fail, 0 skipped, 30 suites |
| `/services/websites` page build, after independent review fixes, 2026-11-07 | pass, exit 0 | changed paths: 0 errors (1 pre-existing warning in `Header.tsx:301`, a line this branch doesn't touch). Full repo: 73 pre-existing errors, all in files this branch doesn't change. | **155 / 155 pass**, 0 fail, 0 skipped, 33 suites |
| GHL adapter remediation (audit F-1 to F-7), after independent review fixes, 2026-11-07 | pass, exit 0 | changed paths: 0 problems. Full repo: 73 pre-existing errors, none in changed files. | **206 / 206 pass**, 0 fail, 45 suites (51 new adapter/phone/intake tests). Mutation check: putting tags back into the upsert fails 4 tests. |

Not verified: anything against a real GoHighLevel sub-account, a real payment provider, a Supabase database (migration not applied), or a browser (no page exists).

## Environment (server-side only; none committed)

```
WEBSITES_SERVICES_MODE=off|nonproduction        # production is refused while any §11 gate is open
WEBSITES_OWNER_RELEASE_AUTHORIZED=true          # also required for production
WEBSITES_PAYMENTS_MODE=disabled|sandbox
WEBSITES_PROPOSED_POLICY_FLOWS=cancellation,... # nonproduction only
WEBSITES_INQUIRY_STORE=supabase                 # only after D-03 is approved and applied
WEBSITES_IP_HASH_SALT=...
GHL_API_TOKEN, GHL_LOCATION_ID, GHL_PIPELINE_ID, GHL_PIPELINE_STAGE_ID, GHL_API_VERSION
GHL_CUSTOM_FIELD_IDS={"style_interest":"<field id>","package_interest":"<field id>",...}   # ids, not keys
# Private Integration scopes (intake sub-account only): contacts.write, contacts.readonly, opportunities.readonly, opportunities.write
TURNSTILE_SECRET_KEY                            # existing; when set, Turnstile is enforced
```

## NO-GO items honored

No public page, no live billing path, no published policy language, no entitlements shown as available. The inquiry route returns 404 unless `WEBSITES_SERVICES_MODE` is set.

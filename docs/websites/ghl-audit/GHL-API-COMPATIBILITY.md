# GHL API compatibility: `lib/integrations/ghl/`

Audit date: 2026-11-07. I compared the code against HighLevel's OpenAPI specs (`GoHighLevel/highlevel-api-docs`, `apps/*.json`, `docs/oauth/Scopes.md`) and the developer docs. No integration was created, no token was generated and no API was called.

## Authentication

| Item | Finding | Code status |
|---|---|---|
| Private Integration token (PIT) | A static, scoped OAuth2-style token, sent as `Authorization: Bearer`. Available at agency and sub-account level, and shown only once. | ✅ `client.ts` sends a Bearer token |
| Token level | Intake uses **one location** (Entrepreneuria's own intake sub-account). Create the PIT **at that sub-account**, not at the agency, so it can't reach customer sub-accounts. | ✅ `GHL_LOCATION_ID` is a single value |
| Version header | `2021-07-28` is the only enum value in the v2 specs and is still supported. `v3` was released 2026-06-11. When a new version ships, older versions enter maintenance (fixes only), and no retirement date is published. | ✅ `GHL_API_VERSION` defaults to `2021-07-28` · ⚠ plan the v3 migration (P2) |
| Lifecycle | No automatic expiry. HighLevel recommends rotating every 90 days. "Rotate and expire later" gives a 7-day overlap, and "expire now" is for a compromised token. Rotation keeps the same burst counter. | ⚠ No runbook yet. The token is read from env, so rotation means updating env and restarting pm2. |
| Storage | Server-only env, never `NEXT_PUBLIC_`. `server.ts` imports `server-only`. | ✅ |

## Minimum scopes for the initial lead-intake integration

> **Updated after remediation (2026-11-07):** the adapter now reads a contact's notes before writing one, so each submission produces exactly one note (F-6). That adds `contacts.readonly`, for **four scopes in total**.

| Scope | Why | Endpoint(s) |
|---|---|---|
| `contacts.write` | Upsert contact, add tags, create note | `POST /contacts/upsert`, `POST /contacts/{contactId}/tags`, `POST /contacts/{contactId}/notes` |
| `contacts.readonly` | Check whether this submission's note already exists | `GET /contacts/{contactId}/notes` |
| `opportunities.readonly` | Find an existing open opportunity | `GET /opportunities/search` |
| `opportunities.write` | Create the opportunity | `POST /opportunities/` |

Leave out `locations/customFields.*` and `locations/tags.*` at runtime: create custom fields and tags by hand in the UI, and read their ids once during setup (V-8). If an automated config check is wanted later, add `locations/customFields.readonly` to a **separate** setup-time token, not the production intake token.

## Endpoint-by-endpoint

| Adapter call | Spec | Compatibility |
|---|---|---|
| `POST /contacts/upsert` with `locationId, name, email, phone, companyName, website, source, tags, customFields` | `UpsertContactDto`. `locationId` is required. Response is `{ new, contact: { id … }, traceId }`. Dedupe follows the location's **"Allow Duplicate Contact"** setting and its email/phone priority. | ✅ Shape matches · ❌ **tags: see F-1** · ⚠ phone format (F-3) · ⚠ dedupe depends on a location setting (V-6) |
| `customFields: [{ key, field_value }]` | `TextField` etc. The spec says "Pass either `id` or `key`", with an example key of `my_custom_field`. The custom-fields API reports `fieldKey` as `contact.my_custom_field`. | ⚠ **F-2**: the key format is ambiguous, and the env example uses `contact.style_interest`. Use field **ids**. |
| `GET /opportunities/search?location_id&contact_id&pipeline_id&status=open` | All four parameters are documented. `status` enum is open/won/lost/abandoned/all. Default limit 20. Response is `{ opportunities, meta }`. | ✅ |
| `POST /opportunities/` with `locationId, pipelineId, pipelineStageId, contactId, name, status` | `CreateDto` requires pipelineId, locationId, name, status and contactId. Response 201 is `{ opportunity: { id … } }`. It supports `customFields` but **has no `tags` field**. | ✅ · D-09 is resolved: opportunities can't be tagged at create, so keep tags on the contact and add `style_interest` as an **opportunity custom field** |
| `POST /opportunities/upsert` | Keyed by opportunity `id`. **There's no `contactId` field, so it can't dedupe by contact.** | Don't switch to it. Search-then-create stays. |
| `POST /contacts/{id}/notes` with `{ body }` | `NotesDTO` requires `body`. Response 201. | ✅ · ⚠ not idempotent (F-6) |

## Field mapping

| Logical field | Value sent | GHL requirement |
|---|---|---|
| `style_interest` | Stable id: `local-professional`, `neighborhood-pro`, `modern-craftsman`, `not-sure`, `something-different`, or omitted when blank | Create it as a **single-line text** field, or as a dropdown whose option values equal these ids exactly (V-8). Also sent as the contact tag `style:<id>` and in the note. |
| `package_interest` | `starter`, `growth`, `business`, **`unsure`**, or omitted when blank | Same rule. `unsure` must exist as an option if a dropdown is used. The `pkg-<id>` tag is only added for real packages, which is correct. |
| `sms_consent`, `sms_consent_at`, `sms_consent_version`, `consent_page_url` | yes/no, ISO timestamp, version, URL | Text fields. **GHL holds a copy only.** The authoritative consent evidence is the Supabase `website_inquiries.consent` row (migration 002, not yet applied). |
| `pricing_version`, `business_type`, `contact_method` | text | Text fields |

## Rate limits and retries

Documented limits: **100 requests per 10 s** per integration per location, and **200,000 per 24 h**, with the daily counter shared by all PITs on the location. **A 429 has no `Retry-After` header.** Use `X-RateLimit-Remaining` and `X-RateLimit-Interval-Milliseconds` (10,000), or `X-RateLimit-Daily-Reset`. Rejected requests aren't counted.

Intake makes about 3–4 requests per lead, so volume isn't a concern. Correctness of the retry logic is.

## Findings

| # | Severity | Finding | Recommended change (not made) |
|---|---|---|---|
| F-1 | **High** | The `tags` field in `/contacts/upsert` **"will overwrite all current tags associated with the contact"** (spec text). A returning lead, or an existing customer submitting the form, would lose every tag. That can remove them from workflows or campaigns. | Upsert without `tags`, then call `POST /contacts/{contactId}/tags` (additive, `contacts.write`). Or send tags only when `new === true`. |
| F-2 | High | The custom-field `key` format is unverified (`contact.x` vs `x`). The spec marks `id` required in several variants. A mismatch could silently drop fields or return a 422. | Map logical names to field **ids** (`GHL_CUSTOM_FIELD_IDS`) captured during V-8. Add an integration test against a staging location. |
| F-3 | Medium | The form accepts `(555) 123-4567`-style numbers, and the spec example is E.164-like. An unparseable phone could fail the upsert, so the lead lands in `crm_failed`. | Normalize to E.164 server-side (default +1), or omit the phone if it won't parse and keep it in the note. |
| F-4 | Medium | On 429 the adapter waits for `Retry-After`, which isn't sent, so it falls back to 600 ms and retries inside the 10 s window. That guarantees a second 429. | Don't retry 429s inline. Mark them retryable and let the durable queue retry after ≥10 s, or after `X-RateLimit-Daily-Reset` when daily remaining is 0. |
| F-5 | Medium | `POST /opportunities/` and `POST /notes` are retried after timeouts and 5xx. If the first attempt succeeded on the server, the retry creates a duplicate. | Before retrying an opportunity create, re-run the search. Don't retry the note inline; the queue can retry it, keyed by inquiry id (F-6). |
| F-6 | Low | Re-running `syncLead` from the owner queue adds another identical note every time. | Put the inquiry reference in the note title and skip if it's already present (`GET /contacts/{id}/notes` needs `contacts.readonly`), or store `crm_note_id`. |
| F-7 | Medium | Race: two submissions for the same email with different idempotency keys can both find no open opportunity and both create one. | Serialize by email in the store (advisory lock or unique pending key), or check the opportunity-settings duplicate rule (V-7). |
| F-8 | Medium | Worst-case latency in the request path is 4 calls × 2 attempts × 8 s timeout, plus sleeps (≈35 s+). | With the durable store on, acknowledge after insert and run the CRM sync asynchronously (this fits D-04 and the `crm-sync-recovery` gate). |
| F-9 | Low | No SMS DND is set for contacts without SMS consent, so a later workflow could text them. | When `sms_consent` is false, send `dndSettings.SMS.status = "active"`, or enforce the consent tag in workflows only. Needs an owner/legal decision (A-07). |
| F-10 | Low | No rate-limit header logging, so nothing to monitor. | Log `X-RateLimit-*-Remaining` on errors. |
| F-11 | Info | Only `2021-07-28` is supported in the code, and v3 exists. | Track it. Migrate after launch, behind the same `GHL_API_VERSION` config, with a v3 adapter test suite. |

## Remediation status (2026-11-07)

| # | Status | What changed |
|---|---|---|
| F-1 | **Fixed** | Upsert never sends `tags`. Tags go through `POST /contacts/{id}/tags`, which is additive. Tests prove a returning contact keeps existing tags across repeated and new submissions. |
| F-2 | **Fixed** | `GHL_CUSTOM_FIELD_IDS` (logical name → field id) replaces `GHL_CUSTOM_FIELD_KEYS`, which is now rejected with a logged problem. Ids are validated: charset and length, known names only, no duplicates. If GHL rejects a field id with 400/422, the upsert is retried without custom fields. Unmapped, rejected or silently ignored fields come back as sync warnings, and intake logs them. Every value is also in the contact note (now including the privacy-notice version) and in the durable store. |
| F-3 | **Fixed** | `lib/services/websites/phone.ts` normalizes to E.164, shared by the form rules and the server schema. "+" or "00" means international. National format is accepted only when it is unambiguously NANP; anything else gets a country-code hint. The adapter also drops a non-E.164 phone, with a warning. |
| F-4 | **Fixed** | 429 is never retried inline. `GhlError.retryAfterMs` is set from `X-RateLimit-*` (10 s burst window, or the daily reset). |
| F-5 | **Fixed** | Creates are sent once per sync. After an ambiguous failure (timeout or 5xx) the adapter re-reads. It reuses what it finds, or throws a retryable `outcome: "unknown"` error. |
| F-6 | **Fixed** | The note carries `Reference: <idempotency key>` and is skipped if it already exists. |
| F-7 | **Partly fixed** | Syncs for the same location and email are serialized within one Node process. Opportunities this process created are remembered for 10 minutes, so a lagging search index can't trigger a second create. **Cross-process** serialization (pm2 cluster) is deferred to the async CRM sync worker; a control test documents the remaining race. |
| F-8 | **Mitigated** | Each request's timeout now covers the body as well as the headers, and each sync has a 25 s total budget, so a stalled response can't hold the lock. Sync still runs inside the request; the full fix is the async worker. |
| Review R-1 | **Fixed** | An unreadable 200, or a read with no list, is an `outcome: "unknown"` error, never "not found". It can't cause a duplicate create. |
| Review R-4 | **Fixed** | If GHL rejects the phone (400/422), the upsert is retried without it, keeping custom fields, and reports `phone_rejected`. |
| Review R-5 | **Fixed** | The note is written before the opportunity, so the full record reaches GHL even if the opportunity step fails. |
| Review R-7 | **Fixed** | `custom_field_not_applied` compares values, so a returning contact's old value can't hide a field GHL ignored. Critical fields are flagged. |
| F-9, F-10, F-11 | Open | SMS DND (owner decision A-07), rate-limit header logging, v3 migration |

**Async CRM sync dependencies:** a single worker or a DB lock per email (F-7); retry scheduling that honors `retryAfterMs`, waiting at least as long as GHL's search-index lag before retrying an `outcome: "unknown"` opportunity error; acknowledging after insert (F-8); and an attempt cap with an owner alert (gate `crm-sync-recovery`).

## Future integrations (not needed for initial intake)

- **Customer sub-accounts:** with architecture C, websites use native GHL forms, so **no per-customer token is needed.** If Entrepreneuria later automates sub-account provisioning, consider an agency-level token (`locations.write`, snapshots) **or** a private Marketplace app with OAuth (per-location tokens, 24 h access tokens, rotating refresh). That needs encrypted multi-tenant credential storage, for example Supabase Vault, and is a separate security review.
- **Webhooks** (ContactCreate, OpportunityStatusUpdate) need a Marketplace app and aren't available to PITs in the same way. **Verify** before designing on them.

## Sources

- Private Integrations: https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken
- Rate limits: https://marketplace.gohighlevel.com/docs/other/rate-limits/
- Versioning: https://marketplace.gohighlevel.com/docs/Versioning
- OpenAPI specs: https://github.com/GoHighLevel/highlevel-api-docs/blob/main/apps/contacts.json · …/apps/opportunities.json · …/apps/custom-fields.json · …/apps/locations.json
- Scopes: https://github.com/GoHighLevel/highlevel-api-docs/blob/main/docs/oauth/Scopes.md

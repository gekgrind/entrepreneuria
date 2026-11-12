# Returning GoHighLevel contacts (leads mode)

Owner decision, 2026-11-09 (DECISION-REGISTER D-22). This supersedes the earlier "review tag + `UNVERIFIED:` note" proposal.

## Behaviour

Steps 1–4 (validation, honeypot, rate limits, Turnstile) are unchanged. After them:

| Situation | CRM | Visitor sees | Owner | Capacity slot |
|---|---|---|---|---|
| New email (lookup: explicit "no contact") | Approved new-lead flow: email-only upsert → details → tags → note → opportunity | Success | GHL new-lead workflow | Yes (checked first; full or paused → capacity message) |
| Email already a contact | **Nothing written.** No upsert, fields, tags, notes or opportunity, so no workflow fires | Whatever a new lead would see right now: success, or the capacity message when full or paused | Reference-only email (always recorded, even when full or paused) | **No** (a peek at capacity, no slot taken, no capacity alert) |
| Lookup failed, timed out or unreadable | Nothing written (never assumed new) | Same as the row above | Reference-only email, plus a lookup-failure alert | No (peek only) |
| Lookup said "none" but the upsert matched (race, index lag, lost response) | Only the email-only upsert, which changes nothing; then stops | Success | Reference-only email | Already checked |
| New email, but the new-lead sync fails (GHL down, timeout, 401/403, 429, unexpected error) | Whatever the sync wrote before failing (the partial contact id is kept in the record) | Success (identical response) | Reference-only email, plus the failure alert (`delivery_failed`, `ghl_auth_failed` or `ghl_rate_limited`) | Already checked |
| Review record can't be written | Nothing written | **Retryable error** with the email fallback | Alert (`review_store`) | — |

The response body is the same for new and returning contacts (`reference: null`), so the form can't be used to find out whether an email is in the CRM. That includes when intake is full or paused (launch P0 review, 2026-11-10): a returning contact still gets its review record and notice, but sees the same capacity message a new lead would, rather than a success that only a known email could get.

A retry of the **same** submission (same idempotency key) after a partial failure may finish the contact this process created minutes earlier. A **different** submission from that person is a returning contact.

## Where returning inquiries are kept

- **Store:** `WEBSITES_REVIEW_DIR` on the app server, an absolute `<review dir>` (real path in the private operations notes).
  - Absolute path, outside the web root and outside the release directories, so it survives deploys.
  - Directory 0700, files 0600, owned by the app user.
  - Leads mode won't start without it.
- **Record:** one JSON file per inquiry, written and fsynced **before** the visitor sees success.
  - Named by an opaque reference: `r-` plus 16 hex characters, a keyed hash of the content.
  - Identical content (double-click, retry) maps to the same file, so there are no duplicates.
- **Review:** over SSH only. No web endpoint reads these records.
  ```
  WEBSITES_REVIEW_DIR=… npx tsx scripts/websites-review.mts list
  WEBSITES_REVIEW_DIR=… npx tsx scripts/websites-review.mts show r-0123456789abcdef
  WEBSITES_REVIEW_DIR=… npx tsx scripts/websites-review.mts resolve r-0123456789abcdef
  ```
- **Notice:** the alert channel carries `event: returning_contact_review` with the reference as `status`. It contains no name, email, phone or message.
  - The record is marked `notified_at` only when the receiver accepts the notice.
- **Recovery:** if the notice fails (receiver down, process restart), the record stays pending.
  - Each later request re-sends pending notices: at most 5 per request, each reference at most every 10 minutes, and never for resolved records.
  - `list` also shows `NOT NOTIFIED`.
- **Backups:** the directory holds personal data. Include it in server backups only if those backups are access-controlled. Delete resolved records according to the privacy policy's retention period (owner/legal to set).

## Not covered (known limits)

- One app process (pm2) is assumed, as for the rate limits. Per-email serialization and the "same submission" memory are per process. Across processes, the failure mode is safe: a review record, never a write.
- Matching is by email only, the established adapter logic. A returning person who uses a new email is treated as new.
- `matched_on_upsert` contacts exist in GHL with only an email; the owner decides what to do with them.
- Review records are not deleted automatically.

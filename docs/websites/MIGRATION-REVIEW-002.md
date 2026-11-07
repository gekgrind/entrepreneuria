# Migration 002 (`website_*` tables): packet for independent review

**Status: prepared for review, NOT APPLIED.** The owner's instruction (2026-11-06) is not to apply it. Applying it needs a separate owner approval after the review.

Files: `scripts/002_websites_services.sql` (up) and `scripts/002_websites_services.down.sql` (rollback).

## What it creates

| Table | Purpose | Written by |
|---|---|---|
| `website_inquiries` | Durable preview requests plus consent evidence. `idempotency_key` is unique, which makes resubmits safe. | `lib/services/websites/inquiry-store-supabase.ts` (service role) |
| `website_projects` | Lifecycle state and the separate approval, payment, launch-approval and launch timestamps | Not written by app code yet |
| `website_project_events` | Append-only audit of every lifecycle transition | Not written by app code yet |
| `website_payment_events` | Webhook replay guard: one row per provider event id | Not written by app code yet |

## Properties the reviewer should confirm

- [ ] **Access**: RLS is enabled on all four tables, and no policies are created. `revoke all … from anon, authenticated`. Only the service role, which bypasses RLS, can read or write.
- [ ] **No pre-launch billing at the DB layer**: check `website_projects_subscription_after_launch`. `subscription_id` requires both `launched_at` and `setup_paid_at`.
- [ ] **No duplicate subscriptions**: `subscription_id` is `unique`.
- [ ] **Value domains**: the `state` and `package_id` check constraints match `lib/services/websites/lifecycle.ts` `PROJECT_STATES` and `packages.ts` `PACKAGE_IDS`.
- [ ] `gen_random_uuid()` is available. It is built in on PG13+ and on Supabase.
- [ ] Additive only: no existing table is altered, and no function, trigger or extension is created.
- [ ] PII: `fields` holds name, email, phone and business details, and `consent` holds an IP **hash** and the user agent. The retention period isn't defined yet. Raise it with the privacy notice review (spec §9).
- [ ] `updated_at` has no trigger. The app sets it on PATCH. Decide whether a trigger is wanted.

## Suggested review procedure (no production writes)

1. Apply to a local Supabase or disposable branch DB: `psql -f scripts/002_websites_services.sql`.
2. As `anon` and `authenticated`, confirm `select`/`insert` on each table fails.
3. As the service role, insert one inquiry. Insert again with the same `idempotency_key`, then confirm there's one row.
4. Try `update website_projects set subscription_id='x'` on a row with `launched_at is null`, and confirm the check constraint rejects it.
5. Run the down script and confirm all four tables are gone.

## After approval (not before)

Apply the migration, then set `WEBSITES_INQUIRY_STORE=supabase` in **nonproduction** only. Production stays off until all §11 gates pass.

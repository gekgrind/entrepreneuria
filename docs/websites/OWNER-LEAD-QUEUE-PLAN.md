# Owner lead queue: plan (D-12)

Status: **plan only, not built.** The owner's direction (2026-11-06) is to use the existing Supabase authentication plus an explicit, server-verified allowlist.

## Access model

1. **Authentication: existing session.** Read the user with `getAuthenticatedUser()` (`lib/supabase/auth-server.ts`). It verifies the session with Supabase Auth, so the user comes from Supabase, not from cookies alone. No new login flow.
2. **Authorization: explicit allowlist, checked on the server for every request.**
   - Server env `WEBSITES_ADMIN_USER_IDS`: a comma-separated list of Supabase **user ids (UUIDs)**, not emails. Emails can change or be unverified, and GitHub can withhold them.
   - New helper `lib/services/websites/admin.ts` (`import "server-only"`): `requireWebsitesAdmin()` returns the user or calls `notFound()`. Unknown users see a 404, not a 403, so the route isn't revealed.
   - An empty or unset allowlist denies everyone (fail-closed).
   - The check runs in the page server component **and** in every server action and route handler. Hiding the UI is not authorization.
3. **Data access: service role, server only.** RLS on `website_*` stays closed with no policies, so the browser can never query these tables directly. All reads go through server code after `requireWebsitesAdmin()`.

## Surface

| Item | Detail |
|---|---|
| Route | `app/(authenticated)/admin/websites/leads/page.tsx`, under the existing authenticated layout (redirects to `/login` when signed out) |
| List | `website_inquiries` ordered by `submitted_at desc`, filters for status (`received`, `crm_synced`, `crm_failed`), package and style. Paginated, 50 per page. |
| Detail | Fields, consent evidence and policy versions, CRM ids, attempts, last error |
| Actions (server actions, admin-checked, audited) | "Retry GHL sync" (re-runs `syncLead`, which is idempotent through upsert plus open-opportunity reuse) and "Mark handled" |
| Not in scope | Editing lead data, deleting leads, exporting CSV. Each needs a separate decision. |
| UI | Existing `components/ui/table`, `badge` and `button` components with existing tokens. Owner-only page, no marketing design change. |

## Ties to D-04 (gate `crm-sync-recovery`)

The queue is the manual recovery path. The gate also needs:
- **Automatic retry**: a scheduled job (cron route protected by a server secret, or a process-manager schedule) that retries `crm_failed` rows with backoff (for example 5 min, 30 min, 2 h, 12 h), with a maximum attempt count and then `needs_attention`.
- **Monitoring**: a count of `crm_failed` rows and of rows older than 15 min still in `received`, exposed to the existing health or status check.
- **Owner alert**: one notification per failure episode (email or GHL internal notification to the confirmed services inbox) when a row exhausts its automatic retries or stays unsynced for over 1 hour.

## Tests to add with the build

- `requireWebsitesAdmin`: signed out → redirect, signed in but not allowlisted → 404, allowlisted → allowed, empty allowlist → 404.
- Server actions reject non-admins even when called directly.
- Retry action converges on one contact and one opportunity (fake GHL).

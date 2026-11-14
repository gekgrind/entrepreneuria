# DRAFT: Subprocessors page update

> **DRAFT. Not published. Not legal advice.** These rows are added to the `subprocessors` array in `main:app/subprocessors/page.tsx`. Existing rows stay. Rows marked `[OWNER]` must be confirmed before publishing.

## Rows to add

| Provider | Purpose | Location | Status |
|---|---|---|---|
| HighLevel, Inc. / LeadConnector LLC | CRM, email, workflows and payment collection for Entrepreneuria Websites `[OWNER: + customer website hosting]` | United States `[web search — verify against HighLevel's sub-processor page, Sept 2025]` | Verified in code (`lib/integrations/ghl/*`) |
| Cloudflare, Inc. | Turnstile spam and bot protection on the website preview form | Global | Verified in code (`turnstile.ts`, `TurnstileWidget.tsx`) |
| `[OWNER: payment processor used by GHL payments]` | Card and bank payment processing for Entrepreneuria Websites | `[OWNER]` | Unverified (LGL-06) |

## Rows to confirm

| Provider | Question |
|---|---|
| Hostinger | Is it the VPS that runs entrepreneuria.io in production? `LAUNCH-READINESS.md` describes a VPS with nginx and pm2 but doesn't name the host `[unverified]` |
| Google | Add "business email (Google Workspace), including automated request notices" to the purpose, if not already covered by "email" |
| Vercel | Vercel preview deployments exist for this repository (PR #37 bot comments). If any production or public traffic is served by Vercel, add it. If previews only, no row is needed `[OWNER]` |
| `vibepreview.app` | Hosts the demo sites only. It receives no customer data unless D-OWN-09 sends prospect details there. Add it only in that case |

## Optional sentence under the table

> Entrepreneuria Websites uses HighLevel (GoHighLevel) to manage requests, customer communication and payments. Website preview requests that need manual review are stored on our own server.

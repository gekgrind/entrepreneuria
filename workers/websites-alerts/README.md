# Websites alert receiver (Cloudflare Worker)

Receives the signed alerts that the leads-only intake sends (`lib/services/websites/alerts.ts`) and emails the owner a short notice. Alerts carry **no visitor details**.

- Logic: `lib/services/websites/alert-receiver.ts`, tested in CI (`alert-receiver.test.ts`, `alert-receiver.worker.test.ts`)
- Entry: `index.ts`
- Config template: `wrangler.jsonc`

**Status: not deployed.** Every step below needs owner approval.

## What it does

| Check | Result |
|---|---|
| Path other than `/alerts`, or a method other than POST | 404 / 405 |
| Body over 4 KB | 413 |
| Missing, wrong or stale signature (HMAC-SHA256, ±5 min) | 401. Nothing is parsed, stored or sent. |
| Same signed request replayed | 200 `duplicate`, no email |
| Payload not exactly the 7 allowlisted fields, or a value outside the token rules | 400 |
| Same alert (event, step, status, environment) within 15 min | 200 `suppressed`, no email |
| More than 12 emails in the current hour | 200 `suppressed`, no email |
| Email send fails | 502, so the app retries (up to 2 retries) |

Alerts handled: lead-delivery failure, GHL auth failure, GHL rate limiting, intake unavailable, Turnstile down, config problems, capacity count unavailable, **1 slot left** (`capacity_near`), **intake full** (`capacity_full`), and `test`. The capacity events arrive with PR #34; this receiver already accepts them. Urgent alerts are prefixed `ACTION:`.

**Cost:** none expected. The Workers free plan covers 100k requests/day. Workers KV is free at this volume. Cloudflare Email Service sends to verified destination addresses for free on all plans.

## Prerequisites (VERIFY before starting)

1. `entrepreneuria.io` DNS is managed by Cloudflare. Email Routing works only on Cloudflare zones. **If it isn't, stop:** see "If DNS is not on Cloudflare".
2. You know where `misti@entrepreneuria.io` is hosted (Google Workspace, Microsoft 365, …). **Do not change the apex domain's MX records.** Everything below uses subdomains.

## Deploy

1. **Verify the destination mailbox.** Cloudflare dashboard → Email Service → Email Routing → Destination addresses → add `misti@entrepreneuria.io`. Click the link Cloudflare sends. This also proves the mailbox receives mail (decision D-20). Record who clicked it and when.
2. **Enable a sending subdomain without touching the apex.** Email Routing → Settings → Subdomains → add `alerts.entrepreneuria.io`. Cloudflare adds MX/SPF records **on that subdomain only**. If the dashboard offers to "Add records" or flags apex MX records as conflicting, **do not** accept it while apex mail is hosted elsewhere.
3. **Create the dedupe store:** `npx wrangler kv namespace create ALERT_DEDUPE`, then put its id in `wrangler.jsonc`.
4. **Generate the shared secret** (at least 32 characters, e.g. `openssl rand -hex 32`):
   - Worker: `npx wrangler secret put ALERT_WEBHOOK_SECRET`
   - App: `WEBSITES_ALERT_WEBHOOK_SECRET` in the server env, same value
   - Never commit it.
5. **Deploy** from `workers/websites-alerts/`: `npx wrangler deploy`. This creates `hooks.entrepreneuria.io` as a custom domain for the Worker.
6. **Point the app at it:** `WEBSITES_ALERT_WEBHOOK_URL=https://hooks.entrepreneuria.io/alerts`.
7. **Verify end to end:** `npx tsx scripts/websites-alert-test.mts staging` with the two app env values set. Expect `receiver answered: 200` and, within a minute, an email titled `[Entrepreneuria Websites] [staging] Test alert`. Record the result as evidence for gate `leads-failure-alerts`.

Cloudflare's Email Routing summary shows Worker-sent mail as "dropped" even when it was delivered. Check the inbox, not that counter.

**Optional hardening.** Unsigned traffic is already rejected cheaply. If the hostname attracts noise, add a WAF rate-limiting rule on `hooks.entrepreneuria.io/alerts`, e.g. 30 requests/minute per IP. The free plan includes one rule.

## Operate

- **Change the recipient:** update `ALERT_EMAIL_TO` and `destination_address` in `wrangler.jsonc`, verify the new address (step 1), then redeploy.
- **Rotate the secret:** set the new value in the Worker and the app at the same time. Alerts sent in between fail with 401, and the app logs them.
- **Logs:** `npx wrangler tail`. Logs carry reason codes and event names only.

## If DNS is not on Cloudflare

The logic is platform-neutral (standard `Request` / `Response` / `crypto.subtle`). Only the `Mailer` in `index.ts` is Cloudflare-specific. Options, in order of preference:

1. Move DNS to Cloudflare (free), then follow the steps above.
2. Host the same handler elsewhere and implement `Mailer` with any email API that has a free tier. This needs that provider's DNS records on a sending subdomain and a new secret.

Either option needs an owner decision.

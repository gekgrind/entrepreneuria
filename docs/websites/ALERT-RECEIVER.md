# Websites alert receiver (app server + existing mailbox)

Receives the signed alerts the leads-only intake sends (`lib/services/websites/alerts.ts`) and emails the owner. **No DNS change, no new subscription, no public endpoint.**

**Status: not deployed.** Each step below needs owner approval.

## Why not the Cloudflare Worker

`entrepreneuria.io` DNS is not on Cloudflare, and migrating it is ruled out (owner, 2026-11-09). A Worker's `send_email` binding can only send from a domain onboarded to Cloudflare Email Routing or Email Sending, which requires a Cloudflare zone. A `workers.dev` hostname can receive the webhook, but it has no sending domain, so it cannot email. The Worker variant was removed; it is in git history at `67d0faf`.

## Architecture

```
app (pm2: entrepreneuria)          receiver (pm2: websites-alerts)           mailbox provider
alerts.ts ── signed POST ──► http://127.0.0.1:3105/alerts ── SMTP (TLS) ──► owner's inbox
             HMAC-SHA256          verify → replay → payload →        AUTH as the mailbox,
             (no lead data)       cooldown → cap → send              send to itself
```

- **Code:**
  - `lib/services/websites/alert-receiver.ts`: checks and email copy (host-neutral)
  - `alert-receiver-server.ts`: loopback HTTP host
  - `smtp-mailer.ts`: SMTP client, no dependency
  - Entry: `scripts/websites-alert-receiver.mts`
- **Security:**
  - Binds to `127.0.0.1` only, so nothing outside the server can reach it. Every request is still verified: HMAC over `timestamp.body`, ±5 min window, constant-time compare, replay rejection, exact 7-field payload.
  - Rate limits: 120 requests/minute; one email per distinct alert per 15 min; at most 12 emails/hour. Capped review notices get 429 so the app retries them later.
  - SMTP requires TLS (implicit 465 or STARTTLS 587) with certificate verification. Credentials are never logged.
- **No personal data in alerts or logs.** Returning-contact notices carry only an opaque reference (`r-…`); details stay in the access-controlled review store (PR #36, `docs/websites/RETURNING-CONTACTS.md`).
- **Failure handling:** if SMTP fails, the receiver answers 502. The app retries twice, then logs `alert delivery failed` with the event name only. Review notices stay pending and are re-sent on later requests.

## Alerts covered

| Event | When | Urgent |
|---|---|---|
| `delivery_failed` | A new lead couldn't be written to GHL (step and status only) | ✔ |
| `ghl_auth_failed` | GHL answered 401/403 | ✔ |
| `ghl_rate_limited` | GHL 429, after 3 occurrences | |
| `turnstile_unavailable` | Spam check unreachable, after 3 | |
| `config_invalid`, `unavailable` | Proxy or configuration problems | ✔ |
| `capacity_count_unavailable` | Open-request count unreadable | |
| `capacity_near` / `capacity_full` | 4 of 5 / 5 of 5 open (PR #34) | full ✔ |
| `returning_contact_review` | Returning contact or failed lookup held for review (PR #36) | ✔ |
| `test` | `scripts/websites-alert-test.mts` | |

## Owner setup

1. **Confirm the mailbox and SMTP access.** Find where `misti@entrepreneuria.io` is hosted (MX record or the admin console) and get its SMTP submission settings:

   | Provider | Host | Port | Credential |
   |---|---|---|---|
   | Google Workspace | `smtp.gmail.com` | 465 | App password (needs 2-Step Verification; the admin must allow app passwords) |
   | Microsoft 365 | `smtp.office365.com` | 587 | Mailbox password or app password; **SMTP AUTH must be enabled for the mailbox** (off by default) |
   | Zoho Mail | `smtp.zoho.com` | 465 | App-specific password |
   | Other | from the provider | 465/587 | SMTP password |

   Sending from the mailbox to itself through its own provider needs no DNS change: the provider's existing SPF/DKIM already cover it. **If the provider allows no SMTP AUTH at all, stop and decide** (see "If SMTP isn't available").
2. **Create the env file** `/etc/entrepreneuria/websites-alerts.env`: owner root, group the app user, mode 0640.
   ```
   ALERT_WEBHOOK_SECRET=<openssl rand -hex 32>
   ALERT_EMAIL_TO=misti@entrepreneuria.io
   ALERT_SMTP_HOST=...
   ALERT_SMTP_PORT=465
   ALERT_SMTP_USER=misti@entrepreneuria.io
   ALERT_SMTP_PASS=<app password>
   ```
3. **Start it** as the app user, from the current release:
   ```
   cd /var/www/entrepreneuria-current
   pm2 start "node --env-file=/etc/entrepreneuria/websites-alerts.env --import tsx scripts/websites-alert-receiver.mts" --name websites-alerts
   pm2 save
   ```
   It refuses to start if a setting is missing, naming the setting but never its value. Restart it after deploys that change the receiver: `pm2 restart websites-alerts`.
4. **Point the app at it** (app `.env.local`):
   ```
   WEBSITES_ALERT_WEBHOOK_URL=http://127.0.0.1:3105/alerts
   WEBSITES_ALERT_WEBHOOK_SECRET=<same value as ALERT_WEBHOOK_SECRET>
   ```
   Plain `http` is accepted only for a loopback host.
5. **Verify end to end:**
   ```
   WEBSITES_ALERT_WEBHOOK_URL=http://127.0.0.1:3105/alerts WEBSITES_ALERT_WEBHOOK_SECRET=... npx tsx scripts/websites-alert-test.mts staging
   ```
   Expect `receiver answered: 200` and an email titled `[Entrepreneuria Websites] [staging] Test alert`. Record the output and the email's arrival time as evidence for gate `leads-failure-alerts`. The arrival also confirms the mailbox receives mail (D-20).

**Logs:** `pm2 logs websites-alerts`. Lines carry reason codes and event names only.

## If SMTP isn't available

Options, owner decision required:
1. Enable SMTP AUTH or app passwords on the existing mailbox. Preferred: no new service.
2. A transactional email provider's free tier. This needs that provider's DNS records (SPF/DKIM) on a sending subdomain at the current DNS host. That's a DNS *record* change, not a migration.

Only `smtp-mailer.ts` would change; the receiver and the app don't.

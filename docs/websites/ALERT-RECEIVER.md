# Websites alert receiver (app server + existing mailbox)

Receives the signed alerts the leads-only intake sends (`lib/services/websites/alerts.ts`) and emails the owner. **No DNS change, no new subscription, no public endpoint.**

**Status: not deployed.** Each step below needs owner approval.

## Why not the Cloudflare Worker

`entrepreneuria.io` DNS is not on Cloudflare, and migrating it is ruled out (owner, 2026-11-09). A Worker's `send_email` binding can only send from a domain onboarded to Cloudflare Email Routing or Email Sending, which requires a Cloudflare zone. A `workers.dev` hostname can receive the webhook, but it has no sending domain, so it cannot email. The Worker variant was removed; it is in git history at `67d0faf`.

## Architecture

```
app (pm2: entrepreneuria)          receiver (pm2: websites-alerts)           Google Workspace
alerts.ts ── signed POST ──► http://127.0.0.1:3105/alerts ── STARTTLS:587 ──► smtp-relay.gmail.com ──► misti@ inbox
             HMAC-SHA256          verify → replay → payload →        IP-authorized, TLS required,
             (no lead data)       cooldown → cap → send              registered sender only
```

- **Code:**
  - `lib/services/websites/alert-receiver.ts`: checks and email copy (host-neutral)
  - `alert-receiver-server.ts`: loopback HTTP host
  - `smtp-mailer.ts`: SMTP client, no dependency; IP or password auth
  - Entry: `scripts/websites-alert-receiver.mts`
  - Probe: `scripts/websites-smtp-probe.mts`
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

## Delivery method: Google Workspace SMTP relay (recommended)

Infrastructure confirmed by the owner (2026-11-09):
- DNS at Hostinger
- Email on Google Workspace (`misti@entrepreneuria.io`)
- App on the existing VPS

### Why the relay, not authenticated Gmail SMTP

| | **SMTP relay** `smtp-relay.gmail.com` (IP-authenticated) | Gmail SMTP `smtp.gmail.com` |
|---|---|---|
| Credential on the server | **None.** Google authorizes the VPS's public IP | App password (needs 2-Step Verification and admin permission) or OAuth 2.0 (Google Cloud project, client secret and refresh token on the server) |
| Status | Supported Workspace feature for servers and apps | Password sign-in ended for Workspace on 2025-05-01. App passwords remain, but you asked not to rely on them. OAuth is supported but adds a project and a long-lived secret |
| TLS | STARTTLS on 587, and the rule can **require** TLS | STARTTLS 587 / TLS 465 |
| Sender control | Admin rule: only registered users or addresses in your domains | The signed-in mailbox |
| Breaks if | The VPS's public IP changes | Password or app password reset; OAuth token revoked |
| DNS change | None | None |

**Recommendation:** the relay with **IP authentication + Require TLS + "Only registered Apps users in my domains"**. Nothing secret lives on the server, it's a documented Workspace feature, and Google enforces TLS and sender identity on its side.

**Prerequisite:** the VPS has a **static public IPv4**. If it doesn't, use `smtp.gmail.com` with an app password instead (`ALERT_SMTP_AUTH=password`); the code supports both.

**Residual risk:** the IP rule authorizes any process on that VPS to send as a registered `entrepreneuria.io` user. Mitigations:
- the VPS isn't shared
- TLS is required
- senders are restricted to registered users
- the receiver caps its own volume (12 emails/hour)

### What the receiver does for Google

- **EHLO name:** the sender's domain (`entrepreneuria.io`), never `localhost`. Google's relay answers `EHLO localhost` with `421 Try again later`; a test reproduces this.
- **Encryption:** STARTTLS before anything else; certificate verified against the system CA store. Plain SMTP is refused for any non-loopback host.
- **IPv4:** `ALERT_SMTP_FAMILY=4` makes the connection come from the allowlisted IPv4 address. Otherwise a dual-stack VPS may connect over IPv6 and be denied.
- **Sender and recipient:** both `misti@entrepreneuria.io`. The receiver refuses to start if they're on different domains.

## Owner setup

### 1. Find the VPS's public IPv4 (on the VPS)
```
curl -4 -s https://ifconfig.me ; echo
```
Confirm it's static, either in Hostinger's VPS panel or with the hosting provider. Note it as `<VPS_IPV4>`.

### 2. Google Admin Console: add the SMTP relay rule (super admin, **owner approval required**)
1. Sign in at **admin.google.com** with a Workspace administrator account.
2. Go to **Menu → Apps → Google Workspace → Gmail → Routing**.
3. Scroll to **SMTP relay service** and click **Configure**. If a rule already exists, click **Add another rule**; don't change existing rules.
4. **Description:** `Entrepreneuria Websites alerts (VPS)`.
5. **Allowed senders:** select **Only registered Apps users in my domains**.
6. **Authentication:**
   - Check **Only accept mail from the specified IP addresses**.
   - Click **Add**:
     - Description `VPS`
     - IP `<VPS_IPV4>` as a single address, not a range
     - Check **Enable**
     - Click **Save**
   - Leave **Require SMTP Authentication** unchecked.
7. **Encryption:** check **Require TLS encryption**.
8. Click **Save**. The setting lives at the top-level organization. Changes can take up to an hour; usually it's minutes.

**Nothing else changes:**
- MX records, inbound routing, users and existing routing rules stay as they are.
- No new service and no license change. The relay is included in Workspace.

### 3. Hostinger DNS: **no change required**

Sender and recipient are the same Workspace mailbox, and the relay sends from Google's servers. Existing records cover it. *Verify* these two items, but change nothing unless one is missing:
- **SPF:** the TXT record on `entrepreneuria.io` contains `include:_spf.google.com`. Workspace setup normally adds it. Check with `dig +short TXT entrepreneuria.io`.
- **DKIM:** Admin Console → Apps → Google Workspace → Gmail → **Authenticate email** shows "Authenticating email" for `entrepreneuria.io`.

If either is missing, fix it as a separate, deliberate change (owner approval): it affects all of the domain's mail, not just alerts. The alerts travel from Google's relay to a mailbox in the same Workspace domain. Stage 2 below shows whether they land in the inbox; if they go to spam, check these two records first.

### 4. Env file on the VPS (outside the repository)

Create `/etc/entrepreneuria/websites-alerts.env`: owner root, group the app user, mode 0640.
```
ALERT_WEBHOOK_SECRET=<openssl rand -hex 32>
ALERT_EMAIL_TO=misti@entrepreneuria.io
ALERT_SMTP_HOST=smtp-relay.gmail.com
ALERT_SMTP_PORT=587
ALERT_SMTP_AUTH=ip
ALERT_SMTP_FAMILY=4
```
The only secret is the webhook secret, which the app and the receiver share. No mail password exists.

### 5. Synthetic delivery test (three stages, on the VPS, as the app user)
```
cd /var/www/entrepreneuria-current
# Stage 1: TLS + IP authorization + sender/recipient accepted. Sends NOTHING.
node --env-file=/etc/entrepreneuria/websites-alerts.env --import tsx scripts/websites-smtp-probe.mts --check
# Stage 2: one probe email.
node --env-file=/etc/entrepreneuria/websites-alerts.env --import tsx scripts/websites-smtp-probe.mts
```
- **Stage 1** should print `OK: TLS established…`.
  - `FAILED at mail (550)`: the IP or sender isn't authorized. Check step 2, the IP and `ALERT_SMTP_FAMILY=4`.
  - `FAILED at ehlo (421)`: the EHLO name was refused or the IP is rate limited.
  - A connection timeout means outbound port 587 is blocked at the VPS firewall.
- **Stage 2:** the email `[Entrepreneuria Websites] [probe] SMTP delivery test …` should arrive in the inbox within a minute. Check spam, and record the arrival time.

### 6. Start the receiver
```
pm2 start "node --env-file=/etc/entrepreneuria/websites-alerts.env --import tsx scripts/websites-alert-receiver.mts" --name websites-alerts
pm2 save
```
- It refuses to start if a setting is missing or the sender and recipient domains differ, naming settings only, never values.
- It listens on `127.0.0.1:3105` only.
- Restart it after deploys that change the receiver: `pm2 restart websites-alerts`.

### 7. Point the app at it (app `.env.local`)
```
WEBSITES_ALERT_WEBHOOK_URL=http://127.0.0.1:3105/alerts
WEBSITES_ALERT_WEBHOOK_SECRET=<same value as ALERT_WEBHOOK_SECRET>
```

### 8. Stage 3: full chain (app signer → receiver → Google → inbox)
```
WEBSITES_ALERT_WEBHOOK_URL=http://127.0.0.1:3105/alerts WEBSITES_ALERT_WEBHOOK_SECRET=... npx tsx scripts/websites-alert-test.mts staging
```
Expect `receiver answered: 200` and the email `[Entrepreneuria Websites] [staging] Test alert`. Record both outputs and the arrival times. They're the evidence for gate `leads-failure-alerts` and for D-20 (the mailbox is operational).

**Logs:** `pm2 logs websites-alerts`. Lines carry reason codes and event names only.

## Fallback: authenticated Gmail SMTP

Use this if the VPS has no static IP, or the relay rule can't be added. Owner decision.
```
ALERT_SMTP_HOST=smtp.gmail.com
ALERT_SMTP_PORT=465
ALERT_SMTP_AUTH=password
ALERT_SMTP_USER=misti@entrepreneuria.io
ALERT_SMTP_PASS=<app password>   # requires 2-Step Verification; the admin must allow app passwords
```
Run the same three test stages. Resetting the account password revokes app passwords, which silently stops alerts until the env file is updated.

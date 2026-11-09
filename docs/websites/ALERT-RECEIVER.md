# Websites alert receiver (app server + existing mailbox)

Receives the signed alerts the leads-only intake sends (`lib/services/websites/alerts.ts`) and emails the owner. **No DNS change, no new subscription, no public endpoint.**

**Status: not deployed. No real email sent yet.** Each step below needs owner approval.

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

### Verified infrastructure (owner, 2026-11-09)

| Item | Value | Status |
|---|---|---|
| DNS | Hostinger | unchanged |
| Email | Google Workspace, `misti@entrepreneuria.io` | |
| VPS public outbound IPv4 | `147.79.75.1` | allowlisted in the relay rule |
| SMTP relay rule | IP auth, Require TLS, registered users only | configured by owner |
| Relay endpoint | `smtp-relay.gmail.com:587` STARTTLS | OpenSSL verify OK, cert `smtp-relay.gmail.com`, Google Trust Services |
| Relay authorization (MAIL FROM / RCPT TO from the IPv4) | | **not yet verified** (stage 1) |
| Actual delivery to the inbox | | **not yet verified** (stages 2 and 3) |

**The OpenSSL check ran over IPv6; the relay rule lists only the IPv4.** From IPv6, Google would answer `550 5.7.1 Invalid credentials for relay [<IPv6>]`. The receiver therefore:
- requires `ALERT_SMTP_FAMILY` whenever `ALERT_SMTP_AUTH=ip` (it refuses to start without it);
- with `ALERT_SMTP_FAMILY=4`, resolves only A records and disables Node's dual-stack racing (`autoSelectFamily: false`);
- checks the family actually connected before sending EHLO, and aborts with `FAILED at connect` otherwise;
- `--check` prints the source address, so you can see `147.79.75.1` (or the VPS's interface address if it sits behind NAT).

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
- **Encryption:** STARTTLS before anything else, TLS 1.2 minimum, `rejectUnauthorized: true` and host-name check against `smtp-relay.gmail.com`, plus an explicit `authorized` check after the handshake. The code refuses any option that disables verification. If the server doesn't offer STARTTLS, nothing past EHLO is sent. Plain SMTP is refused for any non-loopback host.
- **Authorization failures** (`550`/`553`/`554` at MAIL FROM or RCPT TO, `530` TLS required) fail the send, so the receiver answers 502 and the app retries. The receiver logs only `{event, error, stage, code}`, never the server's text (it contains the IP) or addresses. The probe script prints the server's reply line for diagnosis.
- **IPv4:** `ALERT_SMTP_FAMILY=4` makes the connection come from the allowlisted IPv4 address. Otherwise a dual-stack VPS may connect over IPv6 and be denied.
- **Sender and recipient:** both `misti@entrepreneuria.io`. The receiver refuses to start if they're on different domains.

## Owner setup

### 1. VPS public IPv4: **done** (`147.79.75.1`)
Still to confirm once: the IPv4 is static (Hostinger VPS panel). If it changes, alerts stop with `550` until the rule is updated.

### 2. Google Admin Console: SMTP relay rule: **done** (reference only)
1. Sign in at **admin.google.com** with a Workspace administrator account.
2. Go to **Menu → Apps → Google Workspace → Gmail → Routing**.
3. Scroll to **SMTP relay service** and click **Configure**. If a rule already exists, click **Add another rule**; don't change existing rules.
4. **Description:** `Entrepreneuria Websites alerts (VPS)`.
5. **Allowed senders:** select **Only registered Apps users in my domains**.
6. **Authentication:**
   - Check **Only accept mail from the specified IP addresses**.
   - Click **Add**:
     - Description `VPS`
     - IP `147.79.75.1` as a single address, not a range
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
ALERT_SMTP_EXPECT_IP=147.79.75.1
```
The only secret is the webhook secret, which the app and the receiver share. No mail password exists. `ALERT_SMTP_EXPECT_IP` is read by the probe only (a printed note, not a block).

### 5. Synthetic tests (on the VPS)

**Where the code comes from.** `deploy.yml` deploys only `main`, so PR #35 is **not** in `/var/www/entrepreneuria-current`. Stage the branch in a throwaway directory. This doesn't touch the live release, `main`, pm2 or the app's env:
```
sudo install -d -o "$USER" /opt/websites-alerts-test
git -C /var/www/entrepreneuria fetch origin feat/websites-alert-receiver
git -C /var/www/entrepreneuria archive FETCH_HEAD | tar -x -C /opt/websites-alerts-test
cd /opt/websites-alerts-test && npm ci --no-audit --no-fund
```
After the merge and deploy, use `/var/www/entrepreneuria-current` instead and delete `/opt/websites-alerts-test`.

**Stage 0: network pre-checks. Sends nothing.**
```
curl -4 -s https://ifconfig.me ; echo          # expect 147.79.75.1
getent ahostsv4 smtp-relay.gmail.com | head -3  # IPv4 addresses resolve
openssl s_client -4 -starttls smtp -connect smtp-relay.gmail.com:587 \
  -verify_return_error -verify_hostname smtp-relay.gmail.com -brief </dev/null
# expect "Verification: OK" and a "CONNECTED(...)" line over IPv4
```

**Stage 1: SMTP authorization over IPv4. Sends nothing (RSET before DATA).**
```
node --env-file=/etc/entrepreneuria/websites-alerts.env --import tsx scripts/websites-smtp-probe.mts --check
```
Expected:
```
host=smtp-relay.gmail.com:587 security=starttls auth=ip family=4 ehlo=entrepreneuria.io from=misti@entrepreneuria.io to=misti@entrepreneuria.io
connected: IPv4 <local IPv4> -> <Google IPv4>
tls: TLSv1.3, certificate verified, subject=smtp-relay.gmail.com issuer=Google Trust Services
OK: TLS established, server accepted the sender and recipient. Nothing was sent.
```
| Output | Meaning / fix |
|---|---|
| `FAILED at connect` | Connected over the wrong family; keep `ALERT_SMTP_FAMILY=4` |
| `FAILED at mail (550)` / `rcpt (550)` + `Invalid credentials for relay [x]` | `x` isn't in the rule. If `x` is IPv6, the family setting is missing; if it's an IPv4 other than 147.79.75.1, update the rule |
| `FAILED at mail (550)` + sender wording | `ALERT_EMAIL_FROM` isn't a registered user in the domain |
| `FAILED at mail (530)` | TLS or SMTP AUTH demanded: leave "Require SMTP Authentication" unchecked |
| `FAILED at starttls` | Certificate or TLS failure: check `ca-certificates` and the clock |
| `FAILED at ehlo (421)` | EHLO name refused or rate limited; wait, retry once |
| timeout | Outbound 587 over IPv4 blocked at the VPS firewall |

The rule can take up to an hour to apply. Re-run stage 1 before concluding it's wrong.

**Stage 2: one probe email. Owner approval required (sends a real email).**
```
node --env-file=/etc/entrepreneuria/websites-alerts.env --import tsx scripts/websites-smtp-probe.mts
```
The email `[Entrepreneuria Websites] [probe] SMTP delivery test …` should arrive within a minute. Check spam, and record the arrival time.

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

### 8. Stage 3: one synthetic end-to-end alert (app signer → receiver → Google → inbox)

**Owner approval required (sends one real email).** It can run before steps 6 and 7: the receiver runs in the foreground from the staging directory, so pm2, the live app and its env stay untouched. Two shells on the VPS:

Shell A (receiver, foreground, loopback only):
```
cd /opt/websites-alerts-test
node --env-file=/etc/entrepreneuria/websites-alerts.env --import tsx scripts/websites-alert-receiver.mts
# expect: [websites-alerts] listening on 127.0.0.1:3105
```
Shell B (one signed `test` alert; the secret comes from the env file, so it never appears in the command line, history or `ps`):
```
cd /opt/websites-alerts-test
( set -a; . /etc/entrepreneuria/websites-alerts.env; set +a
  WEBSITES_ALERT_WEBHOOK_URL=http://127.0.0.1:3105/alerts \
  WEBSITES_ALERT_WEBHOOK_SECRET="$ALERT_WEBHOOK_SECRET" \
  node --import tsx scripts/websites-alert-test.mts staging )
# expect: receiver answered: 200   (exit code 0)
```
Shell A should log `sent {"event":"test"}`. The inbox should get `[Entrepreneuria Websites] [staging] Test alert` within a minute. Then stop shell A (Ctrl-C).

Results:
- `502` in shell B with `email failed {"stage":…,"code":…}` in shell A: SMTP problem, use the stage 1 table.
- `401`: the two secrets differ.
- `200` with `suppressed`: the same test within 15 min (cooldown), so wait.

Record both outputs and the arrival time. They're the evidence for gate `leads-failure-alerts` and for D-20 (the mailbox is operational).

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

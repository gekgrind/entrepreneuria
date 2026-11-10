# Websites alert receiver (app server + existing mailbox)

Receives the signed alerts the leads-only intake sends (`lib/services/websites/alerts.ts`) and emails the owner. **No DNS change, no new subscription, no public endpoint.**

**Status: staging-verified, not deployed.** Real delivery was proven on the app server from a temporary, foreground receiver (2026-11-09, owner-run). The permanent receiver (pm2) and the app's alert settings are **not** live yet. Each remaining step needs owner approval.

> Server-specific values (public IP, host name, mailbox, ports, file paths) are deliberately **not** in this public repository. They are kept in the owner's private operations notes. Placeholders below look like `<VPS public IPv4>`.

## Why not the Cloudflare Worker

The site's DNS is not on Cloudflare, and migrating it is ruled out (owner, 2026-11-09). A Worker's `send_email` binding can only send from a domain onboarded to Cloudflare Email Routing or Email Sending, which requires a Cloudflare zone. A `workers.dev` hostname can receive the webhook, but it has no sending domain, so it cannot email. The Worker variant was removed; it is in git history at `67d0faf`.

## Architecture

```
app (pm2: entrepreneuria)          receiver (pm2: websites-alerts)                  Google Workspace
alerts.ts ── signed POST ──► http://127.0.0.1:<receiver port>/alerts ── STARTTLS:587 ──► SMTP relay ──► <owner inbox>
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
- **Repeats (launch P2-6):** the app sends the first occurrence of an alert at once and batches repeats of the same event, step and status. A batch goes out without needing a later occurrence, once the previous email for that alert has finished plus the dedupe window (15 min) plus a 60 s margin, with `Occurrences:` showing how many it covers. The wait is measured from when the previous delivery finished, so the batch arrives after the receiver's own 15-minute cooldown and is emailed rather than suppressed. Keep the app window at least as long as the receiver cooldown. Batches are held in memory (one app process); a restart drops unsent batches.
- **Readiness (launch P0-3):** the receiver answers `GET /health` with `{"ok":true}` (no auth, no state, no detail). Before each leads-mode submission the app checks it (cached for 60 s when healthy, re-checked after 10 s when not). While the receiver doesn't answer, the inquiry endpoint returns `unavailable`, so visitors see the email option instead of a form whose failure alerts nobody would receive. The app logs `alert receiver unreachable` and `alert receiver reachable again`. Limits: this proves the receiver process is up, not that SMTP delivery works; SMTP failures surface as 502s, retries and pending review notices, as above. Process supervision (start on boot, restart on crash) is still required on the server.

## Alerts covered

| Event | When | Urgent |
|---|---|---|
| `delivery_failed` | A new lead couldn't be written to GHL (step and status only); the lead itself is held in the review store with its own notice | ✔ |
| `ghl_auth_failed` | GHL answered 401/403 | ✔ |
| `ghl_rate_limited` | GHL 429, after 3 occurrences | |
| `turnstile_unavailable` | Spam check unreachable, after 3 | |
| `config_invalid`, `unavailable` | Proxy or configuration problems | ✔ |
| `capacity_count_unavailable` | Open-request count unreadable | |
| `capacity_near` / `capacity_full` | 4 of 5 / 5 of 5 open (PR #34) | full ✔ |
| `returning_contact_review` | Returning contact, failed lookup, failed new-lead delivery or manual-intake request held for review | ✔ |
| `test` | `scripts/websites-alert-test.mts` | |

## Delivery method: Google Workspace SMTP relay (recommended)

### Verified (owner, 2026-11-09; values in the private operations notes)

| Item | Status |
|---|---|
| DNS provider unchanged; SPF already covers Google | checked |
| App server has a static public IPv4, allowlisted in the relay rule | configured by owner |
| Relay rule: IP auth, Require TLS, registered users only | configured by owner |
| Relay endpoint STARTTLS, certificate verified | OpenSSL verify OK |
| Relay authorization over IPv4 (`websites-smtp-probe.mts --check`, nothing sent) | **passed** (stage 1) |
| Actual delivery to the inbox from a foreground receiver (`websites-alert-test.mts staging`) | **passed** (stage 3) |
| DKIM / DMARC | not checked from here; see step 3 |

**What this proves:** signing → loopback receiver → signature, replay and payload checks → IPv4 STARTTLS with verified certificate → IP-authorized relay → inbox, with `ALERT_SMTP_FAMILY=4` and no SMTP credentials.

**What it does not prove (production gates still open):**
- the receiver running under pm2 and surviving restarts and deploys;
- the **app** raising a real alert (only the test script signed one); needs `WEBSITES_ALERT_WEBHOOK_URL`/`_SECRET` in the app's environment after the stack is on `main`;
- `[production]`-labelled delivery and inbox placement over time.

**IPv4 only.** If the relay rule lists only the server's IPv4 address, a connection over IPv6 is denied (`550 5.7.1 Invalid credentials for relay`). The receiver therefore:
- requires `ALERT_SMTP_FAMILY` whenever `ALERT_SMTP_AUTH=ip` (it refuses to start without it);
- with `ALERT_SMTP_FAMILY=4`, resolves only A records and disables Node's dual-stack racing (`autoSelectFamily: false`);
- checks the family actually connected before sending EHLO, and aborts with `FAILED at connect` otherwise;
- `--check` prints the source address, so you can compare it with the allowlisted address.

### Why the relay, not authenticated Gmail SMTP

| | **SMTP relay** (IP-authenticated) | Gmail SMTP `smtp.gmail.com` |
|---|---|---|
| Credential on the server | **None.** Google authorizes the server's public IP | App password (needs 2-Step Verification and admin permission) or OAuth 2.0 (Google Cloud project, client secret and refresh token on the server) |
| Status | Supported Workspace feature for servers and apps | Password sign-in ended for Workspace on 2025-05-01. App passwords remain, but the owner asked not to rely on them. OAuth is supported but adds a project and a long-lived secret |
| TLS | STARTTLS on 587, and the rule can **require** TLS | STARTTLS 587 / TLS 465 |
| Sender control | Admin rule: only registered users or addresses in your domains | The signed-in mailbox |
| Breaks if | The server's public IP changes | Password or app password reset; OAuth token revoked |
| DNS change | None | None |

**Recommendation:** the relay with **IP authentication + Require TLS + "Only registered Apps users in my domains"**. Nothing secret lives on the server, it's a documented Workspace feature, and Google enforces TLS and sender identity on its side.

**Prerequisite:** the server has a **static public IPv4**. If it doesn't, use `smtp.gmail.com` with an app password instead (`ALERT_SMTP_AUTH=password`); the code supports both.

**Residual risk:** the IP rule authorizes any process on that server to send as a registered user of the domain. Mitigations: the server isn't shared with untrusted tenants, TLS is required, senders are restricted to registered users, and the receiver caps its own volume (12 emails/hour). Alternative: a dedicated low-privilege Workspace user with an app password (`ALERT_SMTP_AUTH=password`).

### What the receiver does for Google

- **EHLO name:** the sender's domain, never `localhost`. Google's relay answers `EHLO localhost` with `421 Try again later`; a test reproduces this.
- **Encryption:** STARTTLS before anything else, TLS 1.2 minimum, `rejectUnauthorized: true` and host-name check against the relay host, plus an explicit `authorized` check after the handshake. The code refuses any option that disables verification. If the server doesn't offer STARTTLS, nothing past EHLO is sent. Plain SMTP is refused for any non-loopback host.
- **Authorization failures** (`550`/`553`/`554` at MAIL FROM or RCPT TO, `530` TLS required) fail the send, so the receiver answers 502 and the app retries. The receiver logs only `{event, error, stage, code}`, never the server's text (it contains the IP) or addresses. The probe script prints the server's reply line for diagnosis.
- **IPv4:** `ALERT_SMTP_FAMILY=4` makes the connection come from the allowlisted IPv4 address. Otherwise a dual-stack server may connect over IPv6 and be denied.
- **Sender and recipient:** the same monitored Workspace mailbox. The receiver refuses to start if they're on different domains.

## Owner setup

### 1. Server public IPv4: **done** (value in the private notes)
Confirm once, in writing, with the hosting provider that the server's dedicated IPv4 survives migrations and re-creation. If it ever changes, alerts fail with `550 Invalid credentials for relay` and the app logs `alert delivery failed`; update the relay rule's IP and `ALERT_SMTP_EXPECT_IP`.

### 2. Google Admin Console: SMTP relay rule: **done** (reference only)
1. Sign in at **admin.google.com** with a Workspace administrator account.
2. Go to **Menu → Apps → Google Workspace → Gmail → Routing**.
3. Scroll to **SMTP relay service** and click **Configure**. If a rule already exists, click **Add another rule**; don't change existing rules.
4. **Description:** `Entrepreneuria Websites alerts (server)`.
5. **Allowed senders:** select **Only registered Apps users in my domains**.
6. **Authentication:**
   - Check **Only accept mail from the specified IP addresses**.
   - Click **Add**: description `server`, IP `<VPS public IPv4>` as a single address (not a range), check **Enable**, click **Save**.
   - Leave **Require SMTP Authentication** unchecked.
7. **Encryption:** check **Require TLS encryption**.
8. Click **Save**. The setting lives at the top-level organization. Changes can take up to an hour; usually it's minutes.

**Nothing else changes:** MX records, inbound routing, users and existing routing rules stay as they are. No new service and no license change; the relay is included in Workspace.

### 3. DNS: **no change required** (SPF verified 2026-11-09)

DKIM and DMARC weren't verified from here. They don't block alerts (sender and recipient are the same Workspace domain), but check them once:
```
dig +short TXT google._domainkey.<your domain>   # expect "v=DKIM1; k=rsa; p=…"
dig +short TXT _dmarc.<your domain>              # expect "v=DMARC1; …" (absent = no policy)
```

*Verify* these two items, but change nothing unless one is missing:
- **SPF:** the domain's TXT record contains `include:_spf.google.com`. Check with `dig +short TXT <your domain>`.
- **DKIM:** Admin Console → Apps → Google Workspace → Gmail → **Authenticate email** shows "Authenticating email" for the domain.

If either is missing, fix it as a separate, deliberate change (owner approval): it affects all of the domain's mail, not just alerts.

### Environment variables (receiver)

All live in a root-owned env file outside the repository (`<receiver env file>`), never in Git. The names match `scripts/websites-alert-receiver.mts`, `scripts/websites-smtp-probe.mts` and `smtp-mailer.ts`.

| Name | Required | Typical value | Notes |
|---|---|---|---|
| `ALERT_WEBHOOK_SECRET` | yes | secret (32+ chars) | Same value as the app's `WEBSITES_ALERT_WEBHOOK_SECRET`. Never print or commit. |
| `ALERT_EMAIL_TO` | yes | `<owner inbox>` | A confirmed, monitored mailbox. |
| `ALERT_EMAIL_FROM` | no | unset → `ALERT_EMAIL_TO` | **Sender.** Must be a registered user in the same domain (relay rule "Only registered Apps users"); the receiver refuses to start if its domain differs from `ALERT_EMAIL_TO`. A non-existent alias is rejected by the rule with 550. |
| `ALERT_SMTP_HOST` | yes | `smtp-relay.gmail.com` | |
| `ALERT_SMTP_PORT` | yes | `587` | |
| `ALERT_SMTP_SECURITY` | no | unset → `starttls` (from port) | `tls` for 465. `none` is refused for any non-loopback host. |
| `ALERT_SMTP_AUTH` | no | `ip` | `password` needs `ALERT_SMTP_USER`/`ALERT_SMTP_PASS`; credentials with `ip` are refused. |
| `ALERT_SMTP_FAMILY` | yes with `ip` | `4` | Start is refused without it in IP mode. |
| `ALERT_SMTP_HELO` | no | unset → sender's domain | Must be a FQDN; `localhost` refused. |
| `ALERT_SMTP_EXPECT_IP` | no | `<VPS public IPv4>` | Probe only (prints a note on mismatch). |
| `ALERT_RECEIVER_PORT` | no | unset → code default | 1024–65535. Loopback only. |
| `ALERT_SMTP_USER` / `ALERT_SMTP_PASS` | fallback only | unset | Only for the `smtp.gmail.com` fallback. |

App side (the app's `.env.local`, which `deploy.yml` copies into each release with mode 0600): `WEBSITES_ALERT_WEBHOOK_URL=http://127.0.0.1:<receiver port>/alerts` and `WEBSITES_ALERT_WEBHOOK_SECRET`. Plain `http` is accepted only for `127.0.0.1`/`[::1]`.

### 4. Env file on the server (outside the repository): **done**

Create `<receiver env file>`: owner root, group the app user, mode 0640.
```
ALERT_WEBHOOK_SECRET=<openssl rand -hex 32>
ALERT_EMAIL_TO=<owner inbox>
ALERT_SMTP_HOST=smtp-relay.gmail.com
ALERT_SMTP_PORT=587
ALERT_SMTP_AUTH=ip
ALERT_SMTP_FAMILY=4
ALERT_SMTP_EXPECT_IP=<VPS public IPv4>
```
The only secret is the webhook secret, which the app and the receiver share. No mail password exists. `ALERT_SMTP_EXPECT_IP` is read by the probe only (a printed note, not a block).

### 5. Synthetic tests (on the server)

**Where the code comes from.** `deploy.yml` deploys only `main`. Until the stack is merged, stage the branch in a throwaway directory (`<staging dir>`) outside the web root; this doesn't touch the live release, `main`, pm2 or the app's env:
```
sudo install -d -o "$USER" <staging dir>
git -C <app source repo> fetch origin <branch>
git -C <app source repo> archive FETCH_HEAD | tar -x -C <staging dir>
cd <staging dir> && npm ci --no-audit --no-fund
```
After the merge and deploy, use `<current release>` instead and delete `<staging dir>`.

**Stage 0: network pre-checks. Sends nothing.**
```
curl -4 -s https://ifconfig.me ; echo          # expect <VPS public IPv4>
getent ahostsv4 smtp-relay.gmail.com | head -3  # IPv4 addresses resolve
openssl s_client -4 -starttls smtp -connect smtp-relay.gmail.com:587 \
  -verify_return_error -verify_hostname smtp-relay.gmail.com -brief </dev/null
# expect "Verification: OK" and a "CONNECTED(...)" line over IPv4
```

**Stage 1: SMTP authorization over IPv4. Sends nothing (RSET before DATA).**
```
node --env-file=<receiver env file> --import tsx scripts/websites-smtp-probe.mts --check
```
Expected (abridged):
```
host=smtp-relay.gmail.com:587 security=starttls auth=ip family=4 ehlo=<domain> from=<owner inbox> to=<owner inbox>
connected: IPv4 <local IPv4> -> <Google IPv4>
tls: TLSv1.3, certificate verified, subject=smtp-relay.gmail.com issuer=Google Trust Services
OK: TLS established, server accepted the sender and recipient. Nothing was sent.
```
| Output | Meaning / fix |
|---|---|
| `FAILED at connect` | Connected over the wrong family; keep `ALERT_SMTP_FAMILY=4` |
| `FAILED at mail (550)` / `rcpt (550)` + `Invalid credentials for relay [x]` | `x` isn't in the rule. If `x` is IPv6, the family setting is missing; if it's another IPv4, update the rule |
| `FAILED at mail (550)` + sender wording | `ALERT_EMAIL_FROM` isn't a registered user in the domain |
| `FAILED at mail (530)` | TLS or SMTP AUTH demanded: leave "Require SMTP Authentication" unchecked |
| `FAILED at starttls` | Certificate or TLS failure: check `ca-certificates` and the clock |
| `FAILED at ehlo (421)` | EHLO name refused or rate limited; wait, retry once |
| timeout | Outbound 587 over IPv4 blocked at the server firewall |

The rule can take up to an hour to apply. Re-run stage 1 before concluding it's wrong.

**Stage 2: one probe email. Owner approval required (sends a real email).**
```
node --env-file=<receiver env file> --import tsx scripts/websites-smtp-probe.mts
```
The email `[Entrepreneuria Websites] [probe] SMTP delivery test …` should arrive within a minute. Check spam, and record the arrival time.

### 6. Start the receiver under pm2 (after the stack reaches `main` and deploys)

**First confirm the temporary test receiver is gone** (read-only):
```
ss -ltnp 'sport = :<receiver port>'      # expect no output
pgrep -af websites-alert-receiver        # expect no output
```
If either shows a process started from `<staging dir>`, stop it (Ctrl-C in its shell or `kill <pid>`; it holds no state that matters).

How it fits the existing deploy:
- `deploy.yml` only deletes and restarts the `entrepreneuria` pm2 process. It never touches `websites-alerts`, so a deploy doesn't stop alerts.
- pm2 keeps the `--cwd` path; the `current` release symlink is resolved when the process starts. A running receiver keeps its old release (releases aren't pruned) until `pm2 restart websites-alerts`.
- No nginx change: the app calls the loopback address directly from the server process; nothing is routed through nginx and nothing is public.
```
cd <current release>
pm2 start "node --env-file=<receiver env file> --import tsx scripts/websites-alert-receiver.mts" \
  --name websites-alerts --cwd <current release>
pm2 save
ss -ltnp 'sport = :<receiver port>'   # expect 127.0.0.1 only, never 0.0.0.0 or *
```
- It refuses to start if a setting is missing or the sender and recipient domains differ, naming settings only, never values.
- It listens on `127.0.0.1` only.
- Restart it after deploys that change the receiver: `pm2 restart websites-alerts`.
- Check it survives a reboot: `pm2 startup` must be configured for the app user, and `pm2 ls` after a restart shows `websites-alerts` online.

### 7. Point the app at it (app `.env.local`)
```
WEBSITES_ALERT_WEBHOOK_URL=http://127.0.0.1:<receiver port>/alerts
WEBSITES_ALERT_WEBHOOK_SECRET=<same value as ALERT_WEBHOOK_SECRET>
```

### 8. Stage 3: one synthetic end-to-end alert (app signer → receiver → Google → inbox)

**Owner approval required (sends one real email).** It can run before steps 6 and 7: the receiver runs in the foreground from the staging directory, so pm2, the live app and its env stay untouched. Two shells on the server:

Shell A (receiver, foreground, loopback only):
```
cd <staging dir>
node --env-file=<receiver env file> --import tsx scripts/websites-alert-receiver.mts
# expect: [websites-alerts] listening on 127.0.0.1:<receiver port>
```
Shell B (one signed `test` alert; the secret comes from the env file, so it never appears in the command line, history or `ps`):
```
cd <staging dir>
( set -a; . <receiver env file>; set +a
  WEBSITES_ALERT_WEBHOOK_URL=http://127.0.0.1:<receiver port>/alerts \
  WEBSITES_ALERT_WEBHOOK_SECRET="$ALERT_WEBHOOK_SECRET" \
  node --import tsx scripts/websites-alert-test.mts staging )
# expect: receiver answered: 200   (exit code 0)
```
Shell A should log `sent {"event":"test"}`. The inbox should get `[Entrepreneuria Websites] [staging] Test alert` within a minute. Then stop shell A (Ctrl-C).

Results:
- `502` in shell B with `email failed {"stage":…,"code":…}` in shell A: SMTP problem, use the stage 1 table.
- `401`: the two secrets differ.
- `200` with `suppressed`: the same test within 15 min (cooldown), so wait.

Record both outputs and the arrival time (privately). They're the evidence for gate `leads-failure-alerts` and for D-20 (the mailbox is operational).

**Logs:** `pm2 logs websites-alerts`. Lines carry reason codes and event names only.

## Fallback: authenticated Gmail SMTP

Use this if the server has no static IP, or the relay rule can't be added. Owner decision.
```
ALERT_SMTP_HOST=smtp.gmail.com
ALERT_SMTP_PORT=465
ALERT_SMTP_AUTH=password
ALERT_SMTP_USER=<sending mailbox>
ALERT_SMTP_PASS=<app password>   # requires 2-Step Verification; the admin must allow app passwords
```
Run the same three test stages. Resetting the account password revokes app passwords, which silently stops alerts until the env file is updated.

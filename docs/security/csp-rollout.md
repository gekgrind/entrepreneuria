# Browser security headers and CSP: rollout and monitoring

Applies to the `entrepreneuria.io` hub, the Next.js app in this repository
that serves `/login`, `/sign-up`, `/auth/*` and the shared session. Sibling apps
(Architecta, Prospra, Directorium, Synceri, Channelwright, Design Studio) set
their own headers in their own repositories and are not changed by this
document.

## What ships

| Control | Where | Default |
|---|---|---|
| `Content-Security-Policy-Report-Only`: full nonce policy | `proxy.ts` → `lib/security/csp.ts` | on (report-only) |
| `Content-Security-Policy`: baseline `frame-ancestors 'none'; base-uri 'self'; object-src 'none'` | `next.config.mjs` → `lib/security/browser-headers.mjs` (static) | enforced in every mode |
| `X-Frame-Options: DENY` | `next.config.mjs` → `lib/security/browser-headers.mjs` | on |
| `X-Content-Type-Options: nosniff` | same | on |
| `Referrer-Policy: strict-origin-when-cross-origin` | same | on (this is already the browser default) |
| `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()` | same | on |
| `Strict-Transport-Security: max-age=86400` (this host only) | same | production only |
| `X-Powered-By` removed | `next.config.mjs` `poweredByHeader: false` | on |
| Violation intake `POST /api/security/csp-report` | `app/api/security/csp-report/route.ts` | on |

### The full policy

```
default-src 'self';
script-src 'self' 'nonce-<per request>' 'strict-dynamic' https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob: <NEXT_PUBLIC_SUPABASE_URL> https://lh3.googleusercontent.com https://avatars.githubusercontent.com;
font-src 'self' data: https://fonts.gstatic.com;
connect-src 'self' <NEXT_PUBLIC_SUPABASE_URL> wss://<supabase host> https://challenges.cloudflare.com;
frame-src https://challenges.cloudflare.com;
worker-src 'self' blob:;
media-src 'self' blob:;
manifest-src 'self';
form-action 'self';
frame-ancestors 'none'; base-uri 'self'; object-src 'none';
report-uri /api/security/csp-report; report-to csp-endpoint
```

In development `'unsafe-eval'` is added to `script-src`, because React's
development build needs it. When enforced in production,
`upgrade-insecure-requests` is added.

### Why it is built this way

- **Nonce plus `'strict-dynamic'`.** Next.js 16 reads the nonce from the request's CSP header and stamps it on every script it renders. `'strict-dynamic'` lets those scripts load what they need: Turnstile through `next/script`, and lazy chunks such as the R3F constellation. An injected `<script src>` tag or inline block has no nonce, so it is refused. Host allowlists in `script-src` are only a fallback for CSP2 browsers.
- **Every HTML route is dynamic.** The root layout reads the session, so no page is prerendered with a stale nonce. `next build` lists only `/icon.png`, `/robots.txt` and `/sitemap.xml` as static. If a page is ever made static, it would ship without the nonce and break under enforcement, and the e2e check catches that.
- **`style-src 'unsafe-inline'` stays.** React `style` props, Radix and the motion libraries render inline style attributes on the server. Styles cannot execute script. Removing this would need a large refactor and buys little.
- **The request headers are rewritten.** The proxy deletes any `Content-Security-Policy*` or `x-nonce` header a client sends before setting its own, so a client cannot choose the nonce Next.js uses.
- **The proxy never sends a CSP without the nonce.** Next.js copies every header the proxy *responds* with onto the forwarded request (`router-utils/resolve-routes.js`), and it reads `content-security-policy` before `content-security-policy-report-only` when it looks for the nonce. An earlier draft sent the baseline from the proxy, and every script rendered without a nonce. The e2e check caught this. The baseline is therefore a static header from `next.config.mjs`, and unit tests assert that the proxy only ever emits nonce-carrying policies.

## Kill switches (environment, no commit needed)

| Variable | Values | Effect |
|---|---|---|
| `CSP_MODE` | `report-only` (default), `enforce`, `off` | `off` removes the nonce policy. The static baseline stays, because it cannot break a page this app renders. Any unrecognised value falls back to `report-only`, never to `enforce`. |
| `SECURITY_HSTS_MAX_AGE` | integer seconds, `0`–`63072000` | Overrides the 1-day default. `0` tells browsers to forget the policy. Invalid values keep the default. |

Both are read on the server at request time (`CSP_MODE`) and at config load
(`SECURITY_HSTS_MAX_AGE`), so a restart applies them.

## Monitoring

Each violation is logged by the Next.js process as one line:

```
[csp-violation] {"disposition":"report","directive":"script-src-elem","blocked":"https://evil.example/x.js","document":"https://entrepreneuria.io/login","source":null,"line":null,"sample":null}
```

- URLs are reduced to `origin + path`. Query strings and fragments are dropped, because auth pages carry `code`, `token_hash` and `next` in them.
- `sample` holds the first 80 characters of a blocked inline script. This is the field that would show an injected ClickFix payload.
- At most 120 lines are logged per minute per process. Above that, a `{"dropped": N}` line is logged when the window rolls over.
- Bodies over 16 KB, wrong content types and malformed JSON are refused and not logged.

On the VPS, read them from the process log, for example:

```bash
pm2 logs <app> --lines 2000 --nostream | grep '\[csp-violation\]'
```

or from `journalctl -u <service>`, whichever supervises `next start`. Use the
command that matches the deployment; this repository does not record it.

### Reading the reports

| Pattern | Meaning | Action |
|---|---|---|
| `blocked: "chrome-extension:"` / `moz-extension:` | A visitor's browser extension | Ignore. This is expected noise. |
| `blocked: "inline"`, `sample` looks like app code | A legitimate inline script without a nonce | Fix before enforcing. |
| `blocked: "inline"` or an unknown origin, with a `sample` or URL you don't recognise | Possible injection | Investigate: record the time, page and sample. |
| `directive: "img-src"`, an avatar host | A provider avatar host that is missing | Add the host to `AVATAR_IMAGE_ORIGINS`. |
| `directive: "connect-src"`, `"frame-src"` | A missing legitimate dependency | Add it narrowly, with a comment saying why. |

## Staged rollout

1. **Stage 0 (this PR, after owner approval).** Deploy with the defaults: CSP report-only, baseline enforced, `HSTS max-age=86400`.
2. **Stage 1 (≥ 7 days of clean reports).** Sign in on desktop and phone, use Google, GitHub and email sign-in, the cross-app returns to Architecta, Prospra and Channelwright, the dashboard, account and avatar upload, the home page constellation, and the tools. Confirm that no reports point at app code.
3. **Stage 2.** Set `CSP_MODE=enforce` on staging first, repeat the Stage 1 checks, then set it in production. If something breaks, roll back immediately with `CSP_MODE=report-only` and a restart.
4. **Stage 3.** Raise `SECURITY_HSTS_MAX_AGE` to `31536000`.
5. **Not in scope, owner decision.** HSTS `includeSubDomains` and `preload` would bind every `*.entrepreneuria.io` host, including future ones, to HTTPS for the full max-age. They need a host-by-host HTTPS inventory first. Channelwright already sends `includeSubDomains` for its own host, which affects only `*.channelwright.entrepreneuria.io`.

## Compatibility notes

- Nothing may frame `entrepreneuria.io`: the baseline `frame-ancestors 'none'` and `X-Frame-Options: DENY` are enforced immediately. No current code frames the hub, but a sibling app that tried would break.
- If nginx or another layer caches HTML, it must not cache across visitors, because the nonce is per response. Today the dynamic pages send `Cache-Control: private, no-store`.
- If nginx adds its own security headers later, remove them there or here, so the browser does not receive conflicting values.

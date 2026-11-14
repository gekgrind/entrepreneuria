# DRAFT: Cookie and tracking disclosure corrections

> **DRAFT. Not published. Not legal advice.** This corrects `/cookies` (`main:app/cookies/page.tsx`) and the "Cookies" paragraph of `/privacy` to match what the code actually sets. The inventory was verified in this repository on 2026-11-11. Product apps on other subdomains or repositories were **not** audited. Rows marked `[OWNER]` need confirmation.

## Verified inventory (this repository)

| Name | Type | Set by | Purpose | Duration | Evidence |
|---|---|---|---|---|---|
| `entrepreneuria-auth-token` (may be split into numbered chunks) | First-party cookie, essential | Supabase auth via our server | Keeps you signed in | Session / per Supabase settings `[ENG confirm]` | `lib/supabase/cookie-options.ts:4`, `proxy.ts` |
| `sidebar_state` | First-party cookie, preference | Our app UI | Remembers whether the sidebar is open | 7 days (`SIDEBAR_COOKIE_MAX_AGE`, verified) | `components/ui/sidebar.tsx:28-29,86`. Set only inside the signed-in app shell (`components/app-shell/AppShell.tsx`) |
| Hiring-assistant draft | Browser localStorage, preference | Free tool page | Saves your draft on your device | Until you clear it | `app/tools/hiring-assistant/page.tsx:147,166` |
| Cloudflare Turnstile | Third-party script (security) | Cloudflare, on the Websites preview form | Tells people from bots | Per Cloudflare; may set `cf_clearance` `[ENG: confirm in a live test]` | `components/auth/TurnstileWidget.tsx` |
| Analytics | **None found** | — | `@vercel/analytics` is installed but never imported | — | `package.json:49`; no import anywhere |
| Advertising / marketing pixels | **None found** | — | — | — | grep for gtag, fbq, GTM, PostHog, Plausible, Hotjar: no hits |

## 1. Replacement "Cookies" paragraph for `/privacy`

> We use a small number of cookies and similar technologies that our sites need to work: to keep you signed in, to remember simple display preferences, and to protect forms from spam. Our spam check on the website preview form is provided by Cloudflare Turnstile. We do not currently use advertising cookies or third-party analytics on entrepreneuria.io. If that changes, we will update this policy first. See our [Cookie Policy](/cookies).

`[OWNER: if the product apps (Architecta, Prospra, etc.) use analytics, add: "Some signed-in product apps use [tool] to understand feature usage."]`

## 2. Edits to `/cookies`

| Section | Change |
|---|---|
| How We Use Cookies | Remove "analyze usage" and "support marketing" **unless** the owner confirms analytics or marketing tools on another surface |
| Types: Analytics cookies | Replace with: "We do not currently use analytics cookies on entrepreneuria.io." |
| Types: Marketing cookies | Replace with: "We do not use marketing or advertising cookies." |
| Types: Security cookies | Add: "Our website preview form uses Cloudflare Turnstile to detect automated abuse. Cloudflare may process technical signals from your browser for this purpose; see Cloudflare's Turnstile Privacy Addendum." |
| Third-Party Cookies | Replace the long speculative list with the verified inventory table above (as a page table) |
| Do Not Track | Keep. Add: "We do not track you across other websites." |
| Effective date | New date on publication |

## Why

- **Overstating tracking:** low legal risk, but it misinforms visitors and makes the policy harder to trust.
- **Leaving out the third party that runs on the intake form (Cloudflare):** this is the real gap. CalOPPA asks whether third parties may collect personal information about a visitor's online activity `[web search — verify]`.
- **No consent banner is needed** for essential and security uses under US and Georgia law `[inference]`. Revisit if analytics or advertising tags are added.

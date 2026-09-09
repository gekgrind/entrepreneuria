# GitHub OAuth — configuration

GitHub sign-in is implemented in this repository, but it cannot work
until the GitHub OAuth App and the Supabase Auth provider are configured
by hand. Nothing here belongs in the repo: **no client secret, no
service-role key, and no OAuth credential is ever committed or read from
a `NEXT_PUBLIC_*` variable.** GitHub's client ID and client secret are
held by Supabase, and the browser never sees either of them.

## Where each value lives

| Value                       | Created in                    | Pasted into                           |
| --------------------------- | ----------------------------- | ------------------------------------- |
| GitHub **Client ID**        | GitHub → Developer settings   | Supabase → Authentication → GitHub    |
| GitHub **Client Secret**    | GitHub → Developer settings   | Supabase → Authentication → GitHub    |
| Supabase **callback URL**   | Supabase → Authentication     | GitHub OAuth App → Authorization callback URL |

## 1. GitHub

Create **one OAuth App per Supabase project** (a single app covers both
localhost and production, because GitHub calls back to *Supabase*, not to
Entrepreneuria).

- GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App
- Application name: `Entrepreneuria`
- Homepage URL: `https://entrepreneuria.io`
- **Authorization callback URL:** `https://<project-ref>.supabase.co/auth/v1/callback`

That callback URL is shown verbatim in the Supabase GitHub provider panel;
copy it from there rather than typing it.

GitHub OAuth Apps accept exactly one callback URL. Because the callback
points at Supabase and not at the site, localhost development uses the
same app — no second registration is required.

## 2. Supabase

- Authentication → **Sign In / Providers** → GitHub → enable
- Paste the GitHub Client ID and Client Secret
- Save

Then Authentication → **URL Configuration**:

- **Site URL:** `https://entrepreneuria.io`
- **Redirect URLs** must include the application's own callback route,
  for every origin that signs users in:
  - `https://entrepreneuria.io/auth/callback`
  - `http://localhost:3000/auth/callback`
  - any preview-deployment origin you sign in from, e.g.
    `https://*.vercel.app/auth/callback`
  - each ecosystem app origin that hosts its own login, e.g.
    `https://prospra.entrepreneuria.io/auth/callback`

The same allow-list entries are required for Google — the application's
OAuth flow now returns to `/auth/callback` for **both** providers instead
of landing directly on the destination page. If `/auth/callback` is
missing from the allow-list, Supabase silently falls back to the Site URL
and sign-in appears to succeed but drops the visitor on the home page.

## 3. Environment variables

**No new environment variables are required.** GitHub sign-in uses the
Supabase variables the app already reads:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Both are already present in `.env.example`.

## 4. Account linking — deliberately not implemented

Supabase treats each provider identity as its own authentication
identity. Signing in with GitHub using an email address that already has
a Google or password account does **not** merge the two: depending on the
project's "Allow linking" setting, Supabase either creates a separate
user or refuses the sign-in.

This repository does not implement email-matching account linking, and
should not: matching on email alone lets anyone who controls an
unverified provider email take over an existing account. Linking a second
provider to an existing account is a separate, deliberate feature — it
belongs behind an authenticated `linkIdentity()` call from the account
settings page, where the visitor has already proven they own the first
account.

## 5. Verifying

1. `npm run dev`, open `/login`, click **Continue with GitHub**.
2. Authorize on GitHub.
3. You should return to `/auth/callback?next=/dashboard` and be
   forwarded, already signed in, to the destination.
4. Click **Cancel** on GitHub's authorization screen instead: you should
   land back on `/login` with "Authorization was cancelled." and no
   provider error text on screen.
5. Sign in with a GitHub account whose email is private: the account menu
   should show the GitHub display name (or the handle) and the GitHub
   avatar, and Settings should read "No email available" rather than
   erroring.

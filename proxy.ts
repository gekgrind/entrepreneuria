import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

import { getPublicRequestOrigin } from "@/lib/auth/public-origin";
import {
  AUTH_NO_STORE_HEADERS,
  applyAuthResponseHeaders,
  clearAuthSweepGuard,
  expireHostOnlyAuthCookies,
  hasAuthSweepGuard,
  markAuthCookiesHeld,
  readAuthCookieInventory,
  retireStaleAuthCookies,
  setAuthSweepGuard,
} from "@/lib/supabase/auth-cookie-cleanup";
import {
  createAuthFetchObserver,
  writesRemoveSession,
} from "@/lib/supabase/auth-fetch";
import {
  getSupabaseCookieOptions,
  isEntrepreneuriaHostname,
  mergeSupabaseCookieOptions,
} from "@/lib/supabase/cookie-options";

/* Routes that read the browser's own cookies; see `proxy` below. */
const PASS_THROUGH_PATHS = new Set([
  "/auth/signout",
  /* They establish a session and then retire every other copy, so they
     need the browser's whole inventory, not what a sweep leaves. */
  "/auth/callback",
  "/auth/confirm",
]);

const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/account",
  "/settings",
  "/command-center",
];

/* Methods a sweep may answer with a redirect that repeats them. */
const SAFE_METHODS = new Set(["GET", "HEAD"]);

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/*
 * The hub's only session refresher, and the one place a duplicated
 * session cookie is dealt with.
 *
 * The Cookie header does not say which scope a cookie came from, and its
 * readers disagree about duplicates: Next's `request.cookies` keeps the
 * last value of a name, the browser's `document.cookie` parser the
 * first. So a name the browser sends twice is never read here at all.
 *
 * - GET/HEAD: nothing is read or refreshed. Every host-only copy is
 *   expired (a host-only expiry can never touch the `.entrepreneuria.io`
 *   copy; see `expireHostOnlyAuthCookies`) and the browser is sent
 *   straight back to the same URL with a 303, which it then requests
 *   with the shared copy alone. A short-lived marker cookie makes this
 *   one-shot: a browser that comes back still holding a duplicate (a
 *   copy no host-only expiry reaches) is not redirected again.
 * - Any other method, or a second pass under the marker: the same
 *   host-only expiries, and the request is served unauthenticated — no
 *   session cookie is forwarded and nothing is written.
 *
 * Whatever survives is one copy per name, read by the stock Supabase
 * client. If it cannot refresh, auth-js clears it — the shared copy, the
 * only one left — and the visitor signs in again: a local sign-out. No
 * request ever signs anyone out globally; only the explicit sign-out on
 * /sign-out does.
 *
 * Names no reader may see are stripped from the request before the
 * client reads it: malformed names (`.0.0`), a bare fragment beside
 * chunks (it would shadow them, and auth-js would then expire the sound
 * chunks in the shared scope), and chunks that can never be part of the
 * session. They are expired on the way out (`retireStaleAuthCookies`).
 */
export async function proxy(request: NextRequest) {
  /* These routes own their request and response: they see every copy,
     and a refresh here would be written beside their expiries. */
  if (PASS_THROUGH_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  /* Before anything below strips a copy from the forwarded cookies. */
  markAuthCookiesHeld(request);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  /* Without Supabase configuration no session can be verified: protected
     routes fail closed, public ones stay reachable. */
  if (!supabaseUrl || !supabaseAnonKey) {
    if (!isProtectedRoute(request.nextUrl.pathname)) {
      return NextResponse.next({ request });
    }

    return new NextResponse("Authentication is unavailable.", {
      status: 503,
      headers: { ...AUTH_NO_STORE_HEADERS, "Retry-After": "30" },
    });
  }

  /* Taken before the client below runs: forwarding a refreshed session
     rewrites the request's Cookie header. */
  const authCookies = readAuthCookieInventory(request);
  const cookieHostname = authCookies.cookieHostname;
  const swept = hasAuthSweepGuard(request);

  if (
    authCookies.duplicated &&
    !swept &&
    SAFE_METHODS.has(request.method) &&
    isEntrepreneuriaHostname(cookieHostname)
  ) {
    /* On the public origin, never the `next start` bind address. */
    const sweep = NextResponse.redirect(
      new URL(
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
        getPublicRequestOrigin(request),
      ),
      { status: 303 },
    );

    expireHostOnlyAuthCookies(authCookies, sweep);
    setAuthSweepGuard(sweep, cookieHostname);
    applyAuthResponseHeaders(sweep);

    return sweep;
  }

  /* With a duplicate left, the whole family is withheld: unauthenticated. */
  const hidden = authCookies.duplicated
    ? [...authCookies.session, ...authCookies.malformed]
    : [...authCookies.malformed, ...authCookies.unreadable];

  for (const name of hidden) {
    request.cookies.delete(name);
  }

  const writable = !authCookies.duplicated;
  const observer = createAuthFetchObserver(fetch);

  let response = NextResponse.next({
    request,
  });
  let pendingCookies: CookieToSet[] = [];
  let pendingHeaders: Record<string, string> = {};

  function applyPendingSessionUpdates(target: NextResponse) {
    for (const { name, value, options } of pendingCookies) {
      target.cookies.set(
        name,
        value,
        mergeSupabaseCookieOptions(cookieHostname, options),
      );
    }

    for (const [key, value] of Object.entries(pendingHeaders)) {
      target.headers.set(key, value);
    }

    return target;
  }

  /* Last, after every session write: a later `response.cookies.set`
     would rebuild Set-Cookie from its name-keyed map and drop these. */
  function finish(target: NextResponse) {
    retireStaleAuthCookies(authCookies, target);

    if (swept && !authCookies.duplicated) {
      clearAuthSweepGuard(target, cookieHostname);
    }

    return target;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: getSupabaseCookieOptions(cookieHostname),
    global: { fetch: observer.fetch },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        if (!writable) return;

        /* auth-js drops the session on any refresh error it does not
           retry, a plain 500 included. An outage is not a refusal: the
           session stays, and the next request tries again. */
        if (writesRemoveSession(cookiesToSet) && observer.isIndeterminate()) {
          return;
        }

        // Refreshed cookies must be propagated both ways: onto `request`
        // so downstream Server Components in this same request see the
        // refreshed session, and onto `response` so the browser does.
        // Rebuilding `response` from the mutated `request` is what makes
        // the forwarded request carry the new values.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({
          request,
          headers: response.headers,
        });

        pendingCookies = [...pendingCookies, ...cookiesToSet];
        pendingHeaders = { ...pendingHeaders, ...headersToSet };
        applyPendingSessionUpdates(response);
      },
    },
  });

  if (isProtectedRoute(request.nextUrl.pathname)) {
    // getClaims() verifies the JWT (locally against Supabase's JWKS, or
    // via the Auth server as a fallback) instead of trusting the
    // unverified session payload the way a raw getSession() read would.
    const { data } = await supabase.auth.getClaims();

    if (!data?.claims) {
      const loginUrl = request.nextUrl.clone();
      const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("next", nextPath);

      return finish(
        applyPendingSessionUpdates(NextResponse.redirect(loginUrl)),
      );
    }
  } else {
    await supabase.auth.getSession();
  }

  return finish(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

import { getPublicRequestOrigin } from "@/lib/auth/public-origin";
import { buildSessionRecoveryPath } from "@/lib/auth/session-recovery";
import {
  AUTH_NO_STORE_HEADERS,
  markAuthCookiesHeld,
  readAuthCookieInventory,
  retireStaleAuthCookies,
  settleSessionConflict,
} from "@/lib/supabase/auth-cookie-cleanup";
import {
  pinResolvedSession,
  resolveSessionConflict,
} from "@/lib/supabase/auth-session-resolution";
import {
  getSupabaseCookieHostname,
  getSupabaseCookieOptions,
  mergeSupabaseCookieOptions,
} from "@/lib/supabase/cookie-options";

/* Routes that read the browser's own cookies; see `proxy` below. */
const PASS_THROUGH_PATHS = new Set([
  "/auth/signout",
  /* They establish a session and then retire every other copy, so they
     need the browser's whole inventory, not the one survivor. */
  "/auth/callback",
  "/auth/confirm",
]);

const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/account",
  "/settings",
  "/command-center",
];

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

export async function proxy(request: NextRequest) {
  /* These routes own their request and response. Resolving a conflict
     here would rewrite the forwarded Cookie header to the one surviving
     session, so the route could neither revoke nor expire the other
     copies, and a refresh here would be written beside its expiries. */
  if (PASS_THROUGH_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  /* Before anything below can delete a copy from the forwarded cookies. */
  markAuthCookiesHeld(request);

  let response = NextResponse.next({
    request,
  });
  let pendingCookies: CookieToSet[] = [];
  let pendingHeaders: Record<string, string> = {};

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  /* Without Supabase configuration no session can be verified: protected
     routes fail closed, public ones stay reachable. */
  if (!supabaseUrl || !supabaseAnonKey) {
    if (!isProtectedRoute(request.nextUrl.pathname)) {
      return response;
    }

    return new NextResponse("Authentication is unavailable.", {
      status: 503,
      headers: { ...AUTH_NO_STORE_HEADERS, "Retry-After": "30" },
    });
  }

  /* Taken before the client below runs: forwarding a refreshed session
     rewrites the request's Cookie header. */
  const authCookies = readAuthCookieInventory(request);
  const cookieHostname = getSupabaseCookieHostname(request.headers);
  const sharedCookieOptions = getSupabaseCookieOptions(cookieHostname);

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

  /* Two session generations: settle which one is live before any client
     reads the collapsed cookies (see auth-session-resolution). The
     forwarded request carries the survivor only; the response rewrites
     it in the canonical scope only once every other copy is settled. */
  const resolution = authCookies.conflict
    ? await resolveSessionConflict(authCookies, {
        supabaseUrl,
        supabaseKey: supabaseAnonKey,
        cookieOptions: sharedCookieOptions,
      })
    : null;

  if (resolution) {
    pinResolvedSession(request.cookies, authCookies, resolution);
    response = NextResponse.next({ request });

    if (resolution.status === "live") {
      pendingCookies = resolution.cookies;
      pendingHeaders = resolution.headers;
      applyPendingSessionUpdates(response);
    }
  }

  function retireStale(target: NextResponse) {
    if (resolution) {
      settleSessionConflict(authCookies, resolution.status, target);
    } else {
      retireStaleAuthCookies(authCookies, target);
    }
  }

  /* With an unsettled conflict the cookies stay exactly as they are:
     a write of the client below would replace whichever canonical copy
     was never proven dead. */
  const writable = !resolution || resolution.status === "live";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: sharedCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        if (!writable) return;

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

    /* A conflict that could not be settled: no account was chosen for
       the visitor and the copies were left as they are. /login would see
       a session and send the visitor straight back, so they go to an
       explicit recovery page instead, which retries or signs out only
       when asked — on the public origin, never the bind address. */
    const recoveryReason =
      resolution?.status === "ambiguous"
        ? "session-conflict"
        : resolution?.status === "unresolved"
          ? "session-unresolved"
          : resolution?.status === "unverifiable"
            ? "auth-unavailable"
            : null;

    if (!data?.claims && recoveryReason) {
      const recoveryUrl = new URL(
        buildSessionRecoveryPath(
          recoveryReason,
          `${request.nextUrl.pathname}${request.nextUrl.search}`,
        ),
        getPublicRequestOrigin(request),
      );

      const redirect = NextResponse.redirect(recoveryUrl);
      retireStale(redirect);

      return redirect;
    }

    if (!data?.claims) {
      const loginUrl = request.nextUrl.clone();
      const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("next", nextPath);

      const redirect = applyPendingSessionUpdates(
        NextResponse.redirect(loginUrl),
      );
      retireStale(redirect);

      return redirect;
    }
  } else {
    await supabase.auth.getSession();
  }

  /* Last, after every session write: a later `response.cookies.set`
     would rebuild Set-Cookie from its name-keyed map and drop these. */
  retireStale(response);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

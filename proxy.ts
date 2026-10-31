import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getPublicCookieDomain, getPublicRequestOrigin } from "@/lib/auth/public-origin";
import {
  classifyAuthCookies,
  classifyWrites,
  createAuthFetchObserver,
  parseCookieHeader,
  serializeExpiry,
  serializeHostOnlyExpiry,
  serializeScopePair,
  writesRemoveSession,
  type CookieWrite,
} from "@/lib/supabase/auth-cookies";
import { getSupabaseCookieOptions } from "@/lib/supabase/cookie-options";

const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/account",
  "/settings",
  "/command-center",
];

/* These routes write or expire the session themselves. Set-Cookie from
   the proxy and from the route land in one response, so a proxy refresh
   or expiry here could undo what the route wrote. */
const ROUTES_THAT_OWN_SESSION_COOKIES = new Set([
  "/auth/callback",
  "/auth/confirm",
  "/auth/signout",
]);

/* Refresh well before auth-js's own 90 s margin, so no client downstream
   of the proxy ever has a reason to refresh during this request. */
const PROACTIVE_REFRESH_SECONDS = 5 * 60;

function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

type SignedOut = {
  origin: string;
  /** Raw Set-Cookie headers, appended after everything else. */
  setCookies: string[];
  /** Family cookie names to hide from the rest of this request. */
  hide: string[];
  authError?: "session_reset" | "unavailable";
};

function withSetCookies(response: NextResponse, setCookies: string[]) {
  /* Appended raw and last: ResponseCookies keeps one cookie per name and
     would collapse the host-only/Domain pair into one. */
  for (const header of setCookies) {
    response.headers.append("set-cookie", header);
  }

  if (setCookies.length > 0) {
    response.headers.set("cache-control", "no-store");
  }

  return response;
}

function signedOut(request: NextRequest, { origin, setCookies, hide, authError }: SignedOut) {
  if (isProtectedRoute(request.nextUrl.pathname)) {
    /* Built on the public origin, not request.nextUrl, which behind nginx
       is the bind address. */
    const loginUrl = new URL("/login", origin);

    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );

    if (authError) {
      loginUrl.searchParams.set("auth_error", authError);
    }

    return withSetCookies(NextResponse.redirect(loginUrl), setCookies);
  }

  for (const name of hide) {
    request.cookies.delete(name);
  }

  return withSetCookies(NextResponse.next({ request }), setCookies);
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    ROUTES_THAT_OWN_SESSION_COOKIES.has(request.nextUrl.pathname) ||
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    return NextResponse.next({ request });
  }

  const origin = getPublicRequestOrigin(request);
  const domain = getPublicCookieDomain(request);
  const cookieOptions = getSupabaseCookieOptions(domain ? "entrepreneuria.io" : null);
  const secure = cookieOptions.secure ?? false;
  const expireAll = (names: string[]) =>
    names.flatMap((name) => serializeExpiry(name, domain, secure));
  const inventory = classifyAuthCookies(
    parseCookieHeader(request.headers.get("cookie")),
  );

  if (inventory.kind === "conflict") {
    /* Never pick a copy or combine fragments: the visitor signs in again.
       No Supabase client is built, so nothing is refreshed or probed. */
    console.warn("[AUTH_COOKIE_CONFLICT]", inventory.reason);

    return signedOut(request, {
      origin,
      setCookies: expireAll(inventory.names),
      hide: inventory.names,
      authError: "session_reset",
    });
  }

  if (inventory.kind === "none") {
    return isProtectedRoute(request.nextUrl.pathname)
      ? signedOut(request, { origin, setCookies: [], hide: [] })
      : NextResponse.next({ request });
  }

  const { session: stored, names, duplicatedNames } = inventory;
  const observer = createAuthFetchObserver();
  let writes: CookieWrite[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions,
    global: { fetch: observer.fetch },
    cookies: {
      getAll() {
        /* Faithful here: every family name carries one distinct value. */
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        writes = [...writes, ...cookiesToSet];
      },
    },
  });

  if (stored.expiresAt - Math.floor(Date.now() / 1000) < PROACTIVE_REFRESH_SECONDS) {
    await supabase.auth.refreshSession({ refresh_token: stored.refreshToken });
  }

  let authenticated: boolean;

  if (isProtectedRoute(request.nextUrl.pathname)) {
    /* getClaims() verifies the JWT instead of trusting the payload. */
    const { data } = await supabase.auth.getClaims();
    authenticated = Boolean(data?.claims);
  } else {
    const { data } = await supabase.auth.getSession();
    authenticated = Boolean(data.session);
  }

  if (writesRemoveSession(writes)) {
    if (observer.isIndeterminate()) {
      /* An outage, not a refusal: leave both scopes as they are. */
      return signedOut(request, {
        origin,
        setCookies: [],
        hide: names,
        authError: "unavailable",
      });
    }

    return signedOut(request, { origin, setCookies: expireAll(names), hide: names });
  }

  const written = classifyWrites(writes);

  /* A refresh must return the account the visitor already had. An access
     token paired with another account's refresh token would otherwise
     switch accounts silently. */
  if (
    written.kind === "conflict" ||
    (written.kind === "single" && written.session.userId !== stored.userId)
  ) {
    console.warn("[AUTH_COOKIE_IDENTITY_MISMATCH]");
    const all = Array.from(new Set([...names, ...writes.map(({ name }) => name)]));

    return signedOut(request, {
      origin,
      setCookies: expireAll(all),
      hide: all,
      authError: "session_reset",
    });
  }

  if (!authenticated) {
    return signedOut(request, {
      origin,
      setCookies: [],
      hide: names,
      authError: observer.isIndeterminate() ? "unavailable" : undefined,
    });
  }

  for (const { name, value } of writes) {
    if (value) {
      request.cookies.set(name, value);
    } else {
      request.cookies.delete(name);
    }
  }

  const rewritten = new Set(writes.map(({ name }) => name));
  const setCookies = [
    ...writes.flatMap(({ name, value, options }) =>
      serializeScopePair(name, value, options, domain),
    ),
    /* The same bytes in both scopes: dropping the host-only copy loses
       nothing and leaves the shared one every app can read. */
    ...(domain
      ? duplicatedNames
          .filter((name) => !rewritten.has(name))
          .map((name) => serializeHostOnlyExpiry(name, secure))
      : []),
  ];

  return withSetCookies(NextResponse.next({ request }), setCookies);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

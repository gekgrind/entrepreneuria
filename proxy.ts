import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  createClient,
  isAuthApiError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";

import { getPublicCookieDomain, getPublicRequestOrigin } from "@/lib/auth/public-origin";
import {
  classifyAuthCookies,
  classifyWrites,
  createAuthFetchObserver,
  parseCookieHeader,
  serializeExpiry,
  serializeHostOnlyExpiry,
  serializeScopePair,
  sessionWrites,
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

/* Provider answers that prove this session is over. Anything else — an
   outage, a bad API key, an unreadable body — leaves the cookies alone. */
const SESSION_REFUSAL_CODES = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_not_found",
  "session_expired",
  "user_not_found",
  "user_banned",
]);

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
  const { name: _storageKey, ...writeOptions } = cookieOptions;
  const pairsFor = (writes: CookieWrite[]) =>
    writes.flatMap(({ name, value, options }) => serializeScopePair(name, value, options, domain));
  const resetSession = (extraNames: string[]) => {
    console.warn("[AUTH_COOKIE_IDENTITY_MISMATCH]");
    const all = Array.from(new Set([...names, ...extraNames]));

    return signedOut(request, {
      origin,
      setCookies: expireAll(all),
      hide: all,
      authError: "session_reset",
    });
  };
  let rotation: CookieWrite[] = [];

  if (stored.expiresAt - Math.floor(Date.now() / 1000) < PROACTIVE_REFRESH_SECONDS) {
    /* Exactly one exchange, on a client with no storage. A cookie-backed
       client would first load the stored session, which refreshes a token
       inside auth-js's margin, and then exchange the same token again. */
    const refresher = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: observer.fetch },
    });
    const { data, error } = await refresher.auth.refreshSession({
      refresh_token: stored.refreshToken,
    });

    if (error || !data.session) {
      /* Only the provider positively refusing the token ends the session.
         Anything else — no answer, a 5xx, an unreadable body — is an
         outage, and both scopes stay as they are. */
      const refused =
        !observer.isIndeterminate() &&
        (isAuthSessionMissingError(error) ||
          (isAuthApiError(error) && SESSION_REFUSAL_CODES.has(error.code ?? "")));

      return refused
        ? signedOut(request, { origin, setCookies: expireAll(names), hide: names })
        : signedOut(request, { origin, setCookies: [], hide: names, authError: "unavailable" });
    }

    rotation = sessionWrites(data.session, names, writeOptions);
    const rotated = classifyWrites(rotation);

    /* A refresh must return the account the visitor already had. An
       access token paired with another account's refresh token would
       otherwise switch accounts silently. */
    if (
      data.session.user.id !== stored.userId ||
      rotated.kind !== "single" ||
      rotated.session.userId !== stored.userId
    ) {
      return resetSession(rotation.map(({ name }) => name));
    }

    for (const { name, value } of rotation) {
      if (value) {
        request.cookies.set(name, value);
      } else {
        request.cookies.delete(name);
      }
    }
  }

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

  let authenticated: boolean;

  try {
    if (isProtectedRoute(request.nextUrl.pathname)) {
      /* getClaims() verifies the JWT instead of trusting the payload. */
      const { data } = await supabase.auth.getClaims();
      authenticated = Boolean(data?.claims);
    } else {
      const { data } = await supabase.auth.getSession();
      authenticated = Boolean(data.session);
    }
  } catch (error) {
    /* Never a 500 loop: an outage keeps the cookies (and any rotation),
       anything else is a session that cannot be read. */
    console.error("[AUTH_SESSION_READ_ERROR]", error instanceof Error ? error.name : "unknown");

    return observer.isIndeterminate()
      ? signedOut(request, {
          origin,
          setCookies: pairsFor(rotation),
          hide: Array.from(new Set([...names, ...rotation.map(({ name }) => name)])),
          authError: "unavailable",
        })
      : resetSession(rotation.map(({ name }) => name));
  }

  const currentNames = request.cookies
    .getAll()
    .map(({ name }) => name)
    .filter((name) => names.includes(name) || rotation.some((write) => write.name === name));

  if (writesRemoveSession(writes)) {
    if (observer.isIndeterminate()) {
      /* Keep a rotation that already happened, or the browser is left
         with a spent refresh token; change nothing else. */
      return signedOut(request, {
        origin,
        setCookies: pairsFor(rotation),
        hide: currentNames,
        authError: "unavailable",
      });
    }

    return signedOut(request, {
      origin,
      setCookies: expireAll(Array.from(new Set([...names, ...currentNames]))),
      hide: currentNames,
    });
  }

  const written = classifyWrites(writes);

  if (
    written.kind === "conflict" ||
    (written.kind === "single" && written.session.userId !== stored.userId)
  ) {
    return resetSession([...currentNames, ...writes.map(({ name }) => name)]);
  }

  const allWrites = [...rotation, ...writes];

  if (!authenticated) {
    /* Not served, but a completed rotation is still persisted. */
    return signedOut(request, {
      origin,
      setCookies: pairsFor(allWrites),
      hide: currentNames,
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

  const rewritten = new Set(allWrites.map(({ name }) => name));
  const setCookies = [
    ...pairsFor(allWrites),
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

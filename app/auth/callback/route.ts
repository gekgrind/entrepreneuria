import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  DEFAULT_AUTHENTICATED_PATH,
  getSafeAuthRedirect,
} from "@/lib/auth/trusted-redirect";
import { classifyProviderError, type OAuthErrorCode } from "@/lib/auth/oauth";
import {
  getPublicCookieDomain,
  getPublicRequestOrigin,
  resolveAuthDestination,
} from "@/lib/auth/public-origin";
import {
  AUTH_CODE_VERIFIER_COOKIE_NAME,
  classifyWrites,
  isAuthFamilyCookie,
  parseCookieHeader,
  serializeExpiry,
  serializeScopePair,
  type CookieWrite,
} from "@/lib/supabase/auth-cookies";
import { getSupabaseCookieOptions } from "@/lib/supabase/cookie-options";

/**
 * The OAuth landing pad, shared by every provider.
 *
 * Supabase's browser client starts the PKCE flow and stores the code
 * verifier in a cookie, which is exactly why the exchange belongs on
 * the server: this route can read that cookie, mint the session, and
 * write the shared `.entrepreneuria.io` auth cookie — so the visitor
 * arrives at a protected destination already authenticated instead of
 * being bounced by the proxy before any client code has run.
 *
 * The intended destination travels as `next` and is re-validated here
 * against the trusted-origin allow-list; the provider is never trusted
 * to hand us a redirect target.
 *
 * The SDK sees only the code verifier, never the stored session: a
 * completed PKCE exchange is this browser's explicit sign-in, so it
 * supersedes whatever was stored, and nothing stored is loaded,
 * refreshed or judged. Its writes go onto the redirect as raw scope
 * pairs (host-only expiry, then the shared write), appended last because
 * ResponseCookies keeps one cookie per name. Nothing here touches
 * next/headers `cookies()`, whose merge would collapse those pairs.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  /* Not `request.nextUrl.origin`: under `next start` behind nginx that
     is the bind address (http://localhost:3000), not the public site. */
  const origin = getPublicRequestOrigin(request);
  const domain = getPublicCookieDomain(request);
  const cookieOptions = getSupabaseCookieOptions(domain ? "entrepreneuria.io" : null);
  const nextPath = getSafeAuthRedirect(searchParams.get("next"));
  const pairs = parseCookieHeader(request.headers.get("cookie"));
  const verifiers = Array.from(
    new Set(
      pairs
        .filter(({ name }) => name === AUTH_CODE_VERIFIER_COOKIE_NAME)
        .map(({ value }) => value),
    ),
  );
  const expireVerifier = serializeExpiry(
    AUTH_CODE_VERIFIER_COOKIE_NAME,
    domain,
    cookieOptions.secure,
  );

  /* The visitor cancelled on the provider's authorization screen, or
     the provider refused. Either way there is no code to exchange. */
  const providerError = searchParams.get("error");

  if (providerError) {
    return redirectToLogin(
      origin,
      classifyProviderError(providerError),
      nextPath,
    );
  }

  const code = searchParams.get("code");

  if (!code) {
    return redirectToLogin(origin, "unknown", nextPath);
  }

  /* Two different verifiers: there is no telling which one started this
     flow, so neither is used. */
  if (verifiers.length !== 1) {
    return redirectToLogin(origin, "exchange", nextPath, expireVerifier);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[OAUTH_CALLBACK_ERROR]", "Missing Supabase environment");
    return redirectToLogin(origin, "unknown", nextPath);
  }

  let writes: CookieWrite[] = [];

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions,
      cookies: {
        getAll() {
          return [{ name: AUTH_CODE_VERIFIER_COOKIE_NAME, value: verifiers[0] }];
        },
        setAll(cookiesToSet) {
          writes = [...writes, ...cookiesToSet];
        },
      },
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      console.error("[OAUTH_CALLBACK_EXCHANGE_ERROR]", error?.message ?? "no session");
      return redirectToLogin(origin, "exchange", nextPath, expireVerifier);
    }

    /* Verify the session the exchange returned, by its own token, before
       it replaces anything: a half-written or foreign session surfaces
       here instead of as a redirect loop through the proxy. */
    const {
      data: { user },
    } = await supabase.auth.getUser(data.session.access_token);
    const written = classifyWrites(writes);

    if (
      !user ||
      user.id !== data.session.user.id ||
      written.kind !== "single" ||
      written.session.userId !== user.id
    ) {
      return redirectToLogin(origin, "session", nextPath, expireVerifier);
    }
  } catch (err) {
    console.error("[OAUTH_CALLBACK_ERROR]", err);
    return redirectToLogin(origin, "unknown", nextPath, expireVerifier);
  }

  const response = NextResponse.redirect(resolveAuthDestination(origin, nextPath));
  const writtenNames = new Set(writes.map(({ name }) => name));
  /* Every stored family name the new session does not overwrite, by
     name alone: stored values are never decoded here. */
  const superseded = Array.from(
    new Set(
      pairs
        .map(({ name }) => name)
        .filter((name) => isAuthFamilyCookie(name) && !writtenNames.has(name)),
    ),
  );
  const setCookies = [
    ...superseded.flatMap((name) => serializeExpiry(name, domain, cookieOptions.secure)),
    ...writes.flatMap(({ name, value, options }) =>
      serializeScopePair(name, value, options, domain),
    ),
  ];

  if (!writtenNames.has(AUTH_CODE_VERIFIER_COOKIE_NAME)) {
    setCookies.push(...expireVerifier);
  }

  return withSetCookies(response, setCookies);
}

function withSetCookies(response: NextResponse, setCookies: string[]) {
  for (const header of setCookies) {
    response.headers.append("set-cookie", header);
  }

  response.headers.set("cache-control", "no-store");

  return response;
}

function redirectToLogin(
  origin: string,
  code: OAuthErrorCode,
  nextPath: string,
  setCookies: string[] = [],
) {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("auth_error", code);

  /* Keep the visitor's original destination so retrying from the login
     page still lands them where they were headed. */
  if (nextPath !== DEFAULT_AUTHENTICATED_PATH) {
    loginUrl.searchParams.set("next", nextPath);
  }

  return withSetCookies(NextResponse.redirect(loginUrl), setCookies);
}

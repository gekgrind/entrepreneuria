import type { CookieOptionsWithName } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

export const SUPABASE_AUTH_COOKIE_NAME = "entrepreneuria-auth-token";
export const SUPABASE_AUTH_COOKIE_DOMAIN = ".entrepreneuria.io";

/*
 * Global Entrepreneuria auth contract:
 * - entrepreneuria.io and all product apps use the same Supabase project.
 * - every app must use this cookie name and `.entrepreneuria.io` domain.
 * - login/session refresh is centralized through entrepreneuria.io-compatible SSR cookies.
 */

function normalizeHostname(hostname?: string | null) {
  if (!hostname) {
    return null;
  }

  return hostname.split(":")[0]?.toLowerCase() ?? null;
}

export function isEntrepreneuriaHostname(hostname?: string | null) {
  const normalized = normalizeHostname(hostname);

  return (
    normalized === "entrepreneuria.io" ||
    normalized?.endsWith(".entrepreneuria.io") === true
  );
}

type HeaderReader = { get(name: string): string | null };

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

/*
 * The hostname that decides the auth cookie's scope, read from the
 * request the browser actually sent. Never `request.nextUrl.hostname`:
 * under `next start` behind nginx that is the bind address
 * (`localhost`), so writers keyed on it dropped `Domain` and planted a
 * host-only copy of every session chunk beside the `.entrepreneuria.io`
 * copy other writers kept. The browser then sent both, Next kept the
 * last value per name, and chunks from the two families were stitched
 * into one unreadable session. Every writer resolves scope here, so the
 * proxy, the auth routes and the server client cannot disagree.
 *
 * An Entrepreneuria host in either header wins: those headers cannot
 * widen the scope past what the browser enforces, because a
 * `Domain=.entrepreneuria.io` cookie from any other host is rejected.
 */
export function getSupabaseCookieHostname(headers: HeaderReader) {
  const hosts = [
    firstHeaderValue(headers.get("x-forwarded-host")),
    firstHeaderValue(headers.get("host")),
  ].filter((host): host is string => Boolean(host));

  return hosts.find(isEntrepreneuriaHostname) ?? hosts[0] ?? null;
}

export function getSupabaseCookieOptions(
  hostname?: string | null,
): CookieOptionsWithName {
  const useSharedDomain = isEntrepreneuriaHostname(hostname);

  return {
    name: SUPABASE_AUTH_COOKIE_NAME,
    domain: useSharedDomain ? SUPABASE_AUTH_COOKIE_DOMAIN : undefined,
    path: "/",
    sameSite: "lax",
    secure: useSharedDomain || process.env.NODE_ENV === "production",
    httpOnly: false,
    maxAge: 400 * 24 * 60 * 60,
  };
}

export function getBrowserSupabaseCookieOptions(): CookieOptionsWithName {
  if (typeof window === "undefined") {
    return getSupabaseCookieOptions();
  }

  return getSupabaseCookieOptions(window.location.hostname);
}

/*
 * Per-cookie options for a single Set-Cookie write. `name` is the
 * Supabase storage key (it only belongs in createServerClient /
 * createBrowserClient `cookieOptions`) and must never reach a cookie
 * setter: Next's `cookies.set(name, value, options)` spreads `options`
 * over `name`, so a leaked `name` renames every session chunk
 * (`entrepreneuria-auth-token.0`, `.1`, …) and the verifier deletion to
 * the bare storage key. The browser then keeps only the last fragment,
 * the session cannot be reassembled, and the proxy treats the visitor
 * as signed out. @supabase/ssr strips `name` for the same reason.
 */
export function mergeSupabaseCookieOptions(
  hostname: string | null,
  options: CookieOptions,
): CookieOptions {
  const { name: _storageKey, ...sharedOptions } =
    getSupabaseCookieOptions(hostname);

  return {
    ...sharedOptions,
    ...options,
    domain: sharedOptions.domain,
    path: sharedOptions.path,
    sameSite: sharedOptions.sameSite,
    secure: sharedOptions.secure,
    httpOnly: sharedOptions.httpOnly,
  };
}

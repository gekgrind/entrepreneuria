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

export function mergeSupabaseCookieOptions(
  hostname: string | null,
  options: CookieOptions,
): CookieOptions {
  const sharedOptions = getSupabaseCookieOptions(hostname);

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

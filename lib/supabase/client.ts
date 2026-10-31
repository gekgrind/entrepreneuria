"use client";

import { createBrowserClient, type CookieOptions } from "@supabase/ssr";

import {
  classifyAuthCookies,
  getAuthCookieDomain,
  isAuthFamilyCookie,
  parseCookieHeader,
  serializeExpiry,
  serializeScopePair,
  type CookiePair,
} from "./auth-cookies";
import { getSupabaseCookieOptions } from "./cookie-options";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/* Hide a session this close to expiry, so auth-js (which refreshes
   inside a 90 s margin) never holds one it would refresh. */
const BROWSER_SESSION_CUTOFF_SECONDS = 120;

/**
 * The cookies the browser client may see. The browser never refreshes:
 * the proxy is the hub's only refresher, so identity binding and the
 * outage guard cover every rotation. A family that is not one
 * unambiguous session, or that is near expiry, is hidden entirely.
 */
export function selectBrowserCookies(
  pairs: CookiePair[],
  now = Math.floor(Date.now() / 1000),
): CookiePair[] {
  const others = pairs.filter(({ name }) => !isAuthFamilyCookie(name));
  const inventory = classifyAuthCookies(pairs);

  if (
    inventory.kind !== "single" ||
    inventory.session.expiresAt - now < BROWSER_SESSION_CUTOFF_SECONDS
  ) {
    return others;
  }

  const seen = new Set<string>();
  const family = pairs.filter(({ name }) => {
    if (!isAuthFamilyCookie(name) || seen.has(name)) {
      return false;
    }

    seen.add(name);
    return true;
  });

  return [...others, ...family];
}

/**
 * The Set-Cookie strings a browser write turns into: each cookie as a
 * scope pair, and — when a session is written — every other family
 * name present expired in both scopes, so no stale chunk survives.
 */
export function browserCookieWrites(
  present: CookiePair[],
  cookiesToSet: { name: string; value: string; options: CookieOptions }[],
  domain: string | undefined,
) {
  const writes = cookiesToSet.flatMap(({ name, value, options }) =>
    serializeScopePair(name, value, options, domain),
  );
  const writtenNames = new Set(cookiesToSet.map(({ name }) => name));
  const writesSession = cookiesToSet.some(
    ({ name, value }) => isAuthFamilyCookie(name) && value !== "",
  );

  if (!writesSession) {
    return writes;
  }

  const stale = Array.from(
    new Set(
      present
        .map(({ name }) => name)
        .filter((name) => isAuthFamilyCookie(name) && !writtenNames.has(name)),
    ),
  );

  return [...stale.flatMap((name) => serializeExpiry(name, domain)), ...writes];
}

/**
 * Refuses refresh grants before they leave the browser. Thrown as a
 * network failure, which auth-js treats as retryable: it neither stores
 * a new session nor removes the current one.
 */
export const refusingRefreshFetch: typeof fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);

  if (url.includes("/auth/v1/token") && url.includes("grant_type=refresh_token")) {
    throw new TypeError("Session refresh is handled by the server.");
  }

  return fetch(input, init);
};

/**
 * The hub's browser client over any cookie source: `document.cookie` in
 * the app, a modelled jar in tests.
 */
export function createHubBrowserClient({
  supabaseUrl,
  supabaseAnonKey,
  hostname,
  readCookies,
  writeCookie,
}: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  hostname: string;
  readCookies: () => string;
  writeCookie: (setCookie: string) => void;
}) {
  const domain = getAuthCookieDomain(hostname);

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: getSupabaseCookieOptions(hostname),
    isSingleton: false,
    auth: { autoRefreshToken: false },
    global: { fetch: refusingRefreshFetch },
    cookies: {
      getAll() {
        return selectBrowserCookies(parseCookieHeader(readCookies()));
      },
      setAll(cookiesToSet) {
        for (const header of browserCookieWrites(
          parseCookieHeader(readCookies()),
          cookiesToSet,
          domain,
        )) {
          writeCookie(header);
        }
      },
    },
  });
}

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase browser environment variables.");
  }

  browserClient = createHubBrowserClient({
    supabaseUrl,
    supabaseAnonKey,
    hostname: window.location.hostname,
    readCookies: () => document.cookie,
    writeCookie: (setCookie) => {
      document.cookie = setCookie;
    },
  });

  return browserClient;
}

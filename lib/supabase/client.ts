"use client";

import { createBrowserClient } from "@supabase/ssr";

import { AUTH_SESSION_STATE_HEADER, refuseRefreshGrants } from "./auth-fetch";
import {
  browserCookieWrites,
  parseCookieHeader,
  selectBrowserCookies,
} from "./browser-cookies";
import { getSupabaseCookieOptions } from "./cookie-options";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * The hub's browser client over any cookie source: `document.cookie` in
 * the app, a modelled jar in tests. Ported from #26.
 *
 * It never refreshes a session: the proxy is the hub's only refresher.
 * Two refreshers holding one refresh token — this tab and the proxy,
 * two tabs, two apps on the shared domain — rotate it twice, GoTrue
 * reads the second rotation as reuse and revokes the sign-in's refresh
 * tokens. So auto-refresh is off, refresh grants are refused before they
 * are sent, and a session close to expiry is hidden from it (see
 * `selectBrowserCookies`), as is any session name sent twice.
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
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: getSupabaseCookieOptions(hostname),
    /* This module keeps its own singleton; @supabase/ssr's would keep the
       options of whichever caller came first. */
    isSingleton: false,
    auth: { autoRefreshToken: false },
    global: {
      fetch: refuseRefreshGrants((input, init) => fetch(input, init)),
    },
    cookies: {
      getAll() {
        return selectBrowserCookies(parseCookieHeader(readCookies()));
      },
      setAll(cookiesToSet) {
        for (const header of browserCookieWrites(
          parseCookieHeader(readCookies()),
          cookiesToSet,
          hostname,
        )) {
          writeCookie(header);
        }
      },
    },
  });
}

/**
 * Lets the proxy refresh the session before a browser operation that
 * needs one: any same-origin request passes through it, and it refreshes
 * a session the browser client would hide (inside
 * BROWSER_SESSION_CUTOFF_SECONDS). The browser itself never exchanges a
 * refresh token.
 *
 * "unavailable" when the server could not be reached or could not reach
 * the Auth API: a session missing afterwards then says nothing about
 * whether it expired.
 */
export async function refreshSessionThroughServer(
  fetchImpl: typeof fetch = fetch,
): Promise<"ok" | "unavailable"> {
  try {
    const response = await fetchImpl("/api/auth/user", {
      cache: "no-store",
      credentials: "same-origin",
    });

    return response.headers.get(AUTH_SESSION_STATE_HEADER) === "unavailable" ||
      response.status >= 500
      ? "unavailable"
      : "ok";
  } catch {
    return "unavailable";
  }
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

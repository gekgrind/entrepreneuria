import "server-only";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getPublicCookieDomain } from "@/lib/auth/public-origin";
import {
  createAuthFetchObserver,
  refuseRefreshGrants,
  writesRemoveSession,
} from "./auth-cookies";
import {
  getSupabaseCookieOptions,
  mergeSupabaseCookieOptions,
} from "./cookie-options";

/*
 * Server Components and route handlers read the session the proxy
 * already refreshed (it refreshes five minutes ahead of expiry). This
 * client may never refresh on its own, however slow the request: its
 * refresh grants are refused before they are sent, because only the
 * proxy checks that a rotation returns the same account, and because
 * `cookies()` can only emit the shared-domain copy, never the host-only
 * expiry. A token that runs out mid-request just reads as signed out.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  const domain = getPublicCookieDomain({
    headers: headerStore,
    nextUrl: {
      protocol: headerStore.get("x-forwarded-proto") === "https" ? "https:" : "http:",
    },
  });
  /* Only the scope matters to the cookie options. */
  const scopeHostname = domain ? "entrepreneuria.io" : null;
  const observer = createAuthFetchObserver(refuseRefreshGrants(fetch));

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: getSupabaseCookieOptions(scopeHostname),
    global: { fetch: observer.fetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        /* An outage is not a refusal: never drop the session for one. */
        if (writesRemoveSession(cookiesToSet) && observer.isIndeterminate()) {
          return;
        }

        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(
              name,
              value,
              mergeSupabaseCookieOptions(scopeHostname, options),
            );
          }
        } catch {
          // This can fail in read-only server component contexts.
          // Middleware or route handlers can handle cookie writes instead.
        }
      },
    },
  });
}

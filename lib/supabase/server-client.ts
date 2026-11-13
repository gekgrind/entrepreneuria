import "server-only";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import {
  createAuthFetchObserver,
  keepSessionThroughOutage,
} from "./auth-fetch";
import { AUTH_REQUEST_TIMEOUT_MS } from "./auth-session-resolution";
import {
  getSupabaseCookieHostname,
  getSupabaseCookieOptions,
  mergeSupabaseCookieOptions,
} from "./cookie-options";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieHostname = getSupabaseCookieHostname(headerStore);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  /* The proxy keeps a session through an Auth API outage; so must every
     client behind it, or a route that loads the session (getUser) would
     remove what the proxy kept. */
  const observer = createAuthFetchObserver(fetch, {
    timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
  });

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: getSupabaseCookieOptions(cookieHostname),
    global: { fetch: observer.fetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll: keepSessionThroughOutage(observer, (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(
              name,
              value,
              mergeSupabaseCookieOptions(cookieHostname, options),
            );
          }
        } catch {
          // This can fail in read-only server component contexts.
          // Middleware or route handlers can handle cookie writes instead.
        }
      }),
    },
  });
}

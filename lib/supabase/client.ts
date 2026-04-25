"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getBrowserSupabaseCookieOptions } from "./cookie-options";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase browser environment variables.");
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: getBrowserSupabaseCookieOptions(),
  });

  return browserClient;
}

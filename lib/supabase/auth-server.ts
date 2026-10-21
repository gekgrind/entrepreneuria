import "server-only";

import { getSupabaseServerClient } from "./server-client";

export type AuthUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown> | null;
};

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    user_metadata:
      user.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : null,
  };
}

/**
 * Signs out the one session this request's collapsed cookies show. It
 * cannot see or revoke other copies of the session; the browser sign-out
 * path is POST /auth/signout, which does. auth-js treats a 401/403/404
 * from the Auth API as success here, so a resolved call does not prove
 * the session was revoked server-side; any other failure is thrown.
 */
export async function signOutUser() {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getSupabaseRestHeaders() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return null;
  }

  return {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export function getSupabaseRestBaseUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  return `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
}
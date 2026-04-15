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

export async function signOutUser() {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
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
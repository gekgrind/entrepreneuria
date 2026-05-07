import "server-only";

import { getAuthenticatedUser, getSupabaseRestBaseUrl, getSupabaseRestHeaders } from "@/lib/supabase/auth-server";

export type ResolvedUserIdentity = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

type MaybeProfileRow = {
  full_name?: string | null;
  avatar_url?: string | null;
};

type AuthUser = Awaited<ReturnType<typeof getAuthenticatedUser>>;

function readMetadataString(user: NonNullable<AuthUser>, key: string) {
  const value = user.user_metadata?.[key];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getFallbackName(user: NonNullable<AuthUser>) {
  return readMetadataString(user, "full_name") ?? readMetadataString(user, "name");
}

function getFallbackAvatar(user: NonNullable<AuthUser>) {
  return readMetadataString(user, "avatar_url");
}

function buildIdentity(user: NonNullable<AuthUser>, profile: MaybeProfileRow | null): ResolvedUserIdentity {
  const fullName = profile?.full_name?.trim() || getFallbackName(user);
  const avatarUrl = profile?.avatar_url?.trim() || getFallbackAvatar(user);

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: fullName ?? null,
    avatarUrl: avatarUrl ?? null,
  };
}

async function tryGetProfile(userId: string): Promise<MaybeProfileRow | null> {
  const headers = await getSupabaseRestHeaders();

  if (!headers) {
    return null;
  }

  // NOTE: The `profiles` table may not exist yet in every downstream deployment.
  // We intentionally fail open to auth metadata when this query errors.
  let response: Response;

  try {
    response = await fetch(
      `${getSupabaseRestBaseUrl()}/profiles?select=full_name,avatar_url&id=eq.${encodeURIComponent(userId)}&limit=1`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      },
    );
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as MaybeProfileRow[];
  return rows[0] ?? null;
}

export async function resolveUserIdentity(
  user: NonNullable<AuthUser>,
): Promise<ResolvedUserIdentity> {
  const profile = await tryGetProfile(user.id);
  return buildIdentity(user, profile);
}

export async function getResolvedUserIdentity(): Promise<ResolvedUserIdentity | null> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  return resolveUserIdentity(user);
}

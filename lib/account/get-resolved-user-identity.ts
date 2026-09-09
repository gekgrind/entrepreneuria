import "server-only";

import { getAuthenticatedUser, getSupabaseRestBaseUrl, getSupabaseRestHeaders } from "@/lib/supabase/auth-server";
import {
  resolveAvatarUrl,
  resolveDisplayName,
  resolveEmail,
} from "@/lib/auth/identity-metadata";

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

/*
 * The `profiles` row always wins where it has a value — it is what the
 * founder edited in Settings. Provider metadata is the fallback, and it
 * is normalized rather than read key-by-key, so a GitHub account with
 * no display name set resolves to its handle instead of to null.
 */
function buildIdentity(user: NonNullable<AuthUser>, profile: MaybeProfileRow | null): ResolvedUserIdentity {
  const email = resolveEmail(user.user_metadata, user.email);
  const fullName =
    profile?.full_name?.trim() || resolveDisplayName(user.user_metadata, email);
  const avatarUrl =
    profile?.avatar_url?.trim() || resolveAvatarUrl(user.user_metadata);

  return {
    id: user.id,
    // A GitHub account may keep its email private, so this can be empty.
    // Consumers already render "No email available" for that case.
    email: email ?? "",
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

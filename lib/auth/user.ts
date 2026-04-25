import type { User } from "@supabase/supabase-js";

export type AuthContextUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  userMetadata: Record<string, unknown>;
};

function readMetadataString(
  metadata: Record<string, unknown>,
  key: string,
) {
  const value = metadata[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function toAuthContextUser(user: User): AuthContextUser {
  const userMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : {};

  return {
    id: user.id,
    email: user.email ?? null,
    fullName:
      readMetadataString(userMetadata, "full_name") ??
      readMetadataString(userMetadata, "name"),
    avatarUrl:
      readMetadataString(userMetadata, "avatar_url") ??
      readMetadataString(userMetadata, "picture"),
    userMetadata,
  };
}

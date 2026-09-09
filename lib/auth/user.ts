import type { User } from "@supabase/supabase-js";

import {
  resolveAvatarUrl,
  resolveDisplayName,
  resolveEmail,
} from "@/lib/auth/identity-metadata";

export type AuthContextUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  userMetadata: Record<string, unknown>;
};

export function toAuthContextUser(user: User): AuthContextUser {
  const userMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : {};

  const email = resolveEmail(userMetadata, user.email);

  return {
    id: user.id,
    email,
    fullName: resolveDisplayName(userMetadata, email),
    avatarUrl: resolveAvatarUrl(userMetadata),
    userMetadata,
  };
}

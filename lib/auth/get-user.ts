import "server-only";

import { resolveUserIdentity } from "@/lib/account/get-resolved-user-identity";
import { getAuthenticatedUser } from "@/lib/supabase/auth-server";
import type { AuthContextUser } from "@/lib/auth/user";

export async function getUser(): Promise<AuthContextUser | null> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  const identity = await resolveUserIdentity(user);

  return {
    id: user.id,
    email: identity.email,
    fullName: identity.fullName,
    avatarUrl: identity.avatarUrl,
    userMetadata: user.user_metadata ?? {},
  };
}

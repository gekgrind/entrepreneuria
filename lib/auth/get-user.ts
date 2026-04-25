import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { toAuthContextUser, type AuthContextUser } from "@/lib/auth/user";

export async function getUser(): Promise<AuthContextUser | null> {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return toAuthContextUser(user);
}

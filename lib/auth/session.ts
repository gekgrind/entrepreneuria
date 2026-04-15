import "server-only";

import { getAuthenticatedUser } from "@/lib/supabase/auth-server";

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  return user;
}
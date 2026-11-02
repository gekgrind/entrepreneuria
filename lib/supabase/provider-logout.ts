/**
 * Revokes a session at the Auth API with nothing but its access token.
 *
 * No Supabase client is built, so no stored session is loaded and no
 * refresh token is ever sent: auth-js `signOut()` loads the session
 * first and refreshes a near-expiry one, which could rotate a stored
 * pair into an account other than the one being signed out. The Auth
 * API validates the token itself; an expired or refused token simply
 * revokes nothing.
 */
export async function revokeSession(
  accessToken: string,
  scope: "global" | "local",
): Promise<{ confirmed: boolean; status: number | null }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
    return { confirmed: false, status: null };
  }

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/auth/v1/logout?scope=${scope}`,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(5000),
      },
    );

    return { confirmed: response.status === 204, status: response.status };
  } catch {
    return { confirmed: false, status: null };
  }
}

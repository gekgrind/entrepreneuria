import { NextResponse, type NextRequest } from "next/server";
import { createClient, type EmailOtpType } from "@supabase/supabase-js";

import {
  DEFAULT_AUTHENTICATED_PATH,
  getSafeAuthRedirect,
} from "@/lib/auth/trusted-redirect";
import { getPublicRequestOrigin } from "@/lib/auth/public-origin";
import { revokeSession } from "@/lib/supabase/provider-logout";

/**
 * Email-confirmation landing pad.
 *
 * When a visitor clicks the verification link in their confirmation
 * email, Supabase redirects here with `token_hash` and `type`. This
 * route verifies the address and then asks the visitor to sign in; it
 * does NOT sign them in.
 *
 * A `token_hash` link is not bound to the browser that requested it
 * (unlike a PKCE code), so anyone can send their own unused link to
 * someone else. Writing the session it mints would sign that person's
 * browser into the sender's account. So the minted session is revoked
 * at once, no cookie is written, and stored sessions are left alone.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = getPublicRequestOrigin(request);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = getSafeAuthRedirect(
    searchParams.get("next"),
    DEFAULT_AUTHENTICATED_PATH,
  );

  if (!tokenHash || !type) {
    return redirectToLogin(origin, { auth_error: "confirm" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[EMAIL_CONFIRM_ERROR]", "Missing Supabase environment");
    return redirectToLogin(origin, { auth_error: "unknown" });
  }

  try {
    /* No cookie storage at all: nothing stored is read, nothing written. */
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (error) {
      console.error("[EMAIL_CONFIRM_VERIFY_ERROR]", error.message);
      return redirectToLogin(origin, { auth_error: "confirm" });
    }

    if (data.session) {
      await revokeSession(data.session.access_token, "local");
    }
  } catch (err) {
    console.error("[EMAIL_CONFIRM_ERROR]", err);
    return redirectToLogin(origin, { auth_error: "unknown" });
  }

  return redirectToLogin(origin, {
    confirmed: "1",
    ...(next !== DEFAULT_AUTHENTICATED_PATH ? { next } : {}),
  });
}

function redirectToLogin(origin: string, params: Record<string, string>) {
  const loginUrl = new URL("/login", origin);

  for (const [key, value] of Object.entries(params)) {
    loginUrl.searchParams.set(key, value);
  }

  return NextResponse.redirect(loginUrl);
}

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

import {
  DEFAULT_AUTHENTICATED_PATH,
  getSafeAuthRedirect,
} from "@/lib/auth/trusted-redirect";
import {
  getPublicRequestOrigin,
  resolveAuthDestination,
} from "@/lib/auth/public-origin";
import {
  getSupabaseCookieOptions,
  mergeSupabaseCookieOptions,
} from "@/lib/supabase/cookie-options";

/**
 * Email-confirmation landing pad.
 *
 * When a visitor clicks the verification link in their confirmation
 * email, Supabase redirects here with `token_hash` and `type` in the
 * query string. This route verifies the OTP, mints the session cookie,
 * and sends the visitor to the authenticated area — the same pattern
 * the OAuth callback uses, but for email verification instead of a
 * PKCE code exchange.
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
    return redirectToLogin(origin, "confirm");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[EMAIL_CONFIRM_ERROR]", "Missing Supabase environment");
    return redirectToLogin(origin, "unknown");
  }

  const response = NextResponse.redirect(
    resolveAuthDestination(origin, next),
  );
  const hostname = request.nextUrl.hostname;

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: getSupabaseCookieOptions(hostname),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(
              name,
              value,
              mergeSupabaseCookieOptions(hostname, options),
            );
          }
        },
      },
    });

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (error) {
      console.error("[EMAIL_CONFIRM_VERIFY_ERROR]", error.message);
      return redirectToLogin(origin, "confirm");
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return redirectToLogin(origin, "session");
    }
  } catch (err) {
    console.error("[EMAIL_CONFIRM_ERROR]", err);
    return redirectToLogin(origin, "unknown");
  }

  return response;
}

function redirectToLogin(origin: string, code: string) {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("auth_error", code);
  return NextResponse.redirect(loginUrl);
}

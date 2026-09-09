import { NextResponse, type NextRequest } from "next/server";

import {
  DEFAULT_AUTHENTICATED_PATH,
  getSafeAuthRedirect,
} from "@/lib/auth/trusted-redirect";
import { classifyProviderError, type OAuthErrorCode } from "@/lib/auth/oauth";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

/**
 * The OAuth landing pad, shared by every provider.
 *
 * Supabase's browser client starts the PKCE flow and stores the code
 * verifier in a cookie, which is exactly why the exchange belongs on
 * the server: this route can read that cookie, mint the session, and
 * write the shared `.entrepreneuria.io` auth cookie through the same
 * SSR client the rest of the app uses — so the visitor arrives at a
 * protected destination already authenticated instead of being bounced
 * by the proxy before any client code has run.
 *
 * The intended destination travels as `next` and is re-validated here
 * against the trusted-origin allow-list; the provider is never trusted
 * to hand us a redirect target.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const nextPath = getSafeAuthRedirect(searchParams.get("next"));

  /* The visitor cancelled on the provider's authorization screen, or
     the provider refused. Either way there is no code to exchange. */
  const providerError = searchParams.get("error");

  if (providerError) {
    return redirectToLogin(
      origin,
      classifyProviderError(providerError),
      nextPath,
    );
  }

  const code = searchParams.get("code");

  if (!code) {
    return redirectToLogin(origin, "unknown", nextPath);
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[OAUTH_CALLBACK_EXCHANGE_ERROR]", error.message);
      return redirectToLogin(origin, "exchange", nextPath);
    }

    /* Confirm the session actually reads back before handing the
       visitor to a protected route, so a half-written cookie surfaces
       here rather than as a redirect loop through the proxy. */
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return redirectToLogin(origin, "session", nextPath);
    }
  } catch (err) {
    console.error("[OAUTH_CALLBACK_ERROR]", err);
    return redirectToLogin(origin, "unknown", nextPath);
  }

  return NextResponse.redirect(resolveDestination(origin, nextPath));
}

/**
 * `getSafeAuthRedirect` yields either a same-site path or an absolute
 * URL on a trusted ecosystem origin; both are safe to hand to
 * `NextResponse.redirect`, which requires an absolute URL.
 */
function resolveDestination(origin: string, nextPath: string) {
  return nextPath.startsWith("https://")
    ? nextPath
    : new URL(nextPath, origin).toString();
}

function redirectToLogin(
  origin: string,
  code: OAuthErrorCode,
  nextPath: string,
) {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("auth_error", code);

  /* Keep the visitor's original destination so retrying from the login
     page still lands them where they were headed. */
  if (nextPath !== DEFAULT_AUTHENTICATED_PATH) {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

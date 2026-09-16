import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  DEFAULT_AUTHENTICATED_PATH,
  getSafeAuthRedirect,
} from "@/lib/auth/trusted-redirect";
import { classifyProviderError, type OAuthErrorCode } from "@/lib/auth/oauth";
import {
  getSupabaseCookieOptions,
  mergeSupabaseCookieOptions,
} from "@/lib/supabase/cookie-options";

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
 *
 * The session cookies are written onto the redirect response we return,
 * NOT through next/headers `cookies()`. Mutating the request cookie
 * store here does not put Set-Cookie on a response the handler
 * constructs itself, so the exchange succeeded while the browser
 * received no session at all: it then arrived at the protected
 * destination signed out and the proxy bounced it straight back to
 * /login. Binding the writes to the response is the same approach
 * proxy.ts already uses.
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[OAUTH_CALLBACK_ERROR]", "Missing Supabase environment");
    return redirectToLogin(origin, "unknown", nextPath);
  }

  /* Built before the exchange so the client below has somewhere to put
     the session cookies. */
  const response = NextResponse.redirect(resolveDestination(origin, nextPath));
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

  return response;
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

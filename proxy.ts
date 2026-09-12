import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

import {
  getSupabaseCookieOptions,
  mergeSupabaseCookieOptions,
} from "@/lib/supabase/cookie-options";

const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/account",
  "/settings",
  "/command-center",
];

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });
  let pendingCookies: CookieToSet[] = [];
  let pendingHeaders: Record<string, string> = {};

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const sharedCookieOptions = getSupabaseCookieOptions(
    request.nextUrl.hostname,
  );

  function applyPendingSessionUpdates(target: NextResponse) {
    for (const { name, value, options } of pendingCookies) {
      target.cookies.set(
        name,
        value,
        mergeSupabaseCookieOptions(request.nextUrl.hostname, options),
      );
    }

    for (const [key, value] of Object.entries(pendingHeaders)) {
      target.headers.set(key, value);
    }

    return target;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: sharedCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        // Refreshed cookies must be propagated both ways: onto `request`
        // so downstream Server Components in this same request see the
        // refreshed session, and onto `response` so the browser does.
        // Rebuilding `response` from the mutated `request` is what makes
        // the forwarded request carry the new values.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({
          request,
          headers: response.headers,
        });

        pendingCookies = [...pendingCookies, ...cookiesToSet];
        pendingHeaders = { ...pendingHeaders, ...headersToSet };
        applyPendingSessionUpdates(response);
      },
    },
  });

  if (isProtectedRoute(request.nextUrl.pathname)) {
    // getClaims() verifies the JWT (locally against Supabase's JWKS, or
    // via the Auth server as a fallback) instead of trusting the
    // unverified session payload the way a raw getSession() read would.
    const { data } = await supabase.auth.getClaims();

    if (!data?.claims) {
      const loginUrl = request.nextUrl.clone();
      const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("next", nextPath);

      return applyPendingSessionUpdates(NextResponse.redirect(loginUrl));
    }
  } else {
    await supabase.auth.getSession();
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

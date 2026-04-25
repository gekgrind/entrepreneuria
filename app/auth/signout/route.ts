import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { signOutUser } from "@/lib/supabase/auth-server";
import {
  getSupabaseCookieOptions,
  SUPABASE_AUTH_COOKIE_NAME,
} from "@/lib/supabase/cookie-options";

export async function POST(request: Request) {
  await signOutUser();

  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
  const cookieOptions = getSupabaseCookieOptions(new URL(request.url).hostname);

  const cookieStore = await cookies();
  const authCookies = cookieStore
    .getAll()
    .filter(
      (cookie) =>
        cookie.name === SUPABASE_AUTH_COOKIE_NAME ||
        cookie.name.startsWith(`${SUPABASE_AUTH_COOKIE_NAME}.`) ||
        cookie.name === "sb-access-token" ||
        cookie.name === "supabase-auth-token" ||
        (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))
    );

  for (const cookie of authCookies) {
    response.cookies.set(cookie.name, "", {
      ...cookieOptions,
      maxAge: 0,
      expires: new Date(0),
    });
    response.cookies.set(cookie.name, "", {
      ...cookieOptions,
      domain: undefined,
      maxAge: 0,
      expires: new Date(0),
    });
  }

  return response;
}

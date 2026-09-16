import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { getSignOutRedirectUrl } from "@/lib/auth/public-origin";
import { signOutUser } from "@/lib/supabase/auth-server";
import {
  mergeSupabaseCookieOptions,
  SUPABASE_AUTH_COOKIE_NAME,
} from "@/lib/supabase/cookie-options";

export async function POST(request: NextRequest) {
  await signOutUser();

  /* Not `request.url`: under `next start` behind nginx that is
     http://localhost:3000, and the browser following this 303 from
     entrepreneuria.io made a loopback request — which is what raised
     Chrome's "access other apps and services on this device" prompt. */
  const response = NextResponse.redirect(getSignOutRedirectUrl(request), {
    status: 303,
  });
  /* Merged options never carry the storage-key `name`, which would
     otherwise rename every chunk deletion to the bare cookie name and
     leave `entrepreneuria-auth-token.0`, `.1`, … behind. */
  const cookieOptions = mergeSupabaseCookieOptions(
    new URL(request.url).hostname,
    {},
  );

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

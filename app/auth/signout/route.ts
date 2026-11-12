import { NextResponse, type NextRequest } from "next/server";

import {
  getPublicCookieDomain,
  getSignOutRedirectUrl,
} from "@/lib/auth/public-origin";
import {
  AUTH_CODE_VERIFIER_COOKIE_NAME,
  classifyAuthCookies,
  isAuthFamilyCookie,
  isLegacyAuthCookie,
  parseCookieHeader,
  serializeExpiry,
} from "@/lib/supabase/auth-cookies";
import { revokeSession } from "@/lib/supabase/provider-logout";

/*
 * Sign-out builds no Supabase client and never touches `cookies()`.
 *
 * - The provider call uses only the stored access token (see
 *   revokeSession), so a stored pair is never refreshed on the way out.
 *   The scope stays `global`, as before: every session of the account.
 * - A family that is not one unambiguous session gets no provider call.
 * - Every session cookie is expired in BOTH scopes with raw headers.
 *   ResponseCookies keeps one cookie per name, and `cookies()` mutations
 *   are merged through it after the handler returns, so either would
 *   collapse the host-only/Domain pair and leave one copy behind.
 */
export async function POST(request: NextRequest) {
  const pairs = parseCookieHeader(request.headers.get("cookie"));
  const inventory = classifyAuthCookies(pairs);

  if (inventory.kind === "single") {
    const { confirmed, status } = await revokeSession(
      inventory.session.accessToken,
      "global",
    );

    if (!confirmed) {
      console.warn("[AUTH_SIGNOUT_UNCONFIRMED]", status ?? "network");
    }
  }

  /* Not `request.url`: under `next start` behind nginx that is
     http://localhost:3000, and the browser following this 303 from
     entrepreneuria.io made a loopback request — which is what raised
     Chrome's "access other apps and services on this device" prompt. */
  const response = NextResponse.redirect(getSignOutRedirectUrl(request), {
    status: 303,
  });
  const domain = getPublicCookieDomain(request);
  const names = new Set(
    pairs
      .map(({ name }) => name)
      .filter(
        (name) =>
          isAuthFamilyCookie(name) ||
          isLegacyAuthCookie(name) ||
          name === AUTH_CODE_VERIFIER_COOKIE_NAME,
      ),
  );

  for (const name of names) {
    for (const header of serializeExpiry(name, domain)) {
      response.headers.append("set-cookie", header);
    }
  }

  response.headers.set("cache-control", "no-store");

  return response;
}

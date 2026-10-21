import { NextResponse, type NextRequest } from "next/server";

import {
  getPublicRequestOrigin,
  getSignOutRedirectUrl,
} from "@/lib/auth/public-origin";
import {
  getTrustedSiteOrigins,
  isSameOriginRequest,
} from "@/lib/auth/same-origin";
import {
  SIGN_OUT_PAGE_PATH,
  getSafeRetryPath,
  isSessionRecoveryReason,
} from "@/lib/auth/session-recovery";
import {
  AUTH_NO_STORE_HEADERS,
  applyAuthResponseHeaders,
  expireAllAuthCookies,
  readAuthCookieInventory,
} from "@/lib/supabase/auth-cookie-cleanup";
import {
  revokeSessionCandidates,
  type RevocationReport,
  type RevocationStatus,
} from "@/lib/supabase/auth-session-resolution";
import { getSupabaseCookieOptions } from "@/lib/supabase/cookie-options";

/*
 * Sign-out. The proxy passes this path through untouched, so the route
 * sees the browser's own cookie inventory, every copy included.
 *
 * GET changes nothing: a state-changing GET could be triggered by any
 * page with an <img>. It forwards to the confirmation page, whose button
 * POSTs here; the POST is refused unless it provably comes from this site.
 */

export function GET(request: NextRequest) {
  /* On the public origin, never the `next start` bind address. */
  const target = new URL(SIGN_OUT_PAGE_PATH, getPublicRequestOrigin(request));
  const reason = request.nextUrl.searchParams.get("reason");
  const next = request.nextUrl.searchParams.get("next");

  if (isSessionRecoveryReason(reason)) {
    target.searchParams.set("reason", reason);
  }
  if (next) {
    target.searchParams.set("next", getSafeRetryPath(next));
  }

  const response = NextResponse.redirect(target, { status: 303 });
  applyAuthResponseHeaders(response);

  return response;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request, getTrustedSiteOrigins(request))) {
    return new NextResponse("Sign-out must come from this site.", {
      status: 403,
      headers: AUTH_NO_STORE_HEADERS,
    });
  }

  const authCookies = readAuthCookieInventory(request);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let report: RevocationReport | null = null;

  if (supabaseUrl && supabaseAnonKey) {
    /* Revokes every sign-in the browser holds a copy of, each judged on
       its own tokens: a collapsed name-keyed read would revoke only
       whichever generation was sent last. Deliberately not the
       next/headers server client: any `cookies()` write here makes Next
       rebuild this response's Set-Cookie headers from a name-keyed map,
       which collapses the paired host-only / `.entrepreneuria.io`
       expiries below to one scope per name — that is how the
       shared-domain session used to survive sign-out. */
    report = await revokeSessionCandidates(authCookies, {
      supabaseUrl,
      supabaseKey: supabaseAnonKey,
      cookieOptions: getSupabaseCookieOptions(authCookies.cookieHostname),
    });
  }

  /* Without the Auth API nothing is confirmed: any credential the
     browser held may still work. Deleting local cookies alone is never
     reported as a sign-out everywhere. */
  const status: RevocationStatus =
    report?.status ??
    (authCookies.candidates.length > 0 ||
    authCookies.candidatesTruncated ||
    authCookies.legacy.length > 0
      ? "incomplete"
      : "local");

  /* Not `request.url`: under `next start` behind nginx that is
     http://localhost:3000, and the browser following this 303 from
     entrepreneuria.io made a loopback request — which is what raised
     Chrome's "access other apps and services on this device" prompt.
     Only a confirmed sign-out everywhere goes straight to /login;
     anything less lands on a page that says what was and wasn't
     confirmed. No retry happens on its own. */
  const response = NextResponse.redirect(
    status === "complete"
      ? getSignOutRedirectUrl(request)
      : new URL(
          `${SIGN_OUT_PAGE_PATH}?status=${status}`,
          getPublicRequestOrigin(request),
        ),
    { status: 303 },
  );

  /* Local cleanup never depends on the Auth API: every session chunk and
     legacy auth cookie the browser sent is expired, in both scopes,
     uncacheably. */
  expireAllAuthCookies(authCookies, response);

  response.headers.set("X-Auth-Revocation", status);

  if (status !== "complete") {
    /* Counts only: never a token, cookie value or user id. */
    console.warn("[auth] sign-out not confirmed everywhere", {
      status,
      configured: Boolean(supabaseUrl && supabaseAnonKey),
      candidates: report?.candidates ?? authCookies.candidates.length,
      revoked: report?.revoked ?? 0,
      alreadyInvalid: report?.alreadyInvalid ?? 0,
      uncertain: report?.uncertain ?? 0,
      skipped: report?.skipped ?? 0,
      usersSignedOut: report?.usersSignedOut ?? 0,
      usersUnconfirmed: report?.usersUnconfirmed ?? 0,
      legacyCookies: authCookies.legacy.length,
    });
  }

  return response;
}

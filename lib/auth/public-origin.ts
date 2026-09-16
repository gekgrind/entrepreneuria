import { getTrustedRedirectOrigins } from "./trusted-redirect";

/**
 * Where auth redirects go when the request itself cannot tell us.
 *
 * Self-hosted `next start` does NOT build `request.url` /
 * `request.nextUrl` from the Host header: it uses the address the
 * server was started on, so behind nginx on the VPS every route handler
 * sees `http://localhost:3000`. Redirects built from `nextUrl.origin`
 * therefore sent production visitors to localhost after a successful
 * OAuth exchange. The public origin has to come from the forwarded
 * headers instead, and only when they name an origin we trust.
 */
export const CANONICAL_AUTH_ORIGIN = "https://entrepreneuria.io";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

type HeaderReader = { get(name: string): string | null };

export type PublicOriginRequest = {
  headers: HeaderReader;
  nextUrl: { protocol: string };
};

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function toOrigin(protocol: string, host: string) {
  try {
    const url = new URL(`${protocol}//${host}`);

    /* A Host header is a bare authority; anything that parses into a
       path, credentials or query is not one. */
    if (url.pathname !== "/" || url.username || url.password || url.search) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

/**
 * The origin the visitor's browser actually addressed, for building
 * post-auth redirects.
 *
 * Host headers are client-controlled, so they are only honoured when
 * they name a trusted Entrepreneuria origin (always over https), or —
 * outside production — a loopback address, which is only reachable
 * when the app really is running locally. Anything else falls back to
 * the canonical production origin: never localhost, never a private
 * network address, never an arbitrary external host.
 */
export function getPublicRequestOrigin(
  request: PublicOriginRequest,
  { isProduction = process.env.NODE_ENV === "production" } = {},
) {
  const hosts = [
    firstHeaderValue(request.headers.get("x-forwarded-host")),
    firstHeaderValue(request.headers.get("host")),
  ].filter((host): host is string => Boolean(host));

  const trustedOrigins = getTrustedRedirectOrigins();

  for (const host of hosts) {
    const url = toOrigin("https:", host);

    if (url && trustedOrigins.has(url.origin)) {
      return url.origin;
    }
  }

  if (!isProduction) {
    for (const host of hosts) {
      const url = toOrigin(request.nextUrl.protocol, host);

      if (url && LOOPBACK_HOSTNAMES.has(url.hostname)) {
        return url.origin;
      }
    }
  }

  return CANONICAL_AUTH_ORIGIN;
}

/**
 * `getSafeAuthRedirect` yields either a same-site path or an absolute
 * URL on a trusted ecosystem origin; both resolve to an absolute URL
 * here, which is what `NextResponse.redirect` requires.
 */
export function resolveAuthDestination(origin: string, nextPath: string) {
  return nextPath.startsWith("https://")
    ? nextPath
    : new URL(nextPath, origin).toString();
}

/**
 * Where POST /auth/signout sends the visitor: /login on the public
 * origin, never the `next start` bind address.
 */
export function getSignOutRedirectUrl(
  request: PublicOriginRequest,
  options?: { isProduction?: boolean },
) {
  return new URL("/login", getPublicRequestOrigin(request, options));
}

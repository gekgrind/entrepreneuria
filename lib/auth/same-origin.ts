import { getPublicRequestOrigin, type PublicOriginRequest } from "./public-origin";

type HeaderReader = { get(name: string): string | null };

/**
 * The origins this site's own pages are served from, compared whole
 * (scheme, host and port): the public origin `getPublicRequestOrigin`
 * derives, which honours a forwarded host only when it names a trusted
 * Entrepreneuria origin (always https), or a loopback one outside
 * production — never an arbitrary forwarded header.
 */
export function getTrustedSiteOrigins(request: PublicOriginRequest) {
  return new Set([getPublicRequestOrigin(request)]);
}

/** A serialized origin, or null unless the value is exactly one. */
function parseOrigin(value: string) {
  try {
    const url = new URL(value);

    /* scheme://host[:port], nothing more; rules out the opaque `null`. */
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.origin !== value.toLowerCase()
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Whether a state-changing request provably comes from one of
 * `trustedOrigins`, judged only from headers page script cannot set.
 *
 * - `Sec-Fetch-Site`, when present, must be `same-origin`.
 * - `Origin`, when present, must equal a trusted origin exactly.
 * - At least one of them must be present. Every current browser sends
 *   `Origin` on a POST, so a request with neither proves nothing about
 *   where it came from and is refused.
 *
 * Contradictory headers fail one of the checks.
 */
export function isSameOriginRequest(
  request: { headers: HeaderReader },
  trustedOrigins: ReadonlySet<string>,
) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");

  if (site !== null && site.trim().toLowerCase() !== "same-origin") {
    return false;
  }

  if (origin === null) {
    return site !== null;
  }

  const parsed = parseOrigin(origin.trim());

  return parsed !== null && trustedOrigins.has(parsed);
}

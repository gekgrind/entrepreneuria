/*
 * Browser security headers sent on every response, static assets
 * included (next.config.mjs `headers()`). The full, nonce-based CSP is
 * NOT here: it carries a per-request nonce and is set by the proxy
 * (lib/security/csp.ts).
 *
 * Plain .mjs so next.config.mjs can import it without a TypeScript step.
 */

/**
 * Enforced in every CSP_MODE: no framing, no <base> hijack, no plugins.
 *
 * It lives here, not in the proxy, because Next.js copies proxy response
 * headers onto the forwarded request and reads `content-security-policy`
 * there for the script nonce; a nonce-less policy from the proxy would
 * hide the nonce from the renderer. Under CSP_MODE=enforce the proxy's
 * full policy (a superset of this one) replaces it.
 */
export const BASELINE_CSP = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

/**
 * HSTS for the hub's own host only.
 *
 * Deliberately WITHOUT `includeSubDomains` and `preload`: sibling apps
 * and any future subdomain would inherit it, and neither is reversible
 * on a short timescale. Those need the owner's explicit approval after
 * every *.entrepreneuria.io host is verified HTTPS-only.
 *
 * The max-age starts at one day (SECURITY_HSTS_MAX_AGE overrides it) so
 * a misconfiguration can still be walked back; raise it to 31536000
 * once the rollout is clean.
 */
export const DEFAULT_HSTS_MAX_AGE_SECONDS = 86400;

/** @param {string | undefined} value */
export function getHstsMaxAge(value) {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_HSTS_MAX_AGE_SECONDS;
  }

  const parsed = Number(value);

  /* Anything unparseable keeps the conservative default; 0 is a valid,
     explicit way to tell browsers to forget the policy. */
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 63072000) {
    return DEFAULT_HSTS_MAX_AGE_SECONDS;
  }

  return parsed;
}

/**
 * @param {{ isProduction?: boolean, hstsMaxAge?: string }} [options]
 * @returns {{ key: string, value: string }[]}
 */
export function getBrowserSecurityHeaders({
  isProduction = process.env.NODE_ENV === "production",
  hstsMaxAge = process.env.SECURITY_HSTS_MAX_AGE,
} = {}) {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    /* Features this app never uses, denied to it and to every frame it
       embeds (Turnstile included, which needs none of them). */
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
    /* Legacy twin of CSP `frame-ancestors 'none'`, for browsers and
       responses without the CSP header. */
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Content-Security-Policy", value: BASELINE_CSP },
  ];

  /* Browsers ignore HSTS over http; outside production it would only
     pin localhost. */
  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: `max-age=${getHstsMaxAge(hstsMaxAge)}`,
    });
  }

  return headers;
}

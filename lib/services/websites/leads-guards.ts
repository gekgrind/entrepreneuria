/**
 * Extra request checks that apply only to the leads-only path. Pure.
 *
 * The host allowlist, bounded body read, trusted client address and
 * Turnstile are shared with every mode (gate.ts, request-guards.ts,
 * turnstile.ts). These two are additional and leads-only.
 */

/** Only the origin the page was served on (gate.origin) may post. A missing Origin header fails closed. */
export function isAllowedOrigin(request: Request, allowedOrigin: string): boolean {
  return request.headers.get("origin") === allowedOrigin;
}

export function isJsonContentType(request: Request): boolean {
  const ct = request.headers.get("content-type") ?? "";
  return /^application\/json\s*(;|$)/i.test(ct);
}

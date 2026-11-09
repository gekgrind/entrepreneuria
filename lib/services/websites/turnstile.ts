/**
 * Turnstile verification for the Websites inquiry.
 *
 * Separate from lib/auth/verify-turnstile.ts so the auth flows keep their
 * behavior. This verifier adds:
 *   - a request timeout (default 5 s); a timeout or network error fails closed
 *   - a hostname check: the challenge must have been solved on the host
 *     the inquiry was posted to
 *   - an action check: the token must come from the inquiry widget
 *
 * Pure of env so it is unit-tested with a fake fetch; the route passes the
 * secret in.
 */

export const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** Must match the `action` the inquiry form renders the widget with. */
export const WEBSITES_TURNSTILE_ACTION = "websites-inquiry";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface TurnstileVerifierOptions {
  secret: string;
  /** Hostname (no port) the challenge must report. */
  expectedHostname: string;
  expectedAction: string;
  timeoutMs?: number;
  fetch?: FetchLike;
}

export function createTurnstileVerifier(opts: TurnstileVerifierOptions): (token: string) => Promise<boolean> {
  const doFetch = opts.fetch ?? ((i, init) => fetch(i, init));
  const timeoutMs = opts.timeoutMs ?? 5000;
  const expectedHostname = opts.expectedHostname.toLowerCase();

  return async function verify(token: string): Promise<boolean> {
    if (!opts.secret || !token) return false;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const form = new FormData();
      form.append("secret", opts.secret);
      form.append("response", token);
      const res = await doFetch(TURNSTILE_SITEVERIFY_URL, {
        method: "POST",
        body: form,
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) return false;
      // The body is read under the same timeout.
      const data = (await res.json()) as { success?: unknown; hostname?: unknown; action?: unknown };
      return (
        data?.success === true &&
        typeof data.hostname === "string" &&
        data.hostname.toLowerCase() === expectedHostname &&
        data.action === opts.expectedAction
      );
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
}

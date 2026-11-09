/**
 * Turnstile verification for the website inquiry form.
 *
 * Separate from lib/auth/verify-turnstile.ts (used by sign-in flows), which
 * is left unchanged. On top of `success`, this requires the token to have
 * been issued for this host and for the inquiry form's action, and gives
 * up after a timeout. Any error or unexpected response counts as failed.
 */
import { WEBSITES_TURNSTILE_ACTION } from "./content";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_TIMEOUT_MS = 5000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function createTurnstileVerifier(opts: {
  secret: string;
  /** Hostname (no port) the page was served on. */
  expectedHostname: string;
  expectedAction?: string;
  timeoutMs?: number;
  fetch?: FetchLike;
}): (token: string) => Promise<boolean> {
  const { secret, expectedHostname, expectedAction = WEBSITES_TURNSTILE_ACTION, timeoutMs = TURNSTILE_TIMEOUT_MS } = opts;
  const doFetch = opts.fetch ?? ((i, init) => fetch(i, init));
  if (!secret) throw new Error("createTurnstileVerifier requires a secret");

  return async (token) => {
    if (!token) return false;
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    // The timeout covers the response body too.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(SITEVERIFY_URL, {
        method: "POST",
        body: form,
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { success?: unknown; hostname?: unknown; action?: unknown };
      return data.success === true && data.hostname === expectedHostname && data.action === expectedAction;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
}

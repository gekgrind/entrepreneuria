/**
 * Turnstile verification for the website inquiry form.
 *
 * Sign-in flows do not verify here: they pass the token to Supabase Auth
 * as `captchaToken`, and Supabase verifies it. On top of `success`, this
 * requires the token to have
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
  /**
   * Called when the verification SERVICE itself fails (network error, timeout,
   * non-2xx), as distinct from a challenge that simply failed. Used for
   * alerting only; the result is still `false`. Must not throw.
   */
  onServiceError?: () => void;
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
      if (!res.ok) {
        opts.onServiceError?.();
        return false;
      }
      const data = (await res.json()) as { success?: unknown; hostname?: unknown; action?: unknown };
      return data.success === true && data.hostname === expectedHostname && data.action === expectedAction;
    } catch {
      opts.onServiceError?.();
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
}

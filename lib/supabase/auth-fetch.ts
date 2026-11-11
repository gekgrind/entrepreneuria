import type { CookieOptions } from "@supabase/ssr";

/*
 * fetch wrappers for Supabase clients, ported from #26
 * (`lib/supabase/auth-cookies.ts` there). Pure: they run in the proxy
 * and in the browser.
 */

function requestUrl(input: RequestInfo | URL) {
  return input instanceof Request ? input.url : String(input);
}

function isRefreshGrant(input: RequestInfo | URL) {
  const url = requestUrl(input);

  return url.includes("/auth/v1/token") && url.includes("grant_type=refresh_token");
}

/**
 * Refuses refresh grants before they leave this process. The browser
 * client uses it so that the proxy is the only place a refresh token is
 * ever exchanged: two refreshers holding the same refresh token (two
 * tabs, two apps) rotate it twice, GoTrue reads the second as reuse, and
 * the sign-in's refresh tokens are revoked.
 *
 * Thrown as a network failure, which auth-js treats as retryable: it
 * neither stores a new session nor removes the current one. auth-js does
 * retry a retryable refresh for up to 30 s, though, so this is only a
 * backstop: the browser client also hides any session close enough to
 * expiry that auth-js would try (see `selectBrowserCookies`).
 */
export function refuseRefreshGrants(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    if (isRefreshGrant(input)) {
      throw new TypeError("Session refresh is handled by the server.");
    }

    return baseFetch(input, init);
  };
}

/**
 * Set by the proxy, to "unavailable", on a response for which it could
 * not refresh a session because the Auth API gave no answer. The session
 * itself is left as it was; the page that asked can then say the
 * sign-in service is unreachable instead of calling the session expired.
 */
export const AUTH_SESSION_STATE_HEADER = "X-Auth-Session";

/**
 * Wraps fetch so a caller can tell a definitive Auth API answer from an
 * outage. auth-js removes the stored session on any refresh error it
 * does not retry, a plain 500 included, so a removal is only honoured
 * when no Auth API call in the same request was indeterminate (a
 * network failure, a 5xx, a 429).
 */
export function createAuthFetchObserver(baseFetch: typeof fetch = fetch) {
  let indeterminate = false;

  const observed: typeof fetch = async (input, init) => {
    const isAuthApi = requestUrl(input).includes("/auth/v1/");

    try {
      const response = await baseFetch(input, init);

      if (isAuthApi && (response.status >= 500 || response.status === 429)) {
        indeterminate = true;
      }

      return response;
    } catch (error) {
      if (isAuthApi) {
        indeterminate = true;
      }

      throw error;
    }
  };

  return { fetch: observed, isIndeterminate: () => indeterminate };
}

function isRemoval(value: string, options: CookieOptions) {
  return value === "" || (options.maxAge !== undefined && options.maxAge <= 0);
}

/** A batch of Supabase cookie writes that only removes cookies. */
export function writesRemoveSession(
  cookiesToSet: { value: string; options: CookieOptions }[],
) {
  return (
    cookiesToSet.length > 0 &&
    cookiesToSet.every(({ value, options }) => isRemoval(value, options))
  );
}

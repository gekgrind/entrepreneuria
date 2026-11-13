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

/*
 * Codes in which the Auth API itself says a refresh token (or the sign-in
 * behind it) is finished. Only these make a refused refresh a definitive
 * answer; the same set the sign-out judgement trusts
 * (`auth-session-resolution`), plus a banned user.
 */
const REFRESH_REFUSAL_CODES = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_not_found",
  "session_expired",
  "user_not_found",
  "user_banned",
]);

type RefreshVerdict = "session" | "refused" | "indeterminate";

/**
 * What a refresh-grant response proves. A bare status proves nothing (a
 * gateway's 403, a WAF's 401), and neither does a 200 that is not a
 * session: only a session body, or a refusal GoTrue itself coded, is an
 * answer. Anything else is no answer at all.
 */
async function judgeRefreshResponse(response: Response): Promise<RefreshVerdict> {
  if (response.status >= 500 || response.status === 429) return "indeterminate";

  let body: unknown;

  try {
    const text = await response.clone().text();
    body = text ? JSON.parse(text) : null;
  } catch {
    return "indeterminate";
  }

  const record =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  if (response.ok) {
    return typeof record.access_token === "string" &&
      typeof record.refresh_token === "string" &&
      typeof record.user === "object" &&
      record.user !== null
      ? "session"
      : "indeterminate";
  }

  /* A legacy error body carries the HTTP status as a numeric `code`;
     only a string is an error code. */
  const code =
    typeof record.error_code === "string"
      ? record.error_code
      : typeof record.code === "string"
        ? record.code
        : null;

  return code !== null && REFRESH_REFUSAL_CODES.has(code)
    ? "refused"
    : "indeterminate";
}

/*
 * What auth-js is handed when a refresh got no answer. Its own handling
 * of a failed fetch is to retry, sleeping 200 ms, 400 ms, ... for up to
 * 30 s, and to treat an unreadable success as a missing session and drop
 * it. A coded, non-retryable refusal ends the attempt at once; its
 * removal of the session is then dropped by the caller, because the
 * observer is indeterminate (see `writesRemoveSession`).
 */
function unavailableRefreshResponse() {
  return new Response(
    JSON.stringify({
      error_code: "auth_unavailable",
      msg: "The Auth API gave no usable answer to the refresh.",
    }),
    { status: 408, headers: { "content-type": "application/json" } },
  );
}

/**
 * Wraps fetch so a caller can tell a definitive Auth API answer from an
 * outage. auth-js removes the stored session on any refresh error it
 * does not retry, so a removal is only honoured when no Auth API call in
 * the same request was indeterminate: a network failure, a timeout, a
 * 5xx or 429, and, for a refresh, any response that is neither a session
 * nor a coded refusal (a gateway's 403, a 200 with `{}`).
 *
 * With `timeoutMs`, every Auth API request has that deadline, body
 * included. A refresh is also a single attempt: one that gets no answer
 * is not retried (here or by auth-js), and no further refresh is sent
 * for the rest of the request, so a stalled Auth API costs one deadline.
 */
export function createAuthFetchObserver(
  baseFetch: typeof fetch = fetch,
  { timeoutMs }: { timeoutMs?: number } = {},
) {
  let indeterminate = false;

  const observed: typeof fetch = async (input, init) => {
    const isAuthApi = requestUrl(input).includes("/auth/v1/");
    const isRefresh = isAuthApi && isRefreshGrant(input);

    if (isRefresh && indeterminate) {
      return unavailableRefreshResponse();
    }

    let requestInit = init;

    if (isAuthApi && timeoutMs !== undefined) {
      const deadline = AbortSignal.timeout(timeoutMs);

      requestInit = {
        ...init,
        signal: init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline,
      };
    }

    try {
      const response = await baseFetch(input, requestInit);

      if (isRefresh) {
        if ((await judgeRefreshResponse(response)) === "indeterminate") {
          indeterminate = true;

          return unavailableRefreshResponse();
        }

        return response;
      }

      if (isAuthApi && (response.status >= 500 || response.status === 429)) {
        indeterminate = true;
      }

      return response;
    } catch (error) {
      if (isAuthApi) {
        indeterminate = true;
      }

      if (isRefresh) {
        return unavailableRefreshResponse();
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

/**
 * A Supabase cookie adapter's `setAll` that keeps the session through an
 * Auth API outage, as the proxy does: auth-js removes a stored session
 * on any refresh error it does not retry (a plain 500 included), so a
 * removal is dropped when an Auth API call made by the same client got
 * no clear answer. Every other write goes through unchanged.
 */
export function keepSessionThroughOutage<
  Write extends { value: string; options: CookieOptions },
  Rest extends unknown[],
>(
  observer: { isIndeterminate(): boolean },
  setAll: (cookiesToSet: Write[], ...rest: Rest) => void,
) {
  return (cookiesToSet: Write[], ...rest: Rest) => {
    if (writesRemoveSession(cookiesToSet) && observer.isIndeterminate()) {
      return;
    }

    setAll(cookiesToSet, ...rest);
  };
}

import { SIGN_OUT_PAGE_PATH } from "./session-recovery";

/* The sign-out page with the form again, saying the last try failed. */
export const SIGN_OUT_FAILED_PATH = `${SIGN_OUT_PAGE_PATH}?error=sign-out-failed`;

/* The only pages POST /auth/signout redirects to. */
const SIGN_OUT_OUTCOME_PATHS = new Set(["/login", SIGN_OUT_PAGE_PATH]);

/**
 * Where to send the visitor after a `fetch` POST to /auth/signout.
 *
 * The route answers every sign-out it carried out with a redirect, which
 * `fetch` follows: to /login, or to the page saying what could not be
 * confirmed. Only such a redirect on this origin, ending in a page that
 * loaded, is an outcome. Anything else — the same-origin guard's 403, a
 * 5xx from the route or the proxy in front of it, an unexpected page —
 * may mean the cookies were never expired, so the visitor goes back to
 * the form with that said, never on to /login as if it had worked. A
 * request that never completed is `null`.
 */
export function signOutDestination(
  response: Pick<Response, "redirected" | "url" | "ok"> | null,
  currentHref: string,
) {
  const current = new URL(currentHref);

  if (response?.redirected && response.ok) {
    try {
      const target = new URL(response.url);

      if (
        target.origin === current.origin &&
        SIGN_OUT_OUTCOME_PATHS.has(target.pathname)
      ) {
        return target.toString();
      }
    } catch {
      /* Not a URL: not an outcome either. */
    }
  }

  return new URL(SIGN_OUT_FAILED_PATH, current).toString();
}

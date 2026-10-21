import { getSafeAuthRedirect } from "./trusted-redirect";

/*
 * Sign-out confirmation and session recovery live on a page, since
 * POST /auth/signout is the only thing that signs anyone out.
 */
export const SIGN_OUT_PAGE_PATH = "/sign-out";

/** Why the visitor was sent to the session recovery page. */
export type SessionRecoveryReason =
  /** Two accepted sessions name different accounts. */
  | "session-conflict"
  /** Several saved sessions, none of which can be chosen safely. */
  | "session-unresolved"
  /** The Auth API could not be reached to check them. */
  | "auth-unavailable";

export const SESSION_RECOVERY_REASONS: readonly SessionRecoveryReason[] = [
  "session-conflict",
  "session-unresolved",
  "auth-unavailable",
];

export function isSessionRecoveryReason(
  value: string | null | undefined,
): value is SessionRecoveryReason {
  return (SESSION_RECOVERY_REASONS as readonly (string | null | undefined)[]).includes(
    value,
  );
}

/** A same-site path to retry, never an absolute URL. */
export function getSafeRetryPath(value: string | null | undefined) {
  const safe = getSafeAuthRedirect(value ?? null);

  return safe.startsWith("/") ? safe : getSafeAuthRedirect(null);
}

export function buildSessionRecoveryPath(
  reason: SessionRecoveryReason,
  nextPath?: string | null,
) {
  const params = new URLSearchParams({ reason });

  if (nextPath) {
    params.set("next", getSafeRetryPath(nextPath));
  }

  return `${SIGN_OUT_PAGE_PATH}?${params.toString()}`;
}

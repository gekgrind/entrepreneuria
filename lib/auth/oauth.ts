/**
 * The OAuth provider contract shared by login and sign-up.
 *
 * Both routes hand off to Supabase with the SAME shape: the browser
 * starts the PKCE flow, Supabase returns the visitor to
 * `/auth/callback`, and the server route exchanges the code for the
 * shared Entrepreneuria session cookie. Providers differ only in the
 * `provider` string and the words on the button, so they live in one
 * registry rather than being re-declared per page.
 */

export const OAUTH_CALLBACK_PATH = "/auth/callback";

export type OAuthProviderId = "google" | "github";

export type OAuthProvider = {
  id: OAuthProviderId;
  /** Button copy, e.g. "Continue with GitHub". */
  label: string;
  /** Shown in place of the label while the redirect is in flight. */
  redirectingLabel: string;
};

/** Order here is the order the buttons render in. */
export const OAUTH_PROVIDERS: readonly OAuthProvider[] = [
  {
    id: "google",
    label: "Continue with Google",
    redirectingLabel: "Redirecting to Google",
  },
  {
    id: "github",
    label: "Continue with GitHub",
    redirectingLabel: "Redirecting to GitHub",
  },
];

/**
 * Builds the absolute `redirectTo` handed to Supabase.
 *
 * The visitor's intended destination rides along as `next` rather than
 * being the redirect target itself: the destination is usually a
 * protected route, and the proxy would bounce it to /login (dropping
 * the `code` with it) before any client code could exchange it.
 */
export function buildOAuthCallbackUrl(origin: string, nextPath: string) {
  const url = new URL(OAUTH_CALLBACK_PATH, origin);
  url.searchParams.set("next", nextPath);

  return url.toString();
}

/*
 * Error copy. Provider and Supabase error strings are never shown
 * verbatim — they leak configuration detail and read as a crash. The
 * callback route redirects with one of these codes instead.
 */
export type OAuthErrorCode =
  | "cancelled"
  | "provider"
  | "exchange"
  | "session"
  | "confirm"
  | "unknown";

const OAUTH_ERROR_MESSAGES: Record<OAuthErrorCode, string> = {
  cancelled: "Authorization was cancelled. You can try again when you're ready.",
  provider:
    "Your provider could not complete the sign in. Please try again, or use your email and password.",
  exchange:
    "We could not finish signing you in. Please try again, or use your email and password.",
  session:
    "We could not start your session. Please try again, or use your email and password.",
  confirm:
    "Your verification link has expired or was already used. Please sign up again to receive a new one.",
  unknown:
    "Sign in is temporarily unavailable. Please try again in a moment.",
};

export function getOAuthErrorMessage(code: string | null) {
  if (!code) {
    return null;
  }

  return (
    OAUTH_ERROR_MESSAGES[code as OAuthErrorCode] ?? OAUTH_ERROR_MESSAGES.unknown
  );
}

/**
 * Maps the provider's own `error` query parameter onto our codes.
 * GitHub sends `access_denied` when the visitor clicks Cancel on the
 * authorization screen; Google sends the same for its Deny.
 */
export function classifyProviderError(error: string | null): OAuthErrorCode {
  if (!error) {
    return "unknown";
  }

  return error === "access_denied" ? "cancelled" : "provider";
}

import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthAlert,
  AuthHeading,
  AuthLink,
  AuthMeta,
  AuthSubmit,
} from "@/components/auth/fields";
import {
  getSafeRetryPath,
  isSessionRecoveryReason,
  type SessionRecoveryReason,
} from "@/lib/auth/session-recovery";

/*
 * Sign-out confirmation and session recovery. Sign-out itself only
 * happens when the visitor submits the form below (a same-origin POST
 * to /auth/signout); loading this page never changes a session.
 */

const ALL_DEVICES =
  "Signing out ends your Entrepreneuria session on every device you're signed in on, including this one.";

const COPY: Record<
  SessionRecoveryReason | "confirm",
  { title: string; body: string; tone: "status" | "error" | null }
> = {
  confirm: {
    title: "Sign out of all devices?",
    body: ALL_DEVICES,
    tone: null,
  },
  "session-conflict": {
    title: "More than one account is signed in",
    body: "This browser holds sessions for more than one Entrepreneuria account, so we haven't chosen one for you. Sign out, then sign in with the account you want.",
    tone: "status",
  },
  "session-unresolved": {
    title: "We couldn't safely restore your session",
    body: "This browser holds more than one saved sign-in, and we can't tell which one is current without risking the others, so none has been changed. Sign out, then sign in again.",
    tone: "status",
  },
  "auth-unavailable": {
    title: "We couldn't check your session",
    body: "The sign-in service didn't respond, so nothing about your session has been changed. Try again in a moment.",
    tone: "error",
  },
};

export default async function SignOutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const reasonParam = first(params.reason);
  const reason = isSessionRecoveryReason(reasonParam) ? reasonParam : null;
  const nextParam = first(params.next);

  const status = first(params.status);

  if (status === "incomplete" || status === "local") {
    return (
      <AuthShell
        kicker="Signed out"
        title={<>You&apos;re signed out on this browser.</>}
        lede="Your session cookies here have been cleared."
      >
        <div>
          <AuthHeading title="One more step" />
          <AuthAlert tone={status === "incomplete" ? "error" : "status"}>
            {status === "incomplete"
              ? "We couldn't confirm that your sessions on other devices were ended. To make sure they are, sign in again and then sign out — that ends every session for your account."
              : "This browser didn't hold a session that still worked, so we couldn't end your sessions on other devices from here. If you're signed in anywhere else, sign in again and then sign out to end them all."}
          </AuthAlert>
          <AuthMeta>
            <AuthLink href="/login">Sign in</AuthLink>
          </AuthMeta>
        </div>
      </AuthShell>
    );
  }

  const copy = COPY[reason ?? "confirm"];

  return (
    <AuthShell
      kicker={reason ? "Session check" : "Sign out"}
      title={<>{copy.title}</>}
      lede={reason ? copy.body : ALL_DEVICES}
    >
      <div>
        <AuthHeading title={copy.title} subtitle={reason ? ALL_DEVICES : undefined} />

        {copy.tone && reason ? (
          <AuthAlert tone={copy.tone}>{copy.body}</AuthAlert>
        ) : null}

        <form method="post" action="/auth/signout" className="mt-6">
          <AuthSubmit loadingLabel="Signing out">
            Sign out of all devices
          </AuthSubmit>
        </form>

        {reason === "auth-unavailable" && nextParam ? (
          <AuthMeta>
            <AuthLink href={getSafeRetryPath(nextParam)}>Try again</AuthLink>
          </AuthMeta>
        ) : null}
      </div>
    </AuthShell>
  );
}

import { AuthShell } from "@/components/auth/AuthShell";
import { getOAuthErrorMessage } from "@/lib/auth/oauth";
import { getSafeAuthRedirect } from "@/lib/auth/trusted-redirect";

import LoginPageClient from "./LoginPageClient";

/**
 * Query params are read HERE, on the server, rather than with
 * useSearchParams in the form.
 *
 * That is not a preference. `useSearchParams` forces a Suspense
 * boundary, and a Suspense boundary nested inside this server
 * component's children never resolved on the client: the fallback
 * stayed in the DOM, the form never hydrated, next/script never
 * injected Turnstile, and the page was unusable in both dev and
 * production. /forgot-password and /reset-password, which have no
 * boundary, hydrated correctly throughout — that contrast is what
 * identified the cause.
 *
 * Reading them here also moves redirect validation server-side, so the
 * client is handed a destination that has already been through
 * getSafeAuthRedirect rather than being trusted to validate it.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const statusMessage =
    first(params["check-email"]) === "1"
      ? "Your account was created. Check your email to verify your address before logging in."
      : first(params.reset) === "success"
        ? "Your password has been updated successfully. You can log in now."
        : null;

  return (
    <AuthShell
      kicker="Return"
      title={
        <>
          The center is still <em className="text-white/90">yours</em>.
        </>
      }
      lede="Sign in to Entrepreneuria and pick up exactly where the work left off."
    >
      <LoginPageClient
        nextPath={getSafeAuthRedirect(first(params.next) ?? null)}
        statusMessage={statusMessage}
        callbackError={getOAuthErrorMessage(first(params.auth_error) ?? null)}
      />
    </AuthShell>
  );
}

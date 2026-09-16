"use client";

import { FormEvent, useRef, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import TurnstileWidget, {
  type TurnstileWidgetHandle,
} from "@/components/auth/TurnstileWidget";
import {
  AuthAlert,
  AuthField,
  AuthHeading,
  AuthLink,
  AuthMeta,
  AuthSubmit,
  AuthVerification,
} from "@/components/auth/fields";

/**
 * Password-reset request. The Supabase call, the captcha token and the
 * /reset-password redirect target are unchanged.
 *
 * The one substitution: this page rendered `react-turnstile` directly
 * while the rest of the flow used the shared TurnstileWidget. Same
 * Cloudflare sitekey, same token, same server-side verification — but
 * now the same loading, error and reset behaviour as every other auth
 * screen, which is what makes the four pages one design system.
 */
export default function ForgotPasswordClient() {
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);

  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!turnstileToken) {
      setError("Please verify that you are human.");
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
        captchaToken: turnstileToken,
      });

      turnstileRef.current?.reset();
      setTurnstileToken("");

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setSuccess(
        "Password reset email sent. Check your inbox and click the link to set a new password.",
      );
      setLoading(false);
    } catch (err) {
      console.error("[FORGOT_PASSWORD_PAGE_ERROR]", err);
      setError(
        "Unable to send reset email right now. Please try again in a moment.",
      );
      turnstileRef.current?.reset();
      setTurnstileToken("");
      setLoading(false);
    }
  }

  return (
    <div>
      <AuthHeading
        title="Reset your password"
        subtitle="Enter the email on your account and we'll send you a reset link."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <AuthField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          aria-invalid={error ? true : undefined}
          required
        />

        <AuthVerification verified={Boolean(turnstileToken)}>
          <TurnstileWidget
            ref={turnstileRef}
            onVerify={(token) => {
              setTurnstileToken(token);
              setError(null);
            }}
            onExpire={() => setTurnstileToken("")}
            onError={() => setTurnstileToken("")}
          />
        </AuthVerification>

        {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
        {success ? <AuthAlert tone="success">{success}</AuthAlert> : null}

        <AuthSubmit
          loading={loading}
          loadingLabel="Sending link"
          disabled={!turnstileToken}
        >
          Send reset link
        </AuthSubmit>
      </form>

      <AuthMeta>
        Remembered it? <AuthLink href="/login">Back to sign in</AuthLink>
      </AuthMeta>
    </div>
  );
}

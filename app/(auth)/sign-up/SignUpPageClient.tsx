"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { OAUTH_PROVIDERS } from "@/lib/auth/oauth";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth/trusted-redirect";
import { useOAuthSignIn } from "@/hooks/use-oauth-sign-in";
import TurnstileWidget, {
  type TurnstileWidgetHandle,
} from "@/components/auth/TurnstileWidget";
import {
  AuthAlert,
  AuthDivider,
  AuthField,
  AuthHeading,
  AuthLink,
  AuthMeta,
  AuthSubmit,
  AuthVerification,
  OAuthButton,
  OAuthProviderGroup,
} from "@/components/auth/fields";

/**
 * Sign-up form island. Authentication logic is unchanged: Supabase
 * signUp with a Turnstile captcha token, provider OAuth through the
 * shared /auth/callback route, the same password-confirmation guard,
 * and the same hand-off to /login?check-email=1 so the verification
 * notice is shown there.
 */
export default function SignUpPageClient() {
  const router = useRouter();
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* Surfaced as soon as both fields have content, rather than waiting
     for a rejected submit. The submit guard below is unchanged. */
  const mismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  const handleOAuthError = useCallback((message: string) => {
    setOauthError(message);
  }, []);

  /* A new account lands inside the product, not back on the anonymous
     marketing homepage it just converted from. `/dashboard` is the
     canonical authenticated entry (it is what the proxy protects, and
     it forwards to the command center); there is no onboarding route to
     defer to — `/onboarding` currently 404s. */
  const { pending: oauthPending, signIn: signInWithProvider } = useOAuthSignIn({
    nextPath: DEFAULT_AUTHENTICATED_PATH,
    onError: handleOAuthError,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!turnstileToken) {
      setError("Please verify that you are human.");
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          captchaToken: turnstileToken,
        },
      });

      turnstileRef.current?.reset();
      setTurnstileToken("");

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      /* Supabase returns a session here only when the project has email
         confirmation switched off; when it is required, `session` is
         null and the account stays inert until the emailed link is
         followed. Branching on the actual response keeps both project
         configurations correct — and keeps an already-authenticated new
         user from being told to go and check their email. */
      if (data.session) {
        router.replace(DEFAULT_AUTHENTICATED_PATH);
      } else {
        router.push("/login?check-email=1");
      }

      router.refresh();
    } catch (err) {
      console.error("[SIGN_UP_PAGE_ERROR]", err);
      setError(
        "Sign up is temporarily unavailable. Please try again in a moment.",
      );
      turnstileRef.current?.reset();
      setTurnstileToken("");
      setLoading(false);
    }
  }

  const busy = loading || Boolean(oauthPending);

  return (
    <div>
      <AuthHeading title="Create your account" />

      {oauthError ? (
        <div className="mb-6">
          <AuthAlert tone="error">{oauthError}</AuthAlert>
        </div>
      ) : null}

      <OAuthProviderGroup>
        {OAUTH_PROVIDERS.map((provider) => (
          <OAuthButton
            key={provider.id}
            provider={provider}
            onClick={() => {
              setOauthError(null);
              void signInWithProvider(provider.id);
            }}
            loading={oauthPending === provider.id}
            disabled={loading || Boolean(oauthPending)}
          />
        ))}
      </OAuthProviderGroup>

      <AuthDivider />

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
          disabled={busy}
          required
        />

        <AuthField
          label="Password"
          name="new-password"
          autoComplete="new-password"
          placeholder="Choose a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          reveal
          required
        />

        <AuthField
          label="Confirm password"
          name="confirm-password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={busy}
          aria-invalid={mismatch || undefined}
          hint={mismatch ? "Both passwords need to match." : undefined}
          reveal
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

        <AuthSubmit
          loading={loading}
          loadingLabel="Creating account"
          disabled={Boolean(oauthPending) || !turnstileToken}
        >
          Create account
        </AuthSubmit>
      </form>

      <AuthMeta>
        Already have an account? <AuthLink href="/login">Sign in</AuthLink>
      </AuthMeta>
    </div>
  );
}

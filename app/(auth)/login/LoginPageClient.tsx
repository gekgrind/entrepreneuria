"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getOAuthErrorMessage, OAUTH_PROVIDERS } from "@/lib/auth/oauth";
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
 * Login form island. The authentication logic is unchanged from the
 * previous implementation: Supabase password sign-in with a Turnstile
 * captcha token, provider OAuth through the shared /auth/callback
 * route, and the same absolute/relative redirect split on success.
 */
export default function LoginPageClient({
  nextPath,
  statusMessage,
  callbackError,
}: {
  /** Already validated server-side by getSafeAuthRedirect. */
  nextPath: string;
  statusMessage: string | null;
  callbackError: string | null;
}) {
  const router = useRouter();
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* Provider failures are surfaced beside the provider buttons rather
     than at the foot of the form, where the visitor is not looking. */
  const handleOAuthError = useCallback((message: string) => {
    setOauthError(message);
  }, []);

  const { pending: oauthPending, signIn: signInWithProvider } = useOAuthSignIn({
    nextPath,
    onError: handleOAuthError,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!turnstileToken) {
      setError("Please verify that you are a human.");
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
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

      if (nextPath.startsWith("https://")) {
        window.location.replace(nextPath);
      } else {
        router.replace(nextPath);
        router.refresh();
      }
    } catch (err) {
      console.error("[LOGIN_PAGE_ERROR]", err);
      setError(
        "Login is temporarily unavailable. Please try again in a moment.",
      );
      turnstileRef.current?.reset();
      setTurnstileToken("");
      setLoading(false);
    }
  }

  const busy = loading || Boolean(oauthPending);
  /* A failure starting the flow, or one handed back by the callback. */
  const providerAlert = oauthError ?? callbackError;

  return (
    <div>
      <AuthHeading title="Sign in" />

      {statusMessage ? (
        <div className="mb-6">
          <AuthAlert tone="status">{statusMessage}</AuthAlert>
        </div>
      ) : null}

      {providerAlert ? (
        <div className="mb-6">
          <AuthAlert tone="error">{providerAlert}</AuthAlert>
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
          aria-invalid={error ? true : undefined}
          required
        />

        <AuthField
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          reveal
          required
          action={
            <AuthLink href="/forgot-password">
              <span className="type-label">Forgot?</span>
            </AuthLink>
          }
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
          loadingLabel="Signing in"
          disabled={Boolean(oauthPending) || !turnstileToken}
        >
          Sign in
        </AuthSubmit>
      </form>

      <AuthMeta>
        New to Entrepreneuria?{" "}
        <AuthLink href="/sign-up">Create an account</AuthLink>
      </AuthMeta>
    </div>
  );
}

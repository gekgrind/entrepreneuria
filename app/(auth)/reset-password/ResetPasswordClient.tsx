"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  AuthAlert,
  AuthField,
  AuthHeading,
  AuthLink,
  AuthMeta,
  AuthSubmit,
} from "@/components/auth/fields";

/**
 * New-password entry. Recovery-session detection, the 8-character
 * minimum, the mismatch guard, updateUser and the delayed hand-off to
 * /login?reset=success are all unchanged.
 */
export default function ResetPasswordClient() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session) {
        setRecoveryReady(true);
      }

      setCheckingSession(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === "PASSWORD_RECOVERY" || session) {
          setRecoveryReady(true);
          setCheckingSession(false);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setSuccess("Your password has been updated. Redirecting to log in...");
      setLoading(false);

      setTimeout(() => {
        router.push("/login?reset=success");
        router.refresh();
      }, 1200);
    } catch (err) {
      console.error("[RESET_PASSWORD_PAGE_ERROR]", err);
      setError("Unable to update your password right now. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <AuthHeading
        title="Choose a new password"
        subtitle="Set a new password for your Entrepreneuria account."
      />

      {checkingSession ? (
        <AuthAlert tone="status">Checking your recovery link…</AuthAlert>
      ) : !recoveryReady ? (
        <div className="space-y-5">
          <AuthAlert tone="error">
            This password reset link is invalid or has expired. Request a new
            one to continue.
          </AuthAlert>
          <AuthLink href="/forgot-password">Request a new reset link</AuthLink>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <AuthField
            label="New password"
            name="new-password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            minLength={8}
            reveal
            required
          />

          <AuthField
            label="Confirm new password"
            name="confirm-password"
            autoComplete="new-password"
            placeholder="Repeat your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            aria-invalid={mismatch || undefined}
            hint={mismatch ? "Both passwords need to match." : undefined}
            reveal
            required
          />

          {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
          {success ? <AuthAlert tone="success">{success}</AuthAlert> : null}

          <AuthSubmit loading={loading} loadingLabel="Updating password">
            Update password
          </AuthSubmit>
        </form>
      )}

      <AuthMeta>
        Back to <AuthLink href="/login">sign in</AuthLink>
      </AuthMeta>
    </div>
  );
}

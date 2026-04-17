"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      }
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
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#061426_0%,#0a1830_35%,#10203f_62%,#1a2744_78%,#d27a2c_140%)] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,212,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(210,122,44,0.12),transparent_30%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-7xl overflow-hidden rounded-[28px] shadow-[0_24px_80px_rgba(0,0,0,0.35)] lg:min-h-[720px] lg:grid-cols-2">
          <div className="relative hidden lg:block">
            <Image
              src="/images/auth-founder-desk.jpg"
              alt="Founder workspace"
              fill
              priority
              className="object-cover object-center"
            />

            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,10,20,0.12)_0%,rgba(3,10,20,0.34)_35%,rgba(3,10,20,0.74)_100%)]" />

            <div className="absolute inset-0 flex items-end p-10 xl:p-12">
              <div className="max-w-md">
                <h1 className="whitespace-pre-line text-5xl font-semibold leading-[0.96] tracking-[-0.04em] text-white xl:text-6xl">
                  {"New.\nPassword.\nEnergy."}
                </h1>

                <p className="mt-6 max-w-sm text-base leading-7 text-white/85 xl:text-lg">
                  Choose a new password and get right back into Entrepreneuria.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center bg-[#0A1A2F] px-6 py-10 sm:px-8 lg:px-10 xl:px-12">
            <div className="w-full max-w-[460px]">
              <section className="rounded-2xl border border-white/12 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-sm sm:p-7">
                <div className="space-y-2">
                  <p className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-white/70 lg:hidden">
                    Entrepreneuria Access
                  </p>

                  <h1 className="text-2xl font-semibold">Reset password</h1>
                  <p className="text-sm text-white/70">
                    Set a new password for your account.
                  </p>
                </div>

                {checkingSession ? (
                  <div className="mt-6">
                    <p className="text-sm text-white/70">Checking your recovery link...</p>
                  </div>
                ) : !recoveryReady ? (
                  <div className="mt-6 space-y-4">
                    <p className="text-sm text-red-400">
                      This password reset link is invalid or has expired. Request a new one to continue.
                    </p>
                    <Link
                      href="/forgot-password"
                      className="inline-flex rounded-lg bg-[#00D4FF] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
                    >
                      Request new reset link
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <input
                      type="password"
                      placeholder="New password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-sm text-white placeholder-white/45 outline-none transition focus:border-[#00D4FF]"
                      required
                    />

                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-sm text-white placeholder-white/45 outline-none transition focus:border-[#00D4FF]"
                      required
                    />

                    {error ? <p className="text-sm text-red-400">{error}</p> : null}
                    {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg bg-[#00D4FF] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Updating..." : "Update password"}
                    </button>
                  </form>
                )}

                <p className="mt-5 text-sm text-white/70">
                  Back to{" "}
                  <Link href="/login" className="text-[#00D4FF] underline">
                    Log in
                  </Link>
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
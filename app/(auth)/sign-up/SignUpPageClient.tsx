"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import TurnstileWidget, {
  type TurnstileWidgetHandle,
} from "@/components/auth/TurnstileWidget";

export default function SignUpPage() {
  const router = useRouter();
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignUp() {
    setError(null);
    setGoogleLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/`
          : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        setError(error.message);
        setGoogleLoading(false);
      }
    } catch (err) {
      console.error("[GOOGLE_SIGNUP_ERROR]", err);
      setError(
        "Google sign up is temporarily unavailable. Please try again in a moment.",
      );
      setGoogleLoading(false);
    }
  }

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

      const { error } = await supabase.auth.signUp({
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

      router.push("/login?check-email=1");
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#061426_0%,#0a1830_35%,#10203f_62%,#1a2744_78%,#d27a2c_140%)] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,212,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(210,122,44,0.12),transparent_30%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.35)] lg:h-[560px] lg:grid-cols-2">
          <div className="relative hidden lg:block">
            <Image
              src="/images/auth-founder-desk.jpg"
              alt="Founder workspace"
              fill
              priority
              className="object-cover object-center"
            />

            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,10,20,0.1)_0%,rgba(3,10,20,0.35)_45%,rgba(3,10,20,0.82)_100%)]" />

            <div className="absolute inset-0 flex items-end p-8">
              <div className="max-w-sm">
                <h1 className="whitespace-pre-line text-4xl font-semibold leading-[0.96] tracking-[-0.04em] text-white xl:text-5xl">
                  {"Build.\nGrow.\nLaunch."}
                </h1>

                <p className="mt-5 max-w-xs text-sm leading-6 text-white/85 xl:text-base">
                  Your business doesn&apos;t need permission.
                  <br />
                  Just execution.
                </p>
              </div>
            </div>
          </div>

          <div className="flex h-full items-start justify-center bg-[#0A1A2F] px-6 py-10">
            <div className="w-full max-w-[340px] bg-transparent">
              <div className="flex justify-center">
                <Image
                  src="/entrepreneuria-logo.png"
                  alt="Entrepreneuria"
                  width={64}
                  height={64}
                  className="h-14 w-14 object-contain"
                />
              </div>

              <div className="mt-6 space-y-3 bg-transparent">
                <button
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={googleLoading || loading}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#0A1A2F] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {googleLoading ? "Redirecting..." : "Continue with Google"}
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/20" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                    OR
                  </span>
                  <div className="h-px flex-1 bg-white/20" />
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-5 space-y-3 bg-transparent"
              >
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#16263A] px-3 py-2.5 text-sm text-white placeholder-white/60 outline-none transition focus:border-[#00D4FF]"
                  required
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#16263A] px-3 py-2.5 text-sm text-white placeholder-white/60 outline-none transition focus:border-[#00D4FF]"
                  required
                />

                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#16263A] px-3 py-2.5 text-sm text-white placeholder-white/60 outline-none transition focus:border-[#00D4FF]"
                  required
                />

                <div className="overflow-x-auto bg-transparent">
                  <TurnstileWidget
                    ref={turnstileRef}
                    onVerify={(token) => {
                      setTurnstileToken(token);
                      setError(null);
                    }}
                    onExpire={() => setTurnstileToken("")}
                    onError={() => setTurnstileToken("")}
                  />
                </div>

                {error ? (
                  <p className="rounded-lg border border-red-400/30 bg-red-950/50 px-3 py-2 text-sm text-red-100">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading || googleLoading || !turnstileToken}
                  className="w-full rounded-lg bg-[#00D4FF] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creating..." : "Create account"}
                </button>
              </form>

              <p className="mt-4 text-sm text-white/70">
                Already have an account?{" "}
                <Link href="/login" className="text-[#00D4FF] underline">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

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
        typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

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
      setError("Google sign up is temporarily unavailable. Please try again in a moment.");
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
      setError("Sign up is temporarily unavailable. Please try again in a moment.");
      turnstileRef.current?.reset();
      setTurnstileToken("");
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
                  {"Build.\nGrow.\nLaunch."}
                </h1>

                <p className="mt-6 max-w-sm text-base leading-7 text-white/85 xl:text-lg">
                  Your business doesn&apos;t need permission.
                  <br />
                  Just execution.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center bg-[#0A1A2F] px-6 py-10 sm:px-8 lg:px-10 xl:px-12">
            <div className="w-full max-w-[360px]">
              <section className="w-full">
                <div className="flex justify-center">
                  <Image
                    src="/entrepreneuria-logo.png"
                    alt="Entrepreneuria"
                    width={72}
                    height={72}
                    className="h-16 w-16 object-contain"
                  />
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={handleGoogleSignUp}
                    disabled={googleLoading || loading}
                    className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#0A1A2F] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                    >
                      <path
                        fill="#EA4335"
                        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.6 12 2.6 6.9 2.6 2.8 6.7 2.8 11.8S6.9 21 12 21c6.9 0 9.1-4.8 9.1-7.3 0-.5 0-.9-.1-1.3H12Z"
                      />
                      <path
                        fill="#34A853"
                        d="M3.8 7.2l3.2 2.3c.9-1.8 2.7-3.1 5-3.1 1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.6 12 2.6 8.4 2.6 5.2 4.7 3.8 7.2Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M12 21c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.6-1.9 1.1-3.4 1.1-3.9 0-5.2-2.6-5.5-3.8l-3.2 2.5C4.7 18.7 8 21 12 21Z"
                      />
                      <path
                        fill="#4285F4"
                        d="M21.1 13.7c0-.5 0-.9-.1-1.3H12v3.9h5.5c-.2 1.1-1 2.1-2.1 2.8l2.9 2.4c1.7-1.6 2.8-4 2.8-7.8Z"
                      />
                    </svg>
                    {googleLoading ? "Redirecting..." : "Continue with Google"}
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs uppercase tracking-[0.18em] text-white/45">
                      or
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-white px-3 py-2.5 text-sm text-[#0A1A2F] placeholder-[#0A1A2F]/45 outline-none transition focus:border-[#00D4FF]"
                    required
                  />

                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-white px-3 py-2.5 text-sm text-[#0A1A2F] placeholder-[#0A1A2F]/45 outline-none transition focus:border-[#00D4FF]"
                    required
                  />

                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-white px-3 py-2.5 text-sm text-[#0A1A2F] placeholder-[#0A1A2F]/45 outline-none transition focus:border-[#00D4FF]"
                    required
                  />

                  <div className="overflow-x-auto">
                    <TurnstileWidget
                      ref={turnstileRef}
                      onVerify={(token) => setTurnstileToken(token)}
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

                <p className="mt-5 text-sm text-white/70">
                  Already have an account?{" "}
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

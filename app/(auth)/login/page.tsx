import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";

import LoginPageClient from "./LoginPageClient";

/**
 * The shell is server-rendered, so the constellation environment and the
 * page's heading are in the first HTML payload. Only the form hydrates —
 * and the Suspense boundary (required by useSearchParams) now wraps the
 * form alone rather than the whole page, so nothing decorative is
 * gated on client JS.
 */
export default function LoginPage() {
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
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginPageClient />
      </Suspense>
    </AuthShell>
  );
}

/** Reserves the form's exact height so the lane never shifts. */
function LoginFormSkeleton() {
  return (
    <div aria-hidden="true" className="min-h-[520px] animate-pulse">
      <div className="mb-8 h-9 w-40 rounded-lg bg-white/[0.06]" />
      <div className="grid gap-3">
        <div className="h-[52px] w-full rounded-full bg-white/[0.06]" />
        <div className="h-[52px] w-full rounded-full bg-white/[0.06]" />
      </div>
      <div className="my-6 h-px w-full bg-white/10" />
      <div className="space-y-5">
        <div className="h-[76px] w-full rounded-xl bg-white/[0.04]" />
        <div className="h-[76px] w-full rounded-xl bg-white/[0.04]" />
        <div className="h-[52px] w-full rounded-full bg-white/[0.06]" />
      </div>
    </div>
  );
}

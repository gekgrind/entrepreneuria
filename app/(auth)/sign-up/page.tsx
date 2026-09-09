import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";

import SignUpPageClient from "./SignUpPageClient";

/**
 * The headline is deliberately the homepage journey's closing line. The
 * marketing story ends on "You've carried this far enough alone" with
 * the founder's light at the center of the constellation; sign-up opens
 * on the same sentence, so the seam between the two reads as one
 * continuous thought rather than a hand-off to a different product.
 */
export default function SignUpPage() {
  return (
    <AuthShell
      kicker="Begin"
      title={
        <>
          You&apos;ve carried this far enough{" "}
          <em className="text-white/90">alone</em>.
        </>
      }
      lede="One account opens the whole ecosystem — starting with Prospra, and lighting up as the rest ships."
    >
      <Suspense fallback={<SignUpFormSkeleton />}>
        <SignUpPageClient />
      </Suspense>
    </AuthShell>
  );
}

/** Reserves the form's approximate height so the lane never shifts. */
function SignUpFormSkeleton() {
  return (
    <div aria-hidden="true" className="min-h-[600px] animate-pulse">
      <div className="mb-8 h-9 w-56 rounded-lg bg-white/[0.06]" />
      <div className="grid gap-3">
        <div className="h-[52px] w-full rounded-full bg-white/[0.06]" />
        <div className="h-[52px] w-full rounded-full bg-white/[0.06]" />
      </div>
      <div className="my-6 h-px w-full bg-white/10" />
      <div className="space-y-5">
        <div className="h-[76px] w-full rounded-xl bg-white/[0.04]" />
        <div className="h-[76px] w-full rounded-xl bg-white/[0.04]" />
        <div className="h-[76px] w-full rounded-xl bg-white/[0.04]" />
        <div className="h-[52px] w-full rounded-full bg-white/[0.06]" />
      </div>
    </div>
  );
}

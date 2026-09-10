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
      <SignUpPageClient />
    </AuthShell>
  );
}

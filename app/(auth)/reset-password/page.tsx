import { AuthShell } from "@/components/auth/AuthShell";

import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      kicker="Reset"
      title={
        <>
          One new password. Then back to{" "}
          <em className="text-white/90">building</em>.
        </>
      }
      lede="Choose something you'll remember. You'll be signed straight back into the ecosystem."
    >
      <ResetPasswordClient />
    </AuthShell>
  );
}

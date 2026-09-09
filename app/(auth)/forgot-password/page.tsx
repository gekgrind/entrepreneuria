import { AuthShell } from "@/components/auth/AuthShell";

import ForgotPasswordClient from "./ForgotPasswordClient";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      kicker="Recover"
      title={
        <>
          Locked out is a <em className="text-white/90">temporary</em> state.
        </>
      }
      lede="We'll send a secure link to your inbox so you can set a new password and get back to building."
    >
      <ForgotPasswordClient />
    </AuthShell>
  );
}

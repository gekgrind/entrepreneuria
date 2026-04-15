import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/supabase/auth-server";
import { UserAvatar } from "@/components/account/UserAvatar";
import { getResolvedUserIdentity } from "@/lib/account/get-resolved-user-identity";

export default async function AccountPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const identity = await getResolvedUserIdentity();

  const fullName =
    typeof identity?.fullName === "string" ? identity.fullName : null;

  const email =
    typeof identity?.email === "string"
      ? identity.email
      : typeof user.email === "string"
      ? user.email
      : null;

  const avatarUrl =
    typeof identity?.avatarUrl === "string" ? identity.avatarUrl : null;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Account</h1>
        <p className="text-sm text-white/70">
          Read-only identity summary for your platform profile.
        </p>
      </header>

      <div className="flex items-center gap-4 rounded-2xl border border-[#00D4FF]/20 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-sm">
        <UserAvatar
          fullName={fullName}
          email={email}
          avatarUrl={avatarUrl}
          className="size-12 border border-[#00D4FF]/25"
        />
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-white">
            {fullName ?? "No full name set"}
          </p>
          <p className="truncate text-sm text-white/65">
            {email ?? "No email available"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/settings"
          className="rounded-xl border border-[#00D4FF]/40 px-4 py-2.5 text-sm font-medium text-[#00D4FF] transition hover:bg-[#00D4FF]/10"
        >
          Go to settings
        </Link>
        <Link
          href="/account/avatar"
          className="rounded-xl border border-[#00D4FF]/40 px-4 py-2.5 text-sm font-medium text-[#00D4FF] transition hover:bg-[#00D4FF]/10"
        >
          Change avatar
        </Link>
      </div>
    </section>
  );
}
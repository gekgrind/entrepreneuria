import { UserAccountMenu } from "@/components/account/UserAccountMenu";
import type { ResolvedUserIdentity } from "@/lib/account/get-resolved-user-identity";

type SidebarUserIdentityProps = {
  identity: ResolvedUserIdentity;
};

export function SidebarUserIdentity({ identity }: SidebarUserIdentityProps) {
  return (
    <div className="rounded-2xl border border-[#00D4FF]/15 bg-white/5 p-3 backdrop-blur-sm">
      <UserAccountMenu
        fullName={identity.fullName}
        email={identity.email}
        avatarUrl={identity.avatarUrl}
      />
    </div>
  );
}
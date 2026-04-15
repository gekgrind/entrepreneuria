// components/account/HeaderUserMenu.tsx
"use client";

import { UserAccountMenu } from "@/components/account/UserAccountMenu";

type HeaderUserMenuProps = {
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
};

export function HeaderUserMenu({
  fullName,
  email,
  avatarUrl,
}: HeaderUserMenuProps) {
  return (
    <div className="shrink-0">
      <UserAccountMenu
        fullName={fullName}
        email={email}
        avatarUrl={avatarUrl}
      />
    </div>
  );
}
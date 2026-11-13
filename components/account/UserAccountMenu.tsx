"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import { ChevronUp, LogOut, Settings, UserCircle2 } from "lucide-react";

import { UserAvatar } from "@/components/account/UserAvatar";
import {
  SIGN_OUT_DESCRIPTION_IDS,
  SignOutExplanation,
} from "@/components/auth/SignOutExplanation";
import { useUser } from "@/components/auth/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type UserAccountMenuProps = {
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
};

/* A forwarded ref and spread props so that DropdownMenuItem asChild can
   hand the menu item's props (including aria-describedby) to the form. */
export const AccountSignOutForm = forwardRef<
  HTMLFormElement,
  ComponentPropsWithoutRef<"form">
>(function AccountSignOutForm(props, ref) {
  return (
    <form
      {...props}
      ref={ref}
      action="/auth/signout"
      method="post"
      className={props.className ? `${props.className} w-full` : "w-full"}
    >
      <button
        type="submit"
        aria-describedby={SIGN_OUT_DESCRIPTION_IDS.accountMenu}
        className="flex w-full items-center gap-2 text-left"
      >
        <LogOut />
        Sign out of all devices
      </button>
      <SignOutExplanation
        id={SIGN_OUT_DESCRIPTION_IDS.accountMenu}
        className="mt-1 text-xs font-normal opacity-70"
      />
    </form>
  );
});

export function UserAccountMenu({ fullName, email, avatarUrl }: UserAccountMenuProps) {
  const { user } = useUser();
  const resolvedFullName = fullName?.trim() || user?.fullName || null;
  const resolvedEmail = email.trim() || user?.email || "";
  const resolvedAvatarUrl = avatarUrl || user?.avatarUrl || null;
  const label = resolvedFullName || "Account";
  const secondaryLabel = resolvedEmail || "No email";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-between px-2 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar fullName={resolvedFullName} email={resolvedEmail} avatarUrl={resolvedAvatarUrl} className="size-8" />
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">{label}</span>
              <span className="block truncate text-xs opacity-70">{secondaryLabel}</span>
            </span>
          </div>
          <ChevronUp className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="min-w-0">
          <div className="truncate text-sm">{label}</div>
          <div className="truncate text-xs font-normal opacity-70">{secondaryLabel}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserCircle2 />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild aria-describedby={SIGN_OUT_DESCRIPTION_IDS.accountMenu}>
          <AccountSignOutForm />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

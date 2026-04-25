"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@/components/auth/AuthProvider";
import { UserAvatar } from "@/components/auth/user-avatar";

export default function UserMenu() {
  const { user, loading } = useUser();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleLogout() {
    await fetch("/auth/signout", {
      method: "POST",
      credentials: "same-origin",
    });
    setOpen(false);
    window.location.assign("/login");
  }

  if (loading) return null;

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="rounded-full px-4 py-2 text-sm font-medium text-white/95 transition hover:bg-white/10"
        >
          Log in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-full bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-[var(--brand-navy)] transition hover:brightness-110"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const avatarUrl = user.avatarUrl;
  const displayName = user.fullName;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full transition hover:brightness-110"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open user menu"
      >
        <UserAvatar
          avatarUrl={avatarUrl}
          displayName={displayName}
          email={user.email}
          className="h-10 w-10 border border-white/15"
        />
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/15 bg-[var(--brand-navy)]/95 p-2 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 px-3 py-3">
            <p className="truncate text-sm font-medium text-white">
              {displayName ?? user.email ?? "Signed in"}
            </p>
            {displayName && user.email ? (
              <p className="truncate text-xs text-white/60">{user.email}</p>
            ) : null}
          </div>

          <div className="mt-1 space-y-1">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-white/90 transition hover:bg-white/10"
            >
              Account
            </Link>

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-white/90 transition hover:bg-white/10"
            >
              Settings
            </Link>

            <Link
              href="/account/avatar"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-white/90 transition hover:bg-white/10"
            >
              Change avatar
            </Link>
          </div>

          <div className="mt-2 border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/90 transition hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

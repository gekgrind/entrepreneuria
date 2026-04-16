"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function UserMenu() {
  const supabase = getSupabaseBrowserClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setLoading(false);
    }

    loadUser();

    const {
  data: { subscription },
} = supabase.auth.onAuthStateChange((event: any, session: any) => {
  setUser(session?.user ?? null);
});

    return () => subscription.unsubscribe();
  }, [supabase]);

  if (loading) return null;

  // NOT LOGGED IN
  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="text-sm text-white/70 hover:text-white transition"
        >
          Log in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-lg bg-[#00D4FF] px-3 py-1.5 text-sm font-semibold text-black hover:brightness-110 transition"
        >
          Sign up
        </Link>
      </div>
    );
  }

  // LOGGED IN
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00D4FF] text-black font-semibold"
      >
        {user.email?.[0]?.toUpperCase() || "U"}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#0A1A2F] shadow-xl">
          <Link
            href="/dashboard"
            className="block px-4 py-2 text-sm text-white/80 hover:bg-white/5"
          >
            Dashboard
          </Link>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
            }}
            className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/5"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
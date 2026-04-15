import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getResolvedUserIdentity } from "@/lib/account/get-resolved-user-identity";
import {
  getAuthenticatedUser,
  getSupabaseRestBaseUrl,
  getSupabaseRestHeaders,
} from "@/lib/supabase/auth-server";

async function saveFullName(formData: FormData) {
  "use server";

  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const headers = await getSupabaseRestHeaders();

  if (!headers) {
    redirect("/settings?status=error");
  }

  const fullName = String(formData.get("fullName") ?? "").trim();

  const response = await fetch(`${getSupabaseRestBaseUrl()}/profiles?on_conflict=id`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([
      {
        id: user.id,
        full_name: fullName.length > 0 ? fullName : null,
      },
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    redirect("/settings?status=error");
  }

  revalidatePath("/settings");
  revalidatePath("/account");
  redirect("/settings?status=saved");
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const identity = await getResolvedUserIdentity();

  if (!identity) {
    redirect("/login");
  }

  const params = await searchParams;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-white/70">
          Manage your core platform profile details.
        </p>
      </header>

      <div className="rounded-2xl border border-[#00D4FF]/20 bg-white/5 p-5 backdrop-blur-sm">
        <form action={saveFullName} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="fullName" className="text-sm font-medium text-white">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              defaultValue={identity.fullName ?? ""}
              className="w-full rounded-xl border border-white/15 bg-[#0a1f35] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#00D4FF]"
              maxLength={120}
            />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-white">Email</p>
            <p className="text-sm text-white/65">
              {identity.email || "No email available"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-white">Avatar</p>
            <p className="text-sm text-white/65">
              {identity.avatarUrl ? "Configured" : "Using fallback initial"}
            </p>
            <Link
              href="/account/avatar"
              className="text-sm font-medium text-[#00D4FF] underline underline-offset-4"
            >
              Go to avatar settings
            </Link>
          </div>

          <button
            type="submit"
            className="rounded-xl border border-[#00D4FF]/40 px-4 py-2.5 text-sm font-medium text-[#00D4FF] transition hover:bg-[#00D4FF]/10"
          >
            Save full name
          </button>
        </form>
      </div>

      {params.status === "saved" ? (
        <p className="text-sm text-[#00D4FF]" role="status">
          Full name saved.
        </p>
      ) : null}

      {params.status === "error" ? (
        <p className="text-sm text-red-300" role="status">
          Could not save full name right now. Your account remains unchanged.
        </p>
      ) : null}
    </section>
  );
}
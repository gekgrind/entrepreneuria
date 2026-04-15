import Link from "next/link";
import { redirect } from "next/navigation";
import Orb from "@/components/Orb";
import { SidebarUserIdentity } from "@/components/account/SidebarUserIdentity";
import { getResolvedUserIdentity } from "@/lib/account/get-resolved-user-identity";

const navItems = [
  { href: "/account", label: "Account" },
  { href: "/settings", label: "Settings" },
  { href: "/account/avatar", label: "Change avatar" },
];

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getResolvedUserIdentity();

  if (!identity) {
    redirect("/login");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061426] text-white">

      {/* 🌌 ORB BACKGROUND (STRONG VERSION) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 opacity-100 mix-blend-screen">
        <Orb backgroundColor="#00D4FF" />
      </div>

      {/* OPTIONAL: SECOND FAINT ORB FOR DEPTH */}
      <div className="pointer-events-none absolute left-[55%] top-[55%] z-0 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 opacity-40 mix-blend-screen">
        <Orb backgroundColor="#00D4FF" />
      </div>

      {/* 🧠 APP CONTENT */}
      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl grid-cols-1 md:grid-cols-[260px_1fr]">

        <aside className="flex flex-col border-r border-[#00D4FF]/20 bg-[#081a2f]/80 backdrop-blur-sm">
          <div className="border-b border-[#00D4FF]/15 px-6 py-5">
            <Link
              href="/account"
              className="text-sm font-semibold tracking-[0.18em] uppercase text-[#00D4FF]"
            >
              Platform account
            </Link>
          </div>

          <nav className="flex flex-col gap-2 px-4 py-5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-transparent px-4 py-3 text-sm font-medium text-white/80 transition hover:border-[#00D4FF]/25 hover:bg-[#0c2440] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto px-4 pb-4">
            <SidebarUserIdentity identity={identity} />
          </div>
        </aside>

        <main className="px-4 py-6 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>

      </div>
    </div>
  );
}
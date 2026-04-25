import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComponentType } from "react";
import {
  ArrowUpRight,
  Building2,
  CircleUserRound,
  Compass,
  Crown,
  Layers3,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";

import { getResolvedUserIdentity } from "@/lib/account/get-resolved-user-identity";

type EcosystemApp = {
  name: string;
  description: string;
  status: "Available" | "Beta" | "Coming Soon";
  href: string | null;
  icon: ComponentType<{ className?: string }>;
};

const prospraUrl =
  process.env.NEXT_PUBLIC_PROSPRA_APP_URL || "https://prospra.entrepreneuria.io";

const architectaUrl =
  process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL ||
  "https://architecta.entrepreneuria.io";

const directoriumUrl = process.env.NEXT_PUBLIC_DIRECTORIUM_APP_URL || null;

const apps: EcosystemApp[] = [
  {
    name: "Prospra",
    description: "AI entrepreneur mentor for strategic clarity and founder guidance.",
    status: "Available",
    href: prospraUrl,
    icon: Compass,
  },
  {
    name: "Architecta",
    description: "AI brand, campaign, and content studio for execution-ready growth.",
    status: "Beta",
    href: architectaUrl,
    icon: Layers3,
  },
  {
    name: "Directorium",
    description: "AI board of directors for structured debate and better decisions.",
    status: directoriumUrl ? "Beta" : "Coming Soon",
    href: directoriumUrl,
    icon: Building2,
  },
  {
    name: "Synceri",
    description: "AI life and admin assistant for the operating layer around your work.",
    status: "Coming Soon",
    href: null,
    icon: Sparkles,
  },
];

const statusStyles: Record<EcosystemApp["status"], string> = {
  Available: "border-[#00D4FF]/35 bg-[#00D4FF]/12 text-[#00D4FF]",
  Beta: "border-white/20 bg-white/10 text-white/80",
  "Coming Soon": "border-white/12 bg-white/5 text-white/50",
};

export default async function DashboardPage() {
  const identity = await getResolvedUserIdentity();

  if (!identity) {
    redirect("/login?next=/dashboard");
  }

  const displayName = identity.fullName?.trim() || identity.email || "Founder";

  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(135deg,#061426_0%,#0a1830_34%,#10203f_68%,#1a2744_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(0,212,255,0.22),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(210,122,44,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_36%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="no-accent-link text-sm font-semibold uppercase tracking-[0.24em] text-[#00D4FF]"
          >
            Entrepreneuria
          </Link>

          <nav aria-label="Account links" className="flex flex-wrap gap-2">
            <Link
              href="/account"
              className="no-accent-link inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition hover:border-[#00D4FF]/35 hover:bg-[#00D4FF]/10 hover:text-white"
            >
              <CircleUserRound className="size-4" />
              Profile
            </Link>
            <Link
              href="/settings"
              className="no-accent-link inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition hover:border-[#00D4FF]/35 hover:bg-[#00D4FF]/10 hover:text-white"
            >
              <Settings className="size-4" />
              Settings
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition hover:border-[#00D4FF]/35 hover:bg-[#00D4FF]/10 hover:text-white"
              >
                <LogOut className="size-4" />
                Logout
              </button>
            </form>
          </nav>
        </header>

        <section className="grid gap-6 py-8 lg:grid-cols-[1.35fr_0.65fr] lg:py-10">
          <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[#00D4FF]">
              Build. Launch. Grow.
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[0.95] tracking-normal text-white sm:text-5xl lg:text-6xl">
              Welcome back, {displayName}.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
              Your Entrepreneuria command center brings the suite together in one
              place so you can move from clarity to assets to execution.
            </p>
          </div>

          <aside className="rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/[0.07] p-6 shadow-[0_20px_70px_rgba(0,212,255,0.08)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 text-[#00D4FF]">
                <Crown className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Recommended Next Step
                </h2>
                <p className="text-sm text-white/55">Ecosystem guidance</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-white/72">
              Start with Prospra for strategic clarity, then move into Architecta
              to build your brand assets.
            </p>
          </aside>
        </section>

        <section aria-labelledby="app-launcher-heading" className="pb-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-white/45">
                Suite Launcher
              </p>
              <h2
                id="app-launcher-heading"
                className="mt-2 text-2xl font-semibold text-white sm:text-3xl"
              >
                Choose your operating mode.
              </h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {apps.map((app) => {
              const Icon = app.icon;

              return (
                <article
                  key={app.name}
                  className="flex min-h-[280px] flex-col rounded-2xl border border-white/12 bg-white/[0.065] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:border-[#00D4FF]/35 hover:bg-white/[0.09]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex size-11 items-center justify-center rounded-xl border border-[#00D4FF]/24 bg-[#00D4FF]/10 text-[#00D4FF]">
                      <Icon className="size-5" />
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[app.status]}`}
                    >
                      {app.status}
                    </span>
                  </div>

                  <div className="mt-5 flex-1">
                    <h3 className="text-xl font-semibold text-white">{app.name}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/68">
                      {app.description}
                    </p>
                  </div>

                  {app.href ? (
                    <a
                      href={app.href}
                      className="no-accent-link mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[#00D4FF] px-4 py-2.5 text-sm font-semibold text-[#03121e] transition hover:bg-[#35ddff] hover:text-[#03121e]"
                    >
                      Launch
                      <ArrowUpRight className="size-4" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="mt-6 inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/40"
                    >
                      Coming Soon
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

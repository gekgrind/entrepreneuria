import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  ChartNoAxesCombined,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { WaitlistForm } from "@/components/waitlist-form";

export const metadata: Metadata = {
  title: "Join the Waitlist | Entrepreneuria",
  description:
    "Get early access to Entrepreneuria and be first to hear when our founder-focused AI operating system opens up.",
};

const features = [
  {
    icon: BrainCircuit,
    title: "AI-guided decisions",
    description:
      "Reduce founder guesswork with structured prompts, strategic guidance, and fast next-step clarity.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Operational visibility",
    description:
      "Bring planning, metrics, and execution signals into one place instead of stitching tools together.",
  },
  {
    icon: Zap,
    title: "Faster execution",
    description:
      "Turn ideas into repeatable workflows so your business keeps moving when your attention gets split.",
  },
  {
    icon: ShieldCheck,
    title: "Founder-ready systems",
    description:
      "Build with cleaner processes, stronger consistency, and less manual overhead from the start.",
  },
];

export default function WaitlistPage() {
  return (
    <div className="-mt-[calc(var(--header-height)+20px)] overflow-hidden text-white">
      <section className="relative isolate border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_42%),linear-gradient(160deg,rgba(26,41,66,0.94),rgba(79,124,167,0.72)_45%,rgba(210,122,44,0.65))]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/20 to-transparent" />
        <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col justify-center px-6 py-24 sm:px-10 lg:px-12">
          <div
            data-reveal
            className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/90 backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
            Private beta waitlist
          </div>

          <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
            <div data-reveal className="max-w-3xl">
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-[0_0_50px_rgba(255,255,255,0.16)] backdrop-blur">
                  <Image
                    src="/entrepreneuria-logo.png"
                    alt="Entrepreneuria logo"
                    width={44}
                    height={44}
                    className="h-11 w-11 object-contain"
                    priority
                  />
                </div>
                <div>
                  <p className="text-sm font-heading font-medium uppercase tracking-[0.3em] text-white/70">
                    Entrepreneuria
                  </p>
                  <p className="text-sm text-white/80">
                    AI operating system for founders
                  </p>
                </div>
              </div>

              <h1 className="max-w-3xl text-balance text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                The operating system for ambitious founders.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78 sm:text-xl">
                Entrepreneuria combines AI-powered decision support, operational
                structure, and founder-friendly workflows in one clean interface
                built to help you move faster with less friction.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <a
                  href="#join-waitlist"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--brand-navy)] shadow-[0_18px_60px_rgba(255,255,255,0.2)] transition hover:-translate-y-0.5 hover:bg-white/90"
                >
                  Get early access
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#why-join"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/8 px-6 py-3 text-sm font-medium text-white/88 backdrop-blur transition hover:bg-white/14"
                >
                  See what&apos;s coming
                </a>
              </div>

              <div className="mt-10 flex flex-wrap gap-3 text-sm text-white/75">
                <span className="rounded-full border border-white/15 bg-black/10 px-3 py-1.5 backdrop-blur">
                  Founder-first product design
                </span>
                <span className="rounded-full border border-white/15 bg-black/10 px-3 py-1.5 backdrop-blur">
                  Limited early access spots
                </span>
                <span className="rounded-full border border-white/15 bg-black/10 px-3 py-1.5 backdrop-blur">
                  Launch updates without spam
                </span>
              </div>
            </div>

            <div data-reveal className="lg:justify-self-end">
              <div className="rounded-[28px] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08))] p-6 shadow-[0_24px_80px_rgba(10,16,30,0.4)] backdrop-blur-xl sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/60">
                      Why join now
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                      Be first in line when Entrepreneuria opens up.
                    </h2>
                  </div>
                  <Bot className="mt-1 h-8 w-8 text-[var(--brand-accent)]" />
                </div>
                <div className="mt-8 space-y-5 text-sm leading-7 text-white/76">
                  <p>
                    Join the list for early-access invitations, launch notices,
                    and first look updates as founder tools roll out.
                  </p>
                  <p>
                    You&apos;ll hear from us when your spot is ready, not every
                    week with filler newsletters.
                  </p>
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/12 bg-black/12 p-4">
                    <p className="text-2xl font-semibold text-white">Early</p>
                    <p className="mt-1 text-sm text-white/65">
                      product access before broader release
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-black/12 p-4">
                    <p className="text-2xl font-semibold text-white">Direct</p>
                    <p className="mt-1 text-sm text-white/65">
                      launch and invite updates from the team
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="why-join" className="relative border-b border-white/10 bg-[#f5f7fb]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(79,124,167,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(210,122,44,0.14),transparent_26%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 sm:px-10 lg:px-12">
          <div data-reveal className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--brand-orange)]">
              What&apos;s coming
            </p>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-5xl">
              A cleaner way to run the business behind your ideas.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Here&apos;s what early access gets you as Prospra, Architecta,
              and Synceri open up — the core outcomes the platform is built
              around.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  data-reveal
                  className="rounded-[24px] border border-slate-200 bg-white/88 p-7 shadow-[0_18px_60px_rgba(26,41,66,0.08)] backdrop-blur"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-navy)] text-white shadow-lg">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold text-[var(--brand-navy)]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-base leading-7 text-slate-600">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative border-b border-white/10 bg-[var(--brand-navy)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 sm:px-10 lg:px-12">
          <div
            data-reveal
            className="rounded-[32px] border border-white/12 bg-white/6 p-8 shadow-[0_30px_100px_rgba(0,0,0,0.28)] backdrop-blur md:p-12"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--brand-accent)]">
              Vision
            </p>
            <div className="mt-5 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <h2 className="max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
                  Founders need systems that think with them, not more software
                  to babysit.
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-white/72">
                  Entrepreneuria is being built to reduce tool sprawl and bring
                  decision support, execution clarity, and business structure into
                  one founder-ready experience.
                </p>
              </div>
              <div className="rounded-[28px] border border-white/12 bg-black/16 p-6 text-white/78">
                <p className="text-sm uppercase tracking-[0.24em] text-white/55">
                  Designed for
                </p>
                <ul className="mt-4 space-y-3 text-base leading-7">
                  <li>Solo founders building without a large ops team</li>
                  <li>Small businesses ready for stronger internal systems</li>
                  <li>Operators who want leverage, not more dashboard clutter</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="join-waitlist"
        className="relative bg-[linear-gradient(180deg,rgba(245,247,251,0.98),rgba(234,239,247,0.98))]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(79,124,167,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(210,122,44,0.16),transparent_26%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 sm:px-10 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div data-reveal className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--brand-orange)]">
                Early access
              </p>
              <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-5xl">
                Join the waitlist for launch updates and first access.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Add your email and we&apos;ll use it for invite updates and
                relevant launch communication only. Already on the list?
                We&apos;ll simply confirm your spot.
              </p>
            </div>

            <div data-reveal className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_30px_100px_rgba(26,41,66,0.12)] sm:p-10">
              <WaitlistForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import {
  BrainCircuit,
  ChartNoAxesCombined,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { HomeWaitlistForm } from "@/components/home/HomeWaitlistForm";
import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";

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

const terms = [
  {
    n: "01",
    title: "First invites",
    body: "When Prospra's private beta opens, the waitlist is the door. No public signup first.",
  },
  {
    n: "02",
    title: "Founding pricing",
    body: "Free tier at launch, paid plans from $29/mo — waitlist members lock in first access before prices settle.",
  },
  {
    n: "03",
    title: "No filler",
    body: "You hear from us when something ships or opens. That's the entire email policy.",
  },
];

const designedFor = [
  "Solo founders building without a large ops team",
  "Small businesses ready for stronger internal systems",
  "Operators who want leverage, not more dashboard clutter",
];

export default function WaitlistPage() {
  return (
    <PageShell>
      <PageHero
        kicker="Private beta waitlist"
        title={
          <>
            Be first in when <em className="italic">Prospra</em> opens.
          </>
        }
        lede="One email. First access to Prospra, Architecta, and Synceri as each one ships — plus launch updates without the filler."
      />

      <Section kicker="01 — The terms" title="Early access, in plain terms.">
        <div className="grid gap-16 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20">
          <ul className="space-y-7">
            {terms.map((term) => (
              <li key={term.n} className="flex gap-5">
                <span className="pt-1 text-[11px] tracking-[0.2em] text-white/35 [font-family:var(--font-label)]">
                  {term.n}
                </span>
                <div>
                  <p className="font-semibold text-white">{term.title}</p>
                  <p className="mt-1 leading-7 text-white/60">{term.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-9">
            <h3 className="text-3xl font-medium leading-tight tracking-tight text-white">
              Join the <em className="italic">waitlist</em>.
            </h3>
            <p className="mt-3 leading-7 text-white/60">
              Add your email and we&apos;ll use it for invite updates and
              relevant launch communication only. Already on the list?
              We&apos;ll simply confirm your spot.
            </p>
            <div className="mt-7">
              <HomeWaitlistForm source="waitlist-page" />
            </div>
          </div>
        </div>
      </Section>

      <Section
        kicker="02 — What's coming"
        title={
          <>
            A cleaner way to run the business behind your{" "}
            <em className="italic">ideas</em>.
          </>
        }
        lede="Here's what early access gets you as Prospra, Architecta, and Synceri open up — the core outcomes the platform is built around."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-8"
              >
                <Icon
                  className="mb-5 h-6 w-6 text-[#00d4ff]"
                  aria-hidden="true"
                />
                <h3 className="text-2xl font-medium tracking-tight text-white">
                  {feature.title}
                </h3>
                <p className="mt-3 leading-7 text-white/60">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        kicker="03 — The vision"
        title={
          <>
            Systems that <em className="italic">think with you</em>, not more
            software to babysit.
          </>
        }
        lede="Entrepreneuria is being built to reduce tool sprawl and bring decision support, execution clarity, and business structure into one founder-ready experience."
      >
        <div className="max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45 [font-family:var(--font-label)]">
            Designed for
          </p>
          <ul className="mt-5 space-y-3">
            {designedFor.map((item) => (
              <li key={item} className="flex gap-3 leading-7 text-white/60">
                <span
                  aria-hidden="true"
                  className="mt-3 h-1 w-1 shrink-0 rounded-full bg-[#00d4ff]"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </PageShell>
  );
}

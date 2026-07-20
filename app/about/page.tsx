import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Rocket, Users } from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section, PaperSection } from "@/components/marketing/Section";
import {
  PillButton,
  GhostButton,
  StatusDot,
} from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "About | Entrepreneuria",
  description:
    "Why Entrepreneuria exists: leverage for solo founders — practical tools today, an AI-powered founder OS in open build.",
};

const mentorStats = [
  {
    value: "95%",
    label: "Of aspiring founders never find a mentor",
  },
  {
    value: "93%",
    label: "Of self-made millionaires had one",
  },
  {
    value: "84%",
    label: "Of CEOs say their mentor saved them from costly mistakes",
  },
  {
    value: "1",
    label: "Platform built to change all of that",
  },
];

const pillars = [
  {
    icon: Bot,
    title: "AI-powered tools",
    body: "A full suite of apps from AI mentorship to content creation, business architecture to market intelligence built specifically for the way solo founders actually work.",
  },
  {
    icon: Rocket,
    title: "Launch-ready resources",
    body: "Frameworks, templates, guides, and strategic tools that cut through the noise and help you execute fast. The Launch Pad is your shortcut from idea to action.",
  },
  {
    icon: Users,
    title: "A founder community",
    body: "The Exchange is where the real conversations happen. Strategy, support, accountability, and real talk from founders who are in it with you, not above you.",
  },
];

const stack = [
  {
    name: "Prospra",
    role: "AI mentor & business advisor",
    href: "/prospra",
    live: false,
  },
  {
    name: "Architecta",
    role: "AI content studio & creator",
    href: "/architecta",
    live: false,
  },
  {
    name: "Directorium",
    role: "Your AI board of directors",
    href: "/directorium",
    live: false,
  },
  {
    name: "Synceri",
    role: "AI operations & workflow hub",
    href: "/synceri",
    live: false,
  },
  {
    name: "Launch Pad",
    role: "Free AI founder tools — live today",
    href: "/launch-pad/tools",
    live: true,
  },
];

export default function AboutPage() {
  return (
    <PageShell>
      <PageHero
        kicker="The blueprint"
        title={
          <>
            Built for founders who <em className="italic">build</em>.
          </>
        }
        lede={
          <>
            Entrepreneuria exists for{" "}
            <strong className="font-semibold text-white">one reason</strong>:
            to make sure that building a business while flying solo
            doesn&apos;t have to mean figuring it out alone. We&apos;re the
            infrastructure behind your ambition.
          </>
        }
      >
        <div className="flex flex-wrap gap-4">
          <PillButton href="/waitlist">Join the waitlist</PillButton>
          <GhostButton href="/launch-pad/tools">
            Open the free tools
          </GhostButton>
        </div>
      </PageHero>

      <Section
        kicker="01 — The origin"
        title={
          <>
            Started from frustration.
            <br />
            Built from <em className="italic">purpose</em>.
          </>
        }
      >
        <div className="grid gap-14 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
          <div className="max-w-2xl">
            <p className="leading-8 text-white/70">
              Entrepreneuria didn&apos;t start in a boardroom. It started with
              a question:{" "}
              <strong className="font-semibold text-white">
                why do the most successful people in the world have mentors
                and almost nobody else gets that same advantage?
              </strong>
            </p>

            <p className="mt-5 leading-8 text-white/60">
              Warren Buffett mentored Bill Gates. Maya Angelou mentored Oprah.
              Steve Jobs mentored Mark Zuckerberg while he was building Meta.
              The pattern was impossible to ignore and so was the gap.{" "}
              <strong className="font-semibold text-white">
                95% of people looking for a mentor fail to find one.
              </strong>{" "}
              That felt like a problem worth solving.
            </p>

            <p className="mt-5 leading-8 text-white/60">
              So we built it. Not just a mentor, an entire ecosystem.
              AI-powered tools, strategic resources, and a community built for
              the solo founder who&apos;s moving fast and needs to move smart.
            </p>

            <p className="mt-5 leading-8 text-white/60">
              <strong className="font-semibold text-white">
                This is Entrepreneuria. Welcome to the platform that was built
                because you deserve the same edge everyone at the top already
                has.
              </strong>
            </p>
          </div>

          <div className="grid h-fit grid-cols-2 gap-4">
            {mentorStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <p className="text-4xl font-medium tracking-tight text-white sm:text-5xl">
                  {stat.value}
                </p>
                <p className="mt-3 text-sm leading-6 text-white/50">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        kicker="02 — Our mission"
        title={
          <>
            Give founders an <em className="italic">unfair</em> advantage.
          </>
        }
        lede={
          <>
            Every tool, resource, and app we build is designed around the same
            belief:{" "}
            <strong className="font-semibold text-white">
              solo founders deserve enterprise-grade intelligence.
            </strong>
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.title}
                className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25 sm:p-8"
              >
                <Icon className="mb-5 h-6 w-6 text-[#00d4ff]" aria-hidden="true" />
                <h3 className="text-2xl font-medium tracking-tight text-white">
                  {pillar.title}
                </h3>
                <p className="mt-3 flex-1 leading-7 text-white/60">
                  {pillar.body}
                </p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        kicker="03 — The stack"
        title={
          <>
            The stack that runs <em className="italic">your</em> business.
          </>
        }
        lede="One ecosystem, built in the open. What's live is live; what isn't is labeled."
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {stack.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/25"
            >
              <div className="flex items-center gap-3">
                <StatusDot live={item.live} />
                <p className="text-[15px] font-semibold text-white">
                  {item.name}
                </p>
              </div>
              <p className="mt-3 flex-1 text-sm leading-6 text-white/50">
                {item.role}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 transition group-hover:text-white">
                Learn more
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <PaperSection
        kicker="04 — Ready when you are"
        title={
          <>
            Ready to build <em className="italic">smarter</em>?
          </>
        }
        lede="Solo founders are already using the tool library and free Launch Pad tools today. The waitlist gets first access to the AI products as each one ships."
      >
        <div className="flex flex-wrap gap-4">
          <PillButton href="/waitlist">Join the waitlist</PillButton>
          <Link
            href="/launch-pad/tools"
            className="no-accent-link inline-flex h-13 items-center justify-center rounded-full border border-[#1a2942]/20 px-7 text-[15px] font-semibold text-[#1a2942] transition hover:border-[#1a2942]/50"
          >
            Open the free tools
          </Link>
        </div>
      </PaperSection>
    </PageShell>
  );
}

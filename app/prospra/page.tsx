import type { Metadata } from "next";
import {
  Brain,
  Compass,
  LineChart,
  MessageCircle,
  Repeat,
  Rocket,
  Sparkles,
} from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section, PaperSection } from "@/components/marketing/Section";
import {
  PillButton,
  GhostButton,
  StatusDot,
} from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Prospra — AI Founder Mentor | Entrepreneuria",
  description:
    "Prospra is your AI-powered business mentor: expert guidance from ideation to scaling, on demand, on your terms. Now in private build — join the waitlist.",
};

const stats = [
  {
    value: "93%",
    label: "of self-made millionaires credit a mentor",
  },
  {
    value: "84%",
    label: "of CEOs say their mentor helped them avoid costly mistakes",
  },
  {
    value: "95%",
    label: "of people looking for a mentor never find one",
  },
];

const steps = [
  {
    step: "01",
    title: "Tell us about you",
    description:
      "Walk through a personalized onboarding process. Prospra learns your business stage, goals, available time, and founder journey so every interaction starts from where you really are.",
  },
  {
    step: "02",
    title: "Get matched with your mentor",
    description:
      "Your AI mentor combines current business trends, proven frameworks, and your onboarding context to deliver practical guidance instead of generic internet advice.",
  },
  {
    step: "03",
    title: "Build, grow, repeat",
    description:
      "From ideation to production to scaling, Prospra works alongside you with mentor chat and built-in tools so you can keep making progress when it matters most.",
  },
];

const benefits = [
  {
    title: "Expert-level guidance",
    description:
      "Access strategies and insights usually locked behind high-ticket consultants and accelerators.",
  },
  {
    title: "Personalized direction",
    description:
      "Prospra learns your business model, industry, and goals so guidance stays specific and useful.",
  },
  {
    title: "Always available",
    description:
      "Get support whenever you need it without waiting on calendars, introductions, or office hours.",
  },
  {
    title: "Proven frameworks",
    description:
      "Use practical systems built around how real founders validate, launch, and grow.",
  },
];

const tools = [
  {
    icon: Sparkles,
    title: "FounderFuel",
    description:
      "Stop guessing at prompts. Enter your goals, details, and AI platform, then FounderFuel generates stronger expert-level prompts.",
  },
  {
    icon: Compass,
    title: "Web Advisory",
    description:
      "Get a full website audit with a clear advisory score, identified gaps, and specific next actions.",
  },
  {
    icon: Rocket,
    title: "Copy Architect",
    description:
      "Create and optimize website copy that ranks, converts, and sounds aligned with your brand.",
  },
];

const supportingFeatures = [
  {
    icon: LineChart,
    title: "Progress tracking and milestones",
    description:
      "Set goals, track milestones, and keep momentum visible so you stay focused on meaningful progress.",
  },
  {
    icon: Brain,
    title: "Resource vault and smart recommendations",
    description:
      "Access curated templates, frameworks, and founder resources with recommendations matched to your current stage.",
  },
  {
    icon: MessageCircle,
    title: "Personalized mindset coach",
    description:
      "Work through founder pressure with practical support for stress management, clarity, and confidence.",
  },
  {
    icon: Repeat,
    title: "Pivot advisor",
    description:
      "Evaluate whether to keep pushing or pivot with structured analysis that supports confident decisions.",
  },
];

const mentorSupport = [
  "Expert support across strategy, operations, marketing, and finance",
  "Context-aware responses based on your stage and goals",
  "Momentum support when founder pressure gets heavy",
  "Built to scale from your first idea to your first million",
];

export default function ProspraPage() {
  return (
    <PageShell>
      <PageHero
        kicker={
          <span className="inline-flex items-center gap-3">
            <StatusDot live={false} />
            Prospra · In private build — waitlist open
          </span>
        }
        title={
          <>
            Meet <em className="italic">Prospra</em>, your AI-powered business
            mentor.
          </>
        }
        lede="Expert guidance from ideation to scaling, on demand, on your terms. Because every founder deserves a mentor in their corner."
      >
        <div className="flex flex-wrap gap-4">
          <PillButton href="/waitlist">Join the waitlist</PillButton>
          <GhostButton href="#features">See what's inside</GhostButton>
        </div>
      </PageHero>

      <Section kicker="01 — The mentor gap" title="The numbers behind it.">
        <div className="grid gap-5 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-7"
            >
              <p className="text-5xl font-medium tracking-tight text-white">
                {stat.value}
              </p>
              <p className="mt-3 text-sm leading-6 text-white/50">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <PaperSection
        kicker="02 — Why Prospra exists"
        title="Built by a founder who needed what nobody was offering."
      >
        <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <div className="space-y-5 text-lg leading-8 text-[#41567a]">
            <p>
              Prospra was born out of frustration. I was building a business
              and hitting walls that felt impossible to get past alone — the
              kind of walls that make you question everything.
            </p>
            <p>
              Then I saw the pattern: Steve Jobs mentored Mark Zuckerberg.
              Warren Buffet mentored Bill Gates. Maya Angelou mentored Oprah.
              Behind nearly every successful founder, there was a mentor — and
              the data backed it up.
            </p>
            <p>But 95% of people looking for a mentor never find one.</p>
            <p>
              So I built Prospra — not just as an AI mentor, but as a hands-on
              partner, to help you make better decisions, move faster, and
              actually reach your goals.
            </p>
          </div>

          <div className="h-fit rounded-2xl border border-[#1a2942]/10 bg-white p-7 shadow-[0_16px_50px_rgba(26,41,66,0.08)] sm:p-8">
            <blockquote className="border-l-2 border-[#d27a2c] pl-6 text-xl font-medium italic leading-snug text-[#1a2942]">
              “That just did not seem right to me, so I wanted everyone to have
              something to turn to when they need advice, have questions, or
              feel overwhelmed.”
            </blockquote>
            <p className="mt-5 text-[11px] uppercase tracking-[0.24em] text-[#4f7ca7] [font-family:var(--font-label)]">
              Misti, founder of Entrepreneuria
            </p>
          </div>
        </div>
      </PaperSection>

      <Section
        kicker="03 — How it works"
        title={
          <>
            Up and running in <em className="italic">three</em> steps.
          </>
        }
        lede="Prospra's onboarding learns about you, your business, and your goals so your mentorship experience is relevant from day one."
      >
        <ul className="grid gap-10 md:grid-cols-3">
          {steps.map((item) => (
            <li key={item.step} className="flex gap-5">
              <span className="pt-1 text-[11px] tracking-[0.2em] text-white/35 [font-family:var(--font-label)]">
                {item.step}
              </span>
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 leading-7 text-white/60">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="features"
        kicker="04 — Features & tools"
        title={
          <>
            Everything you need. <em className="italic">Nothing</em> you
            don&apos;t.
          </>
        }
        lede="Prospra combines AI-powered mentorship with practical tools designed to help solo founders move faster and smarter."
      >
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h3 className="text-2xl font-medium tracking-tight text-white">
              Why entrepreneurs choose Prospra
            </h3>
            <ul className="mt-7 space-y-4">
              {benefits.map((item) => (
                <li
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h4 className="font-semibold text-white">{item.title}</h4>
                  <p className="mt-1.5 leading-7 text-white/60">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-8">
            <h3 className="text-2xl font-medium tracking-tight text-white">
              On-demand mentor chat
            </h3>
            <p className="mt-3 leading-7 text-white/60">
              Your mentor is available 24/7, informed by your onboarding
              profile and current business strategies. Ask anything, anytime.
            </p>
            <ul className="mt-5 space-y-3">
              {mentorSupport.map((item) => (
                <li key={item} className="flex gap-3 leading-7 text-white/60">
                  <span
                    aria-hidden="true"
                    className="mt-3 h-1 w-1 shrink-0 rounded-full bg-[#00d4ff]"
                  />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-7 space-y-4 border-t border-white/10 pt-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 [font-family:var(--font-label)]">
                  You
                </p>
                <p className="mt-2 rounded-2xl border border-[rgba(0,212,255,0.25)] bg-[rgba(0,212,255,0.1)] px-4 py-3 text-sm leading-6 text-white/85">
                  I&apos;ve been working on my MVP for 3 months and I&apos;m
                  not sure if I should keep going or pivot. How do I know?
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#d27a2c] [font-family:var(--font-label)]">
                  Prospra mentor
                </p>
                <p className="mt-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm leading-6 text-white/85">
                  Great question. Let&apos;s look at user feedback, traction
                  metrics, and whether the core problem still energizes you.
                  Walk me through what you&apos;re seeing.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <article
                key={tool.title}
                className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25"
              >
                <Icon
                  className="mb-5 h-6 w-6 text-[#00d4ff]"
                  aria-hidden="true"
                />
                <h3 className="text-2xl font-medium tracking-tight text-white">
                  {tool.title}
                </h3>
                <p className="mt-3 flex-1 leading-7 text-white/60">
                  {tool.description}
                </p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        kicker="05 — And there's more"
        title="Built-in tools to keep you moving."
        lede="Prospra is not just a chatbot. It's a founder support layer designed around how real businesses get built."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {supportingFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7"
              >
                <div className="flex items-center gap-4">
                  <Icon
                    className="h-6 w-6 shrink-0 text-[#00d4ff]"
                    aria-hidden="true"
                  />
                  <h3 className="text-xl font-semibold text-white">
                    {feature.title}
                  </h3>
                </div>
                <p className="mt-3 leading-7 text-white/60">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section kicker="06 — The waitlist">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-14 text-center sm:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.25),transparent_65%)]"
          />
          <h2 className="relative text-balance text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
            Ready to build with a <em className="italic">mentor</em> in your
            corner?
          </h2>
          <p className="relative mx-auto mt-5 max-w-2xl leading-7 text-white/60">
            Prospra is almost here. Join the waitlist and be first in line when
            we launch. Real guidance, real momentum, and a smarter way to build
            without doing it all alone.
          </p>
          <div className="relative mt-9 flex justify-center">
            <PillButton href="/waitlist">Join the waitlist</PillButton>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}

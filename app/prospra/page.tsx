import type { Metadata } from "next";
import Image from "next/image";
import {
  Brain,
  Compass,
  LineChart,
  MessageCircle,
  Repeat,
  Rocket,
  Sparkles,
} from "lucide-react";

import { getPrimaryCta } from "@/lib/launch";
import { getProduct, PRODUCT_STATUS_LABELS } from "@/lib/ecosystem/products";
import { ProductShot } from "@/components/home/ProductShot";
import {
  FlowCanvas,
  Glow,
  PaperBleed,
  Thread,
} from "@/components/marketing/flow/atmosphere";
import { FlowSection, Panel } from "@/components/marketing/flow/FlowSection";
import { MentorExchange } from "@/components/marketing/flow/MentorExchange";
import { Reveal, RevealGroup } from "@/components/marketing/flow/Reveal";
import {
  PrimaryAction,
  SecondaryAction,
} from "@/components/marketing/flow/cta";

export const metadata: Metadata = {
  title: "Prospra — AI Founder Mentor | Entrepreneuria",
  description:
    "Prospra is your AI-powered business mentor: expert guidance from ideation to scaling, on demand, on your terms. Now in private build — join the waitlist.",
  alternates: { canonical: "https://entrepreneuria.io/prospra" },
};

const stats = [
  {
    value: "93%",
    label: "of self-made millionaires credit a mentor",
    turn: false,
  },
  {
    value: "84%",
    label: "of CEOs say their mentor helped them avoid costly mistakes",
    turn: false,
  },
  {
    value: "95%",
    label: "of people looking for a mentor never find one",
    turn: true,
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

/** The exchange shown in the hero — the page's one demonstrated behaviour. */
const EXCHANGE = {
  question:
    "I've been working on my MVP for 3 months and I'm not sure if I should keep going or pivot. How do I know?",
  answer:
    "Great question. Let's look at user feedback, traction metrics, and whether the core problem still energizes you. Walk me through what you're seeing.",
};

/**
 * /prospra — the first secondary page brought into the constellation
 * system the homepage established.
 *
 * The page is one continuous field. Sections are marked by rhythm and
 * light, never by rules or background switches, and the single light
 * interlude (the founder letter) is entered and left through a gradient
 * bleed. Motion is scroll-triggered and once, with one exception: the
 * mentor exchange in the hero plays on load, because a behaviour has to
 * be shown rather than claimed.
 *
 * Name, role, status, screenshot and CTA all come from the ecosystem
 * registry and the launch config, so launch day stays an environment
 * change rather than an edit here.
 */
export default function ProspraPage() {
  const prospra = getProduct("prospra");
  const cta = getPrimaryCta();
  const statusLabel = PRODUCT_STATUS_LABELS[prospra.status];
  const shot = prospra.screenshot;

  return (
    <FlowCanvas>
      {/* Without JS the IntersectionObserver never attaches, and the
          reveal CSS would leave the page blank. Hand those readers the
          finished state. */}
      <noscript>
        <style>{`[data-flow-reveal],[data-flow-reveal-group]>*{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section
        aria-labelledby="prospra-hero-heading"
        className="relative overflow-hidden px-6 pb-16 pt-[calc(var(--header-height)+80px)] sm:px-10 sm:pb-24 lg:px-16 lg:pt-[calc(var(--header-height)+112px)]"
      >
        {/* the founder's light, top-left — the homepage hero's rhyme */}
        <Glow
          tone="human"
          className="hero-light-drift left-[-16%] top-[2%] h-[560px] w-[560px]"
          opacity={0.8}
        />
        {/* depth behind the exchange, spilling past the hero's bottom
            edge so the first boundary never resolves into a line */}
        <Glow
          tone="atmosphere"
          className="right-[-20%] top-[22%] h-[680px] w-[680px]"
          opacity={0.7}
        />

        {/* Two columns only from xl. At 1024–1279 the headline in a 6fr
            column wraps to five lines and the exchange gets squeezed;
            stacked, both get their full measure. */}
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] xl:gap-20">
          <div>
            <Reveal distance={14}>
              <p className="type-kicker mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-white/55">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-intelligence shadow-[0_0_8px_rgba(0,212,255,0.8)]"
                  />
                  {prospra.name}
                </span>
                <span aria-hidden="true" className="text-white/25">
                  /
                </span>
                <span>{prospra.role}</span>
                <span aria-hidden="true" className="text-white/25">
                  /
                </span>
                <span>{statusLabel}</span>
              </p>
            </Reveal>

            <h1
              id="prospra-hero-heading"
              className="type-display-lg max-w-[15ch] text-balance"
            >
              Meet Prospra, your AI-powered business mentor.
            </h1>

            <Reveal>
              <p className="type-lede mt-8 max-w-xl text-white/70">
                Expert guidance from ideation to scaling, on demand, on your
                terms. Because every founder deserves a mentor in their corner.
              </p>
            </Reveal>

            <Reveal>
              <div className="mt-11 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <PrimaryAction href={cta.href}>{cta.label}</PrimaryAction>
                <SecondaryAction href="#features">
                  See what&apos;s inside
                </SecondaryAction>
              </div>
            </Reveal>
          </div>

          <div className="w-full max-w-xl xl:max-w-none xl:pt-4">
            <MentorExchange
              question={EXCHANGE.question}
              answer={EXCHANGE.answer}
              logo={prospra.logo}
              name={prospra.name}
            />
          </div>
        </div>
      </section>

      {/* ── The mentor gap ───────────────────────────────────────── */}
      {/* Three numbers, not three boxes. The band is typographic so the
          figures carry the weight themselves, and only the third — the
          one the whole product answers — is lit. */}
      <FlowSection
        id="mentor-gap"
        eyebrow="The mentor gap"
        title="The numbers behind it."
      >
        <RevealGroup
          as="dl"
          distance={28}
          className="grid gap-y-12 sm:grid-cols-3 sm:gap-x-10"
        >
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="relative sm:px-7 sm:first:pl-0 sm:last:pr-0"
            >
              {i > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 hidden w-px bg-gradient-to-b from-transparent via-white/[0.16] to-transparent sm:block"
                />
              ) : null}
              <dt className="flow-figure-mask">
                <span
                  className={`type-display-lg block ${
                    stat.turn ? "text-human" : "text-white"
                  }`}
                >
                  {stat.value}
                </span>
              </dt>
              <dd className="mt-5 max-w-[30ch] leading-7 text-white/65">
                {stat.label}
              </dd>
            </div>
          ))}
        </RevealGroup>

        <Reveal>
          <p className="type-display-sm mt-20 max-w-[26ch] text-balance text-white/80">
            That last number is the one Prospra exists to change.
          </p>
        </Reveal>
      </FlowSection>

      {/* ── The founder letter ───────────────────────────────────── */}
      {/* The one temperature shift on the page — dissolved in and out
          rather than cut. */}
      <PaperBleed direction="into" />

      <section
        aria-labelledby="prospra-founder-heading"
        className="relative bg-paper px-6 pb-20 pt-6 text-ink sm:px-10 sm:pb-28 lg:px-16"
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <Reveal
              as="figure"
              className="relative overflow-hidden rounded-2xl shadow-[0_32px_80px_-40px_rgba(26,41,66,0.45)]"
            >
              <Image
                src="/images/founder/misti-portrait-1200.webp"
                alt="Misti, founder of Entrepreneuria, standing in a city street."
                width={1200}
                height={1200}
                sizes="(min-width: 1024px) 38vw, 92vw"
                className="h-auto w-full object-cover"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 [background:linear-gradient(315deg,rgba(210,122,44,0.18)_0%,transparent_45%)]"
              />
            </Reveal>

            <div>
              <Reveal distance={14}>
                <p className="type-kicker mb-5 text-ink/55">
                  Why Prospra exists
                </p>
              </Reveal>
              <h2
                id="prospra-founder-heading"
                className="type-display-md text-balance"
              >
                Built by a founder who needed what nobody was offering.
              </h2>

              <RevealGroup className="type-lede mt-8 space-y-5 text-ink/80">
                <p>
                  Prospra was born out of frustration. I was building a
                  business and hitting walls that felt impossible to get past
                  alone — the kind of walls that make you question everything.
                </p>
                <p>
                  Then I saw the pattern: Steve Jobs mentored Mark Zuckerberg.
                  Warren Buffet mentored Bill Gates. Maya Angelou mentored
                  Oprah. Behind nearly every successful founder, there was a
                  mentor — and the data backed it up.
                </p>
                <p>But 95% of people looking for a mentor never find one.</p>
                <p>
                  So I built Prospra — not just as an AI mentor, but as a
                  hands-on partner, to help you make better decisions, move
                  faster, and actually reach your goals.
                </p>
              </RevealGroup>
            </div>
          </div>

          {/* The pull quote gets its own beat. Italic serif is this
              site's interior voice, which is exactly what this is. */}
          <Reveal
            as="figure"
            className="mx-auto mt-20 max-w-4xl border-t border-ink/[0.12] pt-12 text-center sm:mt-24"
          >
            <blockquote className="type-kinetic-interior text-balance text-ink/90">
              &ldquo;That just did not seem right to me, so I wanted everyone
              to have something to turn to when they need advice, have
              questions, or feel overwhelmed.&rdquo;
            </blockquote>
            <figcaption className="type-label mt-8 text-ink/55">
              Misti — Founder, Entrepreneuria
            </figcaption>
          </Reveal>
        </div>
      </section>

      <PaperBleed direction="out-of" />

      {/* ── How it works ─────────────────────────────────────────── */}
      {/* A real sequence, so it earns real sequence markers — and the
          thread that draws itself as the reader moves down it. */}
      <FlowSection
        id="how-it-works"
        layout="split"
        eyebrow="How it works"
        title="Up and running in three steps."
        lede="Prospra's onboarding learns about you, your business, and your goals so your mentorship experience is relevant from day one."
      >
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute bottom-10 left-[13px] top-5 sm:left-[15px]"
          >
            <Thread />
          </span>

          <RevealGroup as="ol" className="flex flex-col gap-12 sm:gap-14">
            {steps.map((item) => (
              <li key={item.step} className="relative flex gap-6 sm:gap-8">
                <span className="type-label relative z-10 mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-void-900 text-white/55 sm:h-8 sm:w-8">
                  {item.step}
                </span>
                <div className="min-w-0">
                  <h3 className="type-display-sm text-white">{item.title}</h3>
                  <p className="mt-3 leading-7 text-white/65">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </RevealGroup>
        </div>
      </FlowSection>

      {/* ── The proof ────────────────────────────────────────────── */}
      {/* The real product, on the product's own page. The frame is
          pulled up so it lies across the boundary above it — a seam with
          a large object straddling it stops reading as a seam.
          Registry-driven: no screenshot, no frame, per the no-fake-UI
          rule. */}
      {shot ? (
        <section
          aria-labelledby="prospra-proof-heading"
          className="relative px-6 pb-20 pt-16 sm:px-10 sm:pb-28 sm:pt-20 lg:px-16 lg:pb-36 lg:pt-24"
        >
          <Glow
            tone="intelligence"
            className="left-1/2 top-[-8%] h-[540px] w-[min(94vw,940px)] -translate-x-1/2"
            opacity={0.8}
          />
          <div className="relative mx-auto w-full max-w-5xl">
            <div className="max-w-2xl">
              <Reveal distance={14}>
                <p className="type-kicker mb-5 text-white/50">The product</p>
              </Reveal>
              <h2
                id="prospra-proof-heading"
                className="type-display-md text-balance"
              >
                Not a mockup. The real thing.
              </h2>
              <Reveal>
                <p className="type-lede mt-7 max-w-xl text-white/70">
                  Your founder blueprint, your mentor sessions, and the next
                  move — in one place, from the day you log in.
                </p>
              </Reveal>
            </div>

            <Reveal distance={34} className="mt-14 lg:mt-16">
              <ProductShot
                src={shot.src}
                alt={shot.alt}
                width={1600}
                height={1050}
                caption={`${prospra.name} — the founder dashboard, ${statusLabel.toLowerCase()}`}
              />
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ── What's inside ────────────────────────────────────────── */}
      <FlowSection
        id="features"
        eyebrow="What's inside"
        title="Everything you need. Nothing you don't."
        lede="Prospra combines AI-powered mentorship with practical tools designed to help solo founders move faster and smarter."
      >
        <div className="grid gap-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-20">
          {/* A hairline-ruled list, not four more boxes — the box was
              doing no work here that a rule and some air can't. */}
          <div>
            <h3 className="type-display-sm text-white">
              Why entrepreneurs choose Prospra
            </h3>
            <RevealGroup
              as="dl"
              className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]"
            >
              {benefits.map((item) => (
                <div key={item.title} className="py-6">
                  <dt className="font-semibold text-white">{item.title}</dt>
                  <dd className="mt-2 leading-7 text-white/65">
                    {item.description}
                  </dd>
                </div>
              ))}
            </RevealGroup>
          </div>

          {/* The one panel in this section, because it is the one thing
              here that is genuinely a separate surface: the mentor. */}
          <Reveal>
            <Panel className="h-fit p-7 sm:p-8">
              <h3 className="type-display-sm text-white">
                On-demand mentor chat
              </h3>
              <p className="mt-4 leading-7 text-white/65">
                Your mentor is available 24/7, informed by your onboarding
                profile and current business strategies. Ask anything, anytime.
              </p>
              <ul className="mt-7 space-y-4">
                {mentorSupport.map((item) => (
                  <li key={item} className="flex gap-3 leading-7 text-white/70">
                    <span
                      aria-hidden="true"
                      className="mt-3 h-1 w-1 shrink-0 rounded-full bg-intelligence"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          </Reveal>
        </div>
      </FlowSection>

      {/* ── The toolkit ──────────────────────────────────────────── */}
      <FlowSection
        id="toolkit"
        eyebrow="The toolkit"
        title="Built-in tools to keep you moving."
        lede="Prospra is not just a chatbot. It's a founder support layer designed around how real businesses get built."
      >
        <RevealGroup className="grid gap-5 md:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Panel
                key={tool.title}
                as="article"
                lift
                className="flex h-full flex-col p-7"
              >
                <Icon
                  className="mb-6 h-6 w-6 text-intelligence"
                  aria-hidden="true"
                />
                <h3 className="type-display-xs text-white">{tool.title}</h3>
                <p className="mt-3 flex-1 leading-7 text-white/65">
                  {tool.description}
                </p>
              </Panel>
            );
          })}
        </RevealGroup>

        <RevealGroup
          as="dl"
          className="mt-16 grid gap-x-14 gap-y-10 border-t border-white/[0.08] pt-14 sm:grid-cols-2"
        >
          {supportingFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title}>
                <dt className="flex items-start gap-3.5">
                  <Icon
                    className="mt-0.5 h-5 w-5 shrink-0 text-white/45"
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-white">
                    {feature.title}
                  </span>
                </dt>
                <dd className="mt-2.5 pl-[34px] leading-7 text-white/65">
                  {feature.description}
                </dd>
              </div>
            );
          })}
        </RevealGroup>
      </FlowSection>

      {/* ── The close ────────────────────────────────────────────── */}
      {/* No box. The page opens out, the founder's light comes back, and
          the field runs on into the footer. */}
      <section
        aria-labelledby="prospra-close-heading"
        className="relative overflow-hidden px-6 pb-36 pt-8 text-center sm:px-10 sm:pb-44 lg:px-16"
      >
        <Glow
          tone="human"
          className="left-1/2 top-[6%] h-[560px] w-[min(94vw,800px)] -translate-x-1/2"
          opacity={0.75}
        />
        <div className="relative mx-auto max-w-3xl">
          <Reveal distance={14}>
            <p className="type-kicker mb-6 text-white/50">Begin</p>
          </Reveal>
          <h2
            id="prospra-close-heading"
            className="type-display-lg text-balance"
          >
            Ready to build with a mentor in your corner?
          </h2>
          <Reveal>
            <p className="type-lede mx-auto mt-7 max-w-xl text-white/70">
              Prospra is almost here. Join the waitlist and be first in line
              when we launch. Real guidance, real momentum, and a smarter way
              to build without doing it all alone.
            </p>
          </Reveal>
          <Reveal>
            <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <PrimaryAction href={cta.href}>{cta.label}</PrimaryAction>
              <SecondaryAction href="/#ecosystem">
                Explore the ecosystem
              </SecondaryAction>
            </div>
          </Reveal>
        </div>
      </section>
    </FlowCanvas>
  );
}

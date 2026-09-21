import type { Metadata } from "next";
import {
  ArrowRight,
  CheckCircle,
  ChevronDown,
  Folder,
  Layers,
  PenTool,
  Sparkles,
  Target,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  getProduct,
  isLitStatus,
  PRODUCTS,
  PRODUCT_STATUS_LABELS,
} from "@/lib/ecosystem/products";
import Link from "@/components/transition/TransitionLink";
import { ProductShot } from "@/components/home/ProductShot";
import { Armature } from "@/components/marketing/architecta/Armature";
import { FlowCanvas, Glow } from "@/components/marketing/flow/atmosphere";
import { FlowSection } from "@/components/marketing/flow/FlowSection";
import { Reveal, RevealGroup } from "@/components/marketing/flow/Reveal";
import {
  PrimaryAction,
  SecondaryAction,
} from "@/components/marketing/flow/cta";

export const metadata: Metadata = {
  title: "Architecta — AI Content Studio | Entrepreneuria",
  description:
    "Architecta turns your ideas into structured, platform-ready content without the chaos, rewrites, or wasted hours. In design — join the waitlist.",
  alternates: { canonical: "https://entrepreneuria.io/architecta" },
};

/**
 * The hero drawing. One founder-sized idea and the four versions of it
 * four channels actually ask for — the product's central behaviour,
 * shown rather than claimed.
 *
 * Illustrative example copy, not product output and not a metric: the
 * no-fake-UI rule means the real screenshot further down is the only
 * thing on this page that claims to be the product itself.
 */
const ARMATURE = {
  source:
    "Our new pricing is simpler — three plans, and we dropped the per-seat math.",
  junction: ["Brand voice", "Audience", "Strategy"],
  channels: [
    {
      channel: "LinkedIn",
      form: "Post",
      output:
        "We stopped charging per seat. Three plans, one number — because pricing shouldn't punish a team for growing.",
    },
    {
      channel: "Email",
      form: "Subject line",
      output: "Three plans. No per-seat math.",
    },
    {
      channel: "Blog",
      form: "Working title",
      output: "Why we moved off per-seat pricing (and what it cost us)",
    },
    {
      channel: "Instagram",
      form: "Caption",
      output:
        "Per-seat pricing taxed the teams we most wanted to keep. So we stopped.",
    },
  ],
} as const;

const features = [
  {
    number: "01",
    title: "Idea Builder",
    kicker: "From rough thought to ready-to-create, in seconds.",
    desc: "You know what you want to say. You just don't know how to say it. The Idea Builder turns scattered thoughts, rough notes, and half-formed ideas into clear, structured content directions you can actually use.",
    founderLine: "For founders who have the expertise but not the words.",
    icon: Sparkles,
  },
  {
    number: "02",
    title: "Strategy-to-Content Engine",
    kicker: "Set your strategy once. Architecta runs with it.",
    desc: "Define your audience, your offer, and your tone one time. Architecta remembers and applies that context across everything it creates, so your content stops feeling disconnected and starts working as one system.",
    founderLine:
      "For founders tired of reinventing the wheel every content day.",
    icon: Target,
  },
  {
    number: "03",
    title: "Brand Voice Studio",
    kicker: "Sound like you, everywhere, every time.",
    desc: "Your brand voice is not “professional yet approachable.” It's specific. It's yours. Brand Voice Studio learns your phrasing, rhythm, and energy so every piece of content feels consistent and recognizably you.",
    founderLine:
      "For founders who cringe when AI content sounds like a robot wrote it.",
    icon: PenTool,
  },
  {
    number: "04",
    title: "Multi-Platform Generator",
    kicker: "One source, many channels.",
    desc: "Start with one core idea. Architecta adapts it into platform-ready content for LinkedIn, Instagram, email, blogs, ads, and more, with each version shaped for the channel it belongs on.",
    founderLine: "For founders who are everywhere but can't be everywhere.",
    icon: Layers,
  },
  {
    number: "05",
    title: "Smart Editing Tools",
    kicker: "Polish without rewriting.",
    desc: "Make it shorter. Bolder. Friendlier. More confident. Architecta gives you fast variations without losing your original point, so you can refine what matters instead of starting over.",
    founderLine:
      "For leaders who know 'this isn't quite right' but can't pinpoint why.",
    icon: CheckCircle,
  },
  {
    number: "06",
    title: "Content Library",
    kicker: "Your content brain, not your content mess.",
    desc: "Everything you create stays organized and reusable. Search by topic, platform, campaign, or date. Revisit winning ideas, remix old assets, and build long-term content equity instead of starting from zero.",
    founderLine: "For businesses building long-term content equity.",
    icon: Folder,
  },
];

const steps = [
  {
    step: "01",
    title: "Teach Architecta your brand",
    punchline: "Dial in your voice once.",
    desc: "Tell Architecta who you are, who you serve, and how you sound. It learns your brand DNA and applies it to everything going forward.",
  },
  {
    step: "02",
    title: "Create content your way",
    punchline: "Create exactly how you want to work.",
    desc: "Start from scratch, generate strategically, or go multi-platform. Mix, match, and move as fast as you need.",
  },
  {
    step: "03",
    title: "Refine and publish",
    punchline: "Polish it. Save it. Ship it.",
    desc: "Edit the tone, refine the message, and keep what works. Publish when you're ready. No friction, no robotic output.",
  },
];

const comparisonRows = [
  {
    label: "Planning-to-publishing speed",
    architecta: "Minutes with guided structure",
    oldWay: "Hours across disconnected tools",
  },
  {
    label: "Brand voice consistency",
    architecta: "Unified voice profile and reusable standards",
    oldWay: "Inconsistent writing across contributors",
  },
  {
    label: "Channel adaptation",
    architecta: "Built-in multi-platform output",
    oldWay: "Manual rewrites for every channel",
  },
  {
    label: "Founder workload",
    architecta: "Reduced cognitive load and clean workflows",
    oldWay: "Constant context switching and bottlenecks",
  },
];

const faqs = [
  {
    value: "faq-1",
    question: "Can Architecta actually match my brand voice?",
    answer:
      "Yes. Architecta learns from your positioning and preferred tone, then applies that context across content types so messaging stays consistent.",
  },
  {
    value: "faq-2",
    question: "Is this only for social posts?",
    answer:
      "No. Architecta supports broader marketing workflows, including launch messaging, campaign copy, long-form drafts, and channel-specific adaptations.",
  },
  {
    value: "faq-3",
    question: "Will I still need to edit outputs?",
    answer:
      "You keep full editorial control. Architecta accelerates drafting and structure, while your final review ensures every piece meets your standards.",
  },
  {
    value: "faq-4",
    question: "Who gets the most value from Architecta?",
    answer:
      "Founder-led teams and lean operators who need premium marketing output without adding expensive agency or in-house overhead.",
  },
  {
    value: "faq-5",
    question: "Is Architecta just another ChatGPT wrapper?",
    answer:
      "No. Architecta isn't a chat window where you type a prompt and hope for the best. It's a structured content studio with dedicated tools for ideation, brand voice, multi-platform creation, editing, and organization. The AI is the engine under the hood, not the entire product.",
  },
  {
    value: "faq-6",
    question: "Do I need to be good at writing to use Architecta?",
    answer:
      "Not even a little bit. Architecta is built specifically for people who aren't writers but need to create professional, on-brand content consistently. The Idea Builder helps you get started, the Brand Voice Studio makes sure it sounds like you, and Smart Editing lets you polish without rewriting.",
  },
  {
    value: "faq-7",
    question: "How is this different from Jasper, Copy.ai, or Blaze?",
    answer:
      "Those tools are excellent for marketers. They assume you already know what you want to create, what platform you're targeting, and what your brand voice sounds like. Architecta starts further upstream. It helps you define your strategy, build your voice, and then creates the content to match. It's the difference between a power tool and a workshop.",
  },
  {
    value: "faq-8",
    question: "Will my content sound robotic or generic?",
    answer:
      "That's the whole point of the Brand Voice Studio. You teach Architecta your voice, your specific phrases, your energy, your tone, and it applies that voice to everything. The result is content that sounds like you wrote it on a good day, not like a robot summarized a marketing textbook.",
  },
];

/**
 * /architecta — the second secondary page on the flow system Prospra
 * established, art-directed for what Architecta actually does.
 *
 * Shared with Prospra: the continuous field, the reveal primitives, the
 * section rhythm, the actions, the accent grammar, the no-fake-UI rule.
 * Not shared: the motif, the composition, or the section order. Prospra
 * is a conversation, so its page is a vertical thread and a warm paper
 * interlude. Architecta is a structure, so this page is drawn line work
 * that assembles, a plan rule that runs across a sequence, and a
 * specification schedule where the old page had six identical boxes —
 * and it never leaves the dark field, because it has no founder letter
 * to justify the temperature change.
 *
 * Name, role, status and screenshot come from the ecosystem registry.
 * The CTA does NOT come from getPrimaryCta(): that helper tracks
 * PROSPRA's launch state, and Architecta is still in development, so it
 * would send this page's readers to a sign-up that doesn't exist for
 * this product the day Prospra goes live.
 */
export default function ArchitectaPage() {
  const architecta = getProduct("architecta");
  const statusLabel = PRODUCT_STATUS_LABELS[architecta.status];
  const lit = isLitStatus(architecta.status);
  const shot = architecta.screenshot;
  const siblings = PRODUCTS.filter(
    (p) => p.slug !== "architecta" && p.tier === "core",
  );

  return (
    <FlowCanvas>
      {/* Without JS the IntersectionObserver never attaches and the
          reveal CSS would leave the page blank. Hand those readers the
          finished state. */}
      <noscript>
        <style>{`[data-flow-reveal],[data-flow-reveal-group]>*{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section
        aria-labelledby="architecta-hero-heading"
        className="relative overflow-hidden px-6 pb-20 pt-[calc(var(--header-height)+80px)] sm:px-10 sm:pb-28 lg:px-16 lg:pt-[calc(var(--header-height)+112px)]"
      >
        {/* the founder's light, where the founder's idea enters */}
        <Glow
          tone="human"
          className="hero-light-drift left-[-18%] top-[-4%] h-[520px] w-[520px]"
          opacity={0.75}
        />
        {/* the product's own light, gathered under the branches and
            spilling past the hero's bottom edge so the first boundary
            never resolves into a line */}
        <Glow
          tone="intelligence"
          className="right-[-12%] top-[38%] h-[760px] w-[760px]"
          opacity={0.9}
        />

        {/* The headline takes the full measure so it breaks where the
            sentence does; the evidence for it sits underneath, beside
            the lede, rather than opposite a squeezed column. */}
        <div className="relative mx-auto w-full max-w-6xl">
          <Reveal distance={14}>
            <p className="type-kicker mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-white/55">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={
                    lit
                      ? "h-1.5 w-1.5 rounded-full bg-intelligence shadow-[0_0_8px_rgba(0,212,255,0.8)]"
                      : "h-1.5 w-1.5 rounded-full border border-white/45"
                  }
                />
                {architecta.name}
              </span>
              <span aria-hidden="true" className="text-white/25">
                /
              </span>
              <span>{architecta.role}</span>
              <span aria-hidden="true" className="text-white/25">
                /
              </span>
              <span>{statusLabel}</span>
            </p>
          </Reveal>

          <h1
            id="architecta-hero-heading"
            className="type-display-lg max-w-[20ch] text-balance"
          >
            Stop guessing your content. Start engineering it.
          </h1>

          <div className="mt-14 grid items-start gap-16 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] xl:gap-20">
            <div>
              <Reveal>
                <p className="type-lede max-w-lg text-white/70">
                  Architecta turns your ideas into structured, platform-ready
                  content without the chaos, rewrites, or wasted hours.
                </p>
              </Reveal>

              <Reveal>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <PrimaryAction href="/waitlist">
                    Get early access
                  </PrimaryAction>
                  <SecondaryAction href="#how-it-works">
                    See how it works
                  </SecondaryAction>
                </div>
              </Reveal>
            </div>

            <Armature
              source={ARMATURE.source}
              junction={ARMATURE.junction}
              channels={ARMATURE.channels}
            />
          </div>
        </div>
      </section>

      {/* ── The problem ──────────────────────────────────────────── */}
      {/* The old page ran this as a four-paragraph wall against an empty
          right half. Split, the heading holds the left while the reader
          works down the argument. */}
      <FlowSection
        id="the-problem"
        layout="split"
        eyebrow="Sound familiar?"
        title="You didn't start a business to become a content manager."
      >
        <div>
          <RevealGroup className="max-w-xl space-y-5 text-lg leading-8 text-white/65">
            <p>
              You know you need to post. You know you need emails, blogs, social
              content, ad copy, all of it. But you&apos;re one person running an
              entire business.
            </p>
            <p>
              So the content either doesn&apos;t get done, or it eats your
              entire week. You&apos;re staring at blank screens, rewriting the
              same idea four different ways for four different platforms, and
              toggling between tabs like it&apos;s a competitive sport.
            </p>
            <p>
              Meanwhile, the AI tools that were supposed to help spit out
              generic copy that sounds nothing like you and still needs an hour
              of editing.
            </p>
          </RevealGroup>

          <Reveal>
            <p className="type-display-sm mt-14 max-w-[24ch] text-balance text-white/85">
              You don&apos;t need another AI writing app. You need a system.
            </p>
          </Reveal>
        </div>
      </FlowSection>

      {/* ── The thesis ───────────────────────────────────────────── */}
      {/* The line the whole product is built on, promoted out of the
          paragraph it used to be buried in. The glow is centred ON the
          boundary above, so the seam has light spilling across it. */}
      <div className="relative">
        <Glow
          tone="atmosphere"
          className="left-1/2 top-[-14%] h-[680px] w-[min(96vw,1000px)] -translate-x-1/2"
          opacity={0.8}
        />
        <FlowSection
          id="thesis"
          align="center"
          size="lg"
          eyebrow="Meet Architecta"
          title="Content isn't chaos. It's architecture."
          lede="Not another AI marketing app. A real content system."
        >
          <RevealGroup className="mx-auto max-w-2xl space-y-5 text-center text-lg leading-8 text-white/65">
            <p>
              Architecta is a content studio, not a chatbot with a text box. You
              tell it who you are, who you serve, and how you want to sound
              once. Then Architecta creates, adapts, and organizes your content
              across every platform: blogs, emails, social posts, ads, and
              landing pages.
            </p>
            <p>
              Think of it as the content department you can&apos;t afford to
              hire, built into one intelligent tool.
            </p>
          </RevealGroup>
        </FlowSection>
      </div>

      {/* ── The proof ────────────────────────────────────────────── */}
      {/* The real workspace. Registry-driven: no screenshot, no frame,
          per the no-fake-UI rule. Composed off-axis and cropped by the
          container edge — a plan cut by the sheet edge — rather than
          Prospra's centred frame, and pulled up so a large object lies
          across the boundary above it. */}
      {shot ? (
        <section
          aria-labelledby="architecta-proof-heading"
          className="relative px-6 pb-16 pt-4 sm:px-10 sm:pb-20 lg:px-16 lg:pb-24"
        >
          <Glow
            tone="atmosphere"
            className="right-[-18%] top-[-6%] h-[720px] w-[720px]"
            opacity={0.75}
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
            <div>
              <Reveal distance={14}>
                <p className="type-kicker mb-5 text-white/50">The studio</p>
              </Reveal>
              <h2
                id="architecta-proof-heading"
                className="type-display-md text-balance"
              >
                The plan, before the posts.
              </h2>
              <Reveal>
                <p className="type-lede mt-7 text-white/70">
                  Strategy blueprints on one side, the action queue on the
                  other, and the signals behind both. This is the real
                  Architecta workspace as it stands today — not a mockup, and
                  not finished either.
                </p>
              </Reveal>
            </div>

            {/* The capture carries the browser's own scrollbar and a
                dock icon along its bottom edge; `ratio` trims the frame
                back to the product UI. */}
            <Reveal distance={34}>
              <ProductShot
                src={shot.src}
                alt={shot.alt}
                width={1200}
                height={788}
                sizes="(min-width: 1024px) 60vw, 92vw"
                ratio="1200 / 700"
                caption={`${architecta.name} — strategic intelligence, ${statusLabel.toLowerCase()}`}
              />
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ── The schedule ─────────────────────────────────────────── */}
      {/* Six near-identical glass boxes on the old page. A drawing set
          doesn't box its schedule — it rules it, numbers it, and lets
          the type do the work. */}
      <FlowSection
        id="features"
        eyebrow="What's inside"
        title="Six features. Zero guesswork."
        lede="Every part of Architecta does one job, and they all read from the same brand profile — so the studio behaves like one system instead of six tools."
      >
        <RevealGroup
          as="ol"
          className="divide-y divide-white/[0.08] border-y border-white/[0.08]"
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <li
                key={feature.title}
                className="grid gap-x-10 gap-y-4 py-9 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-11"
              >
                <div className="flex gap-5">
                  <span className="type-label mt-1.5 shrink-0 text-white/35">
                    {feature.number}
                  </span>
                  <div className="min-w-0">
                    <h3 className="type-display-sm text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-2.5 flex items-start gap-2.5 leading-7 text-intelligence/85">
                      <Icon
                        className="mt-1.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      {feature.kicker}
                    </p>
                  </div>
                </div>

                <div className="lg:pt-1.5">
                  <p className="max-w-xl leading-7 text-white/65">
                    {feature.desc}
                  </p>
                  {/* the founder's line gets the founder's accent */}
                  <p className="mt-4 border-l-2 border-human/45 pl-4 text-[0.9375rem] leading-6 text-white/50">
                    {feature.founderLine}
                  </p>
                </div>
              </li>
            );
          })}
        </RevealGroup>
      </FlowSection>

      {/* ── How it works ─────────────────────────────────────────── */}
      {/* The armature's line work again, this time running ACROSS a
          three-stage sequence. The rule draws itself as the reader
          arrives — scroll-driven in CSS, no listener. */}
      <FlowSection
        id="how-it-works"
        eyebrow="Three steps. That's it."
        title="From idea to published. In one flow."
      >
        <div className="relative mt-2">
          <span
            aria-hidden="true"
            className="plan-rule absolute left-0 right-0 top-[7px] hidden h-px lg:block"
          >
            <span className="plan-rule__trace block h-px w-full" />
          </span>

          <RevealGroup
            as="ol"
            distance={18}
            className="grid gap-14 lg:grid-cols-3 lg:gap-12"
          >
            {steps.map((step) => (
              <li key={step.step} className="relative lg:pr-10 lg:pt-10">
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-[3px] hidden h-[9px] w-[9px] rotate-45 border border-intelligence/70 bg-void-900 lg:block"
                />
                <p className="type-label text-white/40">Step {step.step}</p>
                <h3 className="type-display-sm mt-5 text-white">
                  {step.title}
                </h3>
                <p className="mt-3 font-medium leading-7 text-intelligence/85">
                  {step.punchline}
                </p>
                <p className="mt-3 leading-7 text-white/65">{step.desc}</p>
              </li>
            ))}
          </RevealGroup>
        </div>
      </FlowSection>

      {/* ── The comparison ───────────────────────────────────────── */}
      {/* Was a bordered table box. Now an axis with the old way
          receding on one side and Architecta lit on the other. */}
      <div className="relative">
        <Glow
          tone="intelligence"
          className="right-[-16%] top-[-8%] h-[820px] w-[820px]"
          opacity={0.85}
        />
        <FlowSection
          id="why-architecta"
          eyebrow="Why Architecta"
          title="Built for founders who market everything — without a marketing department."
          lede="Most AI content tools assume you already have a marketing system. Architecta is built for the founder who is the system, giving you structure, clarity, and ready-to-publish output without the usual chaos."
        >
          <div className="relative">
            {/* the axis the two columns are measured against */}
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-1/2 hidden w-px bg-gradient-to-b from-transparent via-white/[0.14] to-transparent md:block"
            />

            {/* Column captions once, at the top, where the columns exist.
              Below md the columns stack, so each value carries its own
              caption instead. */}
            <div
              aria-hidden="true"
              className="mb-9 hidden gap-x-10 md:grid md:grid-cols-2"
            >
              <p className="type-label text-white/30 md:pr-10">The old way</p>
              <p className="type-label text-intelligence/70 md:pl-10">
                With Architecta
              </p>
            </div>

            <RevealGroup as="dl" className="grid gap-y-12">
              {comparisonRows.map((row) => (
                <div key={row.label}>
                  <dt className="type-label mb-4 text-white/40">{row.label}</dt>
                  <dd className="grid gap-x-10 gap-y-5 md:grid-cols-2">
                    <span className="block md:pr-10">
                      <span className="type-label mb-2 block text-white/30 md:hidden">
                        The old way
                      </span>
                      <span className="block leading-7 text-white/45">
                        {row.oldWay}
                      </span>
                    </span>
                    <span className="block md:pl-10">
                      <span className="type-label mb-2 block text-intelligence/70 md:hidden">
                        With Architecta
                      </span>
                      <span className="block font-medium leading-7 text-white">
                        {row.architecta}
                      </span>
                    </span>
                  </dd>
                </div>
              ))}
            </RevealGroup>
          </div>
        </FlowSection>
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <FlowSection
        id="faq"
        layout="split"
        eyebrow="FAQ"
        title="Questions before you start?"
      >
        <Reveal>
          <Accordion type="single" collapsible defaultValue="faq-1">
            {faqs.map((faq) => (
              <AccordionItem
                key={faq.value}
                value={faq.value}
                className="border-b border-white/[0.08]"
              >
                {/* The shared trigger renders no marker of its own, so
                    the affordance has to come from here. */}
                <AccordionTrigger className="gap-6 py-6 text-left text-base font-semibold text-white transition-colors hover:!text-white hover:no-underline [&>svg]:transition-transform [&>svg]:duration-300">
                  {faq.question}
                  <ChevronDown
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-white/45"
                  />
                </AccordionTrigger>
                <AccordionContent className="pb-7 pr-8 text-base leading-7 text-white/65">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </FlowSection>

      {/* ── The ecosystem ────────────────────────────────────────── */}
      {/* Was three hand-written cards duplicating registry copy. Now
          the registry itself, ruled rather than boxed. */}
      <FlowSection
        id="ecosystem"
        eyebrow="The ecosystem"
        title="Part of the Entrepreneuria AI business suite."
        lede="Architecta works alongside the rest of the suite, so your business runs on one set of tools instead of ten."
      >
        <RevealGroup
          as="ul"
          className="divide-y divide-white/[0.08] border-y border-white/[0.08]"
        >
          {siblings.map((product) => (
            <li key={product.slug}>
              <Link
                href={product.link.href}
                className="group grid gap-x-10 gap-y-2 py-7 transition-colors hover:text-white sm:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"
              >
                <div className="flex items-baseline gap-3">
                  <h3 className="type-display-xs text-white">{product.name}</h3>
                  <span className="type-label text-white/35">
                    {product.role}
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
                  <p className="max-w-xl flex-1 leading-7 text-white/60 transition-colors group-hover:text-white/80">
                    {product.tagline}
                  </p>
                  <span className="type-label inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-white/35">
                    {PRODUCT_STATUS_LABELS[product.status]}
                    <ArrowRight
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-white/25 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white/60"
                    />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </RevealGroup>
      </FlowSection>

      {/* ── The close ────────────────────────────────────────────── */}
      {/* No box. The page opens out, the founder's light comes back,
          and the field runs on into the footer. */}
      <section
        aria-labelledby="architecta-close-heading"
        className="relative overflow-hidden px-6 pb-36 pt-8 text-center sm:px-10 sm:pb-44 lg:px-16"
      >
        <Glow
          tone="human"
          className="left-1/2 top-[4%] h-[560px] w-[min(94vw,800px)] -translate-x-1/2"
          opacity={0.75}
        />
        <div className="relative mx-auto max-w-3xl">
          <Reveal distance={14}>
            <p className="type-kicker mb-6 text-white/50">Begin</p>
          </Reveal>
          <h2
            id="architecta-close-heading"
            className="type-display-lg text-balance"
          >
            Your content strategy starts here.
          </h2>
          <Reveal>
            <p className="type-lede mx-auto mt-7 max-w-xl text-white/70">
              You&apos;ve been the founder, the marketer, and the content
              creator long enough. It&apos;s time to build the system that does
              the heavy lifting so you can get back to building the business.
            </p>
          </Reveal>
          <Reveal>
            <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <PrimaryAction href="/waitlist">
                Get early access to Architecta
              </PrimaryAction>
              <SecondaryAction href="/contact">
                Book a walkthrough
              </SecondaryAction>
            </div>
          </Reveal>
          <Reveal>
            <p className="type-caption mt-8 text-white/40">
              No agency retainers. No heavy onboarding. Just focused output.
            </p>
          </Reveal>
        </div>
      </section>
    </FlowCanvas>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "@/components/transition/TransitionLink";
import { getPrimaryCta, PROSPRA_LAUNCH_STATE } from "@/lib/launch";
import {
  PRODUCT_STATUS_LABELS,
  getProduct,
  isLitStatus,
} from "@/lib/ecosystem/products";
import {
  LADDER_HEIGHT,
  PUBLISHED_PLANS,
  SHARED_VALUE,
  getPlanProducts,
  type Plan,
} from "@/lib/pricing/plans";
import { FlowCanvas, Glow } from "@/components/marketing/flow/atmosphere";
import { FlowSection } from "@/components/marketing/flow/FlowSection";
import { Reveal, RevealGroup } from "@/components/marketing/flow/Reveal";
import {
  PrimaryAction,
  SecondaryAction,
} from "@/components/marketing/flow/cta";
import { PlanComparison } from "@/components/marketing/pricing/PlanComparison";
import { Rungs } from "@/components/marketing/pricing/Rungs";

export const metadata: Metadata = {
  title: "Pricing | Entrepreneuria",
  description:
    "One account, the whole Entrepreneuria ecosystem — Prospra, Architecta, Directorium, and Synceri. Start free, move up a rung when the business asks for it.",
  alternates: { canonical: "https://entrepreneuria.io/pricing" },
};

/**
 * /pricing — rebuilt on the flow system.
 *
 * Two things this page refuses to do, both of which the old one did:
 *
 * 1. Sell what does not exist yet. Three of the four apps are
 *    `in-development` in the ecosystem registry, so every claim that
 *    depends on them is marked — on the cards and in the comparison —
 *    rather than presented as something you can use this afternoon.
 *
 * 2. Hard-code its own CTA. The rest of the site routes primary actions
 *    through `getPrimaryCta()`; pricing pointed at /sign-up regardless
 *    of launch state, which meant "Start free" while signups were shut.
 *    It now follows the same switch as every other page.
 *
 * There is no payment processor, checkout, or entitlement store in this
 * repository. Prices here are positioning, not a billing integration.
 */

const SIGNUPS_OPEN =
  PROSPRA_LAUNCH_STATE === "live" || PROSPRA_LAUNCH_STATE === "early_access";

/** Tailwind needs whole class names, so the ladder's widths are a map. */
const LADDER_GRID: Record<number, string> = {
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
};

/** "A, B, and C" — Oxford comma, because the brand writes in sentences. */
function formatList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function PlanCard({
  plan,
  cta,
  wideOnTablet = false,
}: {
  plan: Plan;
  cta: { label: string; href: string };
  /** Spans the two-column tablet grid, so an odd ladder has no orphan. */
  wideOnTablet?: boolean;
}) {
  const recommended = Boolean(plan.recommended);
  const action = SIGNUPS_OPEN
    ? { label: plan.ctaLabel, href: `/sign-up?plan=${plan.id}` }
    : cta;

  return (
    <article
      className={`flow-panel relative flex h-full flex-col rounded-2xl border p-7 sm:p-8 ${
        wideOnTablet ? "sm:col-span-2 lg:col-span-1" : ""
      } ${
        recommended
          ? "border-intelligence/30 bg-white/[0.045]"
          : "border-white/[0.09] bg-white/[0.02] hover:border-white/20"
      }`}
    >
      {/* The capability rule: the card's own rung, drawn across its top
          edge. The recommended plan is not given a second bright line on
          top of it — surface, border, and the badge already say it. */}
      <Rungs step={plan.step} of={LADDER_HEIGHT} />

      <div className="mt-6 flex items-start justify-between gap-4">
        <h3 className="type-display-sm text-white">{plan.name}</h3>
        {recommended ? (
          <span className="type-label shrink-0 rounded-full border border-intelligence/30 px-3 py-1 text-intelligence">
            Recommended
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-sm leading-6 text-white/55 sm:min-h-12">
        {plan.positioning}
      </p>

      {/* "$0" rather than the word "Free", which the plan name already
          says — a price column should read as a price at a glance. */}
      <p className="mt-7 flex items-baseline gap-1.5">
        <span className="type-display-md text-white">${plan.price}</span>
        <span className="type-label text-white/40">/ month</span>
      </p>

      <p className="mt-6 border-t border-white/[0.09] pt-6 leading-7 text-white/70">
        {plan.bestFor}
      </p>

      <p className="type-label mt-8 text-white/40">{plan.featuresLabel}</p>

      <ul className="mt-5 space-y-3.5">
        {plan.features.map((feature) => (
          <li
            key={feature.text}
            className="flex items-start gap-3 text-sm leading-6 text-white/70"
          >
            <span
              aria-hidden="true"
              className={`mt-[9px] h-1 w-1 shrink-0 rounded-full ${
                recommended ? "bg-intelligence" : "bg-white/35"
              }`}
            />
            <span>
              {feature.text}
              {/* Marked in words, never by colour alone. */}
              {feature.pending ? (
                <span className="type-label ml-2 whitespace-nowrap text-white/35">
                  On release
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-10 pt-2 sm:mt-auto sm:pt-10">
        {recommended ? (
          <PrimaryAction href={action.href} className="w-full">
            {action.label}
          </PrimaryAction>
        ) : (
          <SecondaryAction href={action.href} className="w-full">
            {action.label}
          </SecondaryAction>
        )}
      </div>
    </article>
  );
}

/**
 * Pricing FAQ.
 *
 * Every answer here is checkable against this repository: the ecosystem
 * registry for what exists, `lib/launch.ts` for whether signups are
 * open, /terms for billing terms, /privacy for data rights. Anything
 * that would require a policy this repo does not state — proration,
 * refunds, annual discounts — is answered by saying where it will be
 * stated, not by inventing it.
 */
const FAQS: readonly { q: string; a: ReactNode }[] = [
  {
    q: "What can I actually use today?",
    a: (
      <>
        Prospra, your AI business mentor, is the app that is launching.
        Architecta, Directorium, and Synceri are in development. The plans
        describe the whole ecosystem because your plan covers the whole
        ecosystem — but anything marked{" "}
        <span className="text-white/85">On release</span> is a commitment, not
        something you can open this afternoon. We would rather tell you that
        here than have you find out after paying.
      </>
    ),
  },
  {
    q: "Can I start without paying?",
    a: "Yes. The Free rung needs no card and does not expire. It is not a trial with a countdown on it — it is a real rung you can stay on for as long as it does the job.",
  },
  {
    q: "Do I pay more when the other apps ship?",
    a: "No. Each app unlocks inside the plan you are already on, at that plan's depth, at no extra cost. Joining early costs you nothing and gets you the whole suite as it lands.",
  },
  {
    q: "Can I move between plans later?",
    a: "Yes, in both directions. The ladder exists so the price can follow the business — up when the work grows, and back down when it does not. Nothing here is an annual contract.",
  },
  {
    q: "Is there annual billing or a yearly discount?",
    a: "Not today. Pricing is monthly, in US dollars. If annual billing arrives, the real saving will be shown next to the real price — we are not going to print a discount that does not exist.",
  },
  {
    q: "When does billing actually start?",
    a: (
      <>
        Nothing is charged while signups are still opening. Full billing terms —
        renewal, cancellation, and refunds — are disclosed at the point of
        purchase and set out in the{" "}
        <Link
          href="/terms"
          className="text-white underline-offset-4 hover:underline"
        >
          Terms
        </Link>
        .
      </>
    ),
  },
  {
    q: "What happens to my work if I move down a rung?",
    a: (
      <>
        Your work stays yours. You keep the right to access, correct, export, or
        delete what you have put into the platform at any tier — see the{" "}
        <Link
          href="/privacy"
          className="text-white underline-offset-4 hover:underline"
        >
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link
          href="/data-deletion"
          className="text-white underline-offset-4 hover:underline"
        >
          data deletion
        </Link>
        . Dropping a rung narrows what you can run, never what you own.
      </>
    ),
  },
  {
    q: "Which rung should I pick?",
    a: "If you are still deciding what the business is, Free. If you are running it day to day and want the suite working together, Growth. If you want the full boardroom and no ceilings on automation, Pro.",
  },
  {
    q: "Is there a custom or enterprise plan?",
    a: (
      <>
        Entrepreneuria is built for founders and small teams, so there is no
        enterprise tier. If your situation genuinely does not fit the ladder,{" "}
        <Link
          href="/contact"
          className="text-white underline-offset-4 hover:underline"
        >
          talk to us
        </Link>{" "}
        rather than forcing it.
      </>
    ),
  },
];

export default function PricingPage() {
  const cta = getPrimaryCta();
  const prospra = getProduct("prospra");
  const planProducts = getPlanProducts();
  // Registry-derived, so this sentence can never name a product that
  // shipped last month or miss one that was just added.
  const upcoming = formatList(
    planProducts
      .filter((p) => p.slug !== prospra.slug && !isLitStatus(p.status))
      .map((p) => p.name),
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
        aria-labelledby="pricing-hero-heading"
        className="relative overflow-hidden px-6 pb-12 pt-[calc(var(--header-height)+56px)] sm:px-10 sm:pb-14 lg:px-16 lg:pt-[calc(var(--header-height)+76px)]"
      >
        <Glow
          tone="human"
          className="hero-light-drift left-[-14%] top-[-6%] h-[480px] w-[480px]"
          opacity={0.7}
        />
        <Glow
          tone="intelligence"
          className="right-[-16%] top-[30%] h-[720px] w-[720px]"
          opacity={0.8}
        />

        <div className="relative mx-auto w-full max-w-6xl">
          <Reveal distance={14}>
            <p className="type-kicker mb-6 text-white/50">Pricing</p>
          </Reveal>

          <h1
            id="pricing-hero-heading"
            className="type-display-md max-w-[17ch] text-balance"
          >
            Build the business. Pick the horsepower.
          </h1>

          <div className="mt-9 grid items-end gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16">
            <Reveal>
              <p className="type-lede max-w-xl text-white/70">
                One account opens the whole ecosystem. Start free while the idea
                is still an idea, and move up a rung when the business asks for
                more intelligence, more automation, and more room.
              </p>
            </Reveal>

            {/* The billing facts, stated plainly instead of a toggle the
                product cannot honour yet. */}
            <Reveal>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-white/[0.09] pt-6 sm:grid-cols-3 lg:border-t-0 lg:pt-0">
                <div>
                  <dt className="type-label text-white/40">Billing</dt>
                  <dd className="mt-1.5 text-sm text-white/75">Monthly, USD</dd>
                </div>
                <div>
                  <dt className="type-label text-white/40">To start</dt>
                  <dd className="mt-1.5 text-sm text-white/75">No card</dd>
                </div>
                <div>
                  <dt className="type-label text-white/40">Apps</dt>
                  <dd className="mt-1.5 text-sm text-white/75">
                    {planProducts.length} in the suite
                  </dd>
                </div>
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── The ladder ───────────────────────────────────────────── */}
      {/* Its own section rather than a FlowSection: the ladder sits
          close under the hero on purpose, so the price is in the first
          viewport on a laptop instead of a scroll away. */}
      <section
        id="plans"
        aria-labelledby="plans-heading"
        className="relative px-6 pb-12 pt-0 sm:px-10 sm:pb-16 lg:px-16 lg:pb-20"
      >
        <h2 id="plans-heading" className="sr-only">
          Plans
        </h2>
        <div className="mx-auto w-full max-w-7xl">
          {/* Said once, above the ladder, so no card has to carry it: what
            you are buying today versus what unlocks later. */}
          <Reveal>
            <p className="mx-auto mb-10 max-w-3xl text-balance leading-7 text-white/60 sm:text-center">
              <span className="text-white/85">
                {prospra.name} is{" "}
                {PRODUCT_STATUS_LABELS[prospra.status].toLowerCase()}.
              </span>{" "}
              {upcoming} are in development, and they unlock inside the plan you
              are already on — at no extra cost — the day each one ships.
            </p>
          </Reveal>

          <RevealGroup
            className={`grid items-stretch gap-4 ${
              LADDER_GRID[PUBLISHED_PLANS.length] ?? LADDER_GRID[3]
            }`}
          >
            {PUBLISHED_PLANS.map((plan, i) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                cta={cta}
                // An odd ladder in a two-column tablet grid leaves the last
                // card stranded beside empty space. Widening the first rung
                // instead reads as intended: Free is the floor everyone
                // stands on, and the paid rungs compare against each other.
                wideOnTablet={PUBLISHED_PLANS.length % 2 === 1 && i === 0}
              />
            ))}
          </RevealGroup>

          {!SIGNUPS_OPEN ? (
            <Reveal>
              <p className="type-caption mx-auto mt-8 max-w-2xl text-center text-white/40">
                Plans open for signup when Prospra launches. Join the waitlist
                now and choose your rung then — nothing is charged today.
              </p>
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* ── Shared value ─────────────────────────────────────────── */}
      <FlowSection
        id="included"
        layout="split"
        eyebrow="Before it is a tier"
        title="Every plan is the same operating system."
        lede="The rungs change how much of it you can run. They do not change what it is."
      >
        <RevealGroup
          as="ul"
          className="divide-y divide-white/[0.08] border-y border-white/[0.08]"
        >
          {SHARED_VALUE.map((item) => (
            <li key={item.title} className="py-7">
              <h3 className="type-display-xs text-white">{item.title}</h3>
              <p className="mt-2.5 max-w-xl leading-7 text-white/60">
                {item.body}
              </p>
            </li>
          ))}
        </RevealGroup>
      </FlowSection>

      {/* ── Comparison ───────────────────────────────────────────── */}
      <div className="relative">
        <Glow
          tone="atmosphere"
          className="left-1/2 top-0 h-[620px] w-[min(96vw,1000px)] -translate-x-1/2"
          opacity={0.5}
        />
        <FlowSection
          id="compare"
          eyebrow="Line by line"
          title="What actually changes between rungs."
          lede="Grouped by the app it belongs to, with each app's build status stated where the promise is made."
          width="7xl"
        >
          <PlanComparison plans={PUBLISHED_PLANS} />
        </FlowSection>
      </div>

      {/* ── The ecosystem ────────────────────────────────────────── */}
      {/* Registry-driven, so plan copy can never claim a product the
          ecosystem registry does not have. */}
      <FlowSection
        id="ecosystem"
        eyebrow="What a plan opens"
        title="One platform. Several specialised intelligences."
        lede="You are not buying an AI tool. You are buying the system they run inside — and every plan includes all of it, at its own depth."
      >
        <RevealGroup
          as="ul"
          className="divide-y divide-white/[0.08] border-y border-white/[0.08]"
        >
          {planProducts.map((product) => (
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

        <Reveal>
          <p className="type-caption mt-7 text-white/40">
            Channelwright is a standalone product from Entrepreneuria with its
            own pricing, and is not part of these plans.
          </p>
        </Reveal>
      </FlowSection>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <FlowSection
        id="faq"
        layout="split"
        eyebrow="Before you decide"
        title="The questions that come just before the button."
      >
        <Accordion type="single" collapsible defaultValue="faq-0">
          {FAQS.map((faq, i) => (
            <AccordionItem
              key={faq.q}
              value={`faq-${i}`}
              className="border-b border-white/[0.09]"
            >
              <AccordionTrigger className="gap-6 py-6 text-left text-base font-semibold text-white transition-colors hover:!text-white hover:no-underline [&>svg]:transition-transform [&>svg]:duration-300">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="pb-7 pr-8 text-base leading-7 text-white/65">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </FlowSection>

      {/* ── The close ────────────────────────────────────────────── */}
      <section
        aria-labelledby="pricing-close-heading"
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
            id="pricing-close-heading"
            className="type-display-lg text-balance"
          >
            Your business can start small. Your operating system shouldn&apos;t.
          </h2>
          <Reveal>
            <p className="type-lede mx-auto mt-7 max-w-xl text-white/70">
              Take the free rung today. Move up the day the work outgrows it —
              and not one day before.
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

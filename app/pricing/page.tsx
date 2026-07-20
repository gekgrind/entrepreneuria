import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { PillButton, GhostButton } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Pricing | Entrepreneuria",
  description:
    "One flat monthly price for the Entrepreneuria ecosystem — Prospra, Architecta, Directorium, and Synceri. Start free, no card needed.",
};

type PricingTier = {
  tierLabel: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  cta: string;
  href: string;
  badge?: string;
  highlighted?: boolean;
  featuresLabel: string;
  features: {
    text: string;
    dimmed?: boolean;
  }[];
};

const pricingTiers: PricingTier[] = [
  {
    tierLabel: "Tier 01",
    name: "Starter",
    price: "0",
    period: "/mo",
    tagline: "Try the ecosystem.",
    cta: "Start free — no card",
    href: "/sign-up?plan=starter",
    featuresLabel: "What's included",
    features: [
      { text: "Access to all 4 apps, with limited features" },
      { text: "Prospra Basic" },
      { text: "Architecta Basic, including core planning tools" },
      { text: "Directorium Basic, with 1 board member" },
      { text: "Synceri Light, with manual workflows only" },
      { text: "Community access via The Founder's Table" },
      { text: "AI Agent credits", dimmed: true },
      { text: "Automations & integrations", dimmed: true },
    ],
  },
  {
    tierLabel: "Tier 02",
    name: "Growth",
    price: "29",
    period: "/mo",
    tagline: "Build and run your business.",
    cta: "Start growing",
    href: "/sign-up?plan=growth",
    badge: "Most popular",
    highlighted: true,
    featuresLabel: "Everything in Starter, plus:",
    features: [
      { text: "Full Prospra, with unlimited pipeline and outreach" },
      { text: "Full Architecta, with all planning and strategy tools" },
      { text: "Directorium with 3 board members and capped sessions" },
      { text: "Full Synceri, with core automations and integrations" },
      { text: "AI Agent credits included monthly" },
      { text: "Standard integrations and workflows" },
      { text: "Priority email support" },
      { text: "Advanced automations in Synceri Pro", dimmed: true },
    ],
  },
  {
    tierLabel: "Tier 03",
    name: "Pro",
    price: "59",
    period: "/mo",
    tagline: "Run like a funded startup, without the team.",
    cta: "Unlock everything",
    href: "/sign-up?plan=pro",
    badge: "Full stack",
    featuresLabel: "Everything in Growth, plus:",
    features: [
      {
        text: "Full Directorium, with all 6 AI board members and unlimited sessions",
      },
      {
        text: "Advanced Synceri, including complex multi-step automations",
      },
      {
        text: "Premium Architecta, with advanced templates and forecasting",
      },
      { text: "Higher AI Agent limits, with more monthly credits" },
      { text: "Priority performance across all apps" },
      { text: "Early access to new features and beta apps" },
      { text: "Priority support with a dedicated response queue" },
      { text: "Everything unlocked. No caps. No ceilings." },
    ],
  },
];

const appLine = [
  {
    name: "Prospra",
    role: "AI mentor & pipeline",
    desc: "AI-powered prospecting, outreach, and pipeline management for solo founders closing deals without a sales team.",
  },
  {
    name: "Architecta",
    role: "Strategy studio",
    desc: "Business design and strategy studio. Build your offers, map your model, and architect your growth plan.",
  },
  {
    name: "Directorium",
    role: "AI board of directors",
    desc: "Your AI Board of Directors, with six distinct expert AI models advising your business in real time.",
  },
  {
    name: "Synceri",
    role: "Automation hub",
    desc: "Automation and workflow hub. Connect your tools, trigger actions, and run operations hands-free.",
  },
];

const comparisonSections = [
  {
    title: "Prospra",
    rows: [
      ["Basic pipeline & tracking", "✓", "✓", "✓"],
      ["AI outreach tools", "—", "✓", "✓"],
      ["Unlimited contacts & sequences", "—", "✓", "✓"],
    ],
  },
  {
    title: "Architecta",
    rows: [
      ["Core planning tools", "✓", "✓", "✓"],
      ["Full strategy & offer design", "—", "✓", "✓"],
      ["Premium templates & forecasting", "—", "—", "✓"],
    ],
  },
  {
    title: "Directorium",
    rows: [
      ["AI Board Members", "1 member", "3 members", "All 6"],
      ["Board sessions per month", "5", "Capped", "Unlimited"],
      ["Full board access (all 6 AI models)", "—", "—", "✓"],
    ],
  },
  {
    title: "Synceri",
    rows: [
      ["Manual workflows", "✓", "✓", "✓"],
      ["Core automations & integrations", "—", "✓", "✓"],
      ["Advanced multi-step automations", "—", "—", "✓"],
    ],
  },
  {
    title: "Platform",
    rows: [
      ["AI Agent credits", "—", "Monthly allotment", "Higher limits"],
      ["Priority performance", "—", "—", "✓"],
      ["Early beta access", "—", "—", "✓"],
      ["Priority support", "—", "Email", "Priority queue"],
    ],
  },
];

const faqs = [
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Yes. Your plan changes can be adjusted as your needs evolve. The pricing structure is designed to grow with the founder, not trap them in a contract dungeon.",
  },
  {
    q: "What's included in the Starter plan?",
    a: "Starter gives you real access to all four apps in limited form. It is meant to let people experience the ecosystem without turning the plan into a cardboard cutout.",
  },
  {
    q: "Who are the 6 board members in Directorium?",
    a: "Directorium is designed around six specialized AI roles across strategy, growth, operations, finance, risk, and contrarian thinking. Growth opens part of the board. Pro unlocks the full room.",
  },
  {
    q: "What are AI Agent credits used for?",
    a: "Credits power AI-driven actions across the ecosystem, including Directorium sessions, Architecta generation tasks, Synceri automation runs, and AI-powered execution inside the platform.",
  },
  {
    q: "Is there a free trial for Growth or Pro?",
    a: "Starter is your no-card entry point into the ecosystem. Paid plans are there when you want deeper usage, more automation, more board access, and more firepower.",
  },
  {
    q: "What does priority performance mean?",
    a: "Pro users get faster response priority across AI-powered workflows, including Directorium sessions, Synceri triggers, and generation-heavy actions during peak usage.",
  },
];

function FeatureMarker({ dimmed }: { dimmed?: boolean }) {
  if (dimmed) {
    return <span className="mt-0.5 shrink-0 text-sm text-white/25">—</span>;
  }
  return (
    <span
      aria-hidden="true"
      className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00d4ff] shadow-[0_0_8px_rgba(0,212,255,0.6)]"
    />
  );
}

export default function PricingPage() {
  return (
    <PageShell>
      <PageHero
        kicker="Pricing — the complete ecosystem"
        title={
          <>
            One price. <em className="italic">Four</em> powerful apps.
          </>
        }
        lede="Everything you need to launch, build, and scale without the enterprise price tag or the headcount. Simple monthly billing — start free, no card needed."
      />

      <Section kicker="01 — The plans" title="Pick your altitude.">
        <div className="grid gap-5 lg:grid-cols-3">
          {pricingTiers.map((tier) => (
            <article
              key={tier.name}
              className={`relative flex h-full flex-col rounded-2xl border p-7 sm:p-8 ${
                tier.highlighted
                  ? "border-white/30 bg-white/[0.05]"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {tier.badge ? (
                <p className="absolute right-6 top-7 text-[11px] uppercase tracking-[0.2em] text-[#00d4ff] [font-family:var(--font-label)]">
                  {tier.badge}
                </p>
              ) : null}

              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40 [font-family:var(--font-label)]">
                {tier.tierLabel}
              </p>

              <h3 className="mt-2 text-3xl font-medium tracking-tight text-white">
                {tier.name}
              </h3>

              <div className="mt-6 flex items-end gap-1.5">
                <span className="mb-2 text-base text-white/40">$</span>
                <span className="text-6xl font-medium leading-none tracking-tight text-white">
                  {tier.price}
                </span>
                <span className="mb-1.5 text-sm text-white/40">
                  {tier.period}
                </span>
              </div>

              <p className="mt-4 border-b border-white/10 pb-6 italic leading-7 text-white/55">
                “{tier.tagline}”
              </p>

              <div className="mt-6">
                {tier.highlighted ? (
                  <PillButton href={tier.href} className="w-full">
                    {tier.cta}
                  </PillButton>
                ) : (
                  <GhostButton href={tier.href} className="w-full">
                    {tier.cta}
                  </GhostButton>
                )}
              </div>

              <p className="mt-7 text-[11px] uppercase tracking-[0.2em] text-white/40 [font-family:var(--font-label)]">
                {tier.featuresLabel}
              </p>

              <ul className="mt-4 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li
                    key={feature.text}
                    className={`flex items-start gap-3 text-sm leading-6 ${
                      feature.dimmed ? "text-white/35" : "text-white/70"
                    }`}
                  >
                    <FeatureMarker dimmed={feature.dimmed} />
                    <span>{feature.text}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section
        kicker="02 — The stack"
        title={
          <>
            Four apps. <em className="italic">One</em> ecosystem.
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {appLine.map((app) => (
            <article
              key={app.name}
              className="flex h-full flex-col rounded-2xl border border-white/10 p-7"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 [font-family:var(--font-label)]">
                {app.role}
              </p>
              <h3 className="mt-2 text-2xl font-medium tracking-tight text-white">
                {app.name}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-white/60">
                {app.desc}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        id="compare"
        kicker="03 — Plan comparison"
        title="See exactly what you get."
      >
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-left text-[11px] uppercase tracking-[0.2em] text-white/40 [font-family:var(--font-label)]">
                    Feature
                  </th>
                  {["Starter", "Growth", "Pro"].map((plan) => (
                    <th
                      key={plan}
                      className="px-6 py-4 text-center text-[11px] uppercase tracking-[0.2em] text-white [font-family:var(--font-label)]"
                    >
                      {plan}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonSections.map((section) => (
                  <Fragment key={section.title}>
                    <tr className="border-t border-white/10">
                      <td
                        colSpan={4}
                        className="bg-white/[0.03] px-6 py-3 text-left text-[11px] uppercase tracking-[0.2em] text-[#00d4ff] [font-family:var(--font-label)]"
                      >
                        {section.title}
                      </td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr
                        key={`${section.title}-${row[0]}`}
                        className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.02]"
                      >
                        <td className="px-6 py-3.5 font-medium text-white">
                          {row[0]}
                        </td>
                        <td className="px-6 py-3.5 text-center text-white/60">
                          {row[1]}
                        </td>
                        <td className="px-6 py-3.5 text-center text-white/60">
                          {row[2]}
                        </td>
                        <td className="px-6 py-3.5 text-center text-white/60">
                          {row[3]}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section kicker="04 — Questions" title="Founder-first answers.">
        <div className="max-w-3xl">
          <Accordion type="single" collapsible className="space-y-1">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={faq.q}
                value={`faq-${i}`}
                className="border-b border-white/10"
              >
                <AccordionTrigger className="py-5 text-left text-base font-semibold text-white hover:no-underline [&>svg]:text-white/50">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="pb-6 leading-7 text-white/60">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      <Section kicker="05 — The close">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-14 text-center sm:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.25),transparent_65%)]"
          />
          <h2 className="relative text-balance text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
            Your entire business.
            <br />
            One <em className="italic">ecosystem</em>.
          </h2>
          <p className="relative mx-auto mt-5 max-w-2xl leading-7 text-white/60">
            Four AI-powered apps. One flat monthly price. Built for founders
            who are done duct-taping twelve tools together and calling it a
            system.
          </p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <PillButton href="/sign-up?plan=starter">
              Start free — no card needed
            </PillButton>
            <GhostButton href="#compare">See all features</GhostButton>
          </div>
          <p className="relative mt-8 text-sm text-white/40">
            All plans include access to the full Entrepreneuria ecosystem.
          </p>
        </div>
      </Section>
    </PageShell>
  );
}

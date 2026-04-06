"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import PageHeader from "@/components/PageHeader"
import AccentItalic from "@/components/ui/AccentItalic";

type PricingTier = {
  tierLabel: string
  name: string
  price: string
  period: string
  tagline: string
  cta: string
  href: string
  badge?: string
  accent: "starter" | "growth" | "pro"
  featuresLabel: string
  features: {
    text: string
    dimmed?: boolean
  }[]
}

const pricingTiers: PricingTier[] = [
  {
    tierLabel: "Tier 01",
    name: "Starter",
    price: "0",
    period: "/mo",
    tagline: "Try the ecosystem.",
    cta: "Start Free — No Card",
    href: "/signup?plan=starter",
    accent: "starter",
    featuresLabel: "What's Included",
    features: [
      { text: "Access to all 4 apps, with limited features" },
      { text: "Prospra Basic" },
      { text: "Architecta Basic, including core planning tools" },
      { text: "Directorium Basic, with 1 board member" },
      { text: "Synceri Light, with manual workflows only" },
      { text: "Community access via The Founder’s Table" },
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
    cta: "Start Growing",
    href: "/signup?plan=growth",
    badge: "Most Popular",
    accent: "growth",
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
    cta: "Unlock Everything",
    href: "/signup?plan=pro",
    badge: "Full Stack",
    accent: "pro",
    featuresLabel: "Everything in Growth, plus:",
    features: [
      { text: "Full Directorium, with all 6 AI board members and unlimited sessions" },
      { text: "Advanced Synceri, including complex multi-step automations" },
      { text: "Premium Architecta, with advanced templates and forecasting" },
      { text: "Higher AI Agent limits, with more monthly credits" },
      { text: "Priority performance across all apps" },
      { text: "Early access to new features and beta apps" },
      { text: "Priority support with a dedicated response queue" },
      { text: "Everything unlocked. No caps. No ceilings." },
    ],
  },
]

const appCards = [
  {
    icon: "📡",
    name: "Prospra",
    accent: "text-[#00D4FF]",
    desc: "AI-powered prospecting, outreach, and pipeline management for solo founders closing deals without a sales team.",
  },
  {
    icon: "📐",
    name: "Architecta",
    accent: "text-[#ff8a8a]",
    desc: "Business design and strategy studio. Build your offers, map your model, and architect your growth plan.",
  },
  {
    icon: "🏛️",
    name: "Directorium",
    accent: "text-[#FFD166]",
    desc: "Your AI Board of Directors, with six distinct expert AI models advising your business in real time.",
  },
  {
    icon: "⚡",
    name: "Synceri",
    accent: "text-[#b89aff]",
    desc: "Automation and workflow hub. Connect your tools, trigger actions, and run operations hands-free.",
  },
]

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
]

const faqs = [
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Yes. Your plan changes can be adjusted as your needs evolve. The pricing structure is designed to grow with the founder, not trap them in a contract dungeon.",
  },
  {
    q: "What’s included in the Starter plan?",
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
]

function CheckMark() {
  return <span className="mt-0.5 text-sm text-[#00D4FF]">◆</span>
}

function getTierClasses(accent: "starter" | "growth" | "pro") {
  return {
    card: "border-[#00D4FF]/20 bg-[#111827]/90",
    eyebrow: "text-[#00D4FF]",
    price: "text-white",
    button:
      "border border-[#00D4FF]/25 bg-transparent text-[#00D4FF] hover:bg-[#00D4FF]/10",
    badge: "border border-[#00D4FF]/25 bg-[#00D4FF]/10 text-[#00D4FF]",
  }
}

export default function PricingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0A0E1A] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-100"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 top-[-200px] z-0 h-[600px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(0,212,255,0.10)_0%,transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-[10%] left-[-200px] z-0 h-[500px] w-[500px] bg-[radial-gradient(ellipse,rgba(255,107,107,0.07)_0%,transparent_70%)]"
      />

      <section className="relative -mt-[calc(var(--header-height)+1rem)] overflow-hidden">
        <PageHeader
          title=""
          subtitle=""
          videoSrc="/videos/pricing-header.mp4"
          imageSrc="/images/pricing-fallback.jpg"
          textColor="text-transparent"
        />

        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
          <div className="pointer-events-auto mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center rounded-sm border border-[#00D4FF]/20 bg-[#00D4FF]/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00D4FF]">
              The Complete Ecosystem
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
              One Price.
              <br />
              <AccentItalic>Four Powerful Apps.</AccentItalic>
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-white/75 md:text-lg">
              Everything you need to launch, build, and scale without the
              enterprise price tag or the headcount.
            </p>

            <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              <span>Monthly billing</span>
              <span className="rounded-full bg-[#00D4FF] px-4 py-1 text-[#0A0E1A]">
                Annual
              </span>
              <span className="text-[#ff8a8a]">Save 20%</span>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-16">
        <section className="mb-24">
          <div className="grid gap-6 lg:grid-cols-3">
            {pricingTiers.map((tier) => {
              const styles = getTierClasses(tier.accent)

              return (
                <Card
                  key={tier.name}
                  className={`relative overflow-hidden rounded-sm border p-0 text-white transition-transform duration-300 hover:-translate-y-1 ${styles.card}`}
                >
                  <div className="absolute left-0 right-0 top-0 h-[2px] bg-[linear-gradient(90deg,transparent,#00D4FF,transparent)] opacity-50" />

                  {tier.badge ? (
                    <div
                      className={`absolute right-4 top-4 rounded-sm px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${styles.badge}`}
                    >
                      {tier.badge}
                    </div>
                  ) : null}

                  <CardContent className="p-8">
                    <div className={`text-[11px] uppercase tracking-[0.22em] ${styles.eyebrow}`}>
                      {tier.tierLabel}
                    </div>

                    <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.08em] text-white">
                      {tier.name}
                    </h2>

                    <div className="mt-6 flex items-end gap-1">
                      <span className="mb-2 text-base text-white/45">$</span>
                      <span className={`text-6xl font-bold leading-none ${styles.price}`}>
                        {tier.price}
                      </span>
                      <span className="mb-2 text-xs uppercase tracking-[0.08em] text-white/45">
                        {tier.period}
                      </span>
                    </div>

                    <p className="mt-4 border-b border-white/8 pb-6 text-sm italic tracking-[0.03em] text-white/55">
                      “{tier.tagline}”
                    </p>

                    <Button asChild className={`mt-6 w-full rounded-sm ${styles.button}`}>
                      <Link href={tier.href}>{tier.cta}</Link>
                    </Button>

                    <div className="mt-7 text-[11px] uppercase tracking-[0.2em] text-white/45">
                      {tier.featuresLabel}
                    </div>

                    <ul className="mt-4 space-y-3">
                      {tier.features.map((feature) => (
                        <li
                          key={feature.text}
                          className={`flex items-start gap-3 text-sm leading-6 ${
                            feature.dimmed ? "text-white/35" : "text-white/80"
                          }`}
                        >
                          {feature.dimmed ? (
                            <span className="mt-0.5 text-sm text-white/25">—</span>
                          ) : (
                            <CheckMark />
                          )}
                          <span>{feature.text}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="mb-24">
          <div className="mb-10 text-center">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#00D4FF]">
              The Stack
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-[0.08em] text-white md:text-4xl">
              Four Apps. One Ecosystem.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {appCards.map((app) => (
              <Card
                key={app.name}
                className="rounded-sm border border-[#00D4FF]/15 bg-[#111827]/90 text-white"
              >
                <CardContent className="p-6 text-center">
                  <div className="text-3xl">{app.icon}</div>
                  <h3 className={`mt-3 text-xl font-semibold uppercase tracking-[0.1em] ${app.accent}`}>
                    {app.name}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/60">{app.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="compare" className="mb-24">
          <div className="mb-10 text-center">
            <p className="text-[11px] tracking-[0.24em] text-[#00D4FF]">
              Plan Comparison
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-[0.08em] text-white md:text-4xl">
              See Exactly What You Get
            </h2>
          </div>

          <div className="overflow-hidden rounded-sm border border-[#00D4FF]/15 bg-[#0f1724]/90">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#00D4FF]/15">
                    <th className="px-5 py-4 text-left text-xs uppercase tracking-[0.16em] text-white/45">
                      Feature
                    </th>
                    <th className="px-5 py-4 text-center text-sm uppercase tracking-[0.12em] text-[#00D4FF]">
                      Starter
                    </th>
                    <th className="px-5 py-4 text-center text-sm uppercase tracking-[0.12em] text-[#00D4FF]">
                      Growth
                    </th>
                    <th className="px-5 py-4 text-center text-sm uppercase tracking-[0.12em] text-[#00D4FF]">
                      Pro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonSections.map((section) => (
                    <>
                      <tr key={`${section.title}-heading`} className="border-t border-[#00D4FF]/15">
                        <td
                          colSpan={4}
                          className="bg-[#00D4FF]/5 px-5 py-3 text-left text-[11px] uppercase tracking-[0.2em] text-[#00D4FF]"
                        >
                          ◆ {section.title}
                        </td>
                      </tr>

                      {section.rows.map((row) => (
                        <tr
                          key={`${section.title}-${row[0]}`}
                          className="border-b border-white/5 hover:bg-white/[0.02]"
                        >
                          <td className="px-5 py-3 font-medium text-white">{row[0]}</td>
                          <td className="px-5 py-3 text-center text-white/75">{row[1]}</td>
                          <td className="px-5 py-3 text-center text-white/75">{row[2]}</td>
                          <td className="px-5 py-3 text-center text-white/75">{row[3]}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mb-24">
          <div className="mb-10 text-center">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#00D4FF]">
              Questions
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-[0.08em] text-white md:text-4xl">
              Founder-First Answers
            </h2>
          </div>

          <Card className="mx-auto max-w-4xl rounded-sm border border-[#00D4FF]/15 bg-[#111827]/90 text-white">
            <CardContent className="p-6 md:p-8">
              <Accordion type="single" collapsible className="space-y-2">
                {faqs.map((faq, i) => (
                  <AccordionItem
                    key={faq.q}
                    value={`faq-${i}`}
                    className="border-b border-white/8"
                  >
                    <AccordionTrigger className="text-left text-sm font-semibold uppercase tracking-[0.06em] text-white hover:text-[#00D4FF]">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-7 text-white/65">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>

        <section className="relative overflow-hidden rounded-sm border border-[#00D4FF]/15 bg-[linear-gradient(135deg,rgba(0,212,255,0.07)_0%,rgba(255,107,107,0.05)_100%)] px-6 py-14 text-center md:px-10">
          <div className="absolute left-0 right-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#00D4FF,#ff6b6b,transparent)]" />

          <h2 className="text-3xl font-bold tracking-[0.08em] text-white md:text-5xl">
            Your Entire Business.
            <br />
            One Ecosystem.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/65">
            Four AI-powered apps. One flat monthly price. Built for founders who
            are done duct-taping twelve tools together and calling it a system.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              className="rounded-sm bg-[#ff6b6b] px-8 text-white hover:bg-[#ff8585] shadow-[0_4px_24px_rgba(255,107,107,0.35)]"
            >
              <Link href="/signup?plan=starter">Start Free — No Card Needed</Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="rounded-sm border-[#00D4FF]/20 bg-transparent px-8 text-[#00D4FF] hover:bg-[#00D4FF]/10 hover:text-[#00D4FF]"
            >
              <Link href="#compare">See All Features</Link>
            </Button>
          </div>
        </section>

        <p className="mt-10 text-center text-xs tracking-[0.06em] text-white/30">
          All plans include access to the full Entrepreneuria ecosystem.
        </p>
      </div>
    </main>
  )
}
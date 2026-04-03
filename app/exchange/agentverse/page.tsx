"use client"

import { useState } from "react"
import Link from "next/link"
import PageHeader from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  Layers3,
  Rocket,
  ShieldCheck,
  Sparkles,
  Stars,
  Wallet,
  Zap,
} from "lucide-react"

const pricingTiers = [
  {
    name: "Starter",
    label: "Free forever",
    price: "$0",
    cadence: "/month",
    eyebrow: "Start here",
    description:
      "A friction-free way to explore the ecosystem, test the tools, and get traction before you upgrade.",
    icon: <Sparkles className="h-6 w-6 text-[#00D4FF]" />,
    cta: "Get Started Free",
    href: "/waitlist",
    featured: false,
    features: [
      "Limited access to Prospra",
      "Limited Architecta generations",
      "Access to Launchpad resources",
      "Basic saved workspace access",
      "Explore the Entrepreneuria ecosystem",
    ],
  },
  {
    name: "Core",
    label: "Most founders start here",
    price: "$24",
    cadence: "/month",
    eyebrow: "Most popular",
    description:
      "The no-brainer plan for solo founders who want real leverage without assembling a stack of disconnected tools.",
    icon: <Rocket className="h-6 w-6 text-[#00D4FF]" />,
    cta: "Choose Core",
    href: "/waitlist",
    featured: true,
    features: [
      "Full Prospra access",
      "Full Architecta access",
      "Limited Directorium sessions",
      "Saved workspaces and history",
      "Foundational templates and systems",
      "One connected founder workflow",
    ],
  },
  {
    name: "Pro",
    label: "For serious builders",
    price: "$59",
    cadence: "/month",
    eyebrow: "Scale smarter",
    description:
      "Built for founders who want stronger outputs, deeper strategy support, and a business that runs with more consistency.",
    icon: <Crown className="h-6 w-6 text-[#00D4FF]" />,
    cta: "Choose Pro",
    href: "/waitlist",
    featured: false,
    features: [
      "Unlimited Prospra",
      "Advanced Architecta workflows",
      "Full Directorium access",
      "Priority features and releases",
      "Advanced exports and systems",
      "Early access to future apps like Synceri",
    ],
  },
]

const ecosystemCards = [
  {
    icon: <Sparkles className="h-8 w-8 text-[#00D4FF]" />,
    title: "Not just AI tools",
    desc: "Entrepreneuria is built as one founder system, not a random pile of subscriptions pretending to be helpful.",
  },
  {
    icon: <Layers3 className="h-8 w-8 text-[#00D4FF]" />,
    title: "One ecosystem, multiple roles",
    desc: "Mentorship, content, strategy, decision support, and execution all live under one roof.",
  },
  {
    icon: <Wallet className="h-8 w-8 text-[#00D4FF]" />,
    title: "Priced for founder reality",
    desc: "Designed to feel premium, but still make sense for solo founders and small teams building carefully.",
  },
]

const planHighlights = [
  {
    title: "Starter",
    desc: "Get in, explore the platform, test the vibe, and stop doom-scrolling for a perfect stack.",
  },
  {
    title: "Core",
    desc: "For founders who want the full operating layer without overcomplicating the budget.",
  },
  {
    title: "Pro",
    desc: "For builders who want the deepest leverage, strongest support, and the most room to grow.",
  },
]

const comparisonRows = [
  {
    feature: "Prospra access",
    starter: "Limited",
    core: "Full",
    pro: "Unlimited",
  },
  {
    feature: "Architecta access",
    starter: "Limited",
    core: "Full",
    pro: "Advanced",
  },
  {
    feature: "Directorum sessions",
    starter: "—",
    core: "Limited",
    pro: "Full",
  },
  {
    feature: "Saved workspaces",
    starter: "Basic",
    core: "Included",
    pro: "Included",
  },
  {
    feature: "Templates & systems",
    starter: "Select",
    core: "Included",
    pro: "Expanded",
  },
  {
    feature: "Priority access to new features",
    starter: "—",
    core: "—",
    pro: "Included",
  },
  {
    feature: "Early access to future apps",
    starter: "—",
    core: "—",
    pro: "Included",
  },
]

const faqs = [
  {
    q: "Why not charge separately for every app?",
    a: "Because the value is in the ecosystem. Entrepreneuria works best when the tools operate like one connected founder system instead of forcing you to stitch together five separate subscriptions and a mild identity crisis.",
  },
  {
    q: "Will there be annual pricing later?",
    a: "That would make sense, yes. A discounted annual option is a natural next step once the core subscription flow is live and the ecosystem is fully launched.",
  },
  {
    q: "What happens as new apps are released?",
    a: "The plan is for the ecosystem to grow with the platform. Higher tiers should get the earliest and deepest access to new capabilities as additional apps roll out.",
  },
  {
    q: "Is the Free plan actually useful?",
    a: "Yes. It should give founders enough access to understand the value, get momentum, and experience the workflow without slamming into a paywall two clicks in.",
  },
  {
    q: "Who is Pro really for?",
    a: "Pro is for serious builders. The founder who is actively creating, testing, launching, refining, and would rather buy leverage than stay trapped doing everything manually.",
  },
]

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.14),_transparent_32%),linear-gradient(180deg,_#061426_0%,_#081a2f_40%,_#061426_100%)] text-white">
      {/* Hero / Header Video */}
      <section className="relative -mt-[var(--header-height)] h-[90svh] min-h-[720px] w-full overflow-hidden bg-black sm:h-[80svh] lg:h-[86svh]">
        <PageHeader
          title=""
          subtitle=""
          videoSrc="/videos/pricing-header.mp4"
          imageSrc="/images/pricing-fallback.jpg"
        />

        <div className="absolute inset-0 z-10 bg-[#061426]/45" />

        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center px-4 pt-40 pb-24 sm:pt-44 lg:pt-48">
          <div className="pointer-events-auto mx-auto flex w-full max-w-5xl -translate-y-10 flex-col items-center text-center sm:-translate-y-12 lg:-translate-y-16">
            <Badge className="mb-5 border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#00D4FF] backdrop-blur-md">
              Pricing that scales with ambition
            </Badge>

            <h1 className="max-w-5xl text-balance text-4xl font-semibold leading-[1.02] text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.45)] sm:text-5xl md:text-6xl lg:text-7xl">
              One ecosystem.
              <br />
              <span className="italic text-[#00D4FF]">Priced for founders.</span>
            </h1>

            <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/85 sm:text-lg md:text-xl">
              Entrepreneuria is built to replace scattered subscriptions,
              disconnected workflows, and the chaos tax of building alone.
            </p>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/72 sm:text-base md:text-lg">
              Start free. Upgrade when you want deeper leverage. Scale into a
              founder operating system that helps you think, create, decide, and
              execute with less friction and a lot more momentum.
            </p>

            <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="min-w-[220px] rounded-full bg-[#00D4FF] px-7 text-[#061426] hover:bg-[#6FE7FF]"
              >
                <Link href="/waitlist">
                  Start Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-w-[220px] rounded-full border-white/25 bg-white/5 px-7 text-white hover:bg-white/10"
              >
                <Link href="/contact">Talk to Us</Link>
              </Button>
            </div>

            <div className="mt-8 grid w-full max-w-4xl gap-3 text-left sm:grid-cols-3">
              {[
                "Built for solo founders and small teams",
                "One connected system instead of five separate subscriptions",
                "Upgrade as your business and usage grow",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-sm text-white/80 backdrop-blur-md"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#00D4FF]" />
                    <span>{item}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
            Founder-first pricing
          </p>

          <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
            You are not paying for
            <br />
            another tool.
            <br />
            You are paying for <span className="italic text-[#00D4FF]">leverage.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-white/75 sm:text-lg">
            The goal is not to charge you for every shiny feature. The goal is
            to give founders an ecosystem that actually helps move the business
            forward.
          </p>

          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-white/75 sm:text-lg">
            Think less subscription sprawl, more operating system. Less juggling
            tools, more building with intention.
          </p>
        </div>
      </section>

      {/* Why this model */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              Why this model works
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              Premium enough to matter.
              <br />
              Accessible enough to <span className="italic text-[#00D4FF]">start now.</span>
            </h2>

            <p className="mt-6 text-base leading-relaxed text-white/75 sm:text-lg">
              Entrepreneuria is designed to grow with the founder journey, from
              early traction to more serious scale.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {ecosystemCards.map((item) => (
              <Card
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/5 text-white shadow-[0_12px_50px_rgba(0,0,0,0.18)] backdrop-blur-md transition duration-300 hover:border-[#00D4FF]/30 hover:bg-white/7"
              >
                <CardHeader className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/10">
                    {item.icon}
                  </div>
                  <CardTitle className="text-xl font-semibold text-white">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed text-white/72">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              Choose your plan
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              Simple tiers.
              <br />
              Clear value. <span className="italic text-[#00D4FF]">No circus.</span>
            </h2>

            <p className="mt-6 text-base leading-relaxed text-white/75 sm:text-lg">
              Start with what fits now. Upgrade when you want more power, more
              access, and a stronger layer of support around your business.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {pricingTiers.map((tier) => (
              <Card
                key={tier.name}
                className={`relative rounded-[2rem] border text-white shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-md transition duration-300 ${
                  tier.featured
                    ? "border-[#00D4FF]/40 bg-[linear-gradient(180deg,rgba(0,212,255,0.12)_0%,rgba(255,255,255,0.05)_100%)] ring-1 ring-[#00D4FF]/25"
                    : "border-white/10 bg-white/5 hover:border-[#00D4FF]/30 hover:bg-white/7"
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="border border-[#00D4FF]/30 bg-[#00D4FF] px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#061426]">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="space-y-6 p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/10">
                      {tier.icon}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#00D4FF]">
                      {tier.eyebrow}
                    </span>
                  </div>

                  <div>
                    <CardTitle className="text-2xl font-semibold text-white">
                      {tier.name}
                    </CardTitle>
                    <p className="mt-2 text-sm text-white/65">{tier.label}</p>
                  </div>

                  <div className="flex items-end gap-1">
                    <span className="text-5xl font-semibold tracking-tight text-white">
                      {tier.price}
                    </span>
                    <span className="pb-1 text-base text-white/60">
                      {tier.cadence}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-white/72">
                    {tier.description}
                  </p>

                  <Button
                    asChild
                    size="lg"
                    className={
                      tier.featured
                        ? "w-full rounded-full bg-[#00D4FF] px-7 text-[#061426] hover:bg-[#6FE7FF]"
                        : "w-full rounded-full border border-white/20 bg-white/8 px-7 text-white hover:bg-white/12"
                    }
                    variant={tier.featured ? "default" : "outline"}
                  >
                    <Link href={tier.href}>
                      {tier.cta}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </CardHeader>

                <CardContent className="px-8 pb-8 pt-0">
                  <div className="h-px w-full bg-white/10" />
                  <ul className="mt-6 space-y-4">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm text-white/78">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#00D4FF]" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Plan Guidance */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              Which plan is right for you?
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              Pick the level
              <br />
              that matches your <span className="italic text-[#00D4FF]">momentum.</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {planHighlights.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
              >
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#00D4FF]">
                  {item.title}
                </div>
                <p className="mt-4 leading-relaxed text-white/72">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              Compare plans
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              Everything at a glance.
              <br />
              No tiny-print <span className="italic text-[#00D4FF]">nonsense.</span>
            </h2>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md">
            <div className="grid grid-cols-4 border-b border-white/10 bg-white/5">
              <div className="px-5 py-4 text-sm font-semibold text-white/80">Feature</div>
              <div className="px-5 py-4 text-sm font-semibold text-white">Starter</div>
              <div className="px-5 py-4 text-sm font-semibold text-white">Core</div>
              <div className="px-5 py-4 text-sm font-semibold text-white">Pro</div>
            </div>

            {comparisonRows.map((row, index) => (
              <div
                key={row.feature}
                className={`grid grid-cols-4 ${
                  index !== comparisonRows.length - 1 ? "border-b border-white/10" : ""
                }`}
              >
                <div className="px-5 py-4 text-sm text-white/72">{row.feature}</div>
                <div className="px-5 py-4 text-sm text-white/85">{row.starter}</div>
                <div className="px-5 py-4 text-sm text-white/85">{row.core}</div>
                <div className="px-5 py-4 text-sm text-white/85">{row.pro}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Strip */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-[#00D4FF]/15 bg-[linear-gradient(180deg,rgba(0,212,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-8 text-center shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-md sm:p-12">
          <ShieldCheck className="mx-auto h-10 w-10 text-[#00D4FF]" />

          <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
            Built to replace
            <br />
            scattered tools, wasted time,
            <br />
            and founder <span className="italic text-[#00D4FF]">overload.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-white/75 sm:text-lg">
            Entrepreneuria is meant to feel like getting your brain, your
            workflow, and your momentum back. Which, frankly, is a much prettier
            line item than six subscriptions and a recurring sense of chaos.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              Frequently asked questions
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              The pricing questions
              <br />
              founders usually <span className="italic text-[#00D4FF]">ask first.</span>
            </h2>
          </div>

          <div className="mt-12 space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index

              return (
                <div
                  key={faq.q}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base font-semibold text-white sm:text-lg">
                      {faq.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-[#00D4FF]" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-[#00D4FF]" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/10 px-6 pb-6 pt-4 text-white/72">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
            Start building smarter
          </p>

          <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-6xl">
            Start free.
            <br />
            Upgrade when you want
            <br />
            more <span className="italic text-[#00D4FF]">firepower.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-white/75 sm:text-lg">
            Whether you are just getting moving or already building at speed,
            there is a plan designed to meet you where you are and help you go
            further without adding more chaos.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="min-w-[220px] rounded-full bg-[#00D4FF] px-7 text-[#061426] hover:bg-[#6FE7FF]"
            >
              <Link href="/waitlist">
                Start Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-w-[220px] rounded-full border-white/25 bg-white/5 px-7 text-white hover:bg-white/10"
            >
              <Link href="/contact">Talk to Us</Link>
            </Button>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 backdrop-blur-md">
            <Stars className="h-4 w-4 text-[#00D4FF]" />
            Built for founders who are done duct-taping their business together.
          </div>
        </div>
      </section>
    </main>
  )
}
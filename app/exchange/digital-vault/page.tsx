"use client"

import { useState } from "react"
import PageHeader from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FolderKanban,
  Lock,
  Sparkles,
  Layers3,
  Package,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react"
import { Playfair_Display } from "next/font/google"

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
})

const featureCards = [
  {
    icon: FolderKanban,
    title: "Smart asset library",
    description:
      "Everything you create is automatically organized, searchable, and easy to reuse across your business.",
  },
  {
    icon: Sparkles,
    title: "AI memory layer",
    description:
      "Your offers, audience, voice, and strategy stay connected so every tool gets smarter over time.",
  },
  {
    icon: RefreshCcw,
    title: "Version control",
    description:
      "Track changes to offers, content systems, and strategy without losing the work that got you here.",
  },
  {
    icon: Package,
    title: "Product locker",
    description:
      "Turn templates, workbooks, guides, and frameworks into deliverable digital products from one place.",
  },
  {
    icon: ShieldCheck,
    title: "Access control",
    description:
      "Keep assets private, unlock them for customers, and prepare for team permissions as you scale.",
  },
  {
    icon: Database,
    title: "Cross-app sync",
    description:
      "Strategies, content, decisions, and workflows flow into one connected system instead of living in silos.",
  },
]

const faqs = [
  {
    question: "What exactly goes into the Vault?",
    answer:
      "Anything you create inside Entrepreneuria can flow into the Vault, including strategies, offers, content, decision logs, templates, frameworks, and future customer-facing products.",
  },
  {
    question: "Is the Vault just storage?",
    answer:
      "No. The Vault is structured storage with search, memory, access control, and product-readiness built in. It is designed to help your work compound, not just sit there.",
  },
  {
    question: "Will the Vault connect to the other apps?",
    answer:
      "Yes. The long-term value of the Vault is that it becomes the shared memory and asset layer for Prospra, Architecta, Directorium, and Synceri.",
  },
  {
    question: "Can I sell what’s inside the Vault?",
    answer:
      "That is a core part of the vision. The Vault is built to support digital products, gated access, bundles, and founder-owned assets you can package and monetize.",
  },
]

export default function DigitalVaultPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <main className="relative z-0">
      <section className="relative -mt-[var(--header-height)]">
        <PageHeader
          title=""
          subtitle=""
          videoSrc="/videos/digital-vault-header.mp4"
          imageSrc="/images/digital-vault-fallback.jpg"
          textColor="text-transparent"
        />

        <div className="absolute inset-0 z-10 bg-[#061426]/45" />

        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4">
          <div className="pointer-events-auto mx-auto max-w-5xl text-center">
            <Badge className="mb-6 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#00D4FF] backdrop-blur-md">
              The founder’s memory system
            </Badge>

            <h1 className="mx-auto max-w-5xl text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Everything you build.
              <br />
              <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
                Organized. Owned. Monetized.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-white/85 md:text-xl">
              Stop losing your work across tabs, tools, and scattered docs. The Digital Vault turns everything you
              create into structured, reusable business assets.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="min-w-[220px] rounded-full bg-[#00D4FF] px-8 text-base font-semibold text-[#061426] hover:bg-[#67e8f9]"
                onClick={() => scrollToSection("features")}
              >
                See what it does
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="min-w-[220px] rounded-full border-white/20 bg-white/5 px-8 text-base font-semibold text-white hover:bg-white/10"
                onClick={() => scrollToSection("monetize")}
              >
                Explore the product layer
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-white/75">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#00D4FF]" />
                <span>Structured asset storage</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#00D4FF]" />
                <span>Cross-app memory</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#00D4FF]" />
                <span>Product-ready access control</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              Why it matters
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white md:text-4xl lg:text-5xl">
              You’re not disorganized.
              <br />
              <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
                You’re overloaded.
              </span>
            </h2>

            <div className="mt-6 space-y-5 text-base leading-8 text-white/78 md:text-lg">
              <p>
                Ideas in one place. Content in another. Offers buried in docs you forgot existed. Every time you sit
                down to work, you waste momentum trying to find what you already made.
              </p>
              <p>
                The Digital Vault fixes that. It gives Entrepreneuria a memory layer, so your strategies, assets,
                decisions, and products stop drifting and start compounding.
              </p>
            </div>
          </div>

          <Card className="overflow-hidden rounded-[28px] border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <CardContent className="p-8 sm:p-10">
              <div className="grid gap-4">
                {[
                  "Search past strategies instantly",
                  "Reuse content instead of recreating it",
                  "Keep your offers, templates, and systems in one place",
                  "Turn business outputs into monetizable assets",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-white/85"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#00D4FF]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="features" className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              What the Vault does
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white md:text-4xl lg:text-5xl">
              The system that remembers
              <br />
              <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
                everything you build.
              </span>
            </h2>

            <p className="mt-6 text-base leading-8 text-white/78 md:text-lg">
              Not just files. Not just folders. The Vault captures your business as a living system, with structure,
              memory, and leverage built in from day one.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((feature) => {
              const Icon = feature.icon

              return (
                <Card
                  key={feature.title}
                  className="group rounded-[28px] border-white/10 bg-white/5 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07]"
                >
                  <CardContent className="p-8">
                    <div className="mb-5 inline-flex rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/10 p-3 text-[#00D4FF]">
                      <Icon className="h-6 w-6" />
                    </div>

                    <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                    <p className="mt-3 leading-7 text-white/72">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section id="monetize" className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <Card className="rounded-[28px] border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.2)] backdrop-blur-xl">
            <CardContent className="p-8 sm:p-10">
              <div className="space-y-5">
                {[
                  {
                    icon: Package,
                    title: "Templates, guides, and workbooks",
                    body: "Store your best assets where they are ready to package, bundle, and deliver.",
                  },
                  {
                    icon: Lock,
                    title: "Gated access",
                    body: "Control what stays private, what becomes customer-facing, and what unlocks after purchase.",
                  },
                  {
                    icon: Layers3,
                    title: "Reusable IP",
                    body: "Turn one-time work into repeatable systems that keep paying you back.",
                  },
                ].map((item) => {
                  const Icon = item.icon

                  return (
                    <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl bg-[#00D4FF]/10 p-3 text-[#00D4FF]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                          <p className="mt-2 leading-7 text-white/72">{item.body}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              Built to monetize
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white md:text-4xl lg:text-5xl">
              Turn your work into products.
              <br />
              <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
                Without rebuilding everything.
              </span>
            </h2>

            <div className="mt-6 space-y-5 text-base leading-8 text-white/78 md:text-lg">
              <p>
                The Vault is not just where your business lives. It is where your best work becomes leverage.
              </p>
              <p>
                Store templates, frameworks, guides, and strategic assets in a structure designed for packaging,
                gating, and future delivery. That means less digital duct tape and way less
                <span className="text-white"> “where did I put that thing?” </span>
                chaos.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Badge className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/80">
                Product locker
              </Badge>
              <Badge className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/80">
                Controlled access
              </Badge>
              <Badge className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/80">
                Founder-owned IP
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              How it connects
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white md:text-4xl lg:text-5xl">
              One shared brain for
              <br />
              <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
                the entire ecosystem.
              </span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                icon: Sparkles,
                title: "Prospra",
                body: "Strategies, plans, and founder guidance become saved business assets.",
              },
              {
                icon: Layers3,
                title: "Architecta",
                body: "Content systems, messaging, and campaigns stay organized and reusable.",
              },
              {
                icon: Search,
                title: "Directorium",
                body: "Key decisions, model debates, and strategic rationale stay documented.",
              },
              {
                icon: Database,
                title: "Synceri",
                body: "Execution layers, life-admin workflows, and future automations stay connected.",
              },
            ].map((item) => {
              const Icon = item.icon

              return (
                <Card key={item.title} className="rounded-[28px] border-white/10 bg-white/5">
                  <CardContent className="p-8">
                    <div className="mb-5 inline-flex rounded-2xl bg-[#00D4FF]/10 p-3 text-[#00D4FF]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                    <p className="mt-3 leading-7 text-white/72">{item.body}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
            The shift
          </p>

          <h2 className="mt-6 text-3xl font-semibold leading-tight text-white md:text-4xl lg:text-5xl">
            Stop creating things once.
            <br />
            <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
              Start building assets that compound.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-white/78 md:text-lg">
            Most founders do the work, ship the work, and then lose the work. The Vault changes that. Every idea,
            asset, and system becomes part of something cumulative, connected, and easier to monetize over time.
          </p>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">FAQs</p>
            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white md:text-4xl">
              What founders usually ask
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index

              return (
                <Card key={faq.question} className="overflow-hidden rounded-2xl border-white/10 bg-white/5">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-base font-semibold text-white md:text-lg">{faq.question}</span>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-[#00D4FF]" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-[#00D4FF]" />
                    )}
                  </button>

                  {isOpen && (
                    <CardContent className="px-6 pb-6 pt-0">
                      <p className="leading-7 text-white/75">{faq.answer}</p>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section id="final-cta" className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-[32px] border border-white/10 bg-white/5 px-6 py-14 text-center shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
            Final call
          </p>

          <h2 className="mt-6 text-3xl font-semibold leading-tight text-white md:text-4xl lg:text-5xl">
            You’ve already done the work.
            <br />
            <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
              Now make it work for you.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-white/78 md:text-lg">
            The Digital Vault gives your business a memory, a structure, and a path to ownership. Instead of losing
            momentum, you start compounding it.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="min-w-[220px] rounded-full bg-[#00D4FF] px-8 text-base font-semibold text-[#061426] hover:bg-[#67e8f9]"
            >
              Open your Vault
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="min-w-[220px] rounded-full border-white/20 bg-white/5 px-8 text-base font-semibold text-white hover:bg-white/10"
            >
              See how it fits together
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
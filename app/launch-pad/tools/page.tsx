import Link from "next/link"
import PageHeader from "@/components/PageHeader"
import AccentItalic from "@/components/ui/AccentItalic"
import { Badge } from "@/components/ui/badge"

const eyebrowClass =
  "mb-5 inline-flex border border-[#00D4FF]/35 bg-[#00D4FF]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#00D4FF]"

const tools = [
  {
    name: "Business Model Blueprint",
    href: "/launch-pad/tools/business-model-blueprint",
    description:
      "Stop trying to hold your entire business model in your head. This tool walks you through every critical component of your model — revenue streams, value propositions, customer segments, cost structure, and more — and generates a clear, structured output you can use in a deck, a planning doc, or a conversation with investors. Great ideas deserve a solid blueprint.",
  },
  {
    name: "Market Analysis AI",
    href: "/launch-pad/tools/market-analysis-ai",
    description:
      "Before you build, you need to know who you're building for, who you're up against, and whether the market is ready for you. This tool synthesizes competitive landscape data, market sizing, and positioning insights so you can walk into any room knowing your numbers and your narrative.",
  },
  {
    name: "Financial Projector",
    href: "/launch-pad/tools/financial-projector",
    description:
      "Fundraising without a financial model is like navigating without a map. The Financial Projector helps you build realistic, defensible projections — revenue forecasts, burn rate estimates, runway calculations — without needing to be a CFO to understand what you're looking at. Clarity on your numbers changes everything.",
  },
  {
    name: "Customer Persona Builder",
    href: "/launch-pad/tools/customer-persona-builder",
    description:
      "Vague customer assumptions create vague products. This tool helps you build rich, detailed customer personas grounded in real behavioral and psychographic data — so your product decisions, marketing messages, and sales conversations speak to an actual human being, not a demographic statistic.",
  },
  {
    name: "Pitch Deck Creator",
    href: "/launch-pad/tools/pitch-deck-creator",
    description:
      "A great pitch isn't just about slides — it's about story. The Pitch Deck Creator helps you structure a compelling narrative arc, nail your problem/solution framing, and produce slide-ready content that investors actually want to read. Because the best idea in the room still needs to be the best pitch in the room.",
  },
  {
    name: "Hiring Assistant",
    href: "/launch-pad/tools/hiring-assistant",
    description:
      "Every hire is a high-stakes decision, especially in the early stages. The Hiring Assistant helps you write sharper job descriptions, build interview frameworks that actually surface the right candidates, and evaluate fit across the dimensions that matter most for your stage and culture. Hire with intention, not instinct alone.",
  },
]

export default function ToolsPage() {
  return (
    <main className="relative isolate overflow-hidden pb-24 text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00D4FF]/10 via-transparent to-[#4f7ca7]/15" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(79,124,167,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(79,124,167,0.16)_1px,transparent_1px)] bg-[size:40px_40px] opacity-35" />
      </div>

      <section className="relative -mt-[calc(var(--header-height)+1rem)] flex min-h-[78vh] items-center justify-center overflow-hidden sm:min-h-[82vh]">
        <PageHeader
          title=""
          subtitle=""
          videoSrc="/videos/ai-tools-hero.mp4"
          imageSrc="/images/home-fallback.jpg"
        />

        <div className="absolute inset-0 z-20 flex items-center justify-center px-4 sm:px-6">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#00D4FF] sm:text-sm">
              THE LAUNCHPAD - AI TOOLS
            </p>

            <h1 className="mt-6 text-4xl font-bold leading-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
              Stop Planning.
              <br />
              <AccentItalic>Start Building.</AccentItalic>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85 sm:text-xl">
              Six systems built for founders who move fast and think bigger.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mr-auto max-w-2xl text-left">
            <Badge className={eyebrowClass}>SYSTEMS, NOT SHORTCUTS</Badge>

            <h2 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
              The tools that think
              <br />
              <AccentItalic>with you</AccentItalic>
            </h2>

            <p className="mt-6 text-lg leading-relaxed text-white/80">
              You&apos;ve got the idea. You&apos;ve got the drive. What you
              don&apos;t have is a room full of analysts, strategists, and
              specialists telling you what to do next.
            </p>

            <p className="mt-4 text-lg leading-relaxed text-white/80">
              That&apos;s what these tools are for.
            </p>

            <p className="mt-4 text-lg leading-relaxed text-white/80">
              Each AI system in the Entrepreneuria toolkit is purpose-built for
              the specific problems founders face most — from validating a
              business model to building a financial projection to writing a
              pitch that doesn&apos;t put investors to sleep.
            </p>

            <p className="mt-4 text-lg leading-relaxed text-white/80">
              They&apos;re not generic. They&apos;re not gimmicky.
            </p>

            <p className="mt-4 text-lg leading-relaxed text-white/80">
              They&apos;re the kind of intelligent systems that give you real,
              actionable output in the time it used to take just to open a blank
              document.
            </p>

            <p className="mt-4 text-lg leading-relaxed text-white/80">
              No fluff. No filler.
              <br />
              Just sharper thinking, faster.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-8 md:py-12">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-semibold leading-tight text-white md:text-5xl">
            Your Missing Team.
            <br />
            <AccentItalic>Now Built In.</AccentItalic>
          </h2>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-14 md:grid-cols-2">
          {tools.map((tool) => (
            <article
              key={tool.name}
              className="group border-t border-white/10 pt-7 transition hover:border-[#00D4FF]/40"
            >
              <h3 className="text-2xl font-semibold text-white">
                <Link
                  href={tool.href}
                  className="transition hover:text-[#00D4FF]"
                >
                  {tool.name}
                </Link>
              </h3>

              <p className="mt-4 text-base leading-8 text-white/84">
                {tool.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24 pt-12">
        <div className="mx-auto max-w-3xl text-center">
        <div className="inline-block rounded-2xl border border-[#00D4FF]/30 bg-[#00D4FF]/5 px-6 py-5 backdrop-blur-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00D4FF]">
          EXPANDING RAPIDLY
          </p>

            <p className="mt-3 text-lg text-white/80 md:text-xl">
            The toolkit is just getting started.
            <br />
              <span className="text-white">More systems are coming.</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
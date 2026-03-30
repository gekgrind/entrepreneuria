import Link from "next/link"
import PageHeader from "@/components/PageHeader"

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
        <div className="absolute inset-0 bg-gradient-to-br from-[#00D4FF]/10 via-transparent to-[#d27a2c]/12" />
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
              Turn Your Ideas Into Action With Intelligent, Startup-Ready AI
              Systems
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85 sm:text-xl">
              Six powerful tools built for founders who move fast and think
              bigger.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl space-y-6 text-base leading-8 text-white/88 md:text-lg">
          <p>
            You've got the idea. You've got the drive. What you don't always
            have is a room full of analysts, strategists, and specialists
            telling you what to do next. That's what these tools are for. Each
            AI system in the Entrepreneuria toolkit is purpose-built for the
            specific problems founders face most — from validating a business
            model to building a financial projection to writing a pitch that
            doesn't put investors to sleep. They're not generic. They're not
            gimmicky. They're the kind of intelligent systems that give you real,
            actionable output in the time it used to take just to open a blank
            document. No fluff. No filler. Just sharper thinking, faster.
          </p>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold text-white md:text-4xl">
            Intelligent Tools for Modern Entrepreneurs
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/80">
            Explore AI systems built to help you ideate, analyze, and grow
            faster — without needing a team behind you.
          </p>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-14 md:grid-cols-2">
          {tools.map((tool) => (
            <article key={tool.name} className="border-t border-white/20 pt-7">
              <h3 className="text-2xl font-semibold text-[#d27a2c]">
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

      <section className="px-6 pb-24 pt-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-base text-white/60 md:text-lg">
            More tools are in development. The Entrepreneuria toolkit is
            constantly expanding.
          </p>
        </div>
      </section>
    </main>
  )
}
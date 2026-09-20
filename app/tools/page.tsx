import type { Metadata } from "next";
import Link from "@/components/transition/TransitionLink";
import { ArrowRight } from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { ArrowLink, StatusDot } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Free AI Tools for Founders | Entrepreneuria",
  description:
    "Six free AI tools for solo founders — business model blueprint, market analysis, financial projections, customer personas, pitch decks, and hiring. Live today, no account required.",
  alternates: { canonical: "/tools" },
};

const tools = [
  {
    name: "Business Model Blueprint",
    /** The one-line read: what you walk away holding. */
    outcome: "A structured business model you can put in front of anyone.",
    href: "/tools/business-model-blueprint",
    description:
      "Stop trying to hold your entire business model in your head. This tool walks you through every critical component of your model — revenue streams, value propositions, customer segments, cost structure, and more — and generates a clear, structured output you can use in a deck, a planning doc, or a conversation with investors. Great ideas deserve a solid blueprint.",
  },
  {
    name: "Market Analysis AI",
    outcome: "Your market, your competitors, and your position in it.",
    href: "/tools/market-analysis-ai",
    description:
      "Before you build, you need to know who you're building for, who you're up against, and whether the market is ready for you. This tool synthesizes competitive landscape data, market sizing, and positioning insights so you can walk into any room knowing your numbers and your narrative.",
  },
  {
    name: "Financial Projector",
    outcome: "Revenue, burn, and runway you can actually defend.",
    href: "/tools/financial-projector",
    description:
      "Fundraising without a financial model is like navigating without a map. The Financial Projector helps you build realistic, defensible projections — revenue forecasts, burn rate estimates, runway calculations — without needing to be a CFO to understand what you're looking at. Clarity on your numbers changes everything.",
  },
  {
    name: "Customer Persona Builder",
    outcome: "Personas detailed enough to make product decisions with.",
    href: "/tools/customer-persona-builder",
    description:
      "Vague customer assumptions create vague products. This tool helps you build rich, detailed customer personas grounded in real behavioral and psychographic data — so your product decisions, marketing messages, and sales conversations speak to an actual human being, not a demographic statistic.",
  },
  {
    name: "Pitch Deck Creator",
    outcome: "A narrative arc and slide-ready content for investors.",
    href: "/tools/pitch-deck-creator",
    description:
      "A great pitch isn't just about slides — it's about story. The Pitch Deck Creator helps you structure a compelling narrative arc, nail your problem/solution framing, and produce slide-ready content that investors actually want to read. Because the best idea in the room still needs to be the best pitch in the room.",
  },
  {
    name: "Hiring Assistant",
    outcome: "Job descriptions and interview frameworks that hold up.",
    href: "/tools/hiring-assistant",
    description:
      "Every hire is a high-stakes decision, especially in the early stages. The Hiring Assistant helps you write sharper job descriptions, build interview frameworks that actually surface the right candidates, and evaluate fit across the dimensions that matter most for your stage and culture. Hire with intention, not instinct alone.",
  },
];

/**
 * Free AI Tools — one of the two public Resources destinations. Its sibling
 * is The Library (`/library`): tools are things you *run*, the library is
 * material you *take*. The two cross-link at the close of each page.
 */
export default function ToolsPage() {
  return (
    <PageShell>
      <PageHero
        kicker={
          <span className="inline-flex items-center gap-3">
            <StatusDot live />
            Free AI tools — live now
          </span>
        }
        title={
          <>
            Stop planning. Start <em className="italic">building</em>.
          </>
        }
        lede="Six systems built for founders who move fast and think bigger — free while in beta, live on this site today. No account required."
      />

      <Section
        kicker="01 — Systems, not shortcuts"
        title={
          <>
            The tools that think <em className="italic">with</em> you.
          </>
        }
      >
        <div className="max-w-2xl space-y-5 text-lg leading-8 text-white/60">
          <p>
            You&apos;ve got the idea. You&apos;ve got the drive. What you
            don&apos;t have is a room full of analysts, strategists, and
            specialists telling you what to do next.
          </p>
          <p>That&apos;s what these tools are for.</p>
          <p>
            Each AI system in the Entrepreneuria toolkit is purpose-built for
            the specific problems founders face most — from validating a
            business model to building a financial projection to writing a
            pitch that doesn&apos;t put investors to sleep.
          </p>
          <p>
            They&apos;re not generic. They&apos;re not gimmicky. They&apos;re
            the kind of intelligent systems that give you real, actionable
            output in the time it used to take just to open a blank document.
          </p>
          <p className="font-medium text-white">
            No fluff. No filler. Just sharper thinking, faster.
          </p>
        </div>
      </Section>

      <Section
        kicker="02 — The toolkit"
        title={
          <>
            Your missing team. Now <em className="italic">built in</em>.
          </>
        }
      >
        <ul className="grid gap-5 md:grid-cols-2">
          {tools.map((tool, index) => (
            <li key={tool.name} className="flex">
              <Link
                href={tool.href}
                className="group flex h-full w-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.05] focus-visible:border-white/25 focus-visible:bg-white/[0.05] sm:p-8"
              >
                <span className="text-[11px] uppercase tracking-[0.28em] text-white/45 [font-family:var(--font-label)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {/* Name + outcome read as one unit; the description sits a
                    step further back, so the eye can skim six cards on the
                    outcome line alone. */}
                <h3 className="mt-4 text-2xl font-medium tracking-tight text-white">
                  {tool.name}
                </h3>
                <p className="mt-2 text-[15px] font-medium leading-6 text-white/75">
                  {tool.outcome}
                </p>
                <p className="mt-4 flex-1 text-sm leading-6 text-white/50">
                  {tool.description}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                  Open the tool
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-14 max-w-2xl text-sm leading-6 text-white/45">
          The toolkit is just getting started — more systems are coming. The
          waitlist gets first word as each one ships.
        </p>
      </Section>

      <Section kicker="03 — Also free">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-medium leading-[1.15] tracking-tight text-white sm:text-4xl">
            Prefer something you can <em className="italic">take with you</em>?
          </h2>
          <p className="mt-5 leading-7 text-white/60">
            The Library holds the other half: downloadable templates,
            playbooks, and frameworks across startup frameworks, funding,
            growth, and team building. Free, no account, yours to keep.
          </p>
          <p className="mt-7">
            <ArrowLink href="/library">Browse The Library</ArrowLink>
          </p>
        </div>
      </Section>
    </PageShell>
  );
}

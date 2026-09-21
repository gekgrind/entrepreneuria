import type { Metadata } from "next";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { ArrowLink, StatusDot } from "@/components/marketing/primitives";
import { QuickLaunch } from "@/components/tools/QuickLaunch";
import { ToolGrid } from "@/components/tools/ToolGrid";
import { libraryStats, loadLibrary, spellCount } from "@/lib/resources/library";
import { FREE_TOOLS } from "@/lib/resources/tools";

export const metadata: Metadata = {
  alternates: { canonical: "/tools" },
  title: "Free AI Tools for Founders | Entrepreneuria",
  description:
    "Six free AI tools that draft the work for you: a business model blueprint, a market report, financial projections, customer personas, a pitch deck plan, and a hiring kit. No sign-up.",
};

const STEPS = [
  {
    label: "Answer",
    title: "Tell it what you know.",
    body: "Plain-language questions, with an example in every field. Rough answers are fine.",
  },
  {
    label: "Review",
    title: "Read it as it builds.",
    body: "Results arrive a section at a time. Keep what's right, run again what isn't.",
  },
  {
    label: "Use",
    title: "Take the draft with you.",
    body: "Copy it into your own doc and keep going. Nothing to install, no account.",
  },
];

/**
 * Free AI Tools — Entrepreneuria's hands-on layer. Its sibling, the Library
 * (/library), is material you keep; these are things you run.
 * The tools are the page: a quick-launch row in the hero, then the grid.
 */
export default function ToolsPage() {
  const library = libraryStats(loadLibrary());

  return (
    <PageShell>
      <PageHero
        kicker={
          <span className="inline-flex items-center gap-3">
            <StatusDot live />
            Free AI Tools · {FREE_TOOLS.length} live · No sign-up
          </span>
        }
        title={
          <>
            Bring a rough idea. Leave with a{" "}
            <em className="italic">working draft</em>.
          </>
        }
        lede="Answer a few questions and each tool writes the first version of something founders usually start from a blank page: a business model, a market report, projections, personas, a pitch, a hiring kit."
      >
        <QuickLaunch />
      </PageHero>

      <Section id="tools" bordered={false}>
        <div className="-mt-8 lg:-mt-16">
          <ToolGrid />
          <p className="mt-6 text-xs leading-5 text-white/40">
            Free while in beta. Output is AI-generated, so check the facts and
            figures before you rely on them.
          </p>
        </div>
      </Section>

      <Section
        kicker="How every tool works"
        title={
          <>
            Minutes, not a <em className="italic">blank page</em>.
          </>
        }
      >
        <ol role="list" className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.label} className="bg-[#081527] p-7 sm:p-8">
              <p className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-[#00d4ff]/80 [font-family:var(--font-label)]">
                <span className="grid h-6 w-6 place-items-center rounded-full border border-[#00d4ff]/40 text-[10px] tracking-normal">
                  {index + 1}
                </span>
                {step.label}
              </p>
              <h3 className="mt-6 text-2xl font-medium tracking-tight text-white">
                {step.title}
              </h3>
              <p className="mt-3 leading-7 text-white/60">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section kicker="Elsewhere on Entrepreneuria">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="max-w-xl">
            <h2 className="text-balance text-3xl font-medium leading-[1.15] tracking-tight text-white sm:text-4xl">
              Rather fill in a template yourself?
            </h2>
            <p className="mt-4 leading-7 text-white/60">
              The Library keeps {spellCount(library.total).toLowerCase()}{" "}
              templates, playbooks, and checklists to download and fill in at
              your own pace.
            </p>
          </div>
          <ArrowLink href="/library">Browse the Library</ArrowLink>
        </div>
      </Section>
    </PageShell>
  );
}

import type { Metadata } from "next";

import { PageShell } from "@/components/marketing/PageShell";
import { PaperSection, Section } from "@/components/marketing/Section";
import { ArrowLink } from "@/components/marketing/primitives";
import { Catalog } from "@/components/library/Catalog";
import { LibraryHero } from "@/components/library/LibraryHero";
import { StartHere } from "@/components/library/StartHere";
import {
  START_HERE,
  libraryStats,
  loadLibrary,
  spellCount,
} from "@/lib/resources/library";

export const metadata: Metadata = {
  alternates: { canonical: "/library" },
  title: "The Library — Startup Templates, Playbooks & Checklists | Entrepreneuria",
  description:
    "A curated collection of free startup templates, playbooks, and checklists — canvases, a financial model, a pitch deck template, due diligence, PMF, hiring, and more. Download and adapt.",
  openGraph: {
    title: "The Library · Entrepreneuria",
    description:
      "Founder templates, playbooks, and checklists worth keeping. Free to download and adapt.",
  },
};

/**
 * The Library — Entrepreneuria's curated resource collection. Its sibling,
 * Free AI Tools (/tools), is where you *run* something; this is
 * where you *keep* something. Editorial, typographic, warm-accented —
 * deliberately unlike the tools grid.
 */
export default function LibraryPage() {
  const shelves = loadLibrary();
  const stats = libraryStats(shelves);
  const entries = new Map(
    shelves.flatMap((s) => s.entries).map((e) => [e.slug, e] as const),
  );
  const picks = START_HERE.flatMap((pick) => {
    const entry = entries.get(pick.slug);
    return entry ? [{ ...pick, entry }] : [];
  });

  return (
    <PageShell>
      <LibraryHero
        kicker={
          <>
            The Library
            <span className="hidden sm:inline"> · Resources &amp; templates</span>
          </>
        }
        title={
          <>
            Founder material, <em className="italic">worth keeping</em>.
          </>
        }
        lede={`${spellCount(stats.total)} templates, playbooks, and checklists, chosen for the problems you'll meet more than once and shelved in the order you'll meet them. Download one, make it yours.`}
        contents={shelves.map((s) => ({
          key: s.key,
          numeral: s.numeral,
          title: s.title,
          count: s.entries.length,
        }))}
        footnote="Free to download. No account, no email."
      />

      {picks.length ? (
        <PaperSection
          kicker="Start here"
          title={
            <>
              If you read three, <em className="italic">read these</em>.
            </>
          }
          lede="An order for the first week: sketch the idea, test it with real people, then see whether the numbers work."
        >
          <StartHere picks={picks} />
        </PaperSection>
      ) : null}

      <Section
        bordered={false}
        kicker="The collection"
        title="Every title, shelved."
      >
        <Catalog shelves={shelves} editableCount={stats.editable} />
      </Section>

      <Section kicker="Elsewhere on Entrepreneuria">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="max-w-xl">
            <h2 className="text-balance text-3xl font-medium leading-[1.15] tracking-tight text-white sm:text-4xl">
              Rather not start from a blank template?
            </h2>
            <p className="mt-4 leading-7 text-white/60">
              The free AI tools ask you a few questions and draft the business
              model, projections, or pitch for you.
            </p>
          </div>
          <ArrowLink href="/tools">Open Free AI Tools</ArrowLink>
        </div>
      </Section>
    </PageShell>
  );
}

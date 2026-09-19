import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { Download } from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { ArrowLink, StatusDot } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "The Library — Free Startup Templates & Playbooks | Entrepreneuria",
  description:
    "Download free startup templates, frameworks, playbooks, and guides across funding, growth, startup frameworks, and team building. No account required.",
  alternates: { canonical: "/library" },
};

type ResourceSection = {
  key:
    | "startup-frameworks"
    | "funding-resources"
    | "growth-playbooks"
    | "team-building";
  eyebrow: string;
  title: string;
  paragraph: string;
};

/**
 * Category order is the founder's own order of operations — shape the idea,
 * fund it, grow it, staff it — not the alphabet.
 */
const sectionOrder: ResourceSection[] = [
  {
    key: "startup-frameworks",
    eyebrow: "Startup frameworks",
    title: "Shape the idea",
    paragraph:
      "Canvases and validation frameworks for turning a rough idea into a business model you can test, explain, and defend.",
  },
  {
    key: "funding-resources",
    eyebrow: "Funding resources",
    title: "Fund the build",
    paragraph:
      "The financial model, the pitch deck, and the diligence checklist — everything an investor conversation asks you to have ready.",
  },
  {
    key: "growth-playbooks",
    eyebrow: "Growth playbooks",
    title: "Find the customers",
    paragraph:
      "Product-market fit, growth tactics, and the operating systems that carry you from scrappy traction to something repeatable.",
  },
  {
    key: "team-building",
    eyebrow: "Team building",
    title: "Bring in the people",
    paragraph:
      "Hiring frameworks, culture worksheets, and remote-team practices for the moment you stop doing all of it yourself.",
  },
];

const resourceDescriptions: Record<string, string> = {
  "business-model-template":
    "A comprehensive canvas to map out your business model, including value propositions, customer segments, revenue streams, and key activities.",
  "lean-startup-canvas-example":
    "Real-world example of a completed Lean Startup Canvas showing how successful startups validated their business hypotheses.",
  "lean-startup-canvas-template":
    "Strategic one-page template to identify problems, solutions, key metrics, and value propositions for rapid iteration and validation.",
  "mvp-planning-template":
    "Step-by-step guide to define, build, and launch your Minimum Viable Product with minimal waste and maximum learning.",
  "startup-validation":
    "Proven frameworks and methodologies to validate your startup idea before investing significant time and resources.",
  "due-diligence-checklist":
    "Complete checklist for investor due diligence covering legal, financial, technical, and operational aspects of your startup.",
  "entrepreneuria-financial-model":
    "AI-assisted financial projection template with built-in formulas for revenue forecasting, expense planning, and cash flow analysis.",
  "the-ultimate-pitch-deck-template-for-entrepreneurs":
    "Investor-ready pitch deck template with proven frameworks used by successful startups to raise seed rounds and Series A funding.",
  "founders-pmf-playbook":
    "Comprehensive playbook to achieve and measure Product-Market Fit, including customer discovery, retention metrics, and growth indicators.",
  "from-hustler-to-ceo-the-scaling-operations-playbook":
    "Operational frameworks and systems to transition from founder-led chaos to scalable, repeatable business processes.",
  "the-growth-hacking-toolkit":
    "Marketing tactics, automation frameworks, and growth loops to expand your reach and accelerate customer acquisition.",
  "culture-building-kit":
    "Core values worksheets, mission statement templates, and frameworks to build a thriving company culture from day one.",
  "entrepreneuria-remote-team-guide":
    "Best practices for building, managing, and scaling remote teams including communication tools, async workflows, and virtual collaboration.",
  "the-a-player-hiring-playbook":
    "Proven hiring frameworks to attract, interview, and retain top talent while avoiding costly hiring mistakes.",
};

/**
 * Titles the slug-formatter cannot get right on its own — acronyms,
 * possessives, hyphenates, and lowercase joining words.
 */
const resourceTitles: Record<string, string> = {
  "mvp-planning-template": "MVP Planning Template",
  "the-ultimate-pitch-deck-template-for-entrepreneurs":
    "The Ultimate Pitch Deck Template for Entrepreneurs",
  "founders-pmf-playbook": "The Founder's PMF Playbook",
  "from-hustler-to-ceo-the-scaling-operations-playbook":
    "From Hustler to CEO: The Scaling Operations Playbook",
  "the-a-player-hiring-playbook": "The A-Player Hiring Playbook",
};

const formatTitle = (str: string) =>
  resourceTitles[str] ??
  str.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

/** Editable formats first, then the read-only PDF. */
const FORMAT_ORDER = ["XLSX", "DOCX", "PDF"];
const formatRank = (label: string) => {
  const index = FORMAT_ORDER.indexOf(label);
  return index === -1 ? FORMAT_ORDER.length : index;
};

/**
 * The Library — one of the two public Resources destinations. Its sibling is
 * Free AI Tools (`/tools`): the library is material you *take*, the tools are
 * things you *run*. Contents are read from `public/resources` at build time,
 * so adding a file to a category folder publishes it.
 */
export default function LibraryPage() {
  const basePath = path.join(process.cwd(), "public", "resources");

  const sectionData = sectionOrder.map((section) => {
    const folderPath = path.join(basePath, section.key);
    const files = fs.readdirSync(folderPath);

    const groupedFiles = files.reduce<Record<string, string[]>>((acc, file) => {
      const nameWithoutExtension = file.replace(/\.(pdf|docx|xlsx)$/i, "");
      if (!acc[nameWithoutExtension]) acc[nameWithoutExtension] = [];
      acc[nameWithoutExtension].push(file);
      return acc;
    }, {});

    return {
      ...section,
      items: Object.entries(groupedFiles).map(([slug, list]) => ({
        slug,
        title: formatTitle(slug),
        description:
          resourceDescriptions[slug] ||
          "Valuable resource to help grow your business.",
        files: list
          .map((file) => ({
            label: file.split(".").pop()?.toUpperCase() || "",
            url: `/resources/${section.key}/${file}`,
          }))
          .sort((a, b) => formatRank(a.label) - formatRank(b.label)),
      })),
    };
  });

  const totalResources = sectionData.reduce(
    (sum, section) => sum + section.items.length,
    0,
  );

  return (
    <PageShell>
      <PageHero
        kicker={
          <span className="inline-flex items-center gap-3">
            <StatusDot live />
            The Library · Free downloads — live now
          </span>
        }
        title={
          <>
            Stop scrambling. Start <em className="italic">building</em>.
          </>
        }
        lede={`${totalResources} templates, playbooks, and frameworks — organized by the order you actually need them. Free, no account, yours to keep.`}
      />

      <Section
        kicker="01 — The shelves"
        title={
          <>
            Download what you <em className="italic">need</em>.
          </>
        }
        lede="Four shelves, in founder order. Every file is free, and every one of them is something you can open and start filling in today."
      >
        {/* Shelf index — a map of the page on desktop, a shortcut past three
            shelves on mobile. Plain hash anchors: no JavaScript required. */}
        <nav aria-label="Library shelves" className="-mt-2 mb-16">
          <ul className="flex flex-wrap gap-2">
            {sectionData.map((section) => (
              <li key={section.key}>
                <a
                  href={`#${section.key}`}
                  className="no-accent-link inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition-colors duration-300 hover:border-white/35 hover:text-white focus-visible:border-white/35 focus-visible:text-white sm:min-h-0"
                >
                  {section.eyebrow}
                  <span className="text-xs text-white/45">
                    {section.items.length}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-20">
          {sectionData.map((section, index) => (
            <section
              key={section.key}
              id={section.key}
              aria-labelledby={`${section.key}-heading`}
              className="scroll-mt-[calc(var(--header-height)+40px)] border-t border-white/10 pt-10"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/45 [font-family:var(--font-label)]">
                  {String(index + 1).padStart(2, "0")} — {section.eyebrow}
                </p>
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/45 [font-family:var(--font-label)]">
                  {section.items.length}{" "}
                  {section.items.length === 1 ? "resource" : "resources"}
                </p>
              </div>

              <h3
                id={`${section.key}-heading`}
                className="mt-4 text-3xl font-medium tracking-tight text-white sm:text-4xl"
              >
                {section.title}
              </h3>
              <p className="mt-4 max-w-2xl leading-7 text-white/60">
                {section.paragraph}
              </p>

              <ul className="mt-10">
                {section.items.map((item) => (
                  <li
                    key={item.slug}
                    className="grid gap-x-10 gap-y-4 border-t border-white/[0.07] py-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-start"
                  >
                    <div className="max-w-2xl">
                      <h4 className="text-lg font-semibold leading-7 text-white">
                        {item.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-white/55">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end md:pt-0.5">
                      {item.files.map((file) => (
                        <a
                          key={file.url}
                          href={file.url}
                          download
                          aria-label={`Download ${item.title} as ${file.label}`}
                          className="no-accent-link inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/80 transition-colors duration-300 hover:border-white/40 hover:text-white focus-visible:border-white/40 focus-visible:text-white sm:min-h-0"
                        >
                          <Download
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {file.label}
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-16 max-w-2xl text-sm leading-6 text-white/45">
          More resources are added regularly. Bookmark this page and check
          back — the library keeps growing.
        </p>
      </Section>

      <Section kicker="02 — Also free">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-medium leading-[1.15] tracking-tight text-white sm:text-4xl">
            Want the thinking <em className="italic">done with you</em>?
          </h2>
          <p className="mt-5 leading-7 text-white/60">
            Six free AI tools handle the work a template can only prompt for —
            business models, market analysis, financial projections, personas,
            pitch decks, and hiring. They run right here, no account needed.
          </p>
          <p className="mt-7">
            <ArrowLink href="/tools">Open the free AI tools</ArrowLink>
          </p>
        </div>
      </Section>
    </PageShell>
  );
}

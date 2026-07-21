import fs from "fs";
import path from "path";
import Link from "next/link";
import { Download } from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { StatusDot } from "@/components/marketing/primitives";

type ResourceSection = {
  key:
    | "funding-resources"
    | "growth-playbooks"
    | "startup-frameworks"
    | "team-building";
  eyebrow: string;
  title: string;
  paragraph: string;
};

const sectionOrder: ResourceSection[] = [
  {
    key: "funding-resources",
    eyebrow: "FUNDING RESOURCES",
    title: "Funding Resources",
    paragraph: "Project Your Startup's Revenue, Costs, and Growth",
  },
  {
    key: "growth-playbooks",
    eyebrow: "GROWTH PLAYBOOKS",
    title: "Growth Playbooks",
    paragraph: "Scrappy, Creative Tactics to Accelerate Growth",
  },
  {
    key: "startup-frameworks",
    eyebrow: "STARTUP FRAMEWORKS",
    title: "Startup Frameworks",
    paragraph: "A Strategic Template for Building Your Business Model",
  },
  {
    key: "team-building",
    eyebrow: "TEAM BUILDING",
    title: "Team Building",
    paragraph: "Build and Manage High-Performing Distributed Teams",
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

const formatTitle = (str: string) =>
  str.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export default function ResourcesPage() {
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
        files: list.map((file) => ({
          label: file.split(".").pop()?.toUpperCase() || "",
          url: `/resources/${section.key}/${file}`,
        })),
      })),
    };
  });

  return (
    <PageShell>
      <PageHero
        kicker={
          <span className="inline-flex items-center gap-3">
            <StatusDot live />
            The Launch Pad · Free downloads — live now
          </span>
        }
        title={
          <>
            Stop scrambling. Start <em className="italic">building</em>.
          </>
        }
        lede="Free, comprehensive resources organized so you can stop searching and start doing."
      />

      <Section kicker="01 — The library" title="Download what you need.">
        <div className="space-y-8">
          {sectionData.map((section, index) => (
            <article
              key={section.key}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-9"
            >
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40 [font-family:var(--font-label)]">
                {String(index + 1).padStart(2, "0")} — {section.eyebrow}
              </p>
              <h3 className="mt-3 text-3xl font-medium tracking-tight text-white">
                {section.title}
              </h3>
              <p className="mt-3 max-w-3xl leading-7 text-white/60">
                {section.paragraph}
              </p>

              <div className="mt-7 border-t border-white/10 pt-6">
                <ul className="space-y-6">
                  {section.items.map((item) => (
                    <li key={item.slug} className="space-y-3">
                      <p className="leading-7 text-white/60">
                        <span className="font-semibold text-white">
                          {item.title}
                        </span>
                        {": "}
                        {item.description}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {item.files.map((file) => (
                          <Link
                            key={`${item.slug}-${file.url}`}
                            href={file.url}
                            download
                            className="no-accent-link inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            {file.label}
                          </Link>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-14 max-w-2xl text-sm leading-6 text-white/45">
          More resources are added regularly. Bookmark this page and check
          back — the library keeps growing.
        </p>
      </Section>
    </PageShell>
  );
}

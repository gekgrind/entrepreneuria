import fs from "fs";
import path from "path";

/**
 * The Library (/library). Files live in `public/resources/<shelf>`
 * and are read at build time, so dropping a file into a shelf folder
 * publishes it. The catalogue notes below were written from each document's
 * actual contents (titles, page counts, sections) — update them when a file
 * changes. A file without a note still appears, with its formatted slug.
 */

export type ShelfKey =
  | "startup-frameworks"
  | "funding-resources"
  | "growth-playbooks"
  | "team-building";

export type LibraryFile = {
  format: "PDF" | "DOCX" | "XLSX";
  url: string;
  size: string;
};

export type LibraryEntry = {
  slug: string;
  shelf: ShelfKey;
  /** Call number, e.g. "II.03" — shelf numeral + position. */
  callNumber: string;
  title: string;
  kind: string;
  length?: string;
  description: string;
  files: LibraryFile[];
  editable: boolean;
};

export type Shelf = {
  key: ShelfKey;
  numeral: string;
  name: string;
  title: string;
  description: string;
  entries: LibraryEntry[];
};

/** Founder order — shape it, fund it, grow it, staff it. */
const SHELVES: Omit<Shelf, "entries" | "numeral">[] = [
  {
    key: "startup-frameworks",
    name: "Startup frameworks",
    title: "Shape the idea",
    description:
      "Canvases, a worked example, and a validation method for pressure-testing the idea before you build it.",
  },
  {
    key: "funding-resources",
    name: "Funding",
    title: "Prepare to raise",
    description:
      "The model, the deck, and the checklist an investor conversation will ask you to have ready.",
  },
  {
    key: "growth-playbooks",
    name: "Growth",
    title: "Find fit, then scale",
    description:
      "Measure product-market fit, run growth experiments, and turn founder-led chaos into process.",
  },
  {
    key: "team-building",
    name: "Team",
    title: "Build the team",
    description:
      "Hire deliberately, work well remotely, and write the culture down before it writes itself.",
  },
];

type Note = {
  title: string;
  kind: string;
  length?: string;
  description: string;
  /** Position within the shelf; lower first. */
  order: number;
};

const NOTES: Record<string, Note> = {
  // Startup frameworks
  "lean-startup-canvas-template": {
    title: "Lean Startup Canvas",
    kind: "Canvas",
    length: "1 page",
    description:
      "Problem, solution, key metrics, unfair advantage — the whole plan on one page, built to be redrawn as you learn.",
    order: 1,
  },
  "lean-startup-canvas-example": {
    title: "Lean Startup Canvas, Worked Example",
    kind: "Example",
    length: "2 pages",
    description:
      "The same canvas completed for a fictional meal-planning app, so you can see what specific answers look like.",
    order: 2,
  },
  "business-model-template": {
    title: "The No-BS Business Model Canvas",
    kind: "Canvas",
    length: "1 page",
    description:
      "All nine business model blocks, each with a guiding question and a note for solo founders.",
    order: 3,
  },
  "startup-validation": {
    title: "The Customer Development Guide",
    kind: "Guide",
    length: "44 pages",
    description:
      "Steve Blank's method, step by step: list your assumptions, interview customers, validate the problem, then the solution.",
    order: 4,
  },
  "mvp-planning-template": {
    title: "MVP Planning Template",
    kind: "Template",
    length: "23 pages",
    description:
      "Scope a first version you can ship: target users, MoSCoW feature priorities, a roadmap, and the metrics that define success.",
    order: 5,
  },

  // Funding
  "entrepreneuria-financial-model": {
    title: "The Entrepreneuria Financial Model",
    kind: "Spreadsheet",
    length: "7 sheets",
    description:
      "Revenue, costs, cash flow, break-even, and a KPI dashboard, with the formulas already connected across sheets.",
    order: 1,
  },
  "the-ultimate-pitch-deck-template-for-entrepreneurs": {
    title: "The Pitch Deck Template",
    kind: "Template",
    length: "22 pages",
    description:
      "A twelve-slide investor deck, slide by slide — what each one has to prove and how to lay it out.",
    order: 2,
  },
  "due-diligence-checklist": {
    title: "Investor Due Diligence Checklist",
    kind: "Checklist",
    length: "21 pages",
    description:
      "95 items investors ask for, from corporate records to the cap table, ranked critical, important, or supporting.",
    order: 3,
  },

  // Growth
  "founders-pmf-playbook": {
    title: "The Founder's PMF Playbook",
    kind: "Playbook",
    length: "14 pages",
    description:
      "A feedback tracker, a modified Sean Ellis survey, and cohort retention benchmarks: how to tell whether you have fit.",
    order: 1,
  },
  "the-growth-hacking-toolkit": {
    title: "The Growth Hacking Toolkit",
    kind: "Toolkit",
    length: "10 pages",
    description:
      "An experiment tracker, a viral-loop template, and an A/B testing log for finding the channels that compound.",
    order: 2,
  },
  "from-hustler-to-ceo-the-scaling-operations-playbook": {
    title: "From Hustler to CEO",
    kind: "Playbook",
    length: "33 pages",
    description:
      "The scaling operations playbook: document processes, delegate, automate, and track the KPIs that matter.",
    order: 3,
  },

  // Team
  "the-a-player-hiring-playbook": {
    title: "The A-Player Hiring Playbook",
    kind: "Playbook",
    length: "30 pages",
    description:
      "Role definition, sourcing, work challenges, interview scorecards, and onboarding: a complete hiring process.",
    order: 1,
  },
  "culture-building-kit": {
    title: "The Culture Building Kit",
    kind: "Workbook",
    length: "27 pages",
    description:
      "A values workshop, a test for whether your values hold up, and the rituals that make them part of the week.",
    order: 2,
  },
  "entrepreneuria-remote-team-guide": {
    title: "Remote Team Guide",
    kind: "Guide",
    length: "25 pages",
    description:
      "A communication charter, meeting agendas, weekly check-ins, and accountability frameworks for a distributed team.",
    order: 3,
  },
};

/** Hand-picked starting points, with the reason each earns its place. */
export const START_HERE: { slug: string; step: string; why: string }[] = [
  {
    slug: "lean-startup-canvas-template",
    step: "Sketch it",
    why: "One page and nine boxes. The quickest honest check on whether the idea holds together.",
  },
  {
    slug: "startup-validation",
    step: "Test it",
    why: "The deepest read on the shelves: how to find out if people want it before you build it.",
  },
  {
    slug: "entrepreneuria-financial-model",
    step: "Cost it",
    why: "The one spreadsheet in the collection. Open it before any conversation about money.",
  },
];

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const FORMAT_ORDER = ["DOCX", "XLSX", "PDF"] as const;

const formatSlug = (slug: string) =>
  slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function loadLibrary(): Shelf[] {
  const base = path.join(process.cwd(), "public", "resources");

  return SHELVES.map((shelf, shelfIndex) => {
    const folder = path.join(base, shelf.key);
    const files = fs.existsSync(folder) ? fs.readdirSync(folder) : [];

    const grouped = new Map<string, LibraryFile[]>();
    for (const file of files) {
      const match = file.match(/^(.*)\.(pdf|docx|xlsx)$/i);
      if (!match) continue;
      const [, slug, ext] = match;
      const list = grouped.get(slug) ?? [];
      list.push({
        format: ext.toUpperCase() as LibraryFile["format"],
        url: `/resources/${shelf.key}/${file}`,
        size: formatSize(fs.statSync(path.join(folder, file)).size),
      });
      grouped.set(slug, list);
    }

    const numeral = NUMERALS[shelfIndex] ?? String(shelfIndex + 1);
    const entries = [...grouped.entries()]
      .sort(
        ([a], [b]) =>
          (NOTES[a]?.order ?? 99) - (NOTES[b]?.order ?? 99) || a.localeCompare(b),
      )
      .map(([slug, list], index): LibraryEntry => {
        const note = NOTES[slug];
        const sorted = list.sort(
          (a, b) => FORMAT_ORDER.indexOf(a.format) - FORMAT_ORDER.indexOf(b.format),
        );
        return {
          slug,
          shelf: shelf.key,
          callNumber: `${numeral}.${String(index + 1).padStart(2, "0")}`,
          title: note?.title ?? formatSlug(slug),
          kind: note?.kind ?? "Resource",
          length: note?.length,
          description: note?.description ?? "",
          files: sorted,
          editable: sorted.some((f) => f.format !== "PDF"),
        };
      });

    return { ...shelf, numeral, entries };
  });
}

export function libraryStats(shelves: Shelf[]) {
  const entries = shelves.flatMap((s) => s.entries);
  return {
    total: entries.length,
    editable: entries.filter((e) => e.editable).length,
  };
}

/** Spelled-out small counts read better in editorial copy. */
export function spellCount(n: number) {
  const words = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
    "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty",
  ];
  return words[n] ?? String(n);
}

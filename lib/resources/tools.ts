/**
 * The six free AI tools on /tools. Copy here describes what each
 * tool actually asks for and actually returns — keep it in step with the
 * tool pages under app/tools/ when either changes.
 */

export type ToolOutput =
  | "blueprint"
  | "report"
  | "projection"
  | "personas"
  | "deck"
  | "hiring";

export type FreeTool = {
  slug: string;
  name: string;
  href: string;
  /** Verb-first job, used on the hero quick-launch row. */
  job: string;
  /** One line on the card: the result, not the process. */
  promise: string;
  /** What the founder types in. */
  bring: string;
  /** What comes back. */
  leave: string;
  /** Short output label shown on the card's preview. */
  outputLabel: string;
  output: ToolOutput;
};

export const FREE_TOOLS: FreeTool[] = [
  {
    slug: "business-model-blueprint",
    name: "Business Model Blueprint",
    href: "/tools/business-model-blueprint",
    job: "Map my business model",
    promise: "Get the whole model out of your head and onto one page.",
    bring: "Your customer, offer, pricing, and the work you do each week",
    leave: "A written blueprint with three prioritized next steps",
    outputLabel: "Blueprint",
    output: "blueprint",
  },
  {
    slug: "market-analysis-ai",
    name: "Market Analysis AI",
    href: "/tools/market-analysis-ai",
    job: "Size up my market",
    promise: "See who you're up against and where the gaps are.",
    bring: "What you're building, who it's for, and any competitors you know",
    leave: "Four research pillars, rolled into one market report",
    outputLabel: "Market report",
    output: "report",
  },
  {
    slug: "financial-projector",
    name: "Financial Projector",
    href: "/tools/financial-projector",
    job: "Check my numbers",
    promise: "Find out when the business pays for itself.",
    bring: "Your pricing, sales assumptions, and monthly costs",
    leave: "Revenue, break-even, and cash-flow projections in plain English",
    outputLabel: "Projection",
    output: "projection",
  },
  {
    slug: "customer-persona-builder",
    name: "Customer Persona Builder",
    href: "/tools/customer-persona-builder",
    job: "Meet my customer",
    promise: "Put a name, a voice, and real objections to your buyer.",
    bring: "Your offer and what you already know about your audience",
    leave: "Up to three distinct personas, compared side by side",
    outputLabel: "Personas",
    output: "personas",
  },
  {
    slug: "pitch-deck-creator",
    name: "Pitch Deck Creator",
    href: "/tools/pitch-deck-creator",
    job: "Draft my pitch",
    promise: "Turn your story into a slide-by-slide pitch you can present.",
    bring: "Problem, solution, traction, and who you're pitching",
    leave: "A slide plan with headlines, content, and speaker notes",
    outputLabel: "Slide plan",
    output: "deck",
  },
  {
    slug: "hiring-assistant",
    name: "Hiring Assistant",
    href: "/tools/hiring-assistant",
    job: "Make my first hire",
    promise: "Write the role, screen the applicants, run the interview.",
    bring: "The role, what it pays, and what the job really involves",
    leave: "A job description, candidate screening, and interview questions",
    outputLabel: "Hiring kit",
    output: "hiring",
  },
];

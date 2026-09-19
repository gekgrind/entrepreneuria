/**
 * Directorium advisors — the single source of truth for the marketing
 * page's board: roles, supporting model names, seat positions, and
 * signature colors.
 *
 * SEATS follow the Strategic Council Chamber in the real Directorium
 * dashboard (clockwise from the top), so the marketing chamber and the
 * product agree when the interface is revealed.
 *
 * SIGNATURE COLORS are derived from that dashboard's seat lights. They
 * are deliberately localized: seats, glyphs, chips, and intelligence
 * indicators only — never buttons, chrome, or section atmosphere, which
 * keep Entrepreneuria's cyan (intelligence) / orange (founder) grammar.
 */

export type AdvisorId =
  | "strategist"
  | "capitalist"
  | "growth-architect"
  | "operator"
  | "risk-analyst"
  | "contrarian";

export interface Advisor {
  id: AdvisorId;
  /** Board order I–VI (reading order on the page). */
  numeral: string;
  /** Full role title, e.g. "The Strategist". */
  title: string;
  /** Seat label in visuals, e.g. "Strategist". */
  role: string;
  /** Supporting model name — secondary, chips only. */
  model: string;
  /** Seat index, clockwise from the top of the chamber (0–5). */
  seat: number;
  /** Signature color (dashboard-derived). */
  color: string;
  description: string;
}

export const ADVISORS: readonly Advisor[] = [
  {
    id: "strategist",
    numeral: "I",
    title: "The Strategist",
    role: "Strategist",
    model: "Claude",
    seat: 0,
    color: "#E2C25B",
    description:
      "Sees the big picture, identifies leverage points, and helps shape direction with structured strategic thinking.",
  },
  {
    id: "capitalist",
    numeral: "II",
    title: "The Capitalist",
    role: "Capitalist",
    model: "Gemini",
    seat: 3,
    color: "#DB5A97",
    description:
      "Evaluates business viability, monetization, and economic logic with a measured, analytical lens.",
  },
  {
    id: "growth-architect",
    numeral: "III",
    title: "The Growth Architect",
    role: "Growth Architect",
    model: "Perplexity",
    seat: 5,
    color: "#9B7DF0",
    description:
      "Builds scalable growth pathways, messaging angles, and expansion opportunities across channels.",
  },
  {
    id: "operator",
    numeral: "IV",
    title: "The Operator",
    role: "Operator",
    model: "OpenAI",
    seat: 4,
    color: "#58C6DA",
    description:
      "Pushes for execution, velocity, and operational clarity when ideas need to become action.",
  },
  {
    id: "risk-analyst",
    numeral: "V",
    title: "The Risk Analyst",
    role: "Risk Analyst",
    model: "Mistral",
    seat: 2,
    color: "#6F83F2",
    description:
      "Flags weaknesses, validates assumptions, and pressure-tests decisions with evidence-driven scrutiny.",
  },
  {
    id: "contrarian",
    numeral: "VI",
    title: "The Contrarian",
    role: "Contrarian",
    model: "Grok",
    seat: 1,
    color: "#4CCFB0",
    description:
      "Challenges consensus, surfaces blind spots, and introduces alternative angles the room may miss.",
  },
];

/**
 * Debate geometry: every tension pair sits directly across the table,
 * so disagreement literally crosses the chamber.
 *   Strategist ↔ Capitalist   — direction vs. economics
 *   Contrarian ↔ Operator     — challenge vs. execution
 *   Risk Analyst ↔ Growth     — caution vs. expansion (most contested)
 */
export const TENSION_PAIRS: readonly {
  a: AdvisorId;
  b: AdvisorId;
  primary: boolean;
}[] = [
  { a: "strategist", b: "capitalist", primary: false },
  { a: "contrarian", b: "operator", primary: false },
  { a: "risk-analyst", b: "growth-architect", primary: true },
];

/** In the verdict the board aligns — except the seat that keeps dissent
 *  on the record. A synthesis, not a unanimous echo. */
export const VERDICT_DISSENT: AdvisorId = "contrarian";

export type ChamberState = "dormant" | "convened" | "debate" | "verdict";

export const CHAMBER_STATE_LABELS: Record<ChamberState, string> = {
  dormant: "The decision is on the table",
  convened: "Six advisors convened",
  debate: "Positions in tension",
  verdict: "Synthesis resolved",
};

export const advisorById = (id: AdvisorId): Advisor => {
  const advisor = ADVISORS.find((a) => a.id === id);
  if (!advisor) throw new Error(`Unknown advisor: ${id}`);
  return advisor;
};

/** Board-order index (I = 0 … VI = 5) — the convening order in motion. */
export const boardIndex = (id: AdvisorId): number =>
  ADVISORS.findIndex((a) => a.id === id);

/** Advisors in seat order (clockwise from the top). */
export const ADVISORS_BY_SEAT: readonly Advisor[] = [...ADVISORS].sort(
  (a, b) => a.seat - b.seat,
);

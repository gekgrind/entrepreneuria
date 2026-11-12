/**
 * Website style identifiers for `style_interest` (spec §8, Sprint 2 handoff §6).
 *
 * Values are STABLE identifiers stored in CRM records — never rename one;
 * retire it and add a new id instead. Labels are the approved Sprint 2
 * option text. The demo gallery registry (websites-demos.ts, added with the
 * page) must reference these ids; a fourth design is a data entry here.
 */
import { z } from "zod";

export const DESIGN_STYLES = [
  { value: "local-professional", label: "Local Professional" },
  { value: "neighborhood-pro", label: "Neighborhood Pro" },
  { value: "modern-craftsman", label: "Modern Craftsman" },
] as const;

export const NON_DESIGN_STYLES = [
  { value: "not-sure", label: "Not sure yet" },
  { value: "something-different", label: "Something different" },
] as const;

export const STYLE_OPTIONS = [...DESIGN_STYLES, ...NON_DESIGN_STYLES] as const;

export type StyleInterest = (typeof STYLE_OPTIONS)[number]["value"];

export const STYLE_INTEREST_VALUES = STYLE_OPTIONS.map((s) => s.value) as [
  StyleInterest,
  ...StyleInterest[],
];

/** Empty string = field left blank (optional, empty by default). */
export const styleInterestSchema = z.enum(STYLE_INTEREST_VALUES).or(z.literal(""));

export function isStyleInterest(value: unknown): value is StyleInterest {
  return typeof value === "string" && (STYLE_INTEREST_VALUES as readonly string[]).includes(value);
}

/** GHL opportunity tag for pipeline filtering, e.g. `style:modern-craftsman`. */
export function styleTag(value: StyleInterest): string {
  return `style:${value}`;
}

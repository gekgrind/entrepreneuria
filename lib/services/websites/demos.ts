/**
 * Website design gallery registry (Sprint 2 handoff §6).
 *
 * Three FICTIONAL businesses built by Entrepreneuria as design examples —
 * never presented as clients. Copy is verbatim from the approved Sprint 2
 * page (docs/websites/design/websites-page.sprint2.html). Screenshots are
 * the approved captures in public/marketing/websites-demos/ (originals,
 * unmodified; sha256 recorded in docs/websites/DECISION-REGISTER.md D-01).
 *
 * A fourth design is a data entry: add its style id to styles.ts first.
 */
import { z } from "zod";

import { DESIGN_STYLES } from "./styles";

const DESIGN_STYLE_VALUES = DESIGN_STYLES.map((s) => s.value) as [
  (typeof DESIGN_STYLES)[number]["value"],
  ...(typeof DESIGN_STYLES)[number]["value"][],
];

const imageSchema = z
  .object({
    src: z.string().regex(/^\/marketing\/websites-demos\/demo-[a-z]+-(desktop|mobile)\.webp$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    alt: z.string(),
  })
  .strict();

const demoSchema = z
  .object({
    id: z.string().regex(/^[a-z]+$/),
    style: z.enum(DESIGN_STYLE_VALUES),
    design: z.string().min(1),
    business: z.string().min(1),
    url: z.string().url().startsWith("https://"),
    position: z.string().min(1),
    description: z.string().min(1),
    palette: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).min(1),
    fictional: z.literal(true),
    desktop: imageSchema,
    mobile: imageSchema,
  })
  .strict();

export type WebsiteDemo = z.infer<typeof demoSchema>;

const shots = (id: string, business: string) => ({
  desktop: { src: `/marketing/websites-demos/demo-${id}-desktop.webp`, width: 1440, height: 900, alt: "" },
  mobile: { src: `/marketing/websites-demos/demo-${id}-mobile.webp`, width: 390, height: 844, alt: `${business} sample website on a phone` },
});

export const WEBSITE_DEMOS: readonly WebsiteDemo[] = z
  .array(demoSchema)
  .superRefine((demos, ctx) => {
    const styles = demos.map((d) => d.style);
    if (new Set(styles).size !== styles.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate style" });
    if (new Set(demos.map((d) => d.id)).size !== demos.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate id" });
  })
  .parse([
    {
      id: "redclay",
      style: "local-professional",
      design: "Local Professional",
      business: "Red Clay Handyman Co.",
      url: "https://preview-1793923076658549724.vibepreview.app/",
      position: "Direct and easy to act on, with the phone number and estimate button always in reach.",
      description:
        "Deep navy and green, bold sans-serif type, a photo-led hero, a clear services grid and a sticky call bar on phones.",
      palette: ["#1a2b3c", "#93d572", "#de871d"],
      fictional: true,
      ...shots("redclay", "Red Clay Handyman Co."),
    },
    {
      id: "porchlight",
      style: "neighborhood-pro",
      design: "Neighborhood Pro",
      business: "Porch Light Handyman",
      url: "https://preview-1793924044171507186.vibepreview.app/",
      position: "Warm and personal, with the estimate request form in the very first screen.",
      description:
        "Cream and terracotta with rounded geometric type, a full-width photo hero with the form beside it, and a friendly, neighborly voice.",
      palette: ["#f6f3ea", "#4d634c", "#bd4922"],
      fictional: true,
      ...shots("porchlight", "Porch Light Handyman"),
    },
    {
      id: "ashford",
      style: "modern-craftsman",
      design: "Modern Craftsman",
      business: "Ashford & Pine Carpentry",
      url: "https://preview-1793936518728832266.vibepreview.app/",
      position: "Editorial and refined, made for businesses whose work is about craft.",
      description:
        "A quiet cream and charcoal palette, an elegant serif with italic accents, a large interior photograph and plenty of white space.",
      palette: ["#f2f0ea", "#1f2123", "#dfd7ca"],
      fictional: true,
      ...shots("ashford", "Ashford & Pine Carpentry"),
    },
  ]);

export function demoForStyle(style: string): WebsiteDemo | undefined {
  return WEBSITE_DEMOS.find((d) => d.style === style);
}

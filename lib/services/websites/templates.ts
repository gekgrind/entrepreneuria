/**
 * Website template gallery, organised by industry (/services/templates,
 * /services/industries/[industry]).
 *
 * The demo websites themselves are built and hosted in GoHighLevel; this
 * registry only describes them: screenshots, copy and the live demo link.
 * Every template is a FICTIONAL business built by Entrepreneuria as a design
 * example, never presented as a client.
 *
 * Handyman entries are derived from the approved demo registry (demos.ts),
 * so their copy, screenshots and style ids are never duplicated here.
 *
 * Publishing rules (enforced by the schema and by `publishedTemplates`):
 *   - only `status: "published"` templates render anywhere;
 *   - a published template needs an https demo URL, both screenshots and the
 *     date its link was last checked (`verifiedOn`, see
 *     `npm run templates:verify`);
 *   - an industry page exists only while it has a published template.
 *
 * Adding a template or an industry is a data entry here. A template that
 * should prefill the inquiry form's style needs a `styleInterest` id from
 * styles.ts; adding new style ids changes CRM values and needs owner approval.
 */
import { z } from "zod";

import { BUSINESS_TYPES } from "./content";
import { WEBSITE_DEMOS } from "./demos";
import { DESIGN_STYLES } from "./styles";

const DESIGN_STYLE_VALUES = DESIGN_STYLES.map((s) => s.value) as [
  (typeof DESIGN_STYLES)[number]["value"],
  ...(typeof DESIGN_STYLES)[number]["value"][],
];

const industrySchema = z
  .object({
    slug: z.string().regex(/^[a-z]+(?:-[a-z]+)*$/),
    /** Plural label for headings and the directory, e.g. "Hair salons". */
    name: z.string().min(1),
    headline: z.string().min(1),
    intro: z.string().min(1),
    /** Approved inquiry-form business type, when one fits. Salons have none yet. */
    businessType: z.enum(BUSINESS_TYPES).optional(),
  })
  .strict();

export type Industry = z.infer<typeof industrySchema>;

const imageSchema = z
  .object({
    src: z.string().regex(/^\/marketing\/websites-demos\/demo-[a-z]+-(desktop|mobile)\.webp$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    alt: z.string(),
  })
  .strict();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const websiteTemplateSchema = z
  .object({
    id: z.string().regex(/^[a-z]+$/),
    industry: z.string(),
    status: z.enum(["draft", "published"]),
    design: z.string().min(1),
    business: z.string().min(1),
    url: z.string().url().startsWith("https://").optional(),
    /** Last date the demo URL answered 200 with the business name on the page. */
    verifiedOn: z.string().regex(ISO_DATE).optional(),
    position: z.string().min(1),
    description: z.string().min(1),
    palette: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).min(1),
    fictional: z.literal(true),
    /** Prefills the inquiry form's style when set (an approved styles.ts id). */
    styleInterest: z.enum(DESIGN_STYLE_VALUES).optional(),
    desktop: imageSchema.optional(),
    mobile: imageSchema.optional(),
  })
  .strict()
  .superRefine((t, ctx) => {
    if (t.status !== "published") return;
    for (const key of ["url", "verifiedOn", "desktop", "mobile"] as const) {
      if (!t[key]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `published template ${t.id} needs ${key}` });
    }
  });

type TemplateInput = z.infer<typeof websiteTemplateSchema>;

/** A template that may be shown publicly: every publishing field is present. */
export type PublishedTemplate = TemplateInput & {
  status: "published";
  url: string;
  verifiedOn: string;
  desktop: NonNullable<TemplateInput["desktop"]>;
  mobile: NonNullable<TemplateInput["mobile"]>;
};

export const INDUSTRIES: readonly Industry[] = z
  .array(industrySchema)
  .refine((list) => new Set(list.map((i) => i.slug)).size === list.length, "duplicate industry slug")
  .parse([
    {
      slug: "handyman",
      name: "Handyman & home repair",
      headline: "Websites for handyman and home repair businesses.",
      intro:
        "Three directions for the same kind of business: one built around the phone call, one around the estimate form, one around the craft.",
      businessType: "Handyman or home repair",
    },
    {
      slug: "salons",
      name: "Hair salons",
      headline: "Websites for hair salons.",
      intro:
        "Designed around how salon guests decide: the service menu, starting prices, the stylists, and a booking button that is always in reach.",
    },
  ]);

/** Verified 2026-11-16: each demo URL answered 200 and its screenshot pair is in public/. */
const HANDYMAN_VERIFIED_ON = "2026-11-16";

const shots = (id: string, business: string) => ({
  desktop: { src: `/marketing/websites-demos/demo-${id}-desktop.webp`, width: 1440, height: 900, alt: "" },
  mobile: { src: `/marketing/websites-demos/demo-${id}-mobile.webp`, width: 390, height: 844, alt: `${business} sample website on a phone` },
});

const RAW_TEMPLATES: TemplateInput[] = [
  ...WEBSITE_DEMOS.map((d) => ({
    id: d.id,
    industry: "handyman",
    status: "published" as const,
    design: d.design,
    business: d.business,
    url: d.url,
    verifiedOn: HANDYMAN_VERIFIED_ON,
    position: d.position,
    description: d.description,
    palette: [...d.palette],
    fictional: true as const,
    styleInterest: d.style,
    desktop: d.desktop,
    mobile: d.mobile,
  })),
  {
    id: "aurelle",
    industry: "salons",
    status: "published",
    design: "Gilded Editorial",
    business: "Aurelle Salon",
    url: "https://preview-1794740742139640803.vibepreview.app/",
    verifiedOn: "2026-11-16",
    position: "Dark, editorial and quietly luxurious, for color and extension specialists who price by consultation.",
    description:
      "Near-black and soft gold, a high-contrast serif with italic accents, a full-bleed salon photograph, a service menu with starting prices, and a call and book bar that stays on screen on phones.",
    palette: ["#0f0d0b", "#c9a96e", "#f4efe7"],
    fictional: true,
    ...shots("aurelle", "Aurelle Salon"),
  },
];

export const WEBSITE_TEMPLATES: readonly TemplateInput[] = z
  .array(websiteTemplateSchema)
  .superRefine((list, ctx) => {
    if (new Set(list.map((t) => t.id)).size !== list.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate template id" });
    const slugs = new Set(INDUSTRIES.map((i) => i.slug));
    for (const t of list) {
      if (!slugs.has(t.industry)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown industry ${t.industry} on ${t.id}` });
    }
  })
  .parse(RAW_TEMPLATES);

const isPublished = (t: TemplateInput): t is PublishedTemplate => t.status === "published";

/** Published templates, optionally for one industry, in registry order. */
export function publishedTemplates(industry?: string): PublishedTemplate[] {
  return WEBSITE_TEMPLATES.filter(isPublished).filter((t) => !industry || t.industry === industry);
}

/** Industries with at least one published template, in registry order. */
export function publishedIndustries(): Industry[] {
  return INDUSTRIES.filter((i) => publishedTemplates(i.slug).length > 0);
}

/** The industry for a URL slug, only while it has a published template. */
export function publishedIndustry(slug: string): Industry | undefined {
  return publishedIndustries().find((i) => i.slug === slug);
}

/**
 * Where "request a preview in this style" goes. Templates with an approved
 * style id prefill the Services page form (or its showcase email request);
 * the rest get a prefilled email naming the design, because the inquiry
 * form has no matching style or business type yet.
 */
export type PreviewAction =
  | { kind: "form"; href: string }
  | { kind: "email"; lines: readonly (readonly [label: string, value: string])[] };

export function previewActionFor(t: PublishedTemplate, industry: Industry): PreviewAction {
  if (t.styleInterest) {
    const q = new URLSearchParams({ style: t.styleInterest });
    if (industry.businessType) q.set("type", industry.businessType);
    return { kind: "form", href: `/services?${q.toString()}#preview` };
  }
  return {
    kind: "email",
    lines: [
      ["Type of business", industry.name],
      ["Website style", `${t.design} (the ${t.business} example)`],
    ],
  };
}

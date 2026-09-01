import { z } from "zod";

/**
 * Ecosystem registry contract.
 *
 * The registry in ./products.ts is the single source of truth for product
 * names, roles, canonical descriptions, statuses, and links across the
 * marketing site. It is validated at build time — an invalid entry fails
 * the build, which is how copy/status drift is prevented.
 */

export const productStatusSchema = z.enum([
  "live",
  "now-launching",
  "in-development",
  "planned",
]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const productTierSchema = z.enum(["core", "standalone"]);
export type ProductTier = z.infer<typeof productTierSchema>;

export const productLinkSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("internal"),
    href: z
      .string()
      .regex(
        /^\/[a-z0-9\-/]*(#[a-z0-9-]*)?$/,
        "internal href must be a root-relative path with optional #anchor",
      ),
  }),
  z.object({
    kind: z.literal("external"),
    href: z
      .string()
      .url()
      .regex(/^https:\/\//, "external href must be https"),
  }),
]);
export type ProductLink = z.infer<typeof productLinkSchema>;

export const productSchema = z.object({
  /** URL-safe unique id. */
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(2),
  /** One-word role in the system: Guidance, Voice, Judgment, Order, Reach. */
  role: z.string().min(3).max(24),
  /** Canonical one-line description. The ONLY place this sentence lives. */
  tagline: z.string().min(40).max(200),
  status: productStatusSchema,
  /** core = part of the Entrepreneuria subscription; standalone = own SaaS. */
  tier: productTierSchema,
  /** Ring in the constellation. 1 = innermost. Layout is computed, never hard-coded. */
  orbitalTier: z.number().int().min(1).max(4),
  badge: z.enum(["FLAGSHIP", "FROM ENTREPRENEURIA"]).optional(),
  /** Product mark; null until one exists. Never substitute a fake. */
  logo: z
    .string()
    .regex(/^\/logos\/.+\.(png|svg|webp)$/)
    .nullable(),
  link: productLinkSchema,
  /** Real product UI only. null until a production screenshot exists. */
  screenshot: z
    .object({
      src: z.string().regex(/^\//),
      alt: z.string().min(20),
    })
    .nullable(),
});
export type Product = z.infer<typeof productSchema>;

export const ecosystemSchema = z
  .array(productSchema)
  .min(1)
  .superRefine((products, ctx) => {
    const seenSlugs = new Set<string>();
    for (const p of products) {
      if (seenSlugs.has(p.slug)) {
        ctx.addIssue({ code: "custom", message: `Duplicate product slug "${p.slug}"` });
      }
      seenSlugs.add(p.slug);
    }
    const flagships = products.filter((p) => p.badge === "FLAGSHIP");
    if (flagships.length > 1) {
      ctx.addIssue({ code: "custom", message: "Only one product may carry the FLAGSHIP badge" });
    }
    const standalone = products.filter((p) => p.tier === "standalone");
    for (const p of standalone) {
      if (p.link.kind !== "external") {
        ctx.addIssue({
          code: "custom",
          message: `Standalone product "${p.slug}" must link externally`,
        });
      }
      if (p.badge !== "FROM ENTREPRENEURIA") {
        ctx.addIssue({
          code: "custom",
          message: `Standalone product "${p.slug}" must carry the FROM ENTREPRENEURIA badge`,
        });
      }
    }
  });

/** Resource-layer entries (Launch Pad / Exchange) for the journey scene. */
export const resourceLayerEntrySchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/),
  /** Journey stage label: START / BUILD / SUPPLY. */
  stage: z.enum(["START", "BUILD", "SUPPLY"]),
  name: z.string().min(2),
  description: z.string().min(40).max(220),
  link: productLinkSchema,
});
export type ResourceLayerEntry = z.infer<typeof resourceLayerEntrySchema>;

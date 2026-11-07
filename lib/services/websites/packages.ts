/**
 * Entrepreneuria Websites — package registry.
 *
 * The SINGLE source of truth for website package identity and pricing.
 * Page, form select, checkout and billing all read from here; nothing else
 * may hardcode a price. Prices are integer cents, USD, tax-exclusive.
 *
 * Spec v1.0 (2026-11-06) §2: names and prices APPROVED. Feature
 * entitlements are VERIFY — they must not be inferred from package names,
 * so every package ships with an empty, unverified entitlement list until
 * the GoHighLevel audit and the owner sign off the matrix.
 */
import { z } from "zod";

export const PRICING_VERSION = "2026-11-06.v1" as const;

export const PACKAGE_IDS = ["starter", "growth", "business"] as const;
export type PackageId = (typeof PACKAGE_IDS)[number];

const centsSchema = z.number().int().nonnegative();

const entitlementSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    label: z.string().min(1),
    /** Only "verified" entitlements may render as available (spec §10F). */
    status: z.enum(["verified", "pending_verification"]),
    limit: z.number().int().positive().optional(),
  })
  .strict();

const packageSchema = z
  .object({
    id: z.enum(PACKAGE_IDS),
    displayName: z.string().min(1),
    setupPriceCents: centsSchema.refine((v) => v > 0, "setup price required"),
    monthlyPriceCents: centsSchema.refine((v) => v > 0, "monthly price required"),
    currency: z.literal("USD"),
    taxInclusive: z.literal(false),
    billingInterval: z.literal("month"),
    /** Spec §3 APPROVED: one-month minimum commitment. */
    minimumTermMonths: z.literal(1),
    recommended: z.boolean(),
    entitlements: z.array(entitlementSchema),
    /** Spec §2 VERIFY: the whole matrix is unconfirmed until signed off. */
    entitlementsStatus: z.enum(["approved", "pending_verification"]),
    pricingVersion: z.literal(PRICING_VERSION),
  })
  .strict();

export type WebsitePackage = z.infer<typeof packageSchema>;
export type Entitlement = z.infer<typeof entitlementSchema>;

const registrySchema = z
  .array(packageSchema)
  .length(PACKAGE_IDS.length)
  .superRefine((pkgs, ctx) => {
    const ids = new Set(pkgs.map((p) => p.id));
    if (ids.size !== pkgs.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate package id" });
    }
    if (pkgs.filter((p) => p.recommended).length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "exactly one package must be recommended" });
    }
    for (const p of pkgs) {
      if (p.entitlementsStatus === "approved" && p.entitlements.some((e) => e.status !== "verified")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${p.id}: an approved matrix cannot contain unverified entitlements`,
        });
      }
    }
  });

/* Order is display order. Growth recommended (Sprint 2 locked decision). */
export const WEBSITE_PACKAGES: readonly WebsitePackage[] = registrySchema.parse([
  {
    id: "starter",
    displayName: "Website Starter",
    setupPriceCents: 19_900,
    monthlyPriceCents: 7_500,
    currency: "USD",
    taxInclusive: false,
    billingInterval: "month",
    minimumTermMonths: 1,
    recommended: false,
    entitlements: [],
    entitlementsStatus: "pending_verification",
    pricingVersion: PRICING_VERSION,
  },
  {
    id: "growth",
    displayName: "Growth Website",
    setupPriceCents: 24_900,
    monthlyPriceCents: 14_900,
    currency: "USD",
    taxInclusive: false,
    billingInterval: "month",
    minimumTermMonths: 1,
    recommended: true,
    entitlements: [],
    entitlementsStatus: "pending_verification",
    pricingVersion: PRICING_VERSION,
  },
  {
    id: "business",
    displayName: "Business Growth System",
    setupPriceCents: 39_900,
    monthlyPriceCents: 24_900,
    currency: "USD",
    taxInclusive: false,
    billingInterval: "month",
    minimumTermMonths: 1,
    recommended: false,
    entitlements: [],
    entitlementsStatus: "pending_verification",
    pricingVersion: PRICING_VERSION,
  },
]);

export function isPackageId(value: unknown): value is PackageId {
  return typeof value === "string" && (PACKAGE_IDS as readonly string[]).includes(value);
}

export function getPackage(id: PackageId): WebsitePackage {
  const pkg = WEBSITE_PACKAGES.find((p) => p.id === id);
  if (!pkg) throw new Error(`Unknown website package: ${id}`);
  return pkg;
}

/** Entitlements safe to show as available. Empty until verified. */
export function getPublishableEntitlements(pkg: WebsitePackage): Entitlement[] {
  return pkg.entitlements.filter((e) => e.status === "verified");
}

/** "$199" / "$75" — whole dollars when exact, cents otherwise. */
export function formatUsd(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("cents must be an integer");
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

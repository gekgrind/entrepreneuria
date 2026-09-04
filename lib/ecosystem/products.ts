import {
  ecosystemSchema,
  resourceLayerEntrySchema,
  type Product,
  type ProductStatus,
  type ResourceLayerEntry,
} from "./schema";

/**
 * THE ECOSYSTEM REGISTRY — single source of truth.
 *
 * Canonical product descriptions live here and ONLY here. Product pages,
 * pricing, footer, and homepage should all derive from this registry over
 * time. Parsed at module load: invalid data fails `next build`.
 */

const productsRaw = [
  {
    slug: "prospra",
    name: "Prospra",
    role: "Guidance",
    tagline:
      "Your AI business mentor for turning ideas into stronger, smarter businesses.",
    status: "now-launching",
    tier: "core",
    orbitalTier: 1,
    badge: "FLAGSHIP",
    logo: "/logos/prospra_logo.png",
    link: { kind: "internal", href: "/prospra" },
    screenshot: {
      src: "/marketing/screenshots/generated/prospra-1200.webp",
      alt: "Prospra founder workspace: welcome dashboard with founder score, mentor sessions, and launch setup checklist.",
    },
  },
  {
    slug: "architecta",
    name: "Architecta",
    role: "Voice",
    tagline:
      "Your AI content strategist for planning, creating, and managing your brand's content.",
    status: "in-development",
    tier: "core",
    orbitalTier: 2,
    badge: undefined,
    logo: "/logos/architecta_logo.png",
    link: { kind: "internal", href: "/architecta" },
    screenshot: {
      src: "/marketing/screenshots/generated/architecta-1200.webp",
      alt: "Architecta dashboard: strategic intelligence view with an AI strategy blueprint and an action queue.",
    },
  },
  {
    slug: "directorium",
    name: "Directorium",
    role: "Judgment",
    tagline:
      "An AI boardroom of specialized advisors that challenge your thinking and help you make better business decisions.",
    status: "in-development",
    tier: "core",
    orbitalTier: 2,
    badge: undefined,
    logo: "/logos/directorium_logo.png",
    link: { kind: "internal", href: "/directorium" },
    screenshot: {
      src: "/marketing/screenshots/generated/directorium-1200.webp",
      alt: "Directorium AI boardroom: a six-member AI board deliberating a market expansion decision with a final recommendation and vote split.",
    },
  },
  {
    slug: "synceri",
    name: "Synceri",
    role: "Order",
    tagline:
      "Your AI life-admin assistant for organizing the work, tasks, and responsibilities competing for your attention.",
    status: "in-development",
    tier: "core",
    orbitalTier: 2,
    badge: undefined,
    logo: "/logos/synceri_logo.png",
    link: { kind: "internal", href: "/synceri" },
    screenshot: {
      src: "/marketing/screenshots/generated/synceri-1200.webp",
      alt: "Synceri Today dashboard: daily focus, life alignment score, daily rhythm, schedule, and items needing attention.",
    },
  },
  {
    slug: "channelwright",
    name: "Channelwright",
    role: "Reach",
    tagline:
      "An AI operating system for building and running a profitable YouTube media business.",
    status: "in-development",
    tier: "standalone",
    orbitalTier: 3,
    badge: "FROM ENTREPRENEURIA",
    logo: null,
    link: { kind: "external", href: "https://channelwright.entrepreneuria.io" },
    screenshot: null,
  },
] satisfies unknown[];

export const PRODUCTS: readonly Product[] = Object.freeze(
  ecosystemSchema.parse(productsRaw),
);

const resourceLayerRaw = [
  {
    slug: "launch-pad",
    stage: "START",
    name: "The Launch Pad",
    description:
      "Free tools, templates, and resources for the very beginning. No account required.",
    link: { kind: "internal", href: "/launch-pad" },
  },
  {
    slug: "products",
    stage: "BUILD",
    name: "The Products",
    description:
      "Prospra today. Architecta, Directorium, and Synceri as they ship — one ecosystem, one login.",
    link: { kind: "internal", href: "/#ecosystem" },
  },
  {
    slug: "exchange",
    stage: "SUPPLY",
    name: "The Exchange",
    description:
      "The marketplace layer: the Digital Vault and Agentverse, for resources and specialized capability when you need more.",
    link: { kind: "internal", href: "/exchange" },
  },
] satisfies unknown[];

export const RESOURCE_LAYER: readonly ResourceLayerEntry[] = Object.freeze(
  resourceLayerEntrySchema.array().parse(resourceLayerRaw),
);

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  live: "Live",
  "now-launching": "Now launching",
  "in-development": "In development",
  planned: "Planned",
};

/** Statuses shown with a lit (cyan) indicator; the rest get a hollow dot. */
export function isLitStatus(status: ProductStatus): boolean {
  return status === "live" || status === "now-launching";
}

export function getProduct(slug: string): Product {
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) throw new Error(`Unknown product slug: ${slug}`);
  return product;
}

export function getFlagship(): Product {
  const flagship = PRODUCTS.find((p) => p.badge === "FLAGSHIP");
  if (!flagship) throw new Error("Registry has no FLAGSHIP product");
  return flagship;
}

export function getProductsByOrbitalTier(tier: number): Product[] {
  return PRODUCTS.filter((p) => p.orbitalTier === tier);
}

export function getMaxOrbitalTier(): number {
  return Math.max(...PRODUCTS.map((p) => p.orbitalTier));
}

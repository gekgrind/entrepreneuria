import type { MetadataRoute } from "next";

const BASE = "https://entrepreneuria.io";

/**
 * Sitemap — marketing surface only. Auth, authenticated app, and API
 * routes are intentionally excluded.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const core: Array<[string, number, MetadataRoute.Sitemap[number]["changeFrequency"]]> = [
    ["/", 1, "weekly"],
    ["/prospra", 0.9, "monthly"],
    ["/architecta", 0.8, "monthly"],
    ["/directorium", 0.8, "monthly"],
    ["/synceri", 0.8, "monthly"],
    ["/pricing", 0.8, "monthly"],
    ["/waitlist", 0.8, "monthly"],
    ["/about", 0.7, "monthly"],
    ["/contact", 0.6, "yearly"],
  ];

  /**
   * The two free destinations, plus each tool's own landing page — every
   * one of them is a distinct search intent worth ranking for. Retired
   * concepts (Launch Pad, blog, community, Exchange) live in
   * `app/_archive` and are deliberately absent.
   */
  const resources: Array<[string, number]> = [
    ["/tools", 0.8],
    ["/library", 0.8],
    ["/tools/business-model-blueprint", 0.6],
    ["/tools/market-analysis-ai", 0.6],
    ["/tools/financial-projector", 0.6],
    ["/tools/customer-persona-builder", 0.6],
    ["/tools/pitch-deck-creator", 0.6],
    ["/tools/hiring-assistant", 0.6],
  ];

  const legal = [
    "/privacy",
    "/terms",
    "/cookies",
    "/acceptable-use",
    "/ai-transparency",
    "/compliance",
    "/security",
    "/status",
    "/subprocessors",
    "/trust",
    "/vulnerability-disclosure",
    "/data-deletion",
  ];

  return [
    ...core.map(([path, priority, changeFrequency]) => ({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    })),
    ...resources.map(([path, priority]) => ({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority,
    })),
    ...legal.map((path) => ({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}

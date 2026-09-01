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

  const resources: Array<[string, number]> = [
    ["/launch-pad", 0.7],
    ["/launch-pad/tools", 0.7],
    ["/launch-pad/resources", 0.7],
    ["/launch-pad/blog", 0.6],
    ["/launch-pad/blog/ai-tools", 0.5],
    ["/launch-pad/blog/first-100-customers", 0.5],
    ["/launch-pad/blog/founder-minset-shift", 0.5],
    ["/launch-pad/blog/run-business-solo", 0.5],
    ["/launch-pad/blog/solo-founders-fail-year-one", 0.5],
    ["/launch-pad/blog/what-is-entrepreneuria", 0.5],
    ["/exchange", 0.6],
    ["/exchange/digital-vault", 0.5],
    ["/exchange/agentverse", 0.5],
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

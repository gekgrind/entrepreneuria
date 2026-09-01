import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/command-center",
          "/account",
          "/settings",
          "/chat",
          "/onboarding",
        ],
      },
    ],
    sitemap: "https://entrepreneuria.io/sitemap.xml",
  };
}

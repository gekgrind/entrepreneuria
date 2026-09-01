import type { Metadata } from "next";

import { getPrimaryCta } from "@/lib/launch";
import { PRODUCTS } from "@/lib/ecosystem/products";
import { JourneyExperience } from "@/components/journey/JourneyExperience";
import { JourneyNarrative } from "@/components/journey/JourneyNarrative";
import { JsonLd } from "@/components/home/JsonLd";

const TITLE = "Entrepreneuria — Everything Entrepreneur";
const DESCRIPTION =
  "An ecosystem of AI-powered mentorship, strategy, and tools for people building a business of their own — starting with Prospra, your AI business mentor.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "https://entrepreneuria.io",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://entrepreneuria.io",
    siteName: "Entrepreneuria",
    type: "website",
    images: [
      {
        url: "/og/constellation-og.png",
        width: 1200,
        height: 630,
        alt: "The Entrepreneuria ecosystem — an ecosystem of intelligence surrounding one founder.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og/constellation-og.png"],
  },
};

/**
 * Homepage (/) — the cinematic scroll-controlled journey, promoted from
 * /journey-preview. Server-rendered narrative is the full experience with
 * zero required JS; JourneyExperience progressively enhances it with the
 * sticky WebGL stage when every gate passes (no reduced motion, kill
 * switch off, WebGL available). Product data always comes from the
 * ecosystem registry.
 */
export default function HomePage() {
  const cta = getPrimaryCta();
  return (
    <>
      <JsonLd />
      <JourneyExperience cta={cta} products={PRODUCTS}>
        <JourneyNarrative cta={cta} products={PRODUCTS} />
      </JourneyExperience>
    </>
  );
}

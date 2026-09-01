import type { Metadata } from "next";

import { SceneHero } from "@/components/home/scenes/SceneHero";
import { SceneReality } from "@/components/home/scenes/SceneReality";
import { SceneTurn } from "@/components/home/scenes/SceneTurn";
import { SceneConstellation } from "@/components/home/scenes/SceneConstellation";
import { SceneProof } from "@/components/home/scenes/SceneProof";
import { ScenePath } from "@/components/home/scenes/ScenePath";
import { SceneFounder } from "@/components/home/scenes/SceneFounder";
import { SceneClose } from "@/components/home/scenes/SceneClose";
import { HomeMotion } from "@/components/home/motion/HomeMotion";
import { JsonLd } from "@/components/home/JsonLd";

const TITLE = "Entrepreneuria — Everything Entrepreneur";
const DESCRIPTION =
  "An ecosystem of AI-powered mentorship, strategy, and tools for people building a business of their own — starting with Prospra, your AI business mentor.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
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
        alt: "The Entrepreneuria constellation — an ecosystem of intelligence surrounding one founder.",
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
 * Homepage — "The Constellation".
 *
 * Server-first: the entire page is meaningful HTML with zero required
 * client JS. Cinematic layers (Lenis/GSAP motion, R3F constellation,
 * hero particle field) progressively enhance this baseline in Stages 5–7.
 *
 * Scene order: Dark → Reality → Turn → Constellation → Proof → Path →
 * Heartbeat → Decision.
 */
export default function HomePage() {
  return (
    <div className="overflow-x-clip bg-void-900 text-white">
      <JsonLd />
      <HomeMotion />
      <SceneHero />
      <SceneReality />
      <SceneTurn />
      <SceneConstellation />
      <SceneProof />
      <ScenePath />
      <SceneFounder />
      <SceneClose />
    </div>
  );
}

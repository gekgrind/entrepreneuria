import type { Metadata } from "next";

import { getPrimaryCta } from "@/lib/launch";
import { PRODUCTS } from "@/lib/ecosystem/products";
import { JourneyExperience } from "@/components/journey/JourneyExperience";
import { JourneyNarrative } from "@/components/journey/JourneyNarrative";

export const metadata: Metadata = {
  title: "Journey Preview — Entrepreneuria",
  description:
    "Proof of concept: a cinematic, scroll-controlled journey from chaos to clarity.",
  robots: { index: false, follow: false },
};

/**
 * /journey-preview — isolated proof-of-concept route for Homepage V2.
 * Scenes 1–3: Chaos → Collapse → Particle Tunnel → The Turn.
 * Scenes 4–6: The Ecosystem Forms → Product Exploration → Meet Prospra.
 *
 * The production homepage (/) is untouched. This route renders the full
 * static narrative server-side; the cinematic layer enhances it only
 * when every gate passes (no reduced motion, kill switch off, WebGL).
 * Product data always comes from the ecosystem registry.
 */
export default function JourneyPreviewPage() {
  const cta = getPrimaryCta();
  return (
    <JourneyExperience cta={cta} products={PRODUCTS}>
      <JourneyNarrative cta={cta} products={PRODUCTS} />
    </JourneyExperience>
  );
}

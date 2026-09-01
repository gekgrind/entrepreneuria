/**
 * proof-cards — the Scene 7 screenshot stack definition.
 *
 * REAL product captures only (the no-fake-UI rule). Alt/caption language
 * derives from the ecosystem registry and the approved SceneProof scene.
 * Derivatives come from the deterministic asset pipeline
 * (scripts/optimize-assets.mjs → /marketing/screenshots/generated/).
 *
 * ASSET STATUS (Phase 3 audit): the Command Center capture is sharp at
 * 3200×2100; the Prospra and Architecta captures are real but soft at
 * text level — flagged for HIGH-RES REPLACEMENT. To swap: replace the
 * source PNGs in /marketing-screenshots, re-run `npm run assets:optimize`.
 * No code changes needed.
 */
import { getProduct, PRODUCT_STATUS_LABELS } from "@/lib/ecosystem/products";
import type { ProductStatus } from "@/lib/ecosystem/schema";

export interface ProofCard {
  key: string;
  name: string;
  /** small cyan instrument label (registry role, or suite descriptor) */
  role: string;
  status: ProductStatus | null;
  logo: string | null;
  alt: string;
  caption: string;
  /** responsive derivative srcs (deterministic pipeline output) */
  src: string;
  srcSet: string;
  /** intrinsic derivative geometry (all captures share 1600:1050) */
  width: number;
  height: number;
}

const GEN = "/marketing/screenshots/generated";

function srcSetFor(name: string, mid: number): string {
  return `${GEN}/${name}-800.webp 800w, ${GEN}/${name}-${mid}.webp ${mid}w, ${GEN}/${name}-2400.webp 2400w`;
}

const prospra = getProduct("prospra");
const architecta = getProduct("architecta");

export const PROOF_CARDS: readonly ProofCard[] = [
  {
    key: "prospra",
    name: prospra.name,
    role: prospra.role,
    status: prospra.status,
    logo: prospra.logo,
    alt:
      prospra.screenshot?.alt ??
      "Prospra dashboard: the founder's live mentor workspace.",
    caption: `${prospra.name} — the founder dashboard, ${PRODUCT_STATUS_LABELS[prospra.status].toLowerCase()}`,
    src: `${GEN}/prospra-1600.webp`,
    srcSet: srcSetFor("prospra", 1600),
    width: 1600,
    height: 1050,
  },
  {
    key: "architecta",
    name: architecta.name,
    role: architecta.role,
    status: architecta.status,
    logo: architecta.logo,
    alt:
      architecta.screenshot?.alt ??
      "Architecta dashboard: the content strategy workspace.",
    caption: `${architecta.name} — ${architecta.role.toLowerCase()}, ${PRODUCT_STATUS_LABELS[architecta.status].toLowerCase()}`,
    src: `${GEN}/architecta-1200.webp`,
    srcSet: srcSetFor("architecta", 1200),
    width: 1600,
    height: 1050,
  },
  {
    key: "command-center",
    name: "Command Center",
    role: "The suite",
    status: null,
    logo: "/logos/entrepreneuria_logo.png",
    alt: "Entrepreneuria Command Center: the Founder Operating Suite showing Prospra, Architecta, and Directorium with a business health score.",
    caption: "Command Center — one login. Every light.",
    src: `${GEN}/command-center-1200.webp`,
    srcSet: srcSetFor("command-center", 1200),
    width: 1600,
    height: 1050,
  },
];

/** sizes shared by every consumer of the stack (enhanced + static) */
export const PROOF_SIZES = "(min-width: 768px) 58vw, 94vw";

/**
 * proof-cards — the Scene 7 screenshot stack definition.
 *
 * REAL product captures only (the no-fake-UI rule). Alt/caption language
 * derives from the ecosystem registry. Derivatives come from the
 * deterministic asset pipeline (scripts/optimize-assets.mjs →
 * /marketing/screenshots/generated/). To swap a capture: replace the
 * source PNG in /marketing-screenshots, re-run `npm run assets:optimize`.
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
  /** intrinsic derivative geometry (all captures share the same ratio) */
  width: number;
  height: number;
}

const GEN = "/marketing/screenshots/generated";

function srcSetFor(name: string): string {
  return `${GEN}/${name}-800.webp 800w, ${GEN}/${name}-1200.webp 1200w`;
}

const prospra = getProduct("prospra");
const architecta = getProduct("architecta");
const directorium = getProduct("directorium");
const synceri = getProduct("synceri");

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
    src: `${GEN}/prospra-1200.webp`,
    srcSet: srcSetFor("prospra"),
    width: 1200,
    height: 801,
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
    srcSet: srcSetFor("architecta"),
    width: 1200,
    height: 801,
  },
  {
    key: "directorium",
    name: directorium.name,
    role: directorium.role,
    status: directorium.status,
    logo: directorium.logo,
    alt:
      directorium.screenshot?.alt ??
      "Directorium dashboard: the AI boardroom workspace.",
    caption: `${directorium.name} — ${directorium.role.toLowerCase()}, ${PRODUCT_STATUS_LABELS[directorium.status].toLowerCase()}`,
    src: `${GEN}/directorium-1200.webp`,
    srcSet: srcSetFor("directorium"),
    width: 1200,
    height: 801,
  },
  {
    key: "synceri",
    name: synceri.name,
    role: synceri.role,
    status: synceri.status,
    logo: synceri.logo,
    alt:
      synceri.screenshot?.alt ??
      "Synceri dashboard: the life-admin workspace.",
    caption: `${synceri.name} — ${synceri.role.toLowerCase()}, ${PRODUCT_STATUS_LABELS[synceri.status].toLowerCase()}`,
    src: `${GEN}/synceri-1200.webp`,
    srcSet: srcSetFor("synceri"),
    width: 1200,
    height: 801,
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
    srcSet: srcSetFor("command-center"),
    width: 1200,
    height: 801,
  },
];

/** sizes shared by every consumer of the stack (enhanced + static) */
export const PROOF_SIZES = "(min-width: 768px) 58vw, 94vw";

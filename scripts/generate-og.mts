/**
 * OG key art generator (Stage 6, Amendment 6).
 *
 * Canonical social art is DETERMINISTIC: computed from the ecosystem
 * registry + the constellation design system, rendered SVG → PNG.
 * Magnific may produce optional enhancement layers, but reproduction
 * never requires it — change a product, re-run this script, done.
 *
 * Run: npx tsx scripts/generate-og.mts
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PRODUCTS, getMaxOrbitalTier } from "../lib/ecosystem/products";
import { computeOrbits } from "../lib/ecosystem/orbits";

const W = 1200;
const H = 630;
const ROOT = process.cwd();
const OUT = path.join(ROOT, "public/og");

const nodes = computeOrbits(PRODUCTS);
const maxTier = getMaxOrbitalTier();
const rings = Array.from({ length: maxTier }, (_, i) => (i + 1) * 150);

/* Map the 1000×1000 constellation space onto the right side of the card */
const SCALE = 0.62;
const CX = 880; // constellation center x on card
const CY = H / 2;
const mx = (x: number) => CX + (x - 500) * SCALE;
const my = (y: number) => CY + (y - 500) * SCALE;

const ringEls = rings
  .map(
    (r) =>
      `<circle cx="${CX}" cy="${CY}" r="${r * SCALE}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`,
  )
  .join("");

const spokeEls = nodes
  .map(
    (n) =>
      `<line x1="${CX}" y1="${CY}" x2="${mx(n.x)}" y2="${my(n.y)}" stroke="rgba(0,212,255,0.14)" stroke-width="1"/>`,
  )
  .join("");

const nodeEls = nodes
  .map(
    (n) => `
    <circle cx="${mx(n.x)}" cy="${my(n.y)}" r="${n.dotRadius * SCALE * 2.4}" fill="rgba(0,212,255,0.12)"/>
    <circle cx="${mx(n.x)}" cy="${my(n.y)}" r="${n.dotRadius * SCALE}" fill="#00d4ff"/>`,
  )
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#081527"/>
  <rect width="${W}" height="${H}" fill="url(#atm)"/>
  <defs>
    <radialGradient id="atm" cx="0.85" cy="0.5" r="0.9">
      <stop offset="0%" stop-color="rgba(79,124,167,0.20)"/>
      <stop offset="100%" stop-color="rgba(79,124,167,0)"/>
    </radialGradient>
    <radialGradient id="you" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="rgba(210,122,44,0.5)"/>
      <stop offset="100%" stop-color="rgba(210,122,44,0)"/>
    </radialGradient>
  </defs>
  ${ringEls}
  ${spokeEls}
  <circle cx="${CX}" cy="${CY}" r="34" fill="url(#you)"/>
  <circle cx="${CX}" cy="${CY}" r="6" fill="#d27a2c"/>
  ${nodeEls}
  <text x="80" y="270" font-family="Georgia, 'Times New Roman', serif" font-size="64" fill="#ffffff" letter-spacing="2">Entrepreneuria</text>
  <text x="82" y="322" font-family="'Courier New', monospace" font-size="17" fill="rgba(255,255,255,0.55)" letter-spacing="6">EVERYTHING ENTREPRENEUR</text>
  <line x1="82" y1="356" x2="282" y2="356" stroke="#d27a2c" stroke-width="2"/>
  <text x="82" y="396" font-family="Georgia, serif" font-style="italic" font-size="24" fill="rgba(255,255,255,0.8)">No founder should have to build alone.</text>
</svg>`;

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "constellation-og.svg"), svg);
await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, "constellation-og.png"));

console.log("public/og/constellation-og.svg");
console.log("public/og/constellation-og.png");

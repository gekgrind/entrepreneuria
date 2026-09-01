/**
 * Deterministic asset pipeline (Stage 6, Amendment 5).
 *
 * Rules:
 *  - Source originals are IMMUTABLE. This script only reads them.
 *  - Derivatives are written ONLY to generated/ folders.
 *  - Re-running with the same inputs produces the same outputs
 *    (fixed sharp settings, fixed widths, fixed names).
 *
 * Run: node scripts/optimize-assets.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_SCREENSHOTS = path.join(ROOT, "public/marketing/screenshots/generated");
const OUT_FOUNDER = path.join(ROOT, "public/images/founder");

/** Explicit manifest — no glob scanning; order and inputs are fixed.
 *  2400w derivatives feed the Scene 7 proof stack (journey-preview):
 *  the stack renders up to ~1000 CSS px wide → 2000+ px on retina. */
const MANIFEST = [
  {
    name: "prospra",
    src: "public/marketing-screenshots/prospra-dashboard-desktop-1600x1050@2x.png",
    widths: [2400, 1600, 800],
    outDir: OUT_SCREENSHOTS,
  },
  {
    name: "architecta",
    src: "public/marketing-screenshots/architecta-dashboard-desktop-1600x1050@2x.png",
    widths: [2400, 1200, 800],
    outDir: OUT_SCREENSHOTS,
  },
  {
    name: "command-center",
    src: "public/marketing-screenshots/command-center-desktop-1600x1050@2x.png",
    widths: [2400, 1200, 800],
    outDir: OUT_SCREENSHOTS,
  },
  {
    name: "misti-portrait",
    src: "public/images/profile.png",
    widths: [1200, 800],
    outDir: OUT_FOUNDER,
  },
];

const results = [];

for (const entry of MANIFEST) {
  const srcPath = path.join(ROOT, entry.src);
  const meta = await sharp(srcPath).metadata();
  await mkdir(entry.outDir, { recursive: true });

  for (const width of entry.widths) {
    if (width > (meta.width ?? 0)) continue; // never upscale
    const outPath = path.join(entry.outDir, `${entry.name}-${width}.webp`);
    const info = await sharp(srcPath)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toFile(outPath);
    results.push({
      name: entry.name,
      source: entry.src,
      output: path.relative(ROOT, outPath).replaceAll("\\", "/"),
      width: info.width,
      height: info.height,
      bytes: info.size,
    });
  }
}

await writeFile(
  path.join(OUT_SCREENSHOTS, "manifest.json"),
  JSON.stringify({ generated: new Date().toISOString(), results }, null, 2),
);

for (const r of results) {
  console.log(
    `${r.output}  ${r.width}x${r.height}  ${Math.round(r.bytes / 1024)}KB`,
  );
}
console.log(`\n${results.length} derivatives written.`);

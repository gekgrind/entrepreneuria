/**
 * Captures a template's gallery screenshots from its live demo, at the
 * same spec as the approved handyman captures:
 *   public/marketing/websites-demos/demo-<id>-desktop.webp  1440×900, 1x
 *   public/marketing/websites-demos/demo-<id>-mobile.webp   390×844, 1x (mobile emulation)
 * Fonts and network settle first; WebP quality 80. Overwrites both files.
 *
 * Run: npm run templates:capture -- <id> <https demo url>
 *   (set CHROMIUM_PATH to a Chromium binary if Playwright's own is not installed)
 * e.g. npm run templates:capture -- aurelle https://preview-1794740742139640803.vibepreview.app/
 *
 * Never run it for the handyman ids (redclay, porchlight, ashford): their
 * screenshots are approved originals (DECISION-REGISTER D-01) and are refused.
 * After capturing, update the template's `verifiedOn` in templates.ts.
 */
import path from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

const PROTECTED = new Set(["redclay", "porchlight", "ashford"]);

const [id, url] = process.argv.slice(2);
if (!id || !/^[a-z]+$/.test(id) || !url?.startsWith("https://")) {
  console.error("usage: npm run templates:capture -- <id> <https demo url>");
  process.exit(2);
}
if (PROTECTED.has(id)) {
  console.error(`refusing to overwrite approved screenshots for ${id}`);
  process.exit(2);
}

const outDir = path.join(process.cwd(), "public/marketing/websites-demos");
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
/* CHROMIUM_PATH: use an installed Chromium when the project's Playwright has not downloaded its own. */
const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ ...(proxy ? { proxy } : {}), ...(executablePath ? { executablePath } : {}) });

try {
  for (const [kind, viewport, mobile] of [
    ["desktop", { width: 1440, height: 900 }, false],
    ["mobile", { width: 390, height: 844 }, true],
  ] as const) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    if (!res || res.status() !== 200) throw new Error(`${kind}: HTTP ${res?.status() ?? "no response"}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(3000);
    const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length);
    if (broken) throw new Error(`${kind}: ${broken} image(s) failed to load; fix network access before capturing`);
    const png = await page.screenshot();
    const file = path.join(outDir, `demo-${id}-${kind}.webp`);
    await sharp(png).webp({ quality: 80 }).toFile(file);
    console.log(`wrote ${path.relative(process.cwd(), file)}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

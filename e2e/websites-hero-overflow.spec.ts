import { expect, test, type Page } from "@playwright/test";

/* Guards the Websites hero against running past a phone viewport with the real Playfair metrics.
 * document.scrollWidth cannot do this: html, body and the page shell use overflow-x: clip, so
 * overflow is cut off without ever widening the document. Each element is measured instead. */
const PHONE_WIDTHS = [375, 390];

/* Content that must fit. Scoping to content keeps decorative backgrounds out of the check. */
const HERO_CONTENT = {
  heading: "h1",
  "price line": "h1 span",
  "supporting text": "h1 ~ p",
  "CTA buttons": "h1 ~ div a",
  "offer card": "aside",
  "offer content": "aside :is(p, span, ul, li, a)",
} as const;
type Group = keyof typeof HERO_CONTENT;

type HeroReport = {
  width: number;
  scrollWidth: number;
  checked: Record<string, number>;
  offenders: { group: string; text: string; left: number; right: number }[];
};

function measureHero(page: Page): Promise<HeroReport> {
  return page.evaluate((content) => {
    // Measure layout, not paint: a transform or running animation never takes up page width.
    const layoutOnly = document.createElement("style");
    layoutOnly.textContent =
      "#top, #top * { transform: none !important; translate: none !important; rotate: none !important; scale: none !important; animation: none !important; transition: none !important; }";
    document.head.append(layoutOnly);

    const width = document.documentElement.clientWidth;
    const report: HeroReport = { width, scrollWidth: document.documentElement.scrollWidth, checked: {}, offenders: [] };
    const beyond = (r: DOMRect) => r.width > 0 && r.height > 0 && (r.right > width + 0.5 || r.left < -0.5);

    for (const [group, selector] of Object.entries(content)) {
      const shown = [...document.querySelectorAll<HTMLElement>(`#top ${selector}`)].filter(
        (el) => el.checkVisibility({ visibilityProperty: true }) && !el.closest('[aria-hidden="true"]'),
      );
      report.checked[group] = shown.length;
      for (const el of shown) {
        // Text is measured too: a box can fit while unbreakable text spills out of it.
        const rects = [el.getBoundingClientRect()];
        for (const node of el.childNodes) {
          if (node.nodeType !== Node.TEXT_NODE) continue;
          const range = document.createRange();
          range.selectNode(node);
          rects.push(...range.getClientRects());
        }
        const over = rects.filter(beyond);
        if (over.length) {
          report.offenders.push({
            group,
            text: (el.textContent ?? "").trim().slice(0, 40),
            left: Math.min(...over.map((r) => r.left)),
            right: Math.max(...over.map((r) => r.right)),
          });
        }
      }
    }
    layoutOnly.remove();
    return report;
  }, HERO_CONTENT);
}

function assertHeroFits(report: HeroReport) {
  // Guards against passing vacuously if the markup moves out from under the selectors.
  for (const group of Object.keys(HERO_CONTENT)) expect(report.checked[group], `${group} rendered`).toBeGreaterThan(0);
  expect(report.checked["CTA buttons"], "both CTAs rendered").toBeGreaterThanOrEqual(2);
  expect(report.offenders).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  test.skip(!PHONE_WIDTHS.includes(page.viewportSize()!.width), "Phone widths only");
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" }),
  );
  await page.goto("/services/websites", { waitUntil: "load" });

  const font = await page.locator("#h-hero").evaluate(async (h1) => {
    const style = getComputedStyle(h1);
    const family = style.fontFamily.split(",")[0];
    await document.fonts.load(`${style.fontWeight} ${style.fontSize} ${family}`, h1.textContent ?? "");
    await document.fonts.ready;
    const real = (name: string) => /Playfair[ _]Display/.test(name) && !/Fallback/.test(name);
    return { family, real: real(family), loaded: [...document.fonts].some((f) => real(f.family) && f.status === "loaded") };
  });
  expect(font, "hero heading uses the real Playfair, not a fallback").toMatchObject({ real: true, loaded: true });
});

test("hero content stays inside the viewport with the real font", async ({ page }) => {
  assertHeroFits(await measureHero(page));
});

test("negative control: the known whole-line nowrap overflow fails the check, even when clipped", async ({ page }) => {
  // The defect from motion-spec section 9A, applied by CSS so hydration cannot undo it.
  await page.addStyleTag({
    content: `
      html, body, #top { overflow-x: clip !important; }
      #h-hero > span { white-space: nowrap !important; }
      #h-hero > span::before { content: "Starting at "; }
    `,
  });
  const report = await measureHero(page);

  expect(report.scrollWidth, "clipping hides this from scrollWidth").toBeLessThanOrEqual(report.width);
  expect(() => assertHeroFits(report)).toThrow();
  const expected: Group[] = ["heading", "price line", "supporting text", "CTA buttons"];
  expect(report.offenders.map((o) => o.group)).toEqual(expect.arrayContaining(expected));
});

test("ignores transforms, hidden elements and decorative overflow", async ({ page }) => {
  await expect(page.locator('#top svg[aria-hidden="true"]').first()).toBeAttached();
  await page.addStyleTag({
    content: `
      #h-hero { transform: translateX(400px); }
      #top h1 ~ p:last-of-type { position: absolute; width: 900px; visibility: hidden; }
      #top aside > p:first-child { position: absolute; width: 900px; display: none; }
      #top svg[aria-hidden="true"] { position: absolute; left: 900px; }
    `,
  });
  assertHeroFits(await measureHero(page));
});

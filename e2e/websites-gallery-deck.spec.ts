import { expect, test, type Page } from "@playwright/test";

import { publishedTemplates } from "../lib/services/websites/templates";

/*
 * Industry gallery deck (/services/industries/[industry]).
 * Stacking is pure CSS: sticky cards plus a scroll-driven recede. These checks
 * pin the gates (who gets the stack), the geometry (cards stack under the header,
 * every control stays inside its card), the links, and filter navigation.
 *
 * Overflow is measured per element: html, body and the page shell use
 * overflow-x: clip, so document.scrollWidth never shows it.
 */

const DECK = "ol[data-stack]";

/** Mirrors deck.module.css: 1000px+ wide and 700px+ tall, or 768px+ wide and 900px+ tall. */
const stacks = (w: number, h: number) => (w >= 1000 && h >= 700) || (w >= 768 && h >= 900);

async function open(page: Page, slug: string) {
  const res = await page.goto(`/services/industries/${slug}`);
  expect(res?.status(), `${slug} should be served where the Services page is`).toBe(200);
  await expect(page.locator(DECK)).toBeVisible();
}

function positions(page: Page) {
  return page.locator(`${DECK} > li`).evaluateAll((lis) => lis.map((li) => getComputedStyle(li).position));
}

function controlsInsideCards(page: Page) {
  return page.locator(`${DECK} > li`).evaluateAll((lis) => {
    const vw = document.documentElement.clientWidth;
    return lis.flatMap((li, i) => {
      const card = li.querySelector("article")!.getBoundingClientRect();
      const problems: string[] = [];
      if (card.left < -0.5 || card.right > vw + 0.5) problems.push(`card ${i} wider than the viewport`);
      for (const a of li.querySelectorAll<HTMLElement>('a:not([tabindex="-1"])')) {
        const r = a.getBoundingClientRect();
        if (r.left < card.left - 0.5 || r.right > card.right + 0.5 || r.bottom > card.bottom + 0.5) problems.push(`card ${i}: "${a.textContent?.trim()}" clipped`);
      }
      return problems;
    });
  });
}

test.describe("industry gallery deck", () => {
  test("handyman: stacks only where there is room, otherwise a plain list", async ({ page }) => {
    await open(page, "handyman");
    const { width, height } = page.viewportSize()!;
    await expect(page.locator(DECK)).toHaveAttribute("data-stack", "on");
    const pos = await positions(page);
    expect(pos).toHaveLength(publishedTemplates("handyman").length);
    expect(new Set(pos)).toEqual(new Set([stacks(width, height) ? "sticky" : "static"]));
    expect(await controlsInsideCards(page)).toEqual([]);
  });

  test("handyman: cards stack under the header and release together", async ({ page }) => {
    const { width, height } = page.viewportSize()!;
    test.skip(!stacks(width, height), "plain list at this size");
    await open(page, "handyman");
    const deck = page.locator(DECK);
    const { top, bottom } = await deck.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + scrollY, bottom: r.bottom + scrollY };
    });
    const header = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 64);

    // Just before the release: every card stuck, each one peek lower than the last.
    const cardH = await page.locator(`${DECK} > li`).first().evaluate((li) => li.getBoundingClientRect().height);
    const n = publishedTemplates("handyman").length;
    const peek = 64;
    await page.evaluate((y) => window.scrollTo(0, y), bottom - cardH - (header + 16) - (n - 1) * peek - 2);
    const tops = await page.locator(`${DECK} > li`).evaluateAll((lis) => lis.map((li) => Math.round(li.getBoundingClientRect().top)));
    tops.forEach((t, i) => expect(Math.abs(t - (header + 16 + Math.min(i, 3) * peek))).toBeLessThanOrEqual(3));
    expect(await controlsInsideCards(page)).toEqual([]);

    // Past the deck: everything has scrolled away; nothing stays pinned over the next section.
    await page.evaluate((y) => window.scrollTo(0, y), bottom + 200);
    const after = await page.locator(`${DECK} > li`).evaluateAll((lis) => lis.map((li) => li.getBoundingClientRect().bottom));
    after.forEach((b) => expect(b).toBeLessThan(0));
    expect(top).toBeGreaterThan(0);
  });

  test("a focused control in a covered card comes to the front", async ({ page }) => {
    const { width, height } = page.viewportSize()!;
    test.skip(!stacks(width, height), "plain list at this size");
    await open(page, "handyman");
    const bottom = await page.locator(DECK).evaluate((el) => el.getBoundingClientRect().bottom + scrollY);
    await page.evaluate((y) => window.scrollTo(0, y - window.innerHeight), bottom);
    const cta = page.locator(`${DECK} > li`).first().getByRole("link", { name: /Explore the live demo/ });
    await cta.focus();
    const onTop = await cta.evaluate((a) => {
      const r = a.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit === a || a.contains(hit);
    });
    expect(onTop).toBe(true);
  });

  test("reduced motion: no pinning, same content", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "handyman");
    expect(new Set(await positions(page))).toEqual(new Set(["static"]));
    await expect(page.getByRole("link", { name: /Explore the live demo/ })).toHaveCount(publishedTemplates("handyman").length);
  });

  test("live demo links are the registry URLs and open in a new tab", async ({ page }) => {
    for (const slug of ["handyman", "salons"]) {
      await open(page, slug);
      const links = page.locator(`${DECK} a[target="_blank"]:not([tabindex="-1"])`);
      await expect(links).toHaveCount(publishedTemplates(slug).length);
      expect(await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(publishedTemplates(slug).map((t) => t.url));
      for (const rel of await links.evaluateAll((as) => as.map((a) => a.getAttribute("rel")))) expect(rel).toContain("noopener");
    }
  });

  test("salons: one card, no stack", async ({ page }) => {
    await open(page, "salons");
    await expect(page.locator(DECK)).toHaveAttribute("data-stack", "off");
    expect(await positions(page)).toEqual(["static"]);
    expect(await controlsInsideCards(page)).toEqual([]);
  });

  test("filter switches industry with a fresh deck, and back returns", async ({ page }) => {
    await open(page, "handyman");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
    await page.getByRole("navigation", { name: "Website examples by industry" }).getByRole("link", { name: /Hair salons/ }).click();
    await expect(page).toHaveURL(/\/services\/industries\/salons$/);
    await expect(page.locator(DECK)).toHaveAttribute("data-stack", "off");
    await expect(page.locator(`${DECK} > li`)).toHaveCount(publishedTemplates("salons").length);
    await expect(page.getByRole("link", { name: /Hair salons/, exact: false }).first()).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(page).toHaveURL(/\/services\/industries\/handyman$/);
    await expect(page.locator(`${DECK} > li`)).toHaveCount(publishedTemplates("handyman").length);
    await expect(page.getByRole("link", { name: "All industries" }).first()).toHaveAttribute("href", "/services/templates");
  });
});

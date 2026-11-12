import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const endpoint = "**/api/services/websites/inquiry";
const submitName = "Request My Free Website Preview";
const preview = (page: Page) => page.locator("#preview");
const form = (page: Page) => preview(page).locator("form");
const submit = (page: Page) => form(page).getByRole("button", { name: submitName });
const summary = (page: Page) => preview(page).getByRole("alert").filter({ hasText: "your attention" });

async function fill(page: Page) {
  await form(page).getByLabel("Your name").fill("Dana Reyes");
  await form(page).getByLabel("Business name").fill("Reyes Studio");
  await form(page).locator("#f-email").fill("dana@example.test");
  await form(page).getByLabel("Type of business").selectOption("Other local business");
  await expect(page.locator("[data-e2e-verification]")).toBeAttached();
}

async function checkA11y(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations()
      .filter((animation) => {
        const end = animation.effect?.getComputedTiming().endTime;
        return animation.playState === "running" && typeof end === "number" && Number.isFinite(end);
      })
      .map((animation) => animation.finished));
  });
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations.filter(({ impact }) => impact === "serious" || impact === "critical")
      .map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })),
  ).toEqual([]);
}

async function checkEmailFallback(link: Locator) {
  await expect(link).toHaveAttribute("href", /^mailto:/);
  const href = await link.evaluate((el: HTMLAnchorElement) => {
    // Exercise the actual click-time prefill without opening the OS mail client.
    el.addEventListener("click", (event) => event.preventDefault(), { once: true });
    el.click();
    return el.href;
  });
  expect(decodeURIComponent(href)).toContain("Business name: Reyes Studio");
}

async function success(page: Page) {
  const result = preview(page).getByRole("status").filter({ hasText: "Your request is in." });
  await expect(result).toBeFocused();
  await expect(result).toContainText("Requesting a preview does not commit you to anything.");
}

test.beforeEach(async ({ page }) => {
  // Always intercept submissions, including when BASE_URL points at staging.
  await page.route(endpoint, (route) => route.abort("blockedbyclient"));
  // Install the fixture before hydration so widget readiness does not depend
  // on the order Next loads the third-party script and mounts the form.
  await page.addInitScript(() => {
    let callback: ((token: string) => void) | undefined;
    window.turnstile = {
      render(container, options) {
        if (typeof container !== "string") container.setAttribute("data-e2e-verification", "");
        (window as unknown as { __e2eTurnstileOptions?: unknown }).__e2eTurnstileOptions = options;
        // A test can switch this one fixture into load-error mode (init-script order is undefined,
        // so there is a single fixture that reads the mode when the widget renders).
        if ((window as unknown as { __e2eTurnstileMode?: string }).__e2eTurnstileMode === "error") {
          queueMicrotask(() => (options as { "error-callback"?: () => void })["error-callback"]?.());
          return "e2e-widget-error";
        }
        callback = options.callback;
        queueMicrotask(() => callback?.("synthetic-ui-test-token"));
        return "e2e-widget";
      },
      reset() { queueMicrotask(() => callback?.("synthetic-ui-test-token")); },
      remove() {},
    };
  });
  await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "/* verification fixture installed by addInitScript */",
  }));
  await page.goto("/services/websites", { waitUntil: "domcontentloaded" });
  await expect(submit(page)).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator("[data-e2e-verification]")).toBeAttached({ timeout: 20_000 });
});

test("responsive offer, pricing labels, and single-package form", async ({ page }) => {
  const mobile = page.viewportSize()!.width < 960;
  await expect(page.getByRole("heading", { level: 1 })).toContainText("$75/month");
  await checkA11y(page);
  const setup = page.locator("#top h1 + p");
  if (mobile) {
    await expect(setup).toContainText("$199");
    await expect(setup).toContainText("Hosting included");
    await expect(setup).toBeInViewport({ ratio: 1 });
  } else {
    await expect(setup).toBeHidden();
    await expect(page.getByRole("complementary", { name: "Website Starter at a glance" })).toContainText("$199");
    await expect(page.getByRole("complementary", { name: "Website Starter at a glance" })).toContainText("Hosting included");
    await expect(page.getByRole("navigation", { name: "Page sections" }).getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "#packages");
  }
  await expect(page.getByRole("link", { name: "View Pricing", exact: true })).toHaveAttribute("href", "#packages");
  for (const section of ["#top", "#why", "#packages", "#faq"]) {
    await expect(page.locator(section)).not.toContainText(/Starting at|request form|service pages/i);
  }
  await expect(page.getByText("What happens after I request a preview?", { exact: true })).toBeVisible();
  await expect(page.getByText("Is hosting included?", { exact: true })).toBeVisible();
  await expect(page.locator("#faq")).toContainText(/A domain name.*is separate from hosting/);
  await expect(page.getByText("What is included in the monthly price?", { exact: true })).toBeVisible();
  await expect(page.locator("#f-pkg")).toHaveCount(0);
  await form(page).getByLabel("Type of business").selectOption("Other local business");
  await expect(page.locator("#f-type")).toHaveValue("Other local business");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

const dockLocator = (page: Page) => page.locator('[aria-label="Quick action"]');

async function scrollToY(page: Page, top: number) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);
}

/**
 * "ok" when the dock is shown, fully inside the viewport, flush with its bottom
 * edge, and is what a tap on its button hits; otherwise the measured geometry.
 * Judged against the viewport, not attributes (UX-02 passed an attribute-only test).
 */
function dockOnScreen(page: Page) {
  return dockLocator(page).evaluate((dock) => {
    const r = dock.getBoundingClientRect();
    const link = dock.querySelector("a")!;
    const lr = link.getBoundingClientRect();
    const hit = document.elementFromPoint(lr.left + lr.width / 2, lr.top + lr.height / 2);
    const g = {
      shown: dock.getAttribute("data-show") === "true" && getComputedStyle(dock).visibility === "visible",
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      left: r.left,
      right: r.right,
      vw: document.documentElement.clientWidth,
      vh: window.innerHeight,
      linkOnTop: hit === link || link.contains(hit),
    };
    const ok = g.shown && r.height > 0 && g.top >= 0 && g.left >= 0 && g.right <= g.vw &&
      Math.abs(r.bottom - g.vh) <= 1 && g.linkOnTop;
    return ok ? "ok" : JSON.stringify(g);
  });
}

async function expectDockPinnedOnScreen(page: Page, where: string) {
  await expect.poll(() => dockOnScreen(page), { message: `dock pinned to the viewport bottom ${where}` }).toBe("ok");
}

async function expectDockHidden(page: Page) {
  const dock = dockLocator(page);
  await expect(dock).toHaveAttribute("aria-hidden", "true");
  await expect(dock.locator("a")).toHaveAttribute("tabindex", "-1");
  await expect.poll(() => dock.evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");
}

test("phone dock stays pinned to the viewport while scrolling and is usable in place", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 760, "Phone-only dock");
  const dock = dockLocator(page);
  const link = dock.locator("a");
  await expectDockHidden(page);

  // Root-cause guard: a transform/perspective/filter/contain/will-change ancestor becomes the
  // containing block for position:fixed, which pinned the dock ~11,600px down the page (UX-02).
  const trap = await dock.evaluate((el) => {
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.transform !== "none" || cs.perspective !== "none" || cs.filter !== "none" ||
          cs.backdropFilter !== "none" || /paint|layout|strict|content/.test(cs.contain) ||
          /transform|perspective|filter/.test(cs.willChange) || cs.containerType !== "normal") {
        return `${a.tagName.toLowerCase()}.${a.className}`;
      }
    }
    return null;
  });
  expect(trap, "no ancestor may become the dock's containing block").toBeNull();

  await page.locator("#why h2").scrollIntoViewIfNeeded();
  await expect(dock).toHaveAttribute("aria-hidden", "false");
  await expect(dock).toContainText("$75/mo");
  await expect(dock).toContainText("$199 setup");
  await expect(link).toHaveAttribute("tabindex", "0");
  await expectDockPinnedOnScreen(page, "at #why");

  // Walk from #why to just before the form, part of a screen at a time: it stays on screen throughout.
  const { start, end, vh } = await page.evaluate(() => ({
    start: Math.round(document.querySelector("#why")!.getBoundingClientRect().top + window.scrollY),
    end: Math.round(document.querySelector("#preview")!.getBoundingClientRect().top + window.scrollY - window.innerHeight - 4),
    vh: window.innerHeight,
  }));
  expect(end).toBeGreaterThan(start);
  for (let y = start; y < end; y += Math.floor(vh * 0.6)) {
    await scrollToY(page, y);
    await expectDockPinnedOnScreen(page, `at scrollY=${y}`);
  }
  await scrollToY(page, end);
  await expectDockPinnedOnScreen(page, `at scrollY=${end}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);

  // Tap the dock where it is painted, without scrolling to it first: it takes the visitor to the form.
  const box = (await link.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page).toHaveURL(/#preview$/);
  await expect(page.locator("#preview h2")).toBeInViewport();
  await expectDockHidden(page);
});

test("phone dock steps aside for the menu, every form control and the footer", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 760, "Phone-only dock");
  await page.locator("#why h2").scrollIntoViewIfNeeded();
  await expectDockPinnedOnScreen(page, "at #why");

  // The header tucks away on scroll-down; a small scroll up brings its menu button back.
  const menuButton = page.getByRole("button", { name: "Open menu" });
  await page.mouse.wheel(0, -160);
  await expect(menuButton).toBeVisible();
  await expectDockPinnedOnScreen(page, "with the header revealed");
  await menuButton.click();
  await expectDockHidden(page);
  await page.getByRole("button", { name: "Close menu" }).click();
  // The global menu scroll lock (RootClientLayout) does not keep the scroll position, so return to #why.
  await page.locator("#why h2").scrollIntoViewIfNeeded();
  await expectDockPinnedOnScreen(page, "after closing the menu");

  // Bring each critical control to the bottom edge, exactly where the dock would sit.
  for (const target of [form(page).locator("#f-name"), form(page).locator("#f-email"), form(page).locator("#f-type"), submit(page)]) {
    await target.evaluate((el) => el.scrollIntoView({ block: "end", behavior: "instant" }));
    await expect(target).toBeInViewport({ ratio: 1 });
    await expectDockHidden(page);
  }
  await page.locator("footer").first().scrollIntoViewIfNeeded();
  await expectDockHidden(page);
});

test("no phone dock overlay at tablet and desktop widths", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 760, "Tablet and desktop only");
  const dock = dockLocator(page);
  const { end, vh } = await page.evaluate(() => ({
    end: document.documentElement.scrollHeight - window.innerHeight,
    vh: window.innerHeight,
  }));
  for (let y = 0; y < end + vh; y += vh) {
    await scrollToY(page, Math.min(y, end));
    await expect(dock).toBeHidden();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("success focuses the confirmation; a fresh request still sends Starter", async ({ page }) => {
  const packages: string[] = [];
  await page.route(endpoint, async (route) => {
    packages.push(route.request().postDataJSON().fields.package_interest);
    await route.fulfill({ json: { ok: true } });
  });
  await fill(page);
  await submit(page).click();
  await success(page);
  await preview(page).getByRole("button", { name: "Send another request" }).click();
  await fill(page);
  await submit(page).click();
  await success(page);
  expect(packages).toEqual(["starter", "starter"]);
  await checkA11y(page);
});

test("server field errors focus the summary, with a working field link", async ({ page }) => {
  await page.route(endpoint, (route) => route.fulfill({
    status: 400,
    json: { error: "invalid", fieldErrors: { email: ["Enter a valid email address, like name@example.com."] } },
  }));
  await fill(page);
  await submit(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page)).toContainText("Enter a valid email address");
  await summary(page).getByRole("link", { name: "Email" }).click();
  await expect(page.locator("#f-email")).toBeFocused();
  await expect(page.locator("#f-email")).toHaveValue("dana@example.test");
  await checkA11y(page);
});

const errors = [
  { name: "verification", status: 400, body: { error: "verification_failed" }, text: "verification check did not go through", fallback: false },
  { name: "rate limit", status: 429, body: { retryAfterSeconds: 120 }, text: "2 minutes", fallback: true },
  { name: "capacity", status: 503, body: { error: "capacity" }, text: "not taking new preview requests", fallback: true },
  { name: "server failure", status: 500, body: {}, text: "could not send your request", fallback: true },
  { name: "network failure", status: 0, body: {}, text: "could not send your request", fallback: true },
] as const;

for (const { name, status, body, text, fallback } of errors) {
  test(`${name} leaves answers in place and focuses the alert`, async ({ page }) => {
    await page.route(endpoint, (route) => status ? route.fulfill({ status, json: body }) : route.abort());
    await fill(page);
    await submit(page).click();
    const alert = preview(page).getByRole("alert").filter({ hasText: text });
    await expect(alert).toBeFocused();
    await expect(page.locator("#f-biz")).toHaveValue("Reyes Studio");
    if (fallback) await checkEmailFallback(alert.getByRole("link", { name: /Email my request/ }));
  });
}

async function startPending(page: Page) {
  const pending = Promise.withResolvers<Route>();
  await page.route(endpoint, (route) => { pending.resolve(route); });
  await fill(page);
  await page.clock.install();
  await submit(page).click();
  return pending.promise;
}

test("slow request announces progress and can still succeed", async ({ page }) => {
  const pending = await startPending(page);
  await page.clock.fastForward(8_000);
  await expect(preview(page).getByRole("status").filter({ hasText: "Still sending" })).toBeVisible();
  await page.clock.fastForward(4_000);
  await pending.fulfill({ json: { ok: true } });
  await success(page);
  await expect(preview(page).getByText("Still sending", { exact: false })).toHaveCount(0);
});

test("deadline preserves answers and idempotency, and offers the email fallback", async ({ page }) => {
  const pending = await startPending(page);
  const key = pending.request().postDataJSON().idempotency_key;
  expect(key).toBeTruthy();
  await page.clock.fastForward(60_000);
  const alert = preview(page).getByRole("alert").filter({ hasText: "could not confirm that your request arrived" });
  await expect(alert).toBeFocused();
  await expect(page.locator("#f-biz")).toHaveValue("Reyes Studio");
  await checkEmailFallback(alert.getByRole("link", { name: /Email my request/ }));
  await page.route(endpoint, async (route) => {
    expect(route.request().postDataJSON().idempotency_key).toBe(key);
    await route.fulfill({ json: { ok: true } });
  });
  await submit(page).click();
  await success(page);
});

test("client validation follows the field order and requires a phone for phone calls", async ({ page }) => {
  await submit(page).click();
  await expect(summary(page)).toBeFocused();
  await expect(summary(page).getByRole("link")).toHaveText(["Your name", "Business name", "Email", "Type of business"]);
  const phone = form(page).getByRole("radio", { name: "Phone call" });
  await phone.press("Space");
  await expect(phone).toBeChecked();
  await submit(page).click();
  await expect(summary(page).getByRole("link")).toHaveText(["Your name", "Business name", "Email", "Phone", "Type of business"]);
});

test("three fictional demonstration websites, each with its own external live-demo link", async ({ page }) => {
  const demos = page.locator("article[id^='dc-']");
  await expect(demos).toHaveCount(3);
  const pageOrigin = new URL(page.url()).origin;
  const destinations: string[] = [];
  for (const demo of await demos.all()) {
    // The actionable CTA (the screenshot link is aria-hidden and must point at the same place).
    const cta = demo.getByRole("link", { name: /View live demo of/i, includeHidden: true });
    await expect(cta).toHaveCount(1);
    const href = await cta.getAttribute("href");
    const url = new URL(href!);
    expect(url.protocol).toBe("https:");
    expect(url.origin).not.toBe(pageOrigin);
    await expect(cta).toHaveAttribute("target", "_blank");
    for (const a of await demo.locator("a[href]").all()) {
      expect(await a.getAttribute("href")).toBe(href);
      // Every link that opens a new tab must carry the exact `noopener` token.
      if ((await a.getAttribute("target")) === "_blank") {
        expect((await a.getAttribute("rel"))?.split(/\s+/) ?? []).toContain("noopener");
      }
    }
    destinations.push(url.href);
  }
  expect(new Set(destinations).size).toBe(3);
  if (page.viewportSize()!.width < 1000) {
    await expect(page.getByRole("tablist", { name: "Sample website designs" }).getByRole("tab")).toHaveCount(3);
  }
});

test("Website Starter is the only offer, at $199 one-time setup plus $75 a month", async ({ page }) => {
  const pricing = page.locator("#packages");
  const offers = pricing.locator("h3[id^='pk-']");
  await expect(offers).toHaveCount(1);
  await expect(offers).toHaveText("Website Starter");
  await expect(offers).toBeVisible();
  const cards = pricing.locator("article[aria-labelledby^='pk-']");
  await expect(cards).toHaveCount(1);
  const card = cards.first();
  await expect(card.getByRole("heading", { level: 3 })).toHaveText("Website Starter");
  await expect(card.getByText(/^\$75(\.00)?$/)).toBeVisible();
  await expect(card.getByText("/month", { exact: true })).toBeVisible();
  await expect(card.getByText(/^plus \$199(\.00)? one-time setup$/)).toBeVisible();
  for (const name of ["Growth Website", "Business Growth System"]) await expect(page.locator("body")).not.toContainText(name);
  await expect(page.getByRole("combobox", { name: /package/i })).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: /package/i })).toHaveCount(0);
});

test("a verification widget that fails to load offers the email fallback and keeps answers (mocked Turnstile)", async ({ page }) => {
  // Switch the single fixture into load-error mode, as an ad blocker or outage would cause.
  await page.addInitScript(() => {
    (window as unknown as { __e2eTurnstileMode?: string }).__e2eTurnstileMode = "error";
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  // Nothing the visitor did caused this, so it is shown in place: no focus move, no scroll.
  const notice = preview(page).getByRole("status").filter({ hasText: "verification check could not load" });
  await expect(notice).toBeVisible({ timeout: 20_000 });
  await expect(notice).not.toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // The visitor types after seeing the message; the email link must carry what they typed.
  await form(page).getByLabel("Business name").fill("Reyes Studio");
  await expect(form(page).getByLabel("Business name")).toHaveValue("Reyes Studio");
  await checkEmailFallback(notice.getByRole("link", { name: /Email my request/ }));
  // Sending is what moves focus, to the same message with the fallback; nothing is sent without a token.
  let sent = 0;
  await page.route(endpoint, (route) => {
    sent += 1;
    return route.abort("blockedbyclient");
  });
  await fill(page);
  await submit(page).click();
  const alert = preview(page).getByRole("alert").filter({ hasText: "verification check could not load" });
  await expect(alert).toBeFocused();
  await checkEmailFallback(alert.getByRole("link", { name: /Email my request/ }));
  expect(sent, "no request is sent without a verification token").toBe(0);
});

test("a later verification error neither interrupts typing nor moves the page (mocked Turnstile)", async ({ page }) => {
  const name = form(page).getByLabel("Your name");
  await name.click();
  await page.keyboard.type("Da");
  const y = await page.evaluate(() => window.scrollY);
  await page.evaluate(() =>
    (window as unknown as { __e2eTurnstileOptions?: { "error-callback"?: () => void } }).__e2eTurnstileOptions?.["error-callback"]?.(),
  );
  await expect(preview(page).getByRole("status").filter({ hasText: "verification check could not load" })).toBeVisible();
  await page.keyboard.type("na");
  await expect(name).toHaveValue("Dana");
  await expect(name).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
});

test("no page errors, hydration warnings or console errors while loading and scrolling", async ({ page }) => {
  test.slow();
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
  });
  await page.reload({ waitUntil: "networkidle" });
  // Every rendered section must exist; then walk the page a viewport at a time so each
  // intersection observer and lazy image runs, settling at every stop.
  for (const id of ["#top", "#examples", "#difference", "#why", "#packages", "#how", "#faq", "#preview"]) {
    await expect(page.locator(id)).toHaveCount(1);
  }
  const step = Math.floor(page.viewportSize()!.height * 0.8);
  for (let y = 0; ; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(150);
    const atEnd = await page.evaluate(() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2);
    if (atEnd) break;
  }
  await page.waitForTimeout(500);
  expect(problems).toEqual([]);
});

test("keyboard reaches submit and moves among gallery tabs when present", async ({ page }) => {
  const tabs = page.getByRole("tablist", { name: "Sample website designs" }).getByRole("tab");
  if (page.viewportSize()!.width < 1000) {
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(tabs.last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tabs.first()).toBeFocused();
  }
  await form(page).locator("#f-msg").focus();
  await page.keyboard.press("Tab");
  await expect(submit(page)).toBeFocused();
});

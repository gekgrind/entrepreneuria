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

test("phone dock hides over hero, preview, and footer and leaves the tab order", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 760, "Phone-only dock");
  const dock = page.locator('[aria-label="Quick action"]');
  const link = dock.locator("a");
  await expect(dock).toHaveAttribute("aria-hidden", "true");
  await expect(link).toHaveAttribute("tabindex", "-1");
  await page.locator("#why h2").scrollIntoViewIfNeeded();
  await expect(dock).toHaveAttribute("aria-hidden", "false");
  await expect(dock).toContainText("$75/mo");
  await expect(dock).toContainText("$199 setup");
  await expect(link).toHaveAttribute("tabindex", "0");
  for (const section of ["#preview h2", "footer"]) {
    await page.locator(section).first().scrollIntoViewIfNeeded();
    await expect(dock).toHaveAttribute("aria-hidden", "true");
    await expect(link).toHaveAttribute("tabindex", "-1");
  }
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

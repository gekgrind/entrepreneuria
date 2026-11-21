import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

/*
 * Browser-level checks on the authentication pages: security headers,
 * the nonce-based CSP, where script comes from, and that no ClickFix-style
 * instruction is rendered. Runs in every viewport project (phone, tablet,
 * desktop).
 *
 * Defense in depth only: this proves what the app itself serves to a
 * clean browser. It cannot prove a browser extension, a compromised
 * device, or a network intermediary never injects content.
 */

const AUTH_PAGES = ["/login", "/sign-up", "/forgot-password"];
const ALLOWED_SCRIPT_ORIGINS = ["https://challenges.cloudflare.com"];

const CLICKFIX = [
  /powershell/i,
  /win(dows)?\s*(key)?\s*\+\s*r\b/i,
  /\brun dialog\b/i,
  /(ctrl|cmd)\s*\+\s*v/i,
  /\bmshta\b/i,
  /press\s+enter\s+to\s+(verify|confirm)/i,
  /verification\s+id\s*:/i,
];

function collectCspConsole(page: Page) {
  const messages: string[] = [];
  page.on("console", (message: ConsoleMessage) => {
    const text = message.text();
    if (/content security policy|content-security-policy/i.test(text)) {
      messages.push(text);
    }
  });
  return messages;
}

function collectScriptRequests(page: Page) {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") urls.push(request.url());
  });
  return urls;
}

for (const path of AUTH_PAGES) {
  test.describe(`auth page ${path}`, () => {
    test("sends the security headers and a nonce CSP", async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      const headers = response!.headers();
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["permissions-policy"]).toContain("camera=()");
      expect(headers["x-powered-by"]).toBeUndefined();

      const reported = headers["content-security-policy-report-only"] ?? "";
      expect(reported).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
      expect(reported).toContain("'strict-dynamic'");
      expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    });

    test("runs only nonce-authorized or approved script, with no CSP violations", async ({ page, baseURL }) => {
      const cspConsole = collectCspConsole(page);
      const scripts = collectScriptRequests(page);

      await page.goto(path);
      await page.waitForLoadState("load");
      await page.waitForTimeout(2_000);

      const allowed = new Set([new URL(baseURL!).origin, ...ALLOWED_SCRIPT_ORIGINS]);
      const foreign = scripts.filter((url) => !allowed.has(new URL(url).origin));
      expect(foreign).toEqual([]);

      /* Every executable inline script carries the nonce Next.js stamped on it. */
      const unnonced = await page.evaluate(() =>
        [...document.querySelectorAll("script")]
          .filter((el) => !el.src && (!el.type || /javascript|module/i.test(el.type)))
          .filter((el) => !el.nonce)
          .map((el) => el.outerHTML.slice(0, 120)),
      );
      expect(unnonced).toEqual([]);

      expect(cspConsole).toEqual([]);
    });

    test("renders no ClickFix-style instructions", async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("load");
      await page.waitForTimeout(2_000);

      const text = await page.locator("body").innerText();
      for (const pattern of CLICKFIX) {
        expect(text, String(pattern)).not.toMatch(pattern);
      }
    });
  });
}

/*
 * Turnstile mounts its challenge iframe inside a closed shadow root, so
 * it is not reachable with a DOM selector. What the policy controls, and
 * this asserts: api.js loads, render() succeeds (its hidden response
 * field appears), every child frame comes from Cloudflare, and nothing
 * is reported. Token issuance itself is NOT asserted: in parallel
 * headless runs it timed out about half the time with CSP_MODE=off as
 * well as report-only (A/B on 2026-11-14), so it measures Cloudflare,
 * not this app.
 */
test("Turnstile loads and renders from Cloudflare on /login", async ({ page }) => {
  const cspConsole = collectCspConsole(page);
  const frameOrigins = new Set<string>();
  page.on("request", (request) => {
    if (request.resourceType() !== "document" || !request.isNavigationRequest()) return;
    /* `frame()` throws once the context is closing; a late event is not evidence. */
    try {
      if (request.frame() !== page.mainFrame()) frameOrigins.add(new URL(request.url()).origin);
    } catch {
      /* ignore */
    }
  });

  await page.goto("/login");

  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveCount(1, { timeout: 20_000 });
  expect(await page.evaluate(() => typeof window.turnstile?.render)).toBe("function");
  await page.waitForTimeout(2_000);

  for (const origin of frameOrigins) {
    expect(origin).toBe("https://challenges.cloudflare.com");
  }
  expect(cspConsole).toEqual([]);
});

test("a protected route sends a signed-out visitor to /login with a relative next", async ({ request }) => {
  const response = await request.get("/dashboard", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toMatch(/\/login\?next=%2Fdashboard$/);
  expect(response.headers()["content-security-policy-report-only"]).toBeTruthy();
});

test("the OAuth callback never forwards an untrusted destination", async ({ request }) => {
  for (const next of ["https://evil.example/", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) {
    const response = await request.get(
      `/auth/callback?error=access_denied&next=${encodeURIComponent(next)}`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(307);
    const location = new URL(response.headers()["location"]!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBeNull();
    expect(location.toString()).not.toContain("evil");
  }
});

test("a callback with no code goes back to /login, not onward", async ({ request }) => {
  const response = await request.get("/auth/callback?next=%2Fdashboard", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(new URL(response.headers()["location"]!).searchParams.get("auth_error")).toBe("unknown");
});

test("the home page renders without CSP violations", async ({ page }) => {
  const cspConsole = collectCspConsole(page);
  await page.goto("/");
  await page.waitForLoadState("load");
      await page.waitForTimeout(2_000);
  expect(cspConsole).toEqual([]);
});

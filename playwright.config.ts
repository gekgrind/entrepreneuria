import { defineConfig } from "@playwright/test";

const localUrl = "http://localhost:3000";
const baseURL = process.env.BASE_URL || localUrl;
if (["entrepreneuria.io", "www.entrepreneuria.io"].includes(new URL(baseURL).hostname)) {
  throw new Error("The Websites acceptance suite only runs locally or on staging.");
}

export default defineConfig({
  testDir: "./e2e",
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR,
  workers: 2,
  use: { baseURL, browserName: "chromium", trace: "retain-on-failure" },
  projects: [
    { name: "375x667", use: { viewport: { width: 375, height: 667 }, hasTouch: true } },
    { name: "390x844", use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "1024x768", use: { viewport: { width: 1024, height: 768 } } },
    { name: "1440x900", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.BASE_URL ? undefined : {
    command: "npm run dev -- --hostname localhost --port 3000",
    url: `${localUrl}/services/websites`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      WEBSITES_SERVICES_MODE: "nonproduction",
      WEBSITES_NONPRODUCTION_HOSTS: "localhost:3000",
      WEBSITES_IP_HASH_SALT: "e2e-salt-0123456789",
      WEBSITES_CONTACT_EMAIL: "preview@example.test",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-placeholder",
    },
  },
});

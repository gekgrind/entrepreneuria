/**
 * Checks every published website template's live demo link (templates.ts).
 *
 * For each published template: GET the URL, require HTTP 200 and the
 * business name somewhere in the HTML. Exits 1 on any failure, so a demo
 * that GoHighLevel moved or unpublished is caught before visitors find it.
 * After a clean run, update `verifiedOn` for templates that changed.
 *
 * Run: npm run templates:verify
 * Network: needs the demo hosts (vibepreview.app subdomains) to be reachable.
 */
import { publishedTemplates } from "../lib/services/websites/templates";

const TIMEOUT_MS = 20_000;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;");

async function check(url: string, business: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status !== 200) return `HTTP ${res.status}`;
    const html = await res.text();
    if (!html.includes(business) && !html.includes(escapeHtml(business))) return `business name "${business}" not found in page`;
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

const results = await Promise.all(
  publishedTemplates().map(async (t) => ({ t, problem: await check(t.url, t.business) }))
);

let failed = 0;
for (const { t, problem } of results) {
  if (problem) failed += 1;
  console.log(`${problem ? "FAIL" : "ok  "}  ${t.industry}/${t.id}  ${t.url}${problem ? `  (${problem})` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} demo links verified.`);
process.exit(failed ? 1 : 0);

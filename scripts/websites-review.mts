/**
 * Owner review of returning-contact inquiries (never written to the CRM).
 * Run ON THE SERVER over SSH, as the app's user. There is deliberately no
 * web endpoint for these records.
 *
 *   WEBSITES_REVIEW_DIR=<review dir> \
 *     npx tsx scripts/websites-review.mts list            # open items (default)
 *     npx tsx scripts/websites-review.mts list --all      # include resolved
 *     npx tsx scripts/websites-review.mts show r-0123…    # full submission
 *     npx tsx scripts/websites-review.mts resolve r-0123… # mark handled
 *
 * The reference in each owner email ("r-" + 16 hex) is what `show` takes.
 * Output contains the visitor's details: don't paste it into tickets or chat.
 */
import { createFileReviewStore, REVIEW_REF } from "../lib/services/websites/review-store";

const dir = process.env.WEBSITES_REVIEW_DIR ?? "";
if (!dir.startsWith("/")) {
  console.error("Set WEBSITES_REVIEW_DIR to the absolute review directory.");
  process.exit(2);
}
const store = createFileReviewStore(dir);
const [cmd = "list", arg] = process.argv.slice(2);
if ((cmd === "show" || cmd === "resolve") && !REVIEW_REF.test(arg ?? "")) {
  console.error("Give a reference like r-0123456789abcdef (from the owner email or `list`).");
  process.exit(2);
}

const REASONS: Record<string, string> = {
  existing_contact: "email already belongs to a CRM contact",
  matched_on_upsert: "matched a CRM contact during creation (race)",
  lookup_failed: "CRM lookup failed or was unreadable: check whether this person is new",
  delivery_failed: "new lead could not be delivered to the CRM: add it by hand (a partial contact may exist)",
  manual_intake: "manual intake: no CRM delivery configured",
};

if (cmd === "list") {
  const all = arg === "--all";
  const rows = (await store.list()).filter((r) => all || !r.resolved_at);
  if (!rows.length) console.log(all ? "No review records." : "Nothing waiting for review.");
  for (const r of rows) {
    const f = r.submission.fields;
    console.log(
      [
        r.ref,
        r.received_at,
        r.resolved_at ? "resolved" : r.notified_at ? "notified" : "NOT NOTIFIED",
        r.reason,
        `${f.name} <${f.email}>`,
        f.business,
      ].join("  |  ")
    );
  }
} else if (cmd === "show" && arg) {
  const r = await store.get(arg);
  if (!r) {
    console.error("No such reference.");
    process.exit(1);
  }
  console.log(`Reference:   ${r.ref}`);
  console.log(`Received:    ${r.received_at}`);
  console.log(`Why review:  ${REASONS[r.reason] ?? r.reason}`);
  console.log(`CRM contact: ${r.crm_contact_id ?? "none recorded"}`);
  console.log(`Notified:    ${r.notified_at ?? "no (will be retried)"}`);
  console.log(`Resolved:    ${r.resolved_at ?? "no"}`);
  console.log("");
  for (const [k, v] of Object.entries(r.submission.fields)) if (v !== "" && v !== undefined && v !== false) console.log(`${k}: ${v}`);
  if (r.submission.utm) console.log(`utm: ${JSON.stringify(r.submission.utm)}`);
  console.log(`page: ${r.submission.page_url}`);
} else if (cmd === "resolve" && arg) {
  await store.markResolved(arg, new Date().toISOString());
  console.log(`Resolved ${arg}.`);
} else {
  console.error("Usage: list [--all] | show <ref> | resolve <ref>");
  process.exit(2);
}

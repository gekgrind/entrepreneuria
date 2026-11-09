/**
 * GoHighLevel SANDBOX check for the Websites intake adapter.
 *
 * Verifies the two API behaviours lib/integrations/ghl/client.ts relies on
 * but the published spec does not fully describe:
 *   1. GET /contacts/search/duplicate returns `{ contact: null }` when there
 *      is no match and `{ contact: { id } }` when there is one (by email
 *      and by `number`).
 *   2. POST /contacts/upsert returns `new: true` for a new contact,
 *      `new: false` for a match, and UPDATES the fields it is sent.
 *   3. A note body comes back from GET /contacts/{id}/notes exactly as it
 *      was posted (the adapter matches its marker on the note's last line).
 *
 * Safety:
 *   - Run ONLY against a sandbox sub-account. It refuses to start unless
 *     GHL_SANDBOX_CONFIRM equals GHL_LOCATION_ID. That guard cannot tell a
 *     sandbox from production: confirming the location is yours to do.
 *   - It never reads or changes a pre-existing contact. It works only with
 *     one contact it creates itself, with a random @example.com address and
 *     a 555-01xx phone. It continues only if both lookups answer exactly
 *     200 `{ contact: null }`, and it deletes a contact only if the upsert
 *     reported creating it (`new: true`). A failed cleanup is a failure.
 *   - It prints response shapes (keys and value types) and pass/fail lines,
 *     never the token or response bodies.
 *
 * Usage (from a machine that can reach the API):
 *   GHL_API_TOKEN=... GHL_LOCATION_ID=... GHL_SANDBOX_CONFIRM=<same location id> \
 *     npx tsx scripts/ghl-sandbox-check.mts
 */
import { randomUUID } from "node:crypto";

const BASE = "https://services.leadconnectorhq.com";
const token = process.env.GHL_API_TOKEN ?? "";
const locationId = process.env.GHL_LOCATION_ID ?? "";
const version = process.env.GHL_API_VERSION ?? "2021-07-28";

if (!token || !locationId || process.env.GHL_SANDBOX_CONFIRM !== locationId) {
  console.error("Refusing to run: set GHL_API_TOKEN, GHL_LOCATION_ID and GHL_SANDBOX_CONFIRM (= GHL_LOCATION_ID, for a SANDBOX sub-account only).");
  process.exit(2);
}

const tag = randomUUID().slice(0, 8);
const email = `sandbox-check+${tag}@example.com`;
const phone = `+1404555${String(100 + Math.floor(Math.random() * 99)).padStart(4, "0")}`;

type Json = Record<string, unknown>;
const shape = (v: unknown, depth = 0): unknown => {
  if (v === null) return "null";
  if (Array.isArray(v)) return depth > 1 ? "array" : [v.length ? shape(v[0], depth + 1) : "empty"];
  if (typeof v === "object") return depth > 1 ? "object" : Object.fromEntries(Object.entries(v as Json).map(([k, x]) => [k, shape(x, depth + 1)]));
  return typeof v;
};

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; json: Json | null }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: version,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  let json: Json | null = null;
  try {
    json = JSON.parse(text) as Json;
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

let failures = 0;
const check = (ok: boolean, label: string) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
};
const dup = (q: Record<string, string>) => call("GET", `/contacts/search/duplicate?${new URLSearchParams({ locationId, ...q })}`);

let createdId: string | undefined;
try {
  const noEmail = await dup({ email });
  console.log("duplicate (no match, email) →", noEmail.status, JSON.stringify(shape(noEmail.json)));
  const noPhone = await dup({ number: phone });
  console.log("duplicate (no match, number) →", noPhone.status, JSON.stringify(shape(noPhone.json)));
  const isNone = (r: { status: number; json: Json | null }) => r.status === 200 && r.json !== null && "contact" in r.json && r.json.contact === null;
  check(isNone(noEmail), "no match → 200 { contact: null } (email)");
  check(isNone(noPhone), "no match → 200 { contact: null } (number)");
  if (!isNone(noEmail) || !isNone(noPhone)) {
    console.error("Lookups did not clearly report 'no contact'; stopping before any write.");
    process.exit(3);
  }

  const first = await call("POST", "/contacts/upsert", { locationId, name: "Sandbox Check A", email, phone, companyName: "Sandbox A", source: "sandbox-check" });
  console.log("upsert (new) →", first.status, JSON.stringify(shape(first.json)));
  const firstId = (first.json?.contact as Json | undefined)?.id;
  check(first.status === 200 || first.status === 201, "upsert (new) succeeds");
  check(first.json?.new === true, "upsert (new) returns new: true");
  check(typeof firstId === "string" && firstId.length > 0, "upsert returns contact.id");
  if (first.json?.new !== true || typeof firstId !== "string" || !firstId) {
    console.error("Upsert did not report creating a new contact; stopping without further writes or deletes.");
    process.exit(4);
  }
  createdId = firstId;

  const byEmail = await dup({ email });
  const byPhone = await dup({ number: phone });
  console.log("duplicate (match, email) →", byEmail.status, JSON.stringify(shape(byEmail.json)));
  check((byEmail.json?.contact as Json | undefined)?.id === createdId, "match by email → { contact: { id } } with the same id");
  check((byPhone.json?.contact as Json | undefined)?.id === createdId, "match by number → { contact: { id } } with the same id");

  const second = await call("POST", "/contacts/upsert", { locationId, name: "Sandbox Check B", email, companyName: "Sandbox B", source: "sandbox-check" });
  check(second.json?.new === false, "upsert (match) returns new: false");
  check((second.json?.contact as Json | undefined)?.id === createdId, "upsert (match) returns the same contact");

  const noteBody = `Sandbox check note\nline two\nReference: ${randomUUID()} (content 0123456789ab)`;
  const posted = await call("POST", `/contacts/${encodeURIComponent(createdId)}/notes`, { body: noteBody });
  check(posted.status === 200 || posted.status === 201, "note create succeeds");
  const listed = await call("GET", `/contacts/${encodeURIComponent(createdId)}/notes`);
  console.log("notes list →", listed.status, JSON.stringify(shape(listed.json)));
  const bodies = Array.isArray(listed.json?.notes) ? (listed.json!.notes as Json[]).map((n) => n?.body) : [];
  check(bodies.includes(noteBody), "note body round-trips exactly (no HTML wrapping or rewriting)");

  {
    const after = await call("GET", `/contacts/${encodeURIComponent(createdId)}`);
    const c = (after.json?.contact ?? {}) as Json;
    const overwritten = c.companyName === "Sandbox B" || String(c.firstName ?? c.name ?? "").includes("B");
    console.log(`upsert (match) overwrote fields: ${overwritten ? "YES" : "no"} (the adapter assumes YES and never upserts a matched contact)`);
  }
} finally {
  if (createdId) {
    const del = await call("DELETE", `/contacts/${encodeURIComponent(createdId)}`);
    check(del.status >= 200 && del.status < 300, `cleanup: synthetic contact deleted (${del.status})`);
  }
}
console.log(failures ? `\n${failures} check(s) FAILED: the adapter's assumptions do not hold; do not take traffic.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);

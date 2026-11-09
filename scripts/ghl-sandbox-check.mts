/**
 * GoHighLevel SANDBOX check for the Websites intake adapter.
 *
 * Checks the API behaviours lib/integrations/ghl/client.ts relies on but the
 * published spec does not fully describe, the same way the adapter calls them:
 *   1. GET /contacts/search/duplicate returns `{ contact: null }` when there
 *      is no match and `{ contact: { id } }` when there is one (by the
 *      lowercase email the form sends, for a contact stored in mixed case,
 *      and by `number`).
 *   2. POST /contacts/upsert with only `locationId` + `email` returns
 *      `new: true` for a new contact and `new: false` (same id) for a match,
 *      and a matching upsert changes nothing, not even the email's case.
 *   3. PUT /contacts/{id} accepts name, phone, company, website, source and
 *      a custom field as `{ id, field_value }`, and echoes it back as
 *      `contact.customFields[{ id, value }]`.
 *   4. A note body comes back from GET /contacts/{id}/notes exactly as it
 *      was posted (the adapter matches its marker on the note's last line).
 * Run it on a sandbox whose duplicate-contact settings match production.
 *
 * Safety:
 *   - Run ONLY against a sandbox sub-account. It refuses to start unless
 *     GHL_SANDBOX_CONFIRM equals GHL_LOCATION_ID. That guard cannot tell a
 *     sandbox from production: confirming the location is yours to do.
 *   - It works only with one contact it creates itself, with a random
 *     @example.com address and a 555-01xx phone. It writes only after both
 *     lookups answer exactly 200 `{ contact: null }`. Its first write is an
 *     email-only upsert, so even if GHL unexpectedly matched an existing
 *     contact nothing on it would change. It updates and deletes a contact
 *     only if that upsert reported creating it (`new: true`). A failed
 *     cleanup counts as a failure.
 *   - It prints response shapes (keys and value types) and pass/fail lines,
 *     never the token or response bodies.
 *
 * Usage (from a machine that can reach the API):
 *   GHL_API_TOKEN=... GHL_LOCATION_ID=... GHL_SANDBOX_CONFIRM=<same location id> \
 *   GHL_SANDBOX_CUSTOM_FIELD_ID=<a text custom field id in that sandbox> \
 *     npx tsx scripts/ghl-sandbox-check.mts
 *
 * Not checkable from here: whether a "Contact Created" workflow fires on the
 * email-only contact before its details arrive, or whether a matching
 * upsert fires "Contact Changed". Check the sandbox's workflow history.
 */
import { randomUUID } from "node:crypto";

const BASE = "https://services.leadconnectorhq.com";
const token = process.env.GHL_API_TOKEN ?? "";
const locationId = process.env.GHL_LOCATION_ID ?? "";
const version = process.env.GHL_API_VERSION ?? "2021-07-28";

const customFieldId = process.env.GHL_SANDBOX_CUSTOM_FIELD_ID ?? "";
if (!token || !locationId || process.env.GHL_SANDBOX_CONFIRM !== locationId || !customFieldId) {
  console.error(
    "Refusing to run: set GHL_API_TOKEN, GHL_LOCATION_ID, GHL_SANDBOX_CONFIRM (= GHL_LOCATION_ID, for a SANDBOX sub-account only) and GHL_SANDBOX_CUSTOM_FIELD_ID."
  );
  process.exit(2);
}

const tag = randomUUID().slice(0, 8);
// Stored in mixed case (as a contact created by hand might be); the form
// always sends lowercase, so lookups and the matching upsert use `lower`.
const email = `Sandbox-Check+${tag}@Example.com`;
const lower = email.toLowerCase();
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
let extraId: string | undefined;
try {
  const noEmail = await dup({ email: lower });
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

  const first = await call("POST", "/contacts/upsert", { locationId, email });
  console.log("upsert (new, email only) →", first.status, JSON.stringify(shape(first.json)));
  const firstId = (first.json?.contact as Json | undefined)?.id;
  check(first.status === 200 || first.status === 201, `upsert (new) succeeds (${first.status})`);
  check(first.json?.new === true, "upsert (new) returns new: true");
  check(typeof firstId === "string" && firstId.length > 0, "upsert returns contact.id");
  if (first.json?.new !== true || typeof firstId !== "string" || !firstId) {
    console.error("Upsert did not report creating a new contact; stopping without further writes or deletes.");
    process.exit(4);
  }
  createdId = firstId;
  const stored = await call("GET", `/contacts/${encodeURIComponent(createdId)}`);
  const storedEmail = (stored.json?.contact as Json | undefined)?.email;
  const mixedCaseKept = storedEmail === email;
  if (!mixedCaseKept) console.log("NOTE  GHL stored the email lowercased on create; mixed-case checks are skipped");

  const put = await call("PUT", `/contacts/${encodeURIComponent(createdId)}`, {
    name: "Sandbox Check",
    phone,
    companyName: "Sandbox Co",
    website: "https://sandbox-check.example.com",
    source: "sandbox-check",
    customFields: [{ id: customFieldId, field_value: "sandbox-check-value" }],
  });
  console.log("details update →", put.status, JSON.stringify(shape(put.json)));
  const putOk = put.status >= 200 && put.status < 300;
  check(putOk, `details update succeeds (${put.status})`);
  const echoed = (put.json?.contact as Json | undefined)?.customFields;
  check(
    Array.isArray(echoed) && (echoed as Json[]).some((f) => f?.id === customFieldId && f?.value === "sandbox-check-value"),
    "details update echoes the custom field as contact.customFields[{ id, value }]"
  );

  const byEmail = await dup({ email: lower });
  const byPhone = await dup({ number: phone });
  console.log("duplicate (match, email) →", byEmail.status, JSON.stringify(shape(byEmail.json)));
  check(
    (byEmail.json?.contact as Json | undefined)?.id === createdId,
    mixedCaseKept ? "lowercase email finds the mixed-case contact → { contact: { id } }" : "match by email → { contact: { id } }"
  );
  if (putOk) check((byPhone.json?.contact as Json | undefined)?.id === createdId, "match by number → { contact: { id } } with the same id");
  else console.log("SKIP  match by number (needs the details update, which failed)");

  const second = await call("POST", "/contacts/upsert", { locationId, email: lower });
  if (second.json?.new === true) extraId = (second.json?.contact as Json | undefined)?.id as string | undefined;
  check(second.json?.new === false, "upsert (match, lowercase email only) returns new: false");
  check((second.json?.contact as Json | undefined)?.id === createdId, "upsert (match) returns the same contact");
  const after = await call("GET", `/contacts/${encodeURIComponent(createdId)}`);
  check(after.status === 200, `contact read succeeds (${after.status})`);
  const c = (after.json?.contact ?? {}) as Json;
  if (mixedCaseKept) check(c.email === email, "a matching upsert leaves the stored email's letter case unchanged");
  else check(c.email === storedEmail, "a matching upsert leaves the stored email unchanged");
  if (putOk) check(c.companyName === "Sandbox Co", "a matching email-only upsert leaves the contact's other fields unchanged");
  else console.log("SKIP  other fields unchanged (needs the details update, which failed)");

  const noteBody = `Sandbox check note\nline two\nReference: ${randomUUID()} (content 0123456789abcdef01234567)`;
  const posted = await call("POST", `/contacts/${encodeURIComponent(createdId)}/notes`, { body: noteBody });
  check(posted.status === 200 || posted.status === 201, "note create succeeds");
  const listed = await call("GET", `/contacts/${encodeURIComponent(createdId)}/notes`);
  console.log("notes list →", listed.status, JSON.stringify(shape(listed.json)));
  const bodies = Array.isArray(listed.json?.notes) ? (listed.json!.notes as Json[]).map((n) => n?.body) : [];
  check(bodies.includes(noteBody), "note body round-trips exactly (no HTML wrapping or rewriting)");

} finally {
  for (const id of [createdId, extraId]) {
    if (!id) continue;
    const del = await call("DELETE", `/contacts/${encodeURIComponent(id)}`);
    check(del.status >= 200 && del.status < 300, `cleanup: synthetic contact deleted (${del.status})`);
  }
}
console.log(failures ? `\n${failures} check(s) FAILED: the adapter's assumptions do not hold; do not take traffic.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);

/**
 * Write boundary for the GHL sandbox test. Every request the adapter makes in
 * a sandbox run goes through `guard.fetch`, which:
 *   - pins the origin to the configured API base;
 *   - lets GETs through and refuses every mutation it doesn't recognise;
 *   - allows writes only to records this run created, proven by the create
 *     response (`new: true` on the email-only upsert, or the opportunity id),
 *     never inferred from errors or lookups;
 *   - writes an `intent` manifest line before each create and a `created`
 *     line after it, so a crash or an unreadable response can be reconciled;
 *   - stops the run (no further writes, never a retry) on any refusal or
 *     ambiguous create.
 * Cleanup deletes opportunities before their contact, re-reads each record
 * first and refuses unless it is exactly the run's own (id, synthetic email,
 * location, pipeline), never retries a DELETE, and then verifies every
 * deleted id is gone.
 *
 * Based on Codex's ownership draft (2026-11-09), extended for the owner's
 * conditions and acceptance criteria A–I (2026-11-10 readiness review).
 */
import type { ManifestEntry, RecordKind, RunManifest } from "./sandbox-ledger";
import { RUN_ID } from "./sandbox-ledger";
import type { SandboxConfig } from "./sandbox-check";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class SandboxRefusal extends Error {
  constructor(reason: string) {
    super(`Sandbox safety refused: ${reason}`);
    this.name = "SandboxRefusal";
  }
}

export interface Snapshot {
  total: number;
  ids: string[];
}

export interface CleanupReport {
  ok: boolean;
  lines: string[];
}

const TIMEOUT_MS = 10_000;

export function syntheticEmailPattern(runId: string): RegExp {
  return new RegExp(`^ghl-sandbox\\+${runId.replace(/[^a-zA-Z0-9-]/g, "")}-[a-z-]+@example\\.com$`);
}

export function createSandboxGuard(config: SandboxConfig, inner: FetchLike, runId: string, manifest: RunManifest) {
  if (!RUN_ID.test(runId)) throw new Error("invalid sandbox run id");
  const base = (config.baseUrl ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
  const origin = new URL(base).origin;
  const headers = { Authorization: `Bearer ${config.token}`, Version: config.apiVersion, Accept: "application/json" };
  const isSynthetic = (email: unknown): email is string => typeof email === "string" && syntheticEmailPattern(runId).test(email);

  const contacts = new Map<string, string>(); // id -> synthetic email (run-owned)
  const opportunities = new Map<string, string>(); // id -> contact id (run-owned)
  const pendingEmails = new Set<string>(); // contact intents with no confirmed create yet
  const done = new Set<string>(); // "<kind>:<id>" deleted or verified absent
  let halted: string | null = null;

  async function halt(reason: string): Promise<never> {
    if (!halted) {
      halted = reason;
      await manifest.append({ t: "stopped", reason });
    }
    throw new SandboxRefusal(reason);
  }

  const get = (p: string) => inner(`${base}${p}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const readJson = async (res: Response) => (res.ok ? res.json().catch(() => null) : null) as Promise<any>;

  /** Duplicate lookup that must answer explicitly; anything else refuses. Returns the id or null. */
  async function duplicate(query: { email: string } | { number: string }): Promise<string | null> {
    const res = await get(`/contacts/search/duplicate?${new URLSearchParams({ locationId: config.locationId, ...query })}`);
    const body = await readJson(res);
    if (res.status === 200 && body && body.contact === null) return null;
    if (res.status === 200 && typeof body?.contact?.id === "string" && body.contact.id) return body.contact.id;
    return halt("duplicate lookup was unreadable");
  }

  async function onlyOwnedMatch(query: { email: string } | { number: string }, expected?: string) {
    const id = await duplicate(query);
    if (id !== null && (id !== expected || !contacts.has(id))) await halt("a non-run contact matches this synthetic data");
  }

  const fetch: FetchLike = async (url, init) => {
    const target = new URL(url);
    if (target.origin !== origin) return halt("request to an unexpected origin");
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET") return inner(url, init);
    if (halted) return halt(`run already stopped (${halted})`);
    const p = target.pathname;
    let body: any;
    try {
      body = JSON.parse(String(init?.body ?? "null"));
    } catch {
      return halt("unreadable request body");
    }

    if (method === "POST" && p === "/contacts/upsert") {
      const keys = body && typeof body === "object" ? Object.keys(body).sort() : [];
      if (keys.join(",") !== "email,locationId" || body.locationId !== config.locationId || !isSynthetic(body.email)) {
        return halt("upsert is not an email-only synthetic create in the sandbox location");
      }
      const expected = [...contacts].find(([, e]) => e === body.email)?.[0];
      await onlyOwnedMatch({ email: body.email }, expected);
      if (!expected) {
        await manifest.append({ t: "intent", kind: "contact", email: body.email });
        pendingEmails.add(body.email);
      }
      const res = await inner(url, init);
      const data = await readJson(res.clone());
      const id = data?.contact?.id;
      if (typeof id !== "string" || !id) return halt("upsert response was unreadable; contact may exist (reconcile by email)");
      if (data.new === true) {
        if (contacts.has(id) && contacts.get(id) !== body.email) return halt("upsert returned a known id for another email");
        contacts.set(id, body.email);
        pendingEmails.delete(body.email);
        await manifest.append({ t: "created", kind: "contact", id, email: body.email });
      } else if (data.new !== false || contacts.get(id) !== body.email) {
        return halt("upsert matched a contact this run did not create");
      }
      return res;
    }

    const c = p.match(/^\/contacts\/([^/]+)(?:\/(tags|notes))?$/);
    if (c && ((method === "PUT" && !c[2]) || (method === "POST" && c[2]))) {
      const id = decodeURIComponent(c[1]);
      if (!contacts.has(id)) return halt("write to a contact this run did not create");
      if (method === "PUT") {
        if (body?.email !== undefined || body?.locationId !== undefined) return halt("details update tried to change email or location");
        if (body?.phone) await onlyOwnedMatch({ number: body.phone }, id);
      }
      return inner(url, init);
    }

    if (method === "POST" && p === "/opportunities/") {
      if (
        !contacts.has(body?.contactId) ||
        body.locationId !== config.locationId ||
        body.pipelineId !== config.pipelineId ||
        body.pipelineStageId !== config.pipelineStageId
      ) {
        return halt("opportunity is not for a run contact in the sandbox pipeline and stage");
      }
      await manifest.append({ t: "intent", kind: "opportunity", contactId: body.contactId });
      const res = await inner(url, init);
      const id = (await readJson(res.clone()))?.opportunity?.id;
      if (typeof id !== "string" || !id) return halt("opportunity create response was unreadable; reconcile by contact");
      opportunities.set(id, body.contactId);
      await manifest.append({ t: "created", kind: "opportunity", id, contactId: body.contactId });
      return res;
    }

    return halt(`mutation not allowed in a sandbox run (${method} ${p.split("/").slice(0, 2).join("/")})`);
  };

  /* ---- snapshot (ids only) ---- */

  async function snapshot(): Promise<Snapshot> {
    const res = await get(`/contacts/?${new URLSearchParams({ locationId: config.locationId, limit: "100" })}`);
    const body = await readJson(res);
    const ids = Array.isArray(body?.contacts) ? body.contacts.map((x: any) => x?.id).filter((x: unknown) => typeof x === "string") : null;
    const total = body?.meta?.total;
    if (!ids || typeof total !== "number" || !Number.isInteger(total)) throw new SandboxRefusal("contact snapshot was unreadable");
    if (ids.length !== total) throw new SandboxRefusal(`contact snapshot incomplete (${ids.length} of ${total}); use a smaller sandbox`);
    return { total, ids: [...ids].sort() };
  }

  /* ---- reconcile support ---- */

  /** Rebuilds ownership from an earlier run's manifest (same run id). */
  function adopt(entries: ManifestEntry[]) {
    for (const e of entries) {
      if (e.t === "intent" && e.kind === "contact") pendingEmails.add(e.email);
      if (e.t === "created" && e.kind === "contact") {
        contacts.set(e.id, e.email);
        pendingEmails.delete(e.email);
      }
      if (e.t === "created" && e.kind === "opportunity") opportunities.set(e.id, e.contactId);
      if (e.t === "verified_absent") done.add(`${e.kind}:${e.id}`);
    }
  }

  /* ---- cleanup ---- */

  type Absent = "absent" | "present" | "unknown";
  async function presence(kind: RecordKind, id: string): Promise<{ state: Absent; body: any }> {
    const res = await get(`/${kind === "contact" ? "contacts" : "opportunities"}/${encodeURIComponent(id)}`);
    const body = await res.json().catch(() => null);
    if (res.ok) return { state: "present", body };
    // GHL answers a missing record with 404, or 400 "… not found".
    if (res.status === 404 || ((res.status === 400 || res.status === 422) && /not found/i.test(String(body?.message ?? "")))) {
      return { state: "absent", body };
    }
    return { state: "unknown", body };
  }

  async function searchOpportunities(contactId: string): Promise<string[]> {
    const q = new URLSearchParams({ location_id: config.locationId, pipeline_id: config.pipelineId, contact_id: contactId, status: "all", limit: "100" });
    const body = await readJson(await get(`/opportunities/search?${q}`));
    if (!Array.isArray(body?.opportunities)) throw new SandboxRefusal("opportunity search was unreadable");
    return body.opportunities.map((o: any) => o?.id).filter((x: unknown): x is string => typeof x === "string");
  }

  async function cleanup(): Promise<CleanupReport> {
    const lines: string[] = [];
    let ok = true;
    const fail = async (kind: RecordKind, id: string, reason: string) => {
      ok = false;
      lines.push(`FAIL  cleanup ${kind} ${id}: ${reason}`);
      await manifest.append({ t: "delete_failed", kind, id, reason });
    };

    try {
      // 1. Contacts whose create response was lost: find by the run's unique synthetic email.
      for (const email of [...pendingEmails]) {
        const res = await get(`/contacts/search/duplicate?${new URLSearchParams({ locationId: config.locationId, email })}`);
        const found = await readJson(res);
        if (res.status !== 200 || !found || (found.contact !== null && typeof found.contact?.id !== "string")) {
          await fail("contact", email, "lookup for an unconfirmed create was unreadable; reconcile later");
          return { ok, lines };
        }
        const id: string | null = found.contact?.id ?? null;
        if (!id) {
          lines.push(`ok    no contact exists for an unconfirmed create (${email})`);
          pendingEmails.delete(email);
          continue;
        }
        const { state, body } = await presence("contact", id);
        if (state !== "present" || body?.contact?.id !== id || body.contact.email !== email) {
          await fail("contact", id, "unconfirmed create could not be verified as this run's; left in place");
          return { ok, lines };
        }
        contacts.set(id, email);
        pendingEmails.delete(email);
        await manifest.append({ t: "created", kind: "contact", id, email, recovered: true });
        lines.push(`ok    recovered unconfirmed contact ${id}`);
      }

      // 2. Opportunities on run contacts, including ones whose create response was lost.
      for (const contactId of contacts.keys()) {
        if (done.has(`contact:${contactId}`)) continue;
        for (const id of await searchOpportunities(contactId)) {
          if (opportunities.has(id)) continue;
          opportunities.set(id, contactId);
          await manifest.append({ t: "created", kind: "opportunity", id, contactId, recovered: true });
          lines.push(`ok    found opportunity ${id} by contact search`);
        }
      }

      // 3. Opportunities first, each re-read and checked before its single DELETE.
      for (const [id, contactId] of opportunities) {
        if (done.has(`opportunity:${id}`)) continue;
        const { state, body } = await presence("opportunity", id);
        if (state === "absent") {
          done.add(`opportunity:${id}`);
          await manifest.append({ t: "verified_absent", kind: "opportunity", id });
          continue;
        }
        const o = body?.opportunity;
        if (state !== "present" || o?.id !== id || o.contactId !== contactId || !contacts.has(contactId) || o.pipelineId !== config.pipelineId) {
          await fail("opportunity", id, "read-back did not match the run's record; no delete sent");
          return { ok, lines };
        }
        const res = await inner(`${base}/opportunities/${encodeURIComponent(id)}`, { method: "DELETE", headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) {
          await fail("opportunity", id, `DELETE returned ${res.status}; not retried`);
          return { ok, lines };
        }
        await manifest.append({ t: "deleted", kind: "opportunity", id });
        if ((await presence("opportunity", id)).state !== "absent") {
          await fail("opportunity", id, "still present after DELETE; its contact is left in place");
          return { ok, lines };
        }
        done.add(`opportunity:${id}`);
        await manifest.append({ t: "verified_absent", kind: "opportunity", id });
      }

      // 4. Contacts, each re-read and checked (id, exact synthetic email, location) before its single DELETE.
      //    A contact is deleted only once all of its known opportunities are verified gone.
      for (const [id, email] of contacts) {
        if (done.has(`contact:${id}`)) continue;
        if ([...opportunities].some(([oid, cid]) => cid === id && !done.has(`opportunity:${oid}`))) {
          await fail("contact", id, "an opportunity on this contact is not verified gone; no delete sent");
          return { ok, lines };
        }
        const { state, body } = await presence("contact", id);
        if (state === "absent") {
          done.add(`contact:${id}`);
          await manifest.append({ t: "verified_absent", kind: "contact", id });
          continue;
        }
        const c = body?.contact;
        if (state !== "present" || c?.id !== id || c.email !== email || !isSynthetic(c.email) || (c.locationId !== undefined && c.locationId !== config.locationId)) {
          await fail("contact", id, "read-back did not match the run's record; no delete sent");
          return { ok, lines };
        }
        const res = await inner(`${base}/contacts/${encodeURIComponent(id)}`, { method: "DELETE", headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) {
          await fail("contact", id, `DELETE returned ${res.status}; not retried`);
          return { ok, lines };
        }
        await manifest.append({ t: "deleted", kind: "contact", id });
      }

      // 5. Verify: every contact is gone, and no opportunity remains on any run contact.
      for (const id of contacts.keys()) {
        if (done.has(`contact:${id}`)) continue;
        const { state } = await presence("contact", id);
        if (state !== "absent") {
          await fail("contact", id, `still ${state === "present" ? "present" : "unverifiable"} after DELETE`);
          continue;
        }
        done.add(`contact:${id}`);
        await manifest.append({ t: "verified_absent", kind: "contact", id });
      }
      for (const contactId of contacts.keys()) {
        const left = await searchOpportunities(contactId);
        if (left.length) await fail("opportunity", left[0], `${left.length} opportunity(ies) still found for run contact ${contactId}`);
      }
      lines.push(`${ok ? "PASS" : "FAIL"}  cleanup: ${contacts.size} contact(s), ${opportunities.size} opportunity(ies) ${ok ? "deleted and verified absent" : "not all verified absent"}`);
    } catch (err) {
      ok = false;
      lines.push(`FAIL  cleanup stopped: ${(err as Error).message}`);
      await manifest.append({ t: "stopped", reason: `cleanup: ${(err as Error).message}` }).catch(() => {});
    }
    return { ok, lines };
  }

  return {
    fetch,
    snapshot,
    adopt,
    cleanup,
    get halted() {
      return halted;
    },
    createdContactIds: () => [...contacts.keys()],
    createdOpportunityIds: () => [...opportunities.keys()],
  };
}

export type SandboxGuard = ReturnType<typeof createSandboxGuard>;

/** Pre-existing contacts must all still be there, and the total back to the pre-run count. */
export function compareSnapshots(pre: Snapshot, post: Snapshot): { ok: boolean; detail: string } {
  const missing = pre.ids.filter((id) => !post.ids.includes(id));
  if (missing.length) return { ok: false, detail: `${missing.length} pre-existing contact(s) missing: ${missing.join(", ")}` };
  if (post.total !== pre.total) return { ok: false, detail: `contact total ${pre.total} before, ${post.total} after` };
  return { ok: true, detail: `${pre.total} pre-existing contact(s) present, total unchanged` };
}

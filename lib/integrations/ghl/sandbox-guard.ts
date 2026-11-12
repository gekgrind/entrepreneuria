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
 * location, pipeline), never retries a DELETE, and then polls with bounded
 * GETs until every deleted id is gone and the contact list matches the
 * pre-run baseline. GHL's list and search lag its by-id reads, so the outcome
 * has three states: `verified`, `pending_consistency` (every DELETE was
 * accepted, but reads have not converged or could not be read) and `failed`
 * (a record remains, a DELETE was refused, or the baseline really differs).
 * A matching count alone never verifies cleanup.
 *
 * A DELETE is attempted at most once per record, across restarts: its intent
 * is journalled and fsynced before it is sent. Once attempted, a record only
 * ever gets read-only verification; if it remains, the owner removes it by
 * hand. An opportunity is deleted only if this run proves it created it, and
 * a create whose outcome is unknown keeps its contact in place.
 *
 * Based on Codex's ownership draft (2026-11-09), extended for the owner's
 * conditions and acceptance criteria A–I (2026-11-10 readiness review).
 */
import type { ManifestEntry, RecordKind, RunManifest } from "./sandbox-ledger";
import { JOURNAL_VERSION, RUN_ID } from "./sandbox-ledger";
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

export type CleanupState = "verified" | "pending_consistency" | "failed";

export interface CleanupReport {
  /** True only for `state: "verified"`. */
  ok: boolean;
  state: CleanupState;
  lines: string[];
  /** Every run record reads as absent by id, and no search still lists one. */
  idsAbsent: boolean;
  /** Comparison with the pre-run snapshot; null when it was never reached or could not be read. */
  baseline: { ok: boolean; detail: string } | null;
}

export interface GuardOptions {
  sleep?: (ms: number) => Promise<void>;
  /** Verification passes after the deletes. */
  settleAttempts?: number;
  settleDelayMs?: number;
  /** Send each write once, stopping the run on a failure or a repeat. Always on for a live run. */
  singleAttemptWrites?: boolean;
}

const TIMEOUT_MS = 10_000;
const DEFAULT_SETTLE_ATTEMPTS = 6;
const DEFAULT_SETTLE_DELAY_MS = 5_000;

export function syntheticEmailPattern(runId: string): RegExp {
  return new RegExp(`^ghl-sandbox\\+${runId.replace(/[^a-zA-Z0-9-]/g, "")}-[a-z-]+@example\\.com$`);
}

export function createSandboxGuard(config: SandboxConfig, inner: FetchLike, runId: string, manifest: RunManifest, options: GuardOptions = {}) {
  if (!RUN_ID.test(runId)) throw new Error("invalid sandbox run id");
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const settleAttempts = options.settleAttempts ?? DEFAULT_SETTLE_ATTEMPTS;
  const settleDelayMs = options.settleDelayMs ?? DEFAULT_SETTLE_DELAY_MS;
  const singleAttemptWrites = options.singleAttemptWrites ?? false;
  const base = (config.baseUrl ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
  const origin = new URL(base).origin;
  const headers = { Authorization: `Bearer ${config.token}`, Version: config.apiVersion, Accept: "application/json" };
  const isSynthetic = (email: unknown): email is string => typeof email === "string" && syntheticEmailPattern(runId).test(email);

  const contacts = new Map<string, string>(); // id -> synthetic email (run-owned)
  const opportunities = new Map<string, string>(); // id -> contact id (run-owned)
  const pendingEmails = new Set<string>(); // contact intents with no confirmed create yet
  const pendingOpportunities: Array<{ contactId: string; name: string | null }> = []; // opportunity intents with no confirmed outcome
  const attempted = new Set<string>(); // "<kind>:<id>" a DELETE was attempted; never sent again
  const done = new Set<string>(); // "<kind>:<id>" deleted or verified absent
  const sentWrites = new Set<string>();
  const unowned = new Set<string>(); // contact ids an upsert proved this run did not create
  let legacyJournal = false; // adopted a journal older than JOURNAL_VERSION: read-only checks only
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

  const pendingFor = (contactId: string) => pendingOpportunities.some((o) => o.contactId === contactId);
  const settleIntent = (contactId: string) => {
    const i = pendingOpportunities.findIndex((o) => o.contactId === contactId);
    if (i >= 0) pendingOpportunities.splice(i, 1);
  };
  /** A 4xx means GHL refused the request, so nothing was created. */
  const isRejected = (status: number) => status >= 400 && status < 500 && status !== 408;

  function send(url: string, init: RequestInit | undefined, method: string, p: string): Promise<Response> {
    if (singleAttemptWrites) {
      const key = `${method} ${p} ${String(init?.body ?? "")}`;
      if (sentWrites.has(key)) return halt(`a ${method} would repeat a write already attempted; writes are sent once`);
      sentWrites.add(key);
    }
    return inner(url, init);
  }

  const fetch: FetchLike = async (url, init) => {
    const target = new URL(url);
    if (target.origin !== origin) return halt("request to an unexpected origin");
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET") return inner(url, init);
    if (halted) return halt(`run already stopped (${halted})`);
    try {
      return await mutate(url, init, method, target.pathname);
    } catch (err) {
      // A thrown request or a failed journal write leaves the outcome unknown: nothing further may be written.
      if (!halted) {
        halted = `write stopped without a confirmed outcome: ${(err as Error).message}`;
        await manifest.append({ t: "stopped", reason: halted }).catch(() => {});
      }
      throw err;
    }
  };

  async function mutate(url: string, init: RequestInit | undefined, method: string, p: string): Promise<Response> {
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
      const res = await send(url, init, method, p);
      if (!expected && isRejected(res.status)) {
        pendingEmails.delete(body.email);
        await manifest.append({ t: "create_rejected", kind: "contact", email: body.email, status: res.status });
      }
      const data = await readJson(res.clone());
      const id = data?.contact?.id;
      if (typeof id !== "string" || !id) return halt("upsert response was unreadable; contact may exist (reconcile by email)");
      if (data.new === true) {
        if (contacts.has(id) && contacts.get(id) !== body.email) return halt("upsert returned a known id for another email");
        contacts.set(id, body.email);
        pendingEmails.delete(body.email);
        await manifest.append({ t: "created", kind: "contact", id, email: body.email });
      } else if (data.new !== false || contacts.get(id) !== body.email) {
        if (!contacts.has(id)) {
          // GHL says the contact already existed: it is not this run's, now or after a restart.
          pendingEmails.delete(body.email);
          unowned.add(id);
          await manifest.append({ t: "unowned_match", kind: "contact", email: body.email, id });
        }
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
      const res = await send(url, init, method, p);
      if (singleAttemptWrites && !res.ok) return halt(`${method} to a run contact returned ${res.status}; writes are sent once`);
      return res;
    }

    if (method === "POST" && p === "/opportunities/") {
      if (
        !contacts.has(body?.contactId) ||
        body.locationId !== config.locationId ||
        body.pipelineId !== config.pipelineId ||
        body.pipelineStageId !== config.pipelineStageId ||
        typeof body.name !== "string" ||
        !body.name.includes(runId)
      ) {
        return halt("opportunity is not a run-named record for a run contact in the sandbox pipeline and stage");
      }
      await manifest.append({ t: "intent", kind: "opportunity", contactId: body.contactId, name: body.name });
      pendingOpportunities.push({ contactId: body.contactId, name: body.name });
      const res = await send(url, init, method, p);
      if (isRejected(res.status)) {
        settleIntent(body.contactId);
        await manifest.append({ t: "create_rejected", kind: "opportunity", contactId: body.contactId, status: res.status });
      }
      const id = (await readJson(res.clone()))?.opportunity?.id;
      if (typeof id !== "string" || !id) return halt("opportunity create response was unreadable; reconcile by contact");
      opportunities.set(id, body.contactId);
      settleIntent(body.contactId);
      await manifest.append({ t: "created", kind: "opportunity", id, contactId: body.contactId });
      return res;
    }

    return halt(`mutation not allowed in a sandbox run (${method} ${p.split("/").slice(0, 2).join("/")})`);
  }

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
    const first = entries.find((e) => e.t === "start");
    legacyJournal = !(first && first.t === "start" && (first.journalVersion ?? 0) >= JOURNAL_VERSION);
    for (const e of entries) {
      if (e.t === "intent" && e.kind === "contact") pendingEmails.add(e.email);
      if (e.t === "unowned_match") {
        pendingEmails.delete(e.email);
        unowned.add(e.id);
      }
      if (e.t === "created" && e.kind === "contact") {
        contacts.set(e.id, e.email);
        pendingEmails.delete(e.email);
        // An older journal can't show whether a DELETE was sent: verify only, never delete.
        if (legacyJournal) attempted.add(`contact:${e.id}`);
      }
      if (e.t === "create_rejected" && e.kind === "contact") pendingEmails.delete(e.email);
      if (e.t === "intent" && e.kind === "opportunity") pendingOpportunities.push({ contactId: e.contactId, name: e.name ?? null });
      if (e.t === "created" && e.kind === "opportunity") {
        // An older journal could record an opportunity as "recovered" on contact membership alone.
        if (legacyJournal && e.recovered) continue;
        opportunities.set(e.id, e.contactId);
        settleIntent(e.contactId);
        if (legacyJournal) attempted.add(`opportunity:${e.id}`);
      }
      if (e.t === "create_rejected" && e.kind === "opportunity") settleIntent(e.contactId);
      if (e.t === "delete_intent" || e.t === "deleted") attempted.add(`${e.kind}:${e.id}`);
      // Older journals have no delete_intent; only these reasons mean a DELETE was actually sent.
      if (e.t === "delete_failed" && /^(DELETE returned|still present after DELETE)/.test(e.reason)) attempted.add(`${e.kind}:${e.id}`);
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
    // Every pipeline: an opportunity elsewhere on this contact must be seen too.
    const q = new URLSearchParams({ location_id: config.locationId, contact_id: contactId, status: "all", limit: "100" });
    const body = await readJson(await get(`/opportunities/search?${q}`));
    if (!Array.isArray(body?.opportunities)) throw new SandboxRefusal("opportunity search was unreadable");
    const ids = body.opportunities.map((o: any) => o?.id);
    if (ids.some((x: unknown) => typeof x !== "string" || !x)) throw new SandboxRefusal("opportunity search listed a record without an id");
    const total = body?.meta?.total;
    if (typeof total === "number" && total > ids.length) throw new SandboxRefusal(`opportunity search was incomplete (${ids.length} of ${total})`);
    return ids as string[];
  }

  /** One read of a record; a thrown read counts as unknown, never as absent. */
  async function readState(kind: RecordKind, id: string): Promise<Absent> {
    try {
      return (await presence(kind, id)).state;
    } catch {
      return "unknown";
    }
  }

  /** Bounded, journalled wait for a deleted record to read as absent. */
  async function awaitAbsent(kind: RecordKind, id: string): Promise<Absent> {
    let state: Absent = "unknown";
    for (let attempt = 1; attempt <= settleAttempts; attempt++) {
      if (attempt > 1) await sleep(settleDelayMs);
      state = await readState(kind, id);
      await manifest.append({ t: "verify_record", kind, id, attempt, of: settleAttempts, state });
      if (state === "absent") break;
    }
    return state;
  }

  async function observe(pre: Snapshot | null) {
    const tally = async (kind: RecordKind, ids: string[]) => {
      const states = new Map<string, Absent>();
      for (const id of ids) {
        const state = await readState(kind, id);
        states.set(id, state);
        if (state === "absent" && !done.has(`${kind}:${id}`)) {
          done.add(`${kind}:${id}`);
          await manifest.append({ t: "verified_absent", kind, id });
        }
      }
      return states;
    };
    const contactStates = await tally("contact", [...contacts.keys()]);
    const opportunityStates = await tally("opportunity", [...opportunities.keys()]);

    let searchIds: string[] | null = [];
    try {
      for (const contactId of contacts.keys()) searchIds.push(...(await searchOpportunities(contactId)));
    } catch {
      searchIds = null;
    }

    let list: Snapshot | null = null;
    if (pre) {
      try {
        list = await snapshot();
      } catch {
        list = null;
      }
    }
    const runIds = list ? list.ids.filter((id) => contacts.has(id)) : [];
    const missing = list && pre ? pre.ids.filter((id) => !list!.ids.includes(id)) : [];
    const foreign = list && pre ? list.ids.filter((id) => !pre.ids.includes(id) && !contacts.has(id)) : [];
    const baseline = list && pre ? compareSnapshots(pre, list) : null;

    const allAbsent = (m: Map<string, Absent>) => [...m.values()].every((s) => s === "absent");
    const idsAbsent = allAbsent(contactStates) && allAbsent(opportunityStates) && searchIds !== null && searchIds.length === 0;
    return { contactStates, opportunityStates, searchIds, list, runIds, missing, foreign, baseline, idsAbsent, verified: idsAbsent && (!pre || baseline?.ok === true) };
  }

  /** After every DELETE was accepted: polls until by-id reads, search and the contact list all agree. */
  async function settle(pre: Snapshot | null, lines: string[]): Promise<CleanupReport> {
    const counts = (m: Map<string, Absent>) => {
      const v = [...m.values()];
      return { absent: v.filter((s) => s === "absent").length, present: v.filter((s) => s === "present").length, unknown: v.filter((s) => s === "unknown").length };
    };
    let last = await observe(pre);
    for (let attempt = 1; ; attempt++) {
      await manifest.append({
        t: "verify_attempt",
        attempt,
        of: settleAttempts,
        verdict: last.verified ? "verified" : "waiting",
        contacts: counts(last.contactStates),
        opportunities: counts(last.opportunityStates),
        searchRemaining: last.searchIds === null ? null : last.searchIds.length,
        list: last.list ? { total: last.list.total, runIds: last.runIds, missingBaseline: last.missing, foreign: last.foreign } : null,
      });
      if (last.verified || attempt >= settleAttempts) break;
      await sleep(settleDelayMs);
      last = await observe(pre);
    }
    if (last.list) await manifest.append({ t: "snapshot", phase: "post", ...last.list });

    const summary = `${contacts.size} contact(s), ${opportunities.size} opportunity(ies)`;
    if (last.verified) {
      lines.push(`PASS  cleanup: ${summary} deleted and verified absent`);
      if (last.baseline) lines.push(`PASS  pre-existing contacts: ${last.baseline.detail}`);
      return { ok: true, state: "verified", lines, idsAbsent: true, baseline: last.baseline };
    }

    // Real differences, as opposed to reads that have not caught up.
    const problems: Array<[RecordKind, string, string]> = [];
    const remains = "still present after DELETE; the DELETE will not be repeated. Remove it in GoHighLevel, then re-run --reconcile to verify";
    for (const [id, s] of last.contactStates) if (s === "present") problems.push(["contact", id, remains]);
    for (const [id, s] of last.opportunityStates) if (s === "present") problems.push(["opportunity", id, remains]);
    for (const id of last.searchIds ?? []) {
      if (!opportunities.has(id)) problems.push(["opportunity", id, "found on a run contact but not recorded by this run"]);
    }
    for (const [kind, id, reason] of problems) {
      lines.push(`FAIL  cleanup ${kind} ${id}: ${reason}`);
      await manifest.append({ t: "delete_failed", kind, id, reason });
    }
    if (last.missing.length) lines.push(`FAIL  pre-existing contacts missing: ${last.missing.join(", ")}`);
    if (last.foreign.length) lines.push(`FAIL  contacts this run did not create appeared: ${last.foreign.join(", ")}`);
    if (problems.length || last.missing.length || last.foreign.length) {
      lines.push(`FAIL  cleanup: ${summary} not all verified absent, or the baseline differs`);
      return { ok: false, state: "failed", lines, idsAbsent: false, baseline: last.baseline };
    }

    lines.push(`PENDING  cleanup: every DELETE was accepted, but reads had not converged after ${settleAttempts} verification pass(es). Re-verify later with --reconcile.`);
    return { ok: false, state: "pending_consistency", lines, idsAbsent: last.idsAbsent, baseline: last.baseline };
  }

  async function cleanup(opts: { pre?: Snapshot | null } = {}): Promise<CleanupReport> {
    const lines: string[] = [];
    const stop = (): CleanupReport => ({ ok: false, state: "failed", lines, idsAbsent: false, baseline: null });
    const fail = async (kind: RecordKind, id: string, reason: string) => {
      lines.push(`FAIL  cleanup ${kind} ${id}: ${reason}`);
      await manifest.append({ t: "delete_failed", kind, id, reason });
    };
    const unresolved = async (kind: RecordKind, ref: string, reason: string) => {
      lines.push(`FAIL  cleanup ${kind} ${ref}: unresolved: ${reason}`);
      await manifest.append({ t: "unresolved", kind, ref, reason });
    };
    /** Contacts kept because an opportunity create on them has no known outcome. */
    const blocked = new Set<string>();

    /** Adopts an opportunity only with run-specific proof against an open create intent. */
    const recover = async (id: string, contactId: string): Promise<boolean> => {
      const intent = pendingOpportunities.find((p) => p.contactId === contactId);
      if (!intent?.name || !intent.name.includes(runId)) return false;
      const { state, body } = await presence("opportunity", id);
      const o = body?.opportunity;
      if (state !== "present" || o?.id !== id || o.contactId !== contactId || o.pipelineId !== config.pipelineId || o.pipelineStageId !== config.pipelineStageId || o.name !== intent.name) {
        return false;
      }
      opportunities.set(id, contactId);
      settleIntent(contactId);
      await manifest.append({ t: "created", kind: "opportunity", id, contactId, recovered: true });
      lines.push(`ok    recovered opportunity ${id} from its create intent`);
      return true;
    };

    try {
      if (legacyJournal) lines.push("note  older journal (no version): read-only verification only; nothing it names will be deleted");
      // 1. Contacts whose create response was lost: find by the run's unique synthetic email.
      for (const email of [...pendingEmails]) {
        let id: string | null = null;
        for (let attempt = 1; attempt <= settleAttempts && !id; attempt++) {
          if (attempt > 1) await sleep(settleDelayMs);
          const res = await get(`/contacts/search/duplicate?${new URLSearchParams({ locationId: config.locationId, email })}`);
          const found = await readJson(res);
          if (res.status !== 200 || !found || (found.contact !== null && typeof found.contact?.id !== "string")) {
            await fail("contact", email, "lookup for an unconfirmed create was unreadable; reconcile later");
            return stop();
          }
          id = found.contact?.id ?? null;
        }
        if (!id) {
          await unresolved("contact", email, "its create response was lost and lookups did not find it, so its absence is not established. Check GoHighLevel");
          continue;
        }
        // Ownership needs proof beyond the address: not a contact GHL said was someone else's,
        // and not one that existed before the run started.
        if (unowned.has(id) || !opts.pre || opts.pre.ids.includes(id)) {
          await unresolved("contact", email, `found ${id}, but this run cannot prove it created it, so it is left in place. Check GoHighLevel`);
          continue;
        }
        const { state, body } = await presence("contact", id);
        if (state !== "present" || body?.contact?.id !== id || body.contact.email !== email) {
          await fail("contact", id, "unconfirmed create could not be verified as this run's; left in place");
          return stop();
        }
        contacts.set(id, email);
        pendingEmails.delete(email);
        await manifest.append({ t: "created", kind: "contact", id, email, recovered: true });
        lines.push(`ok    recovered unconfirmed contact ${id}`);
      }

      // 2. Opportunities on run contacts, including ones whose create response was lost.
      //    Any other opportunity on a run contact is someone else's: stop before deleting anything.
      for (const contactId of contacts.keys()) {
        if (done.has(`contact:${contactId}`) && !pendingFor(contactId)) continue;
        const attempts = pendingFor(contactId) ? settleAttempts : 1;
        for (let attempt = 1; attempt <= attempts; attempt++) {
          if (attempt > 1) await sleep(settleDelayMs);
          for (const id of await searchOpportunities(contactId)) {
            if (opportunities.has(id) || (await recover(id, contactId))) continue;
            await fail("opportunity", id, `on run contact ${contactId} but not proven to be this run's; nothing deleted, contact preserved`);
            return stop();
          }
          if (!pendingFor(contactId)) break;
        }
        if (pendingFor(contactId)) {
          blocked.add(contactId);
          await unresolved("opportunity", contactId, "an opportunity create on this contact has no known outcome, so the contact is left in place. Check GoHighLevel");
        }
      }

      // 3. Opportunities first, each re-read and checked before its single DELETE.
      for (const [id, contactId] of opportunities) {
        if (done.has(`opportunity:${id}`)) continue;
        if (attempted.has(`opportunity:${id}`)) {
          if ((await awaitAbsent("opportunity", id)) !== "absent") {
            await fail("opportunity", id, "a DELETE was already attempted and will not be repeated. Remove it in GoHighLevel, then re-run --reconcile to verify");
            return stop();
          }
          done.add(`opportunity:${id}`);
          await manifest.append({ t: "verified_absent", kind: "opportunity", id });
          continue;
        }
        const { state, body } = await presence("opportunity", id);
        if (state === "absent") {
          done.add(`opportunity:${id}`);
          await manifest.append({ t: "verified_absent", kind: "opportunity", id });
          continue;
        }
        const o = body?.opportunity;
        if (state !== "present" || o?.id !== id || o.contactId !== contactId || !contacts.has(contactId) || o.pipelineId !== config.pipelineId) {
          await fail("opportunity", id, "read-back did not match the run's record; no delete sent");
          return stop();
        }
        await manifest.append({ t: "delete_intent", kind: "opportunity", id });
        attempted.add(`opportunity:${id}`);
        const res = await inner(`${base}/opportunities/${encodeURIComponent(id)}`, { method: "DELETE", headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) {
          await fail("opportunity", id, `DELETE returned ${res.status}; not retried`);
          return stop();
        }
        await manifest.append({ t: "deleted", kind: "opportunity", id });
        const gone = await awaitAbsent("opportunity", id);
        if (gone !== "absent") {
          await fail("opportunity", id, gone === "present" ? "still present after DELETE; its contact is left in place" : "deletion could not be confirmed; its contact is left in place");
          return stop();
        }
        done.add(`opportunity:${id}`);
        await manifest.append({ t: "verified_absent", kind: "opportunity", id });
      }

      // 4. Contacts, each re-read and checked (id, exact synthetic email, location) before its single DELETE.
      //    A contact is deleted only once all of its known opportunities are verified gone.
      for (const [id, email] of contacts) {
        if (done.has(`contact:${id}`) || blocked.has(id)) continue;
        if ([...opportunities].some(([oid, cid]) => cid === id && !done.has(`opportunity:${oid}`))) {
          await fail("contact", id, "an opportunity on this contact is not verified gone; no delete sent");
          return stop();
        }
        if (attempted.has(`contact:${id}`)) continue; // never re-sent; the verification below reads it
        const { state, body } = await presence("contact", id);
        if (state === "absent") {
          done.add(`contact:${id}`);
          await manifest.append({ t: "verified_absent", kind: "contact", id });
          continue;
        }
        const c = body?.contact;
        if (state !== "present" || c?.id !== id || c.email !== email || !isSynthetic(c.email) || (c.locationId !== undefined && c.locationId !== config.locationId)) {
          await fail("contact", id, "read-back did not match the run's record; no delete sent");
          return stop();
        }
        await manifest.append({ t: "delete_intent", kind: "contact", id });
        attempted.add(`contact:${id}`);
        const res = await inner(`${base}/contacts/${encodeURIComponent(id)}`, { method: "DELETE", headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) {
          await fail("contact", id, `DELETE returned ${res.status}; not retried`);
          return stop();
        }
        await manifest.append({ t: "deleted", kind: "contact", id });
      }

      // Unresolved creates mean cleanup cannot be verified, however the reads below would look.
      if (blocked.size || pendingEmails.size || pendingOpportunities.length) return stop();

      // 5. Every DELETE was accepted. Verify by id, by search and against the baseline.
      return await settle(opts.pre ?? null, lines);
    } catch (err) {
      lines.push(`FAIL  cleanup stopped: ${(err as Error).message}`);
      await manifest.append({ t: "stopped", reason: `cleanup: ${(err as Error).message}` }).catch(() => {});
      return stop();
    }
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

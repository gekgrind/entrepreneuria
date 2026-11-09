/**
 * GoHighLevel (LeadConnector API v2, `Version: 2021-07-28`) lead adapter.
 *
 * Pure of env and `server-only`, so it can be unit-tested with a fake
 * fetch; construct it through ./server.ts, which reads server-side env.
 * Scopes used: contacts.write, contacts.readonly, opportunities.readonly,
 * opportunities.write. (The duplicate search needs contacts.readonly.)
 *
 * Sync order, and why each step is safe to repeat:
 *   0. GET /contacts/search/duplicate by email (read-only, strict). If a
 *      contact exists, NOTHING is written to it: no upsert, details, tags,
 *      note or opportunity, so no CRM workflow fires (owner, 2026-11-09).
 *      The sync throws GhlMatchedExistingError and the caller records the
 *      inquiry for manual review outside the CRM. A lookup it cannot read
 *      strictly is an error, never "new".
 *   1. POST /contacts/upsert with the email ONLY (the spec says upsert
 *      `tags` "will overwrite all current tags"). If the response's `new`
 *      flag is not true, the email matched a contact after all (race or
 *      index lag): only the email was sent, nothing changed, and the sync
 *      stops with GhlMatchedExistingError("matched_on_upsert").
 *   1b. PUT /contacts/{id} with name, phone, company, website, source and
 *      custom fields (by field id), on the contact this sync created.
 *   2. POST /contacts/{id}/tags. Additive, so repeating it changes nothing.
 *   3. GET  /contacts/{id}/notes; POST a note only if none carries this
 *      submission's `Reference:` marker. The note comes before the
 *      opportunity so the full record (style, package, consent) reaches the
 *      CRM even when the opportunity step fails.
 *   4. Opportunity: reuse one this process just created, else GET
 *      /opportunities/search (open, this contact, this pipeline), else
 *      create.
 *
 * Retry policy:
 *   - Idempotent calls (upsert, update, add tags, reads) retry once after a network
 *     error, timeout, 5xx or unreadable 200.
 *   - Creates (opportunity, note) are sent at most once per sync. After an
 *     ambiguous failure (timeout, 5xx, unreadable success) the adapter
 *     re-reads and reuses what it finds, or throws a retryable
 *     `outcome: "unknown"` error for the durable queue.
 *   - A read whose response can't be understood is an error, never
 *     "not found", so it can't trigger a duplicate create.
 *   - 429 is never retried inline. HighLevel sends no Retry-After; the
 *     error carries `retryAfterMs` from the X-RateLimit-* headers.
 *   - The timeout covers headers AND body, and every sync has an overall
 *     time budget, so a stalled response can't hold the per-email lock.
 *
 * Concurrency: syncs for the same location and email run one at a time in
 * this process. Opportunities this process just created are remembered
 * briefly, so a lagging search index can't cause a second create.
 * Separate processes are NOT serialized; that needs the planned
 * asynchronous CRM sync worker.
 */

import { CRITICAL_CUSTOM_FIELDS, type LogicalCustomField } from "./config";

export interface GhlConfig {
  token: string;
  locationId: string;
  pipelineId: string;
  pipelineStageId: string;
  apiVersion: string;
  baseUrl?: string;
  /** Per request, headers and body. Default 8000 ms. */
  timeoutMs?: number;
  /** Total budget for one sync, including retries. Default 25000 ms. */
  syncBudgetMs?: number;
  /** Wait before re-reading after an ambiguous create. Default 2000 ms. */
  reconcileDelayMs?: number;
  /** Logical field name → GHL custom field id (validated by config.ts). */
  customFieldIds: Partial<Record<LogicalCustomField, string>>;
}

export interface CrmLead {
  name: string;
  email: string;
  /** E.164, or omitted. Anything else is dropped with a warning. */
  phone?: string;
  companyName: string;
  website?: string;
  source: string;
  tags: string[];
  /**
   * Tags that record consent. Added only to a contact this submission
   * created: an anonymous form must never mark someone else's existing
   * contact as consenting. Consent is always in the note as well.
   */
  newContactTags?: string[];
  customFields: Partial<Record<LogicalCustomField, string | undefined>>;
  opportunityName: string;
  note: string;
  /** Stable per submission (the inquiry idempotency key). Makes the note idempotent. */
  reference: string;
}

export interface CrmSyncResult {
  contactId: string;
  opportunityId: string;
  opportunityCreated: boolean;
  noteCreated: boolean;
  /** Non-fatal problems: unmapped/rejected/unapplied fields, dropped phone, reconciled creates. Never PII. */
  warnings: string[];
}

export interface LeadCrm {
  syncLead(lead: CrmLead): Promise<CrmSyncResult>;
  /**
   * Open opportunities in the intake pipeline (optionally one stage), read
   * from one page of up to 100 results. Used only for the leads-mode
   * capacity limit. Throws a GhlError when GHL cannot answer.
   * VERIFY (staging, D-10): the `limit`, `pipeline_stage_id` and `meta.total`
   * behaviour of the search endpoint has not been tested on a real location.
   */
  countOpenOpportunities?(opts?: { stageId?: string }): Promise<number>;
  /**
   * Read-only lookup by email (GET /contacts/search/duplicate). Resolves to
   * the contact id or null for an explicit "no contact". Any failure or
   * response it cannot read strictly throws: an unknown answer is never
   * treated as "new".
   */
  findContactByEmail?(email: string, reference?: string): Promise<{ contactId: string; createdHere?: boolean } | null>;
}

export type GhlStep = "contact" | "tags" | "opportunity" | "note";

/**
 * `outcome`: "rejected" means the request was not applied (4xx, 429).
 * "unknown" means it may have been applied (timeout, network error, 5xx,
 * unreadable success response, exhausted time budget).
 */
export class GhlError extends Error {
  public readonly outcome: "rejected" | "unknown";
  public readonly retryAfterMs?: number;

  constructor(
    message: string,
    public readonly step: GhlStep,
    public readonly status: number | null,
    public readonly retryable: boolean,
    public readonly contactId?: string,
    opts: { outcome?: "rejected" | "unknown"; retryAfterMs?: number } = {}
  ) {
    super(message);
    this.name = "GhlError";
    this.outcome = opts.outcome ?? (status === null || status >= 500 ? "unknown" : "rejected");
    this.retryAfterMs = opts.retryAfterMs;
  }
}

/**
 * The submission's email belongs to a contact this sync did not create.
 * Owner decision (2026-11-09): an existing contact is never written to, so
 * the sync stops here and the caller routes the inquiry to manual review.
 *   - "existing": found by the read-only lookup; nothing was written.
 *   - "matched_on_upsert": the lookup saw none, but the email-only upsert
 *     matched a contact (a race or index lag). Only the email was sent, so
 *     no field changed; nothing further was written.
 */
export class GhlMatchedExistingError extends Error {
  constructor(
    public readonly contactId: string,
    public readonly reason: "existing" | "matched_on_upsert"
  ) {
    super(`GHL contact already exists (${reason})`);
    this.name = "GhlMatchedExistingError";
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Serializes async work per key within this process. */
export interface KeyedLock {
  run<T>(key: string, fn: () => Promise<T>): Promise<T>;
  size(): number;
}

export function createKeyedLock(): KeyedLock {
  const tails = new Map<string, Promise<void>>();
  return {
    async run(key, fn) {
      const prev = tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const mine = new Promise<void>((r) => (release = r));
      const tail = prev.then(() => mine);
      tails.set(key, tail);
      await prev;
      try {
        return await fn();
      } finally {
        release();
        if (tails.get(key) === tail) tails.delete(key);
      }
    },
    size: () => tails.size,
  };
}

/** Opportunities this process created recently, keyed by location|pipeline|contact. */
export interface RecentOpportunities {
  get(key: string): string | undefined;
  set(key: string, id: string): void;
}

export function createRecentOpportunities(ttlMs = 10 * 60_000, now: () => number = Date.now): RecentOpportunities {
  const entries = new Map<string, { id: string; at: number }>();
  return {
    get(key) {
      const e = entries.get(key);
      if (!e) return undefined;
      if (now() - e.at > ttlMs) {
        entries.delete(key);
        return undefined;
      }
      return e.id;
    },
    set(key, id) {
      for (const [k, e] of entries) if (now() - e.at > ttlMs) entries.delete(k);
      entries.set(key, { id, at: now() });
    },
  };
}

/* Process-wide: server.ts builds a new client per request. */
const processLock = createKeyedLock();
const processRecentOpportunities = createRecentOpportunities();
/** Contacts this process created, by location|email|submission reference, so a retry of the SAME submission can finish its own contact. */
const processRecentContacts = createRecentOpportunities(30 * 60_000);

const RETRY_DELAY_MS = 600;
const DEFAULT_BURST_WAIT_MS = 10_000;
const E164 = /^\+[1-9]\d{7,14}$/;

/** How long to wait after a 429, from HighLevel's documented rate-limit headers. */
export function rateLimitWaitMs(headers: Headers): number {
  const num = (name: string) => {
    const v = Number(headers.get(name));
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  // X-RateLimit-Daily-Reset is documented as milliseconds remaining (a duration, not a timestamp).
  if (headers.get("x-ratelimit-daily-remaining") === "0") {
    return num("x-ratelimit-daily-reset") ?? 24 * 60 * 60 * 1000;
  }
  const interval = num("x-ratelimit-interval-milliseconds") ?? DEFAULT_BURST_WAIT_MS;
  const retryAfterS = num("retry-after"); // not documented as sent; honored if it ever is
  return Math.max(interval, retryAfterS ? retryAfterS * 1000 : 0);
}

export function createGhlClient(
  config: GhlConfig,
  deps: {
    fetch?: FetchLike;
    sleep?: (ms: number) => Promise<void>;
    lock?: KeyedLock;
    recentOpportunities?: RecentOpportunities;
    /** Contacts created by this process (same shape: key → contact id). */
    recentContacts?: RecentOpportunities;
    now?: () => number;
  } = {}
): LeadCrm {
  const doFetch = deps.fetch ?? ((i, init) => fetch(i, init));
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const lock = deps.lock ?? processLock;
  const recent = deps.recentOpportunities ?? processRecentOpportunities;
  const ownContacts = deps.recentContacts ?? processRecentContacts;
  const now = deps.now ?? Date.now;
  const base = (config.baseUrl ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
  const timeoutMs = config.timeoutMs ?? 8000;
  const syncBudgetMs = config.syncBudgetMs ?? 25_000;
  const reconcileDelayMs = config.reconcileDelayMs ?? 2000;

  function makeCaller(deadline: number) {
    return async function call<T>(
      step: GhlStep,
      method: "GET" | "POST" | "PUT",
      path: string,
      body: unknown,
      opts: { idempotent: boolean; contactId?: string; onRetry?: () => void }
    ): Promise<T> {
      const attempts = opts.idempotent ? 2 : 1;
      let last: GhlError | null = null;

      for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) {
          opts.onRetry?.();
          await sleep(RETRY_DELAY_MS);
        }
        const remaining = deadline - now();
        if (remaining <= 0) {
          throw last ?? new GhlError(`GHL ${step} skipped: sync time budget exhausted`, step, null, true, opts.contactId, { outcome: "unknown" });
        }
        const limit = Math.min(timeoutMs, remaining);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), limit);
        try {
          let res: Response;
          try {
            res = await doFetch(`${base}${path}`, {
              method,
              headers: {
                Authorization: `Bearer ${config.token}`,
                Version: config.apiVersion,
                Accept: "application/json",
                ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
              },
              body: body !== undefined ? JSON.stringify(body) : undefined,
              cache: "no-store",
              signal: controller.signal,
            });
          } catch (err) {
            const reason = controller.signal.aborted ? `timed out after ${limit} ms` : (err as Error).message;
            last = new GhlError(`GHL ${step} request failed: ${reason}`, step, null, true, opts.contactId, { outcome: "unknown" });
            continue;
          }

          if (res.ok) {
            // Read the body under the same timeout. An unreadable success is "unknown", never "empty".
            try {
              return (await res.json()) as T;
            } catch {
              last = new GhlError(`GHL ${step} returned an unreadable ${res.status} response`, step, res.status, true, opts.contactId, {
                outcome: "unknown",
              });
              continue;
            }
          }
          if (res.status === 429) {
            // Rejected before the endpoint ran (documented); never retried inline.
            throw new GhlError(`GHL ${step} rate limited`, step, 429, true, opts.contactId, {
              outcome: "rejected",
              retryAfterMs: rateLimitWaitMs(res.headers),
            });
          }
          if (res.status >= 500) {
            last = new GhlError(`GHL ${step} returned ${res.status}`, step, res.status, true, opts.contactId, { outcome: "unknown" });
            continue;
          }
          throw new GhlError(`GHL ${step} returned ${res.status}`, step, res.status, false, opts.contactId, { outcome: "rejected" });
        } finally {
          clearTimeout(timer);
        }
      }
      throw last!;
    };
  }

  function mapCustomFields(values: CrmLead["customFields"]) {
    const sent: Array<{ name: LogicalCustomField; id: string; value: string }> = [];
    const unmapped: LogicalCustomField[] = [];
    for (const [name, value] of Object.entries(values) as Array<[LogicalCustomField, string | undefined]>) {
      if (value === undefined || value === "") continue;
      const id = config.customFieldIds[name];
      if (id) sent.push({ name, id, value });
      else unmapped.push(name);
    }
    return { sent, unmapped };
  }

  const critical = (name: LogicalCustomField) => (CRITICAL_CUSTOM_FIELDS.includes(name) ? ":critical" : "");

  const ownKey = (email: string, reference: string) => `${base}|${config.locationId}|${email.trim().toLowerCase()}|${reference}`;

  async function lookupByEmail(
    call: ReturnType<typeof makeCaller>,
    email: string,
    reference?: string
  ): Promise<{ contactId: string; createdHere: boolean } | null> {
    const q = new URLSearchParams({ locationId: config.locationId, email });
    const r = await call<{ contact?: unknown }>("contact", "GET", `/contacts/search/duplicate?${q}`, undefined, { idempotent: true });
    // Only an explicit `contact: null` means "none" (strict, as in #29).
    if (!r || typeof r !== "object" || Array.isArray(r) || !("contact" in r)) {
      throw new GhlError("GHL duplicate search response had no contact field", "contact", 200, true, undefined, { outcome: "unknown" });
    }
    const c = (r as { contact?: unknown }).contact;
    if (c === null) return null;
    const id = c && typeof c === "object" ? (c as { id?: unknown }).id : undefined;
    if (typeof id !== "string" || !id) {
      throw new GhlError("GHL duplicate search response had no contact id", "contact", 200, true, undefined, { outcome: "unknown" });
    }
    // Created by this process for an earlier attempt of the SAME submission: not a pre-existing contact.
    return { contactId: id, createdHere: reference !== undefined && ownContacts.get(ownKey(email, reference)) === id };
  }

  async function sync(lead: CrmLead): Promise<CrmSyncResult> {
    const call = makeCaller(now() + syncBudgetMs);
    const warnings: string[] = [];
    const { sent, unmapped } = mapCustomFields(lead.customFields);
    for (const name of unmapped) warnings.push(`custom_field_unmapped:${name}${critical(name)}`);

    let phone = lead.phone;
    if (phone !== undefined && !E164.test(phone)) {
      warnings.push("phone_not_e164_omitted");
      phone = undefined;
    }

    // 0. Read-only lookup. An existing contact is never written to: no
    //    upsert, details, tags, note or opportunity (owner, 2026-11-09).
    const found = await lookupByEmail(call, lead.email, lead.reference);
    if (found && !found.createdHere) throw new GhlMatchedExistingError(found.contactId, "existing");

    // 1. Create the contact by email alone.
    type ContactResponse = { new?: unknown; contact?: { id?: string; customFields?: Array<{ id?: string; value?: unknown }> } };
    let contactId: string;
    if (found) {
      // Resuming a contact this process created for an earlier attempt.
      contactId = found.contactId;
      warnings.push("resumed_contact_created_by_this_process");
    } else {
      const upsert = await call<ContactResponse>(
        "contact",
        "POST",
        "/contacts/upsert",
        { locationId: config.locationId, email: lead.email },
        { idempotent: true }
      );
      const id = upsert?.contact?.id;
      if (!id) {
        throw new GhlError("GHL upsert returned no contact id", "contact", 200, true, undefined, { outcome: "unknown" });
      }
      // Matched after all (race, index lag, or a retried upsert whose first
      // attempt created it): stop. Only the email was sent, so nothing changed.
      if (upsert.new !== true) throw new GhlMatchedExistingError(id, "matched_on_upsert");
      contactId = id;
      ownContacts.set(ownKey(lead.email, lead.reference), contactId);
    }

    // 1b. Details only for a contact this sync created. If GHL rejects the
    //     payload (400/422), drop custom fields, then the optional phone; if
    //     it still rejects, or the update fails, keep the bare contact and
    //     carry on: the note (step 3) holds every submitted value.
    {
      const contactPath = `/contacts/${encodeURIComponent(contactId)}`;
      const detailsBody = (withFields: boolean, withPhone: boolean) => ({
        name: lead.name,
        ...(withPhone && phone ? { phone } : {}),
        companyName: lead.companyName,
        ...(lead.website ? { website: lead.website } : {}),
        source: lead.source,
        ...(withFields && sent.length ? { customFields: sent.map((f) => ({ id: f.id, field_value: f.value })) } : {}),
      });
      // Fallback order: everything → without fields → without phone (fields kept) → neither.
      const hasFields = sent.length > 0;
      const hasPhone = Boolean(phone);
      const variants = [
        { withFields: hasFields, withPhone: hasPhone },
        { withFields: false, withPhone: hasPhone },
        { withFields: hasFields, withPhone: false },
        { withFields: false, withPhone: false },
      ].filter((v, i, all) => all.findIndex((w) => w.withFields === v.withFields && w.withPhone === v.withPhone) === i);

      let updated: ContactResponse | undefined;
      let used = variants[0];
      let rejection: GhlError | undefined;
      for (const v of variants) {
        try {
          updated = await call<ContactResponse>("contact", "PUT", contactPath, detailsBody(v.withFields, v.withPhone), {
            idempotent: true,
            contactId,
          });
          used = v;
          break;
        } catch (err) {
          if (!(err instanceof GhlError)) throw err;
          if (err.status !== 400 && err.status !== 422) {
            warnings.push(`contact_details_not_applied:${err.status ?? "network"}`);
            break;
          }
          rejection = err;
        }
      }
      if (!updated) {
        if (rejection) warnings.push(`contact_details_rejected:${rejection.status}`);
      } else {
        if (hasFields && !used.withFields) warnings.push(`custom_fields_rejected:${rejection!.status}`);
        if (hasPhone && !used.withPhone) warnings.push(`phone_rejected:${rejection!.status}`);
        const applied = updated?.contact?.customFields;
        if (used.withFields && Array.isArray(applied)) {
          const got = new Map(applied.map((f) => [f?.id, f?.value]));
          for (const f of sent) {
            const v = got.get(f.id);
            if (!got.has(f.id) || (typeof v === "string" && v !== f.value)) {
              warnings.push(`custom_field_not_applied:${f.name}${critical(f.name)}`);
            }
          }
        }
      }
    }

    // 2. Tags (additive). Only ever reached for a contact this sync created.
    const tags = [...lead.tags, ...(lead.newContactTags ?? [])];
    if (tags.length) {
      await call("tags", "POST", `/contacts/${encodeURIComponent(contactId)}/tags`, { tags }, { idempotent: true, contactId });
    }

    // 3. Note, once per submission, always with the submitted details.
    const marker = `Reference: ${lead.reference}`;
    const noteBody = [
      lead.note,
      "Submitted details:",
      `Name: ${lead.name}`,
      `Email: ${lead.email}`,
      phone ? `Phone: ${phone}` : null,
      `Business: ${lead.companyName}`,
      lead.website ? `Website: ${lead.website}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const hasNote = async () => {
      const r = await call<{ notes?: unknown }>("note", "GET", `/contacts/${encodeURIComponent(contactId)}/notes`, undefined, {
        idempotent: true,
        contactId,
      });
      if (!Array.isArray(r?.notes)) {
        throw new GhlError("GHL notes response had no notes list", "note", 200, true, contactId, { outcome: "unknown" });
      }
      return r.notes.some((n: { body?: unknown }) => typeof n?.body === "string" && n.body.includes(marker));
    };

    let noteCreated = false;
    if (!(await hasNote())) {
      try {
        await call("note", "POST", `/contacts/${encodeURIComponent(contactId)}/notes`, { body: `${noteBody}\n${marker}` }, {
          idempotent: false,
          contactId,
        });
        noteCreated = true;
      } catch (err) {
        if (!(err instanceof GhlError) || err.outcome !== "unknown") throw err;
        await sleep(reconcileDelayMs);
        if (!(await hasNote())) throw err;
        noteCreated = true;
        warnings.push("note_reconciled_after_ambiguous_create");
      }
    }

    // 4. Opportunity: recent in-process create, else search, else create once.
    const recentKey = `${base}|${config.locationId}|${config.pipelineId}|${contactId}`;
    const findOpen = async () => {
      const q = new URLSearchParams({
        location_id: config.locationId,
        contact_id: contactId,
        pipeline_id: config.pipelineId,
        status: "open",
      });
      const r = await call<{ opportunities?: unknown }>("opportunity", "GET", `/opportunities/search?${q}`, undefined, {
        idempotent: true,
        contactId,
      });
      if (!Array.isArray(r?.opportunities)) {
        throw new GhlError("GHL opportunity search response had no list", "opportunity", 200, true, contactId, { outcome: "unknown" });
      }
      return (r.opportunities as Array<{ id?: unknown }>).find((o) => typeof o?.id === "string" && o.id)?.id as string | undefined;
    };

    let opportunityId = recent.get(recentKey) ?? (await findOpen());
    let opportunityCreated = false;
    if (!opportunityId) {
      try {
        const created = await call<{ opportunity?: { id?: string } }>(
          "opportunity",
          "POST",
          "/opportunities/",
          {
            locationId: config.locationId,
            pipelineId: config.pipelineId,
            pipelineStageId: config.pipelineStageId,
            contactId,
            name: lead.opportunityName,
            status: "open",
          },
          { idempotent: false, contactId }
        );
        opportunityId = created?.opportunity?.id;
        if (!opportunityId) {
          throw new GhlError("GHL opportunity create returned no id", "opportunity", 200, true, contactId, { outcome: "unknown" });
        }
        opportunityCreated = true;
      } catch (err) {
        if (!(err instanceof GhlError) || err.outcome !== "unknown") throw err;
        await sleep(reconcileDelayMs);
        opportunityId = await findOpen();
        if (!opportunityId) throw err; // still unknown: the queue re-searches before any new create
        opportunityCreated = true;
        warnings.push("opportunity_reconciled_after_ambiguous_create");
      }
      recent.set(recentKey, opportunityId);
    }

    return { contactId, opportunityId, opportunityCreated, noteCreated, warnings };
  }

  return {
    findContactByEmail(email, reference) {
      return lookupByEmail(makeCaller(now() + timeoutMs * 2), email, reference);
    },
    syncLead(lead) {
      const key = `${base}|${config.locationId}|${lead.email.trim().toLowerCase()}`;
      return lock.run(key, () => sync(lead));
    },
    async countOpenOpportunities(opts = {}) {
      const call = makeCaller(now() + timeoutMs * 2);
      const q = new URLSearchParams({
        location_id: config.locationId,
        pipeline_id: config.pipelineId,
        status: "open",
        limit: "100",
      });
      if (opts.stageId) q.set("pipeline_stage_id", opts.stageId);
      const r = await call<{ opportunities?: unknown; meta?: { total?: unknown } }>(
        "opportunity",
        "GET",
        `/opportunities/search?${q}`,
        undefined,
        { idempotent: true }
      );
      if (!Array.isArray(r?.opportunities)) {
        throw new GhlError("GHL opportunity search response had no list", "opportunity", 200, true, undefined, { outcome: "unknown" });
      }
      const shown = r.opportunities.length;
      const total = r.meta?.total;
      // Prefer GHL's own total; otherwise the page length (100 means "at least 100", above any allowed limit).
      return typeof total === "number" && Number.isInteger(total) && total >= 0 ? Math.max(total, shown) : shown;
    },
  };
}

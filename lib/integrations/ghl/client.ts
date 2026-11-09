/**
 * GoHighLevel (LeadConnector API v2, `Version: 2021-07-28`) lead adapter.
 *
 * Pure of env and `server-only`, so it can be unit-tested with a fake
 * fetch; construct it through ./server.ts, which reads server-side env.
 * Scopes used: contacts.write, contacts.readonly, opportunities.readonly,
 * opportunities.write.
 *
 * Sync order, and why each step is safe to repeat:
 *   1. POST /contacts/upsert with the email ONLY. Upsert overwrites the
 *      fields it is sent on a contact that already exists (the spec says
 *      `tags` "will overwrite all current tags"), and this form is
 *      anonymous, so it must never rewrite an existing contact. The
 *      response's `new` flag says whether the contact was just created.
 *   1b. Only for a contact created by this upsert: PUT /contacts/{id} with
 *      name, phone, company, website, source and custom fields (by field
 *      id). An existing contact gets additive data only (steps 2–4); the
 *      submitted details go in its note. If `new` is missing, the contact
 *      is treated as existing.
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
    now?: () => number;
  } = {}
): LeadCrm {
  const doFetch = deps.fetch ?? ((i, init) => fetch(i, init));
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const lock = deps.lock ?? processLock;
  const recent = deps.recentOpportunities ?? processRecentOpportunities;
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
      opts: { idempotent: boolean; contactId?: string }
    ): Promise<T> {
      const attempts = opts.idempotent ? 2 : 1;
      let last: GhlError | null = null;

      for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) await sleep(RETRY_DELAY_MS);
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
  const isRejection = (err: unknown): err is GhlError => err instanceof GhlError && (err.status === 400 || err.status === 422);

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

    // 1. Find or create the contact by email alone, so nothing on an existing
    //    contact is overwritten.
    type ContactResponse = { new?: unknown; contact?: { id?: string; customFields?: Array<{ id?: string; value?: unknown }> } };
    const upsert = await call<ContactResponse>(
      "contact",
      "POST",
      "/contacts/upsert",
      { locationId: config.locationId, email: lead.email },
      { idempotent: true }
    );
    const contactId = upsert?.contact?.id;
    if (!contactId) {
      throw new GhlError("GHL upsert returned no contact id", "contact", 200, true, undefined, { outcome: "unknown" });
    }
    const created = upsert.new === true;

    // 1b. Details only for a contact this sync created. If GHL rejects the
    //     payload (400/422), drop custom fields, then the optional phone; if
    //     it still rejects, keep the bare contact. Values not applied remain
    //     in the note and the durable store.
    if (created) {
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
          if (!isRejection(err)) throw err;
          rejection = err;
        }
      }
      if (!updated) {
        warnings.push(`contact_details_rejected:${rejection!.status}`);
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
    } else {
      warnings.push("existing_contact_details_not_updated");
    }

    // 2. Tags (additive).
    if (lead.tags.length) {
      await call("tags", "POST", `/contacts/${encodeURIComponent(contactId)}/tags`, { tags: lead.tags }, { idempotent: true, contactId });
    }

    // 3. Note, once per submission. For an existing contact the note also
    //    carries the submitted details, since they were not applied.
    const marker = `Reference: ${lead.reference}`;
    const noteBody = created
      ? lead.note
      : [
          lead.note,
          "Submitted details (not applied to this existing contact):",
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
    syncLead(lead) {
      const key = `${base}|${config.locationId}|${lead.email.trim().toLowerCase()}`;
      return lock.run(key, () => sync(lead));
    },
  };
}

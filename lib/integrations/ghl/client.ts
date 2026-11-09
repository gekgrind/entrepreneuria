/**
 * GoHighLevel (LeadConnector API v2, `Version: 2021-07-28`) lead adapter.
 *
 * Pure of env and `server-only`, so it can be unit-tested with a fake
 * fetch; construct it through ./server.ts, which reads server-side env.
 * Scopes used: contacts.write, contacts.readonly, opportunities.readonly,
 * opportunities.write.
 *
 * The duplicate-search response body is not described in the published API
 * spec. It is parsed strictly (`{ contact: { id } }` or `{ contact: null }`);
 * anything else is an error, never "no contact". Verify against a sandbox
 * sub-account before live traffic.
 *
 * Sync order, and why each step is safe to repeat:
 *   0. GET /contacts/search/duplicate by email. An anonymous form must never
 *      change an existing contact, and upsert updates whatever it matches.
 *      So for an EXISTING contact nothing on the contact is written: no
 *      upsert, no custom fields, no consent tags, none of the lead's
 *      regular tags, and no opportunity (so no pipeline automation starts).
 *      It gets only `existingContactTags` and a note that starts with an
 *      "unverified" warning. The submitted details are in the note (the
 *      intake writes them there) for the owner to review by hand.
 *   1. New email only: POST /contacts/upsert WITHOUT tags. The spec says
 *      upsert `tags` "will overwrite all current tags". Custom fields go by
 *      field id. A phone that already belongs to another contact is left
 *      out (upsert can match by phone); the note says so and carries it.
 *   2. GET  /contacts/{id}/notes; POST a note only if none carries this
 *      submission's `Reference:` marker. The note comes right after the
 *      contact so the full record reaches the CRM even when a later step
 *      fails, and so a retry of the same submission can recognise a
 *      contact it created itself (a verified note with its reference).
 *   3. POST /contacts/{id}/tags. Additive, so repeating it changes nothing.
 *   4. Opportunity, for a contact this sync created only: reuse one this
 *      process just created, else GET /opportunities/search (open, this
 *      contact, this pipeline), else create. Skipped for an existing
 *      (unverified) contact.
 *
 * Retry policy:
 *   - Idempotent calls (upsert, add tags, reads) retry once after a network
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
 * Known gap: a contact created by someone else between the lookup and the
 * upsert (another process, or staff) can still be updated by that upsert.
 * It is detected afterwards (`new` is not true) and then treated as
 * existing for tags and the note, but its fields may already have been
 * written. Closing this needs a create-only call verified against GHL, or
 * the planned single sync worker.
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
  /** Tags that assert consent. Applied only to a contact this sync created, never to an existing one. */
  consentTags?: string[];
  /** Applied INSTEAD of `tags` when the lead matched an existing contact (so its automations don't fire). Default none. */
  existingContactTags?: string[];
  customFields: Partial<Record<LogicalCustomField, string | undefined>>;
  opportunityName: string;
  note: string;
  /** Stable per submission (the inquiry idempotency key). Makes the note idempotent. */
  reference: string;
}

export interface CrmSyncResult {
  contactId: string;
  /** null when the opportunity step was skipped for an existing (unverified) contact. */
  opportunityId: string | null;
  opportunityCreated: boolean;
  noteCreated: boolean;
  /** True when the lead matched an existing contact, whose fields were left unchanged. */
  existingContact: boolean;
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

/** Short-lived per-process memory: opportunities this process created (location|pipeline|contact) and contacts it created per submission reference. */
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

/** Starts the note written for a submission that matched an existing contact. */
export const UNVERIFIED_NOTE_PREFIX = "UNVERIFIED:";

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
      method: "GET" | "POST",
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

    /** Upsert for an email with no existing contact. `isNew` is false if GHL matched one anyway. */
    async function upsertNewContact(): Promise<{ id: string | undefined; isNew: boolean }> {
      // 1. Contact upsert, without tags. If GHL rejects the payload (400/422),
      //    drop custom fields, then the optional phone, rather than losing the
      //    lead. The intake writes every submitted value into the note.
      type Upsert = { new?: unknown; contact?: { id?: string; customFields?: Array<{ id?: string; value?: unknown }> } };
      const upsertBody = (withFields: boolean, withPhone: boolean) => ({
        locationId: config.locationId,
        name: lead.name,
        email: lead.email,
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

      let upsert: Upsert | undefined;
      let used = variants[0];
      let rejection: GhlError | undefined;
      for (const v of variants) {
        try {
          upsert = await call<Upsert>("contact", "POST", "/contacts/upsert", upsertBody(v.withFields, v.withPhone), { idempotent: true });
          used = v;
          break;
        } catch (err) {
          if (!isRejection(err)) throw err;
          rejection = err;
        }
      }
      if (!upsert) throw rejection!;
      if (hasFields && !used.withFields) warnings.push(`custom_fields_rejected:${rejection!.status}`);
      if (hasPhone && !used.withPhone) warnings.push(`phone_rejected:${rejection!.status}`);
      const withFields = used.withFields;
      const applied = upsert.contact?.customFields;
      if (withFields && Array.isArray(applied)) {
        const got = new Map(applied.map((f) => [f?.id, f?.value]));
        for (const f of sent) {
          const v = got.get(f.id);
          // A returning contact echoes older values, so compare the value too.
          if (!got.has(f.id) || (typeof v === "string" && v !== f.value)) {
            warnings.push(`custom_field_not_applied:${f.name}${critical(f.name)}`);
          }
        }
      }
      // `new` other than true: GHL matched a contact the lookup didn't see
      // (created concurrently, or another match rule). Treated as existing.
      return { id: upsert.contact?.id, isNew: upsert.new === true };
    }

    // 0. Existing contact? Looked up by email, then by phone.
    const findDuplicate = async (param: "email" | "number", value: string) => {
      const q = new URLSearchParams({ locationId: config.locationId, [param]: value });
      const r = await call<{ contact?: unknown }>("contact", "GET", `/contacts/search/duplicate?${q}`, undefined, { idempotent: true });
      // Only an explicit `contact: null` means "none"; any other shape is an error,
      // so an unexpected response can never lead to overwriting a contact.
      if (!r || typeof r !== "object" || Array.isArray(r) || !("contact" in r)) {
        throw new GhlError("GHL duplicate search response had no contact field", "contact", 200, true, undefined, { outcome: "unknown" });
      }
      const c = (r as { contact?: unknown }).contact;
      if (c === null) return undefined;
      const id = typeof c === "object" ? (c as { id?: unknown }).id : undefined;
      if (typeof id !== "string" || !id) {
        throw new GhlError("GHL duplicate search response had no contact id", "contact", 200, true, undefined, { outcome: "unknown" });
      }
      return id;
    };

    // A note's body, per contact. A list that can't be read is an error, never "no notes".
    const notesOf = async (id: string): Promise<string[]> => {
      const r = await call<{ notes?: unknown }>("note", "GET", `/contacts/${encodeURIComponent(id)}/notes`, undefined, {
        idempotent: true,
        contactId: id,
      });
      if (!Array.isArray(r?.notes)) {
        throw new GhlError("GHL notes response had no notes list", "note", 200, true, id, { outcome: "unknown" });
      }
      return (r.notes as Array<{ body?: unknown }>).map((n) => (typeof n?.body === "string" ? n.body : ""));
    };
    const marker = `Reference: ${lead.reference}`;
    const createdKey = `created|${base}|${config.locationId}|${lead.reference}`;

    let contactId = await findDuplicate("email", lead.email);
    let newlyCreated = false;
    let knownNotes: string[] | null = null;
    if (contactId) {
      // A retry of this same submission finds the contact its first attempt
      // created. That attempt wrote a verified note carrying this
      // submission's reference right after creating the contact (or, if that
      // note failed, this process remembers the create), so the retry
      // carries on as the creator. Any other match is unverified.
      knownNotes = await notesOf(contactId);
      const own = knownNotes.find((b) => b.includes(marker));
      const createdHere = recent.get(createdKey) === contactId;
      if (createdHere || (own !== undefined && !own.startsWith(UNVERIFIED_NOTE_PREFIX))) {
        newlyCreated = true;
        warnings.push("resumed_own_contact");
      } else {
        warnings.push("existing_contact_not_modified");
      }
    } else {
      if (phone && (await findDuplicate("number", phone))) {
        warnings.push("phone_matches_existing_contact_omitted");
        phone = undefined;
      }
      const created = await upsertNewContact();
      contactId = created.id;
      newlyCreated = created.isNew;
      if (created.isNew && created.id) recent.set(createdKey, created.id);
      if (!created.isNew) warnings.push("upsert_matched_existing_contact");
    }
    if (!contactId) {
      throw new GhlError("GHL upsert returned no contact id", "contact", 200, true, undefined, { outcome: "unknown" });
    }
    const id = contactId;

    // 2. Note, once per submission, written first so a retry can recognise
    //    a contact this submission created (see above).
    const notePrefix = [
      newlyCreated
        ? null
        : `${UNVERIFIED_NOTE_PREFIX} this web form submission matched an existing contact by email only. The contact's details were not changed and no opportunity was created. Review the submitted details below before acting on it.`,
      warnings.includes("phone_matches_existing_contact_omitted")
        ? "The submitted phone number already belongs to another contact, so it was not added to this contact. It is listed below."
        : null,
    ]
      .filter(Boolean)
      .map((l) => `${l}\n\n`)
      .join("");
    const hasNote = async () => (await notesOf(id)).some((b) => b.includes(marker));

    let noteCreated = false;
    if (!(knownNotes ? knownNotes.some((b) => b.includes(marker)) : await hasNote())) {
      try {
        await call("note", "POST", `/contacts/${encodeURIComponent(id)}/notes`, { body: `${notePrefix}${lead.note}\n${marker}` }, {
          idempotent: false,
          contactId: id,
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

    // 3. Tags (additive). The lead's tags and consent tags only for a contact
    //    this submission created; an existing contact gets `existingContactTags`.
    const consentTags = lead.consentTags ?? [];
    if (consentTags.length && !newlyCreated) warnings.push("consent_tags_skipped_existing_contact");
    const tags = newlyCreated ? [...lead.tags, ...consentTags] : (lead.existingContactTags ?? []);
    if (tags.length) {
      await call("tags", "POST", `/contacts/${encodeURIComponent(id)}/tags`, { tags }, { idempotent: true, contactId: id });
    }

    // 4. Opportunity: only for a contact this sync created. An unverified
    //    match is left for manual review, with no pipeline entry.
    if (!newlyCreated) {
      warnings.push("opportunity_skipped_unverified_match");
      return { contactId: id, opportunityId: null, opportunityCreated: false, noteCreated, existingContact: true, warnings };
    }
    const recentKey = `${base}|${config.locationId}|${config.pipelineId}|${id}`;
    const findOpen = async () => {
      const q = new URLSearchParams({
        location_id: config.locationId,
        contact_id: id,
        pipeline_id: config.pipelineId,
        status: "open",
      });
      const r = await call<{ opportunities?: unknown }>("opportunity", "GET", `/opportunities/search?${q}`, undefined, {
        idempotent: true,
        contactId: id,
      });
      if (!Array.isArray(r?.opportunities)) {
        throw new GhlError("GHL opportunity search response had no list", "opportunity", 200, true, id, { outcome: "unknown" });
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
            contactId: id,
            name: lead.opportunityName,
            status: "open",
          },
          { idempotent: false, contactId: id }
        );
        opportunityId = created?.opportunity?.id;
        if (!opportunityId) {
          throw new GhlError("GHL opportunity create returned no id", "opportunity", 200, true, id, { outcome: "unknown" });
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

    return { contactId: id, opportunityId, opportunityCreated, noteCreated, existingContact: !newlyCreated, warnings };
  }

  return {
    syncLead(lead) {
      const key = `${base}|${config.locationId}|${lead.email.trim().toLowerCase()}`;
      return lock.run(key, () => sync(lead));
    },
  };
}

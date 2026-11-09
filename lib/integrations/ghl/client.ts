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
 *      change an existing contact. For an EXISTING contact nothing on the
 *      contact is written: no upsert, no details or custom fields, no
 *      consent tags, none of the lead's regular tags, and no opportunity (so
 *      no pipeline automation starts). It gets only `existingContactTags`
 *      and a review note that starts with "UNVERIFIED:" and carries every
 *      submitted detail (the intake writes them) for manual review.
 *   1. New email only: POST /contacts/upsert with the EMAIL ONLY (no tags:
 *      the spec says upsert `tags` "will overwrite all current tags"). If
 *      GHL matches a contact the lookup didn't see (`new` is not true), the
 *      request carried nothing but that same email, so that contact is not
 *      changed; it is then handled exactly like step 0.
 *   2. GET /contacts/{id}/notes; POST a note only if none ENDS with this
 *      submission's marker (the note's last line, so text a visitor typed
 *      can't match it). Verified notes end `Reference: <ref> (content <fp>)`,
 *      review notes `Review: <ref> (content <fp>)`; the fingerprint comes
 *      from the submitted content (no timestamps), so an identical retry
 *      writes no duplicate and a changed resubmission gets its own note. The
 *      note comes first, so the full submission is in the CRM even if a later
 *      step fails, and a new contact gets no tags (no automations) without it.
 *   3. Only for a contact this submission created: PUT /contacts/{id} with
 *      name, phone, company, website, source and custom fields (consent
 *      included) by field id. A phone that already belongs to another
 *      contact is left out; the note says so and carries it. Rejections fall
 *      back to fewer fields, down to the name; never fatal, since the note
 *      has every value. Written once per submission in this process.
 *   4. POST /contacts/{id}/tags. Additive, so repeating it changes nothing.
 *   5. Opportunity, for a contact this submission created only: reuse one
 *      this process just created, else GET /opportunities/search (open,
 *      this contact, this pipeline), else create.
 *
 * Retry policy:
 *   - Idempotent calls (details, add tags, reads) retry once after a network
 *     error, timeout, 5xx or unreadable 200. The email-only upsert is also
 *     retried once, and a `new: false` after that retry is treated as
 *     unverified (it may be this submission's own create) and says so.
 *   - Creates (opportunity, note) are sent at most once per sync. After an
 *     ambiguous failure (timeout, 5xx, unreadable success) the adapter
 *     re-reads and reuses what it finds, or throws a retryable
 *     `outcome: "unknown"` error.
 *   - A read whose response can't be understood is an error, never
 *     "not found", so it can't trigger a duplicate create.
 *   - 429 is never retried inline. HighLevel sends no Retry-After; the
 *     error carries `retryAfterMs` from the X-RateLimit-* headers.
 *   - The timeout covers headers AND body, and every sync has an overall
 *     time budget, so a stalled response can't hold the lock.
 *
 * Retries of a submission: only this process's own memory (a few minutes,
 * keyed by the submission reference and content fingerprint) can show that
 * an existing contact was created by an earlier attempt of the same
 * submission. Notes are never trusted for that: they can be edited, merged
 * or contain typed text. A retry served by another process is therefore
 * held as an unverified match with its own review note, which fails safe.
 *
 * Concurrency: syncs for the same location run one at a time in this
 * process (intake volume is low), so two submissions can't race each other
 * here. Opportunities this process just created are remembered briefly, so
 * a lagging search index can't cause a second create. Separate processes
 * are NOT serialized; that needs the planned asynchronous CRM sync worker.
 * Because the upsert carries only the email, a cross-process race can at
 * worst produce an unverified match, never overwrite another contact.
 */

import { createHash } from "node:crypto";

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
  /**
   * Fingerprint of the submitted content, identical across retries of the
   * same submission: no timestamps. Defaults to a hash of the lead itself,
   * which is only stable if the lead carries no per-request values.
   */
  contentKey?: string;
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

/** Short-lived per-process memory: opportunities this process created (location|pipeline|contact), and contacts it created per submission (`created|…` keys). */
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

  type DetailsOutcome = { warnings: string[]; consentConfirmed: boolean; complete: boolean };

  async function sync(lead: CrmLead, deadline: number): Promise<CrmSyncResult> {
    const call = makeCaller(deadline);
    const warnings: string[] = [];
    const { sent, unmapped } = mapCustomFields(lead.customFields);
    for (const name of unmapped) warnings.push(`custom_field_unmapped:${name}${critical(name)}`);

    let phone = lead.phone;
    if (phone !== undefined && !E164.test(phone)) {
      warnings.push("phone_not_e164_omitted");
      phone = undefined;
    }

    type Applied = { contact?: { id?: string; customFields?: Array<{ id?: string; value?: unknown }> } };

    // 1. Create-or-match by EMAIL ONLY, without tags. If GHL matches a contact
    //     the lookup didn't see, the request carried nothing but that same
    //     email, so nothing on that contact changes. Sent at most twice: a
    //     retry after an ambiguous failure is remembered, because its `new:
    //     false` may then be this submission's own create.
    async function upsertEmailOnly(): Promise<{ id: string | undefined; isNew: boolean; ambiguous: boolean }> {
      type Upsert = { new?: unknown; contact?: { id?: string } };
      let ambiguous = false;
      for (let attempt = 0; ; attempt++) {
        try {
          const r = await call<Upsert>("contact", "POST", "/contacts/upsert", { locationId: config.locationId, email: lead.email }, { idempotent: false });
          return { id: r?.contact?.id, isNew: r?.new === true, ambiguous };
        } catch (err) {
          if (attempt > 0 || !(err instanceof GhlError) || err.outcome !== "unknown") throw err;
          ambiguous = true;
          await sleep(RETRY_DELAY_MS);
        }
      }
    }

    // 3. Details (name, phone, company, website, source, custom fields
    //     including consent), ONLY for a contact this submission created,
    //     AFTER its note (which already holds every value). If GHL rejects the
    //     payload (400/422), drop custom fields, then the optional phone, then
    //     everything but the name; if even that is rejected the lead carries
    //     on with a warning, since the note has it all.
    async function writeDetails(contactId: string): Promise<DetailsOutcome> {
      const out: string[] = [];
      const body = (withFields: boolean, withPhone: boolean, nameOnly = false) =>
        nameOnly
          ? { name: lead.name }
          : {
              name: lead.name,
              ...(withPhone && phone ? { phone } : {}),
              companyName: lead.companyName,
              ...(lead.website ? { website: lead.website } : {}),
              source: lead.source,
              ...(withFields && sent.length ? { customFields: sent.map((f) => ({ id: f.id, field_value: f.value })) } : {}),
            };
      // Fallback order: everything → without fields → without phone (fields kept) → neither → name only.
      const hasFields = sent.length > 0;
      const hasPhone = Boolean(phone);
      const variants = [
        { withFields: hasFields, withPhone: hasPhone, nameOnly: false },
        { withFields: false, withPhone: hasPhone, nameOnly: false },
        { withFields: hasFields, withPhone: false, nameOnly: false },
        { withFields: false, withPhone: false, nameOnly: false },
        { withFields: false, withPhone: false, nameOnly: true },
      ].filter(
        (v, i, all) => all.findIndex((w) => w.withFields === v.withFields && w.withPhone === v.withPhone && w.nameOnly === v.nameOnly) === i
      );

      let res: Applied | undefined;
      let used = variants[0];
      let rejection: GhlError | undefined;
      for (const v of variants) {
        try {
          res = await call<Applied>("contact", "PUT", `/contacts/${encodeURIComponent(contactId)}`, body(v.withFields, v.withPhone, v.nameOnly), {
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
      if (!res) {
        out.push(`details_rejected:${rejection!.status}`);
        return { warnings: out, consentConfirmed: false, complete: false };
      }
      if (used.nameOnly) out.push(`details_reduced_to_name:${rejection!.status}`);
      if (hasFields && !used.withFields) out.push(`custom_fields_rejected:${rejection!.status}`);
      if (hasPhone && !used.withPhone) out.push(`phone_rejected:${rejection!.status}`);
      const applied = res.contact?.customFields;
      const confirmed = new Set<LogicalCustomField>();
      if (used.withFields && Array.isArray(applied)) {
        const got = new Map(applied.map((f) => [f?.id, f?.value]));
        for (const f of sent) {
          const v = got.get(f.id);
          if (!got.has(f.id) || (typeof v === "string" && v !== f.value)) {
            out.push(`custom_field_not_applied:${f.name}${critical(f.name)}`);
          } else {
            confirmed.add(f.name);
          }
        }
      }
      // Consent tags need the consent evidence fields on the contact itself.
      return { warnings: out, consentConfirmed: confirmed.has("sms_consent"), complete: true };
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
    const fingerprint = createHash("sha256")
      .update(lead.contentKey ?? JSON.stringify([lead.note, lead.tags, lead.consentTags ?? [], lead.customFields]))
      .digest("hex")
      .slice(0, 24);
    // A verified note (this submission's own contact) and a review note (an
    // unverified match) carry different markers, so each is written once.
    const marker = `Reference: ${lead.reference} (content ${fingerprint})`;
    const reviewMarker = `Review: ${lead.reference} (content ${fingerprint})`;
    const createdKey = `created|${base}|${config.locationId}|${lead.reference}|${fingerprint}`;
    const detailsKey = `details|${base}|${config.locationId}|${lead.reference}|${fingerprint}`;

    let contactId = await findDuplicate("email", lead.email);
    let newlyCreated = false;
    let upsertMatchedExisting = false;
    let upsertAmbiguous = false;
    if (contactId) {
      // Only this process's memory of its own create counts as proof that an
      // earlier attempt of this same submission (same content) created it.
      if (recent.get(createdKey) === contactId) {
        newlyCreated = true;
        warnings.push("resumed_own_contact");
        const detailsPending = !recent.get(detailsKey)?.startsWith(`${contactId}|`);
        const other = phone && detailsPending ? await findDuplicate("number", phone) : undefined;
        if (other && other !== contactId) {
          warnings.push("phone_matches_existing_contact_omitted");
          phone = undefined;
        }
      } else {
        warnings.push("existing_contact_not_modified");
      }
    } else {
      if (phone && (await findDuplicate("number", phone))) {
        warnings.push("phone_matches_existing_contact_omitted");
        phone = undefined;
      }
      // Don't start creating a contact without time for its note and details.
      if (deadline - now() < 3 * timeoutMs) {
        throw new GhlError("GHL sync skipped: not enough time budget left to create a contact", "contact", null, true, undefined, {
          outcome: "rejected",
        });
      }
      const created = await upsertEmailOnly();
      contactId = created.id;
      newlyCreated = created.isNew;
      upsertAmbiguous = created.ambiguous;
      if (created.isNew && created.id) recent.set(createdKey, created.id);
      if (!created.isNew) {
        upsertMatchedExisting = true;
        warnings.push(created.ambiguous ? "upsert_matched_after_ambiguous_attempt" : "upsert_matched_existing_contact");
      }
    }
    if (!contactId) {
      throw new GhlError("GHL upsert returned no contact id", "contact", 200, true, undefined, { outcome: "unknown" });
    }
    const id = contactId;

    // 2. Note, once per submission (per marker), before details, tags and the
    //    opportunity. An unverified match always gets its own review note,
    //    even if an earlier attempt of this submission wrote a verified one.
    const noteMarker = newlyCreated ? marker : reviewMarker;
    const endsWith = (m: string) => (b: string) => b.trimEnd().endsWith(`\n${m}`);
    const existingNotes = await notesOf(id);
    // An unverified match whose contact already carries this submission's
    // verified note was created by an earlier attempt that this process
    // can't confirm (another process, or after the memory expired).
    const earlierAttempt = !newlyCreated && existingNotes.some(endsWith(marker));
    const notePrefix = [
      newlyCreated
        ? null
        : earlierAttempt
          ? `${UNVERIFIED_NOTE_PREFIX} this web form submission could not confirm whether it created this contact. An earlier attempt of the same submission appears to have (see the note ending with its reference) and may already have written details, tags or an opportunity before failing. This attempt only added this note and the review tag; it created no opportunity. Review this contact before acting on it.`
          : upsertMatchedExisting && upsertAmbiguous
          ? `${UNVERIFIED_NOTE_PREFIX} this web form submission could not confirm whether it created this contact (a request to the CRM failed and was retried); it may be this submission's own new contact. Only the email was sent to it, so no other details were changed, and no opportunity was created. Review the submitted details below before acting on it.`
          : `${UNVERIFIED_NOTE_PREFIX} this web form submission matched an existing contact by email only. The contact's details were not changed and no opportunity was created. Review the submitted details below before acting on it.`,
      warnings.includes("phone_matches_existing_contact_omitted")
        ? "The submitted phone number already belongs to another contact, so it was not added to this contact. It is listed below."
        : null,
    ]
      .filter(Boolean)
      .map((l) => `${l}\n\n`)
      .join("");
    const hasNote = async () => (await notesOf(id)).some(endsWith(noteMarker));

    let noteCreated = false;
    if (!existingNotes.some(endsWith(noteMarker))) {
      try {
        await call("note", "POST", `/contacts/${encodeURIComponent(id)}/notes`, { body: `${notePrefix}${lead.note}\n${noteMarker}` }, {
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

    // 3. Details for this submission's own contact, after its note, at most
    //    once per submission in this process (writeDetails above).
    //    The outcome (warnings, consent confirmation) is remembered with it,
    //    so a resumed retry still reports what happened.
    let consentConfirmed = false;
    if (newlyCreated) {
      const prior = recent.get(detailsKey);
      let outcome: DetailsOutcome;
      if (prior?.startsWith(`${id}|`)) {
        outcome = JSON.parse(prior.slice(id.length + 1)) as DetailsOutcome;
      } else {
        outcome = await writeDetails(id);
        // A fully rejected update is retried on the next attempt (cheap, may succeed).
        if (outcome.complete) recent.set(detailsKey, `${id}|${JSON.stringify(outcome)}`);
      }
      warnings.push(...outcome.warnings);
      consentConfirmed = outcome.consentConfirmed;
    }

    // 4. Tags (additive). The lead's tags and consent tags only for a contact
    //    this submission created; an existing contact gets `existingContactTags`.
    //    Consent tags also need the consent fields confirmed on the contact.
    let consentTags = lead.consentTags ?? [];
    if (consentTags.length && !newlyCreated) warnings.push("consent_tags_skipped_existing_contact");
    if (consentTags.length && newlyCreated && !consentConfirmed) {
      warnings.push("consent_tags_skipped_fields_not_confirmed");
      consentTags = [];
    }
    const tags = newlyCreated ? [...lead.tags, ...consentTags] : (lead.existingContactTags ?? []);
    if (tags.length) {
      await call("tags", "POST", `/contacts/${encodeURIComponent(id)}/tags`, { tags }, { idempotent: true, contactId: id });
    }

    // 5. Opportunity: only for a contact this sync created. An unverified
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
      // One sync at a time per location in this process. Keying by email
      // alone let two submissions sharing a phone race each other.
      // The time budget starts before the wait, so queued syncs can't
      // outlast it: one that waits too long fails fast as retryable.
      const deadline = now() + syncBudgetMs;
      return lock.run(`${base}|${config.locationId}`, () => sync(lead, deadline));
    },
  };
}

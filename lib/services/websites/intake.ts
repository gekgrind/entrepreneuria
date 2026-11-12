/**
 * Website preview inquiry processing (spec §8 lead processing 1–7).
 *
 * Orchestration only; every side effect is an injected dependency so the
 * whole flow is unit-tested without network or database.
 *
 * Order matters:
 *   validate → honeypot → page origin → per-IP rate limit → Turnstile →
 *   shared unknown-address limit → per-email rate limit → idempotent
 *   replay → durable record → CRM sync → record outcome → respond.
 * The per-email limit is charged only for verified submissions, so
 * unverified requests can't use up someone else's allowance.
 * The inquiry is written to the store BEFORE the CRM is called, so a CRM
 * failure leaves a recoverable `crm_failed` row instead of a lost lead.
 */
import type { CrmLead, CrmSyncResult, LeadCrm } from "../../integrations/ghl/client";
import { GhlError, GhlMatchedExistingError } from "../../integrations/ghl/client";
import type { RateLimiter } from "../../rate-limit";

import { inquiryRequestSchema, ownPageUrl, type InquiryFields, type InquiryRequest } from "./inquiry-schema";
import type { AdmitFn } from "./capacity";
import type { LeadsConfig } from "./leads-config";
import type { ReviewReason, ReviewRecord, ReviewStore } from "./review-store";
import { getPackage, isPackageId, PRICING_VERSION } from "./packages";
import { getPolicy, isPublishable, policyVersionSnapshot, type PolicyId } from "./policies";
import { ipRateLimitKey } from "./request-guards";
import { styleTag } from "./styles";

/** `needs_attention` is written only by the CRM sync queue (migration 003); intake itself never sets it. */
export type InquiryStatus = "received" | "crm_synced" | "crm_failed" | "needs_attention";

export interface ConsentEvidence {
  sms_consent: boolean;
  recorded_at: string;
  /** Version of the SMS consent wording shown with the form; null when it was not shown. */
  sms_disclosure_version: string | null;
  /** Version of the privacy sentence shown with the form; null when it was not shown. */
  privacy_notice_version: string | null;
  page_url: string;
  ip_hash: string | null;
  user_agent: string | null;
}

export interface InquiryRecord {
  id: string;
  idempotency_key: string;
  status: InquiryStatus;
  fields: InquiryFields;
  consent: ConsentEvidence;
  policy_versions: Record<string, string>;
  pricing_version: string;
  utm: InquiryRequest["utm"] | null;
  submitted_at: string;
  crm_contact_id: string | null;
  crm_opportunity_id: string | null;
  crm_attempts: number;
  last_error: string | null;
}

export interface InquiryStore {
  findByIdempotencyKey(key: string): Promise<InquiryRecord | null>;
  /** Must be atomic on idempotency_key; returns the existing row on conflict. */
  insert(record: Omit<InquiryRecord, "id">): Promise<{ record: InquiryRecord; created: boolean }>;
  update(id: string, patch: Partial<Pick<InquiryRecord, "status" | "crm_contact_id" | "crm_opportunity_id" | "crm_attempts" | "last_error">>): Promise<void>;
}

export interface IntakeContext {
  /** Keyed hash of the proxy-reported client address; null when unknown. Stored as consent evidence. */
  ipHash: string | null;
  /** Keyed hash of the client's rate-limit range (rateLimitAddress); null when unknown. */
  ipBucket: string | null;
  userAgent: string | null;
  /** Origin the form was served on (release gate). page_url must match it. */
  pageOrigin: string;
}

/** Operational signals for alerting. Carry no personal data: step and status only. */
export type IntakeEvent =
  | { kind: "crm_failed"; step: string; status: number | string }
  | { kind: "unavailable" };

/**
 * Leads mode: returning-contact handling (owner decision, 2026-11-09).
 * An inquiry whose email already belongs to a CRM contact, or whose lookup
 * failed or was ambiguous, is never written to the CRM. It is stored in
 * the review store (durable, before the visitor sees success), the owner is
 * notified with an opaque reference only, and it does not use a capacity
 * slot.
 */
export interface ReturningContactDeps {
  reviewStore: ReviewStore;
  /** Opaque, stable reference for a submission's content (keyed hash). Same content → same reference. */
  reference: (fields: InquiryFields) => string;
  /** Non-blocking: sends the review notification and marks the record notified on delivery. */
  notify: (ref: string) => void;
  /** Serializes work per key in this process (same email → one at a time). */
  serialize: <T>(key: string, fn: () => Promise<T>) => Promise<T>;
  /** New leads synced recently in this process, by reference: an identical resubmission is not sent twice. */
  recentlySynced: { has(ref: string): boolean; add(ref: string): void };
}

export interface IntakeDeps {
  manual?: Pick<LeadsConfig, "previewIntake" | "maxOpenRequests">;
  store: InquiryStore | null;
  crm: LeadCrm | null;
  /** `global` (optional, leads mode) caps total verified traffic; charged after Turnstile. */
  rateLimiters: { ip: RateLimiter; email: RateLimiter; global?: RateLimiter };
  /** Always required: the route does not run without Turnstile configured. */
  verifyTurnstile: (token: string) => Promise<boolean>;
  now: () => Date;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
  /** Leads mode: decides whether the request may enter (paused or at capacity). Runs after bot checks, before any store or CRM call. */
  admission?: AdmitFn;
  onEvent?: (event: IntakeEvent) => void;
  /** Leads mode only. When set, the CRM path below is replaced by processLeadsCrm. */
  returning?: ReturningContactDeps;
}

export type IntakeResponse =
  | { status: 200; body: { ok: true; state: "received"; reference: string | null } }
  | { status: 400; body: { ok: false; error: "invalid"; fieldErrors: Record<string, string[]> } }
  | { status: 400; body: { ok: false; error: "verification_failed" } }
  | { status: 429; body: { ok: false; error: "rate_limited"; retryAfterSeconds: number } }
  | { status: 502; body: { ok: false; error: "delivery_failed"; retryable: true } }
  | { status: 503; body: { ok: false; error: "unavailable" } }
  | { status: 503; body: { ok: false; error: "capacity"; reason: "paused" | "full" } };

/** Policies whose text or terms the page can show next to the form. */
const FORM_POLICIES: readonly PolicyId[] = ["pricing", "privacy_notice", "sms_consent"];

/**
 * Version of a policy's wording as shown on the page, or null when it was
 * not shown. The page renders legal wording only for publishable policies
 * (legal-copy.ts), so this records exactly what the visitor saw.
 */
const shownVersion = (id: PolicyId): string | null => (isPublishable(id) ? getPolicy(id).version : null);

const RECEIVED = (reference: string | null): IntakeResponse => ({
  status: 200,
  body: { ok: true, state: "received", reference },
});

export function buildCrmLead(
  record: Pick<InquiryRecord, "idempotency_key" | "fields" | "consent" | "pricing_version" | "utm" | "submitted_at">
): CrmLead {
  const f = record.fields;
  const pkg = isPackageId(f.package_interest) ? getPackage(f.package_interest) : null;
  const tags = ["web-preview-request"];
  if (pkg) tags.push(`pkg-${pkg.id}`);
  if (f.style_interest) tags.push(styleTag(f.style_interest));
  // Spec §9: no automation-triggering SMS tag until SMS consent language is approved.
  // Consent tags go only to a contact this submission creates (see CrmLead.newContactTags).
  const newContactTags = record.consent.sms_consent && isPublishable("sms_consent") ? ["sms-consent"] : [];

  const utm = record.utm ?? {};
  const noteLines = [
    `Website preview request — ${record.submitted_at}`,
    `Package interest: ${pkg ? `${pkg.displayName} (${pkg.id})` : f.package_interest === "unsure" ? "not sure yet" : "not specified"}`,
    `Style interest: ${f.style_interest || "not specified"}`,
    `Business type: ${f.business_type}`,
    `Preferred contact: ${f.contact_method}`,
    f.message ? `Message:\n${f.message}` : null,
    `SMS consent: ${record.consent.sms_consent ? "yes" : "no"} (disclosure ${record.consent.sms_disclosure_version ?? "not shown"}, recorded ${record.consent.recorded_at}, page ${record.consent.page_url})`,
    `Privacy notice version: ${record.consent.privacy_notice_version ?? "not shown"}`,
    `Pricing version: ${record.pricing_version}`,
    Object.values(utm).some(Boolean)
      ? `UTM: ${Object.entries(utm).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" ")}`
      : null,
  ].filter(Boolean);

  return {
    name: f.name,
    email: f.email,
    phone: f.phone,
    companyName: f.business,
    website: f.website,
    source: utm.source ? `website-services:${utm.source}` : "website-services",
    tags,
    newContactTags,
    customFields: {
      business_type: f.business_type,
      package_interest: f.package_interest || undefined,
      style_interest: f.style_interest || undefined,
      contact_method: f.contact_method,
      sms_consent: record.consent.sms_consent ? "yes" : "no",
      sms_consent_at: record.consent.sms_consent ? record.consent.recorded_at : undefined,
      sms_consent_version: record.consent.sms_disclosure_version ?? undefined,
      consent_page_url: record.consent.page_url,
      pricing_version: record.pricing_version,
    },
    opportunityName: `${f.business} — website preview`,
    note: noteLines.join("\n"),
    reference: record.idempotency_key,
  };
}

export async function processInquiry(rawBody: unknown, ctx: IntakeContext, deps: IntakeDeps): Promise<IntakeResponse> {
  const log = deps.log ?? (() => {});

  // 1. Validate.
  const parsed = inquiryRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] === "fields" ? String(issue.path[1] ?? "form") : String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { status: 400, body: { ok: false, error: "invalid", fieldErrors } };
  }
  const req = parsed.data;

  // 1b. Texting is not offered until the SMS consent wording is approved (spec §9).
  if (!isPublishable("sms_consent") && (req.fields.sms_consent || req.fields.contact_method === "text")) {
    return {
      status: 400,
      body: { ok: false, error: "invalid", fieldErrors: { contact_method: ["Text messages are not available yet. Please choose email or phone."] } },
    };
  }

  // 2. Honeypot: look successful, do nothing.
  if (req.hp) {
    log("honeypot hit");
    return RECEIVED(null);
  }

  // 2b. The page must be on the origin this request was served on.
  const pageUrl = ownPageUrl(req.page_url, ctx.pageOrigin);
  if (!pageUrl) {
    return { status: 400, body: { ok: false, error: "invalid", fieldErrors: { page_url: ["Invalid page address."] } } };
  }

  const limited = (r: { allowed: boolean; retryAfterSeconds: number }): IntakeResponse | null =>
    r.allowed ? null : { status: 429, body: { ok: false, error: "rate_limited", retryAfterSeconds: r.retryAfterSeconds } };

  // 3. Per-IP rate limit, before verification. Requests without a known
  //    address share one bucket, charged only after verification (4b) so
  //    unverified traffic can't use it up for everyone.
  if (ctx.ipBucket) {
    const ipLimited = limited(deps.rateLimiters.ip.check(ipRateLimitKey(ctx.ipBucket)));
    if (ipLimited) return ipLimited;
  }

  // 4. Bot verification (always required).
  const verified = req.turnstile_token ? await deps.verifyTurnstile(req.turnstile_token).catch(() => false) : false;
  if (!verified) return { status: 400, body: { ok: false, error: "verification_failed" } };

  // 4b. Shared bucket for unknown addresses, then the per-email limit, both
  //     charged only once the submission is verified.
  if (!ctx.ipBucket) {
    const sharedLimited = limited(deps.rateLimiters.ip.check(ipRateLimitKey(null)));
    if (sharedLimited) return sharedLimited;
  }
  const emailLimited = limited(deps.rateLimiters.email.check(`email:${req.fields.email}`));
  if (emailLimited) return emailLimited;

  // 4c. Global ceiling (leads mode), also charged only to verified submissions.
  if (deps.rateLimiters.global) {
    const globalLimited = limited(deps.rateLimiters.global.check("all"));
    if (globalLimited) return globalLimited;
  }

  if (!deps.store && !deps.crm && !deps.manual) {
    log("no store and no CRM configured");
    deps.onEvent?.({ kind: "unavailable" });
    return { status: 503, body: { ok: false, error: "unavailable" } };
  }

  const submittedAt = deps.now().toISOString();
  const draft: Omit<InquiryRecord, "id"> = {
    idempotency_key: req.idempotency_key,
    status: "received",
    fields: req.fields,
    consent: {
      sms_consent: req.fields.sms_consent,
      recorded_at: submittedAt,
      sms_disclosure_version: shownVersion("sms_consent"),
      privacy_notice_version: shownVersion("privacy_notice"),
      page_url: pageUrl,
      ip_hash: ctx.ipHash,
      user_agent: ctx.userAgent ? ctx.userAgent.slice(0, 400) : null,
    },
    policy_versions: policyVersionSnapshot(FORM_POLICIES.filter((id) => shownVersion(id) !== null)),
    pricing_version: PRICING_VERSION,
    utm: req.utm ?? null,
    submitted_at: submittedAt,
    crm_contact_id: null,
    crm_opportunity_id: null,
    crm_attempts: 0,
    last_error: null,
  };

  if (deps.manual) {
    const rt = deps.returning;
    if (!rt) return { status: 503, body: { ok: false, error: "unavailable" } };
    const { previewIntake, maxOpenRequests } = deps.manual;
    const ref = rt.reference(draft.fields);
    return rt.serialize("manual-admission", async () => {
      try {
        // save() rechecks durability before acknowledging even an existing record.
        if (!(await rt.reviewStore.get(ref))) {
          const reason = previewIntake === "paused"
            ? "paused"
            : (await rt.reviewStore.list()).filter((r) => !r.resolved_at).length >= maxOpenRequests ? "full" : null;
          if (reason) return { status: 503, body: { ok: false, error: "capacity", reason } };
        }
        return await holdForReview(draft, ref, "manual_intake", null, rt, deps);
      } catch (err) {
        return reviewFailure(deps, ref, err);
      }
    });
  }

  // Leads mode: lookup first, so returning contacts skip capacity and the CRM.
  if (deps.returning && deps.crm) return processLeadsCrm(draft, deps.crm, deps.returning, deps);

  // 4d. Capacity: paused or at the open-request limit (leads mode only).
  if (deps.admission) {
    const a = await deps.admission();
    if (!a.allowed) {
      log("intake not admitted", { reason: a.reason });
      return { status: 503, body: { ok: false, error: "capacity", reason: a.reason } };
    }
  }

  // 5. Idempotent replay. A failed lookup is not fatal: the insert below is
  //    atomic on the key, and without the store the CRM still gets the lead.
  if (deps.store) {
    try {
      const prior = await deps.store.findByIdempotencyKey(req.idempotency_key);
      if (prior) return RECEIVED(prior.id);
    } catch (err) {
      log("store lookup failed", { error: (err as Error).message });
    }
  }

  // 6. Durable record first.
  let record: InquiryRecord | null = null;
  if (deps.store) {
    try {
      const res = await deps.store.insert(draft);
      if (!res.created) return RECEIVED(res.record.id);
      record = res.record;
    } catch (err) {
      log("store insert failed", { error: (err as Error).message });
      if (!deps.crm) return { status: 502, body: { ok: false, error: "delivery_failed", retryable: true } };
    }
  }

  // 7. CRM sync.
  if (!deps.crm) return RECEIVED(record?.id ?? null);

  let synced: CrmSyncResult | null = null;
  let failure: string | null = null;
  try {
    synced = await deps.crm.syncLead(buildCrmLead(draft));
    // Unmapped/rejected custom fields etc. stay in the note; surface them, never silently.
    if (synced.warnings.length) log("crm sync warnings", { warnings: synced.warnings, contactId: synced.contactId });
  } catch (err) {
    failure = err instanceof GhlError ? `${err.step}:${err.status ?? "network"}` : (err as Error).message;
    if (err instanceof GhlMatchedExistingError) {
      // Non-leads modes have no review store: the stored record (if any) keeps it for review.
      failure = `existing_contact:${err.reason}`;
      log("crm contact exists; not written", { reason: err.reason });
    } else deps.onEvent?.({
      kind: "crm_failed",
      step: err instanceof GhlError ? err.step : "unknown",
      status: err instanceof GhlError ? (err.status ?? "network") : "error",
    });
    log("crm sync failed", {
      error: failure,
      contactId: err instanceof GhlError ? err.contactId : undefined,
      outcome: err instanceof GhlError ? err.outcome : undefined,
      retryAfterMs: err instanceof GhlError ? err.retryAfterMs : undefined,
    });
  }

  if (record && deps.store) {
    await deps.store
      .update(record.id, synced
        ? { status: "crm_synced", crm_contact_id: synced.contactId, crm_opportunity_id: synced.opportunityId, crm_attempts: 1, last_error: null }
        : { status: "crm_failed", crm_attempts: 1, last_error: failure })
      .catch((err) => log("store update failed", { id: record!.id, error: (err as Error).message }));
    // Stored: the inquiry is genuinely received; failures surface in the owner queue.
    return RECEIVED(record.id);
  }

  return synced ? RECEIVED(null) : { status: 502, body: { ok: false, error: "delivery_failed", retryable: true } };
}

const DELIVERY_FAILED: IntakeResponse = { status: 502, body: { ok: false, error: "delivery_failed", retryable: true } };

/**
 * Leads-mode CRM path. Order:
 *   1. Identical content already synced as a new lead here → success, no repeat.
 *   2. Read-only lookup. Found → review. Lookup failed or unreadable → review
 *      (never assume the person is new).
 *   3. New: capacity check (only new leads use a slot), then the approved
 *      new-lead sync. If the sync finds the contact after all → review.
 *      If the sync fails (GHL down, timeout, auth, rate limit) → review, so
 *      a new lead is never lost.
 *   4. Review = durable record first; a failed write is a retryable error,
 *      never a silent success. Then a non-blocking, reference-only notice.
 * The response is identical for new and returning contacts (reference
 * null), so the form can't be used to test whether an email is in the CRM.
 */
async function holdForReview(
  draft: Omit<InquiryRecord, "id">,
  ref: string,
  reason: ReviewReason,
  contactId: string | null,
  rt: ReturningContactDeps,
  deps: IntakeDeps
): Promise<IntakeResponse> {
  const record: ReviewRecord = {
    ref,
    reason,
    crm_contact_id: contactId,
    received_at: draft.submitted_at,
    notified_at: null,
    resolved_at: null,
    submission: {
      idempotency_key: draft.idempotency_key,
      fields: draft.fields,
      consent: draft.consent as unknown as Record<string, unknown>,
      page_url: draft.consent.page_url,
      utm: (draft.utm ?? null) as Record<string, string> | null,
      pricing_version: draft.pricing_version,
    },
  };
  try {
    const saved = await rt.reviewStore.save(record);
    if (saved.created) rt.notify(ref);
    deps.log?.("inquiry held for review", { ref, reason, duplicate: !saved.created });
    return RECEIVED(null);
  } catch (err) {
    return reviewFailure(deps, ref, err);
  }
}

function reviewFailure(deps: IntakeDeps, ref: string, err: unknown): IntakeResponse {
  deps.log?.("review record write failed", { ref, error: (err as Error).name });
  deps.onEvent?.({ kind: "crm_failed", step: "review_store", status: "write_failed" });
  return DELIVERY_FAILED;
}

async function processLeadsCrm(
  draft: Omit<InquiryRecord, "id">,
  crm: LeadCrm,
  rt: ReturningContactDeps,
  deps: IntakeDeps
): Promise<IntakeResponse> {
  const log = deps.log ?? (() => {});
  const ref = rt.reference(draft.fields);
  const email = draft.fields.email.trim().toLowerCase();

  const toReview = (reason: ReviewReason, contactId: string | null) =>
    holdForReview(draft, ref, reason, contactId, rt, deps);

  /*
   * Before any slot is taken (returning contact, failed lookup): keep the
   * record, but answer exactly as a new lead would be answered right now. If
   * intake is paused or full, that is the capacity response, so the form
   * can't be used to learn whether an email is already in the CRM. The peek
   * uses no slot and raises no capacity alert.
   */
  const toReviewAsNewLeadWouldSee = async (reason: ReviewReason, contactId: string | null): Promise<IntakeResponse> => {
    const a = deps.admission ? await deps.admission({ reserve: false }) : ({ allowed: true } as const);
    const held = await toReview(reason, contactId);
    if (held.status !== 200 || a.allowed) return held;
    return { status: 503, body: { ok: false, error: "capacity", reason: a.reason } };
  };

  return rt.serialize(`email:${email}`, async () => {
    if (rt.recentlySynced.has(ref)) return RECEIVED(null);

    let match: { contactId: string; createdHere?: boolean } | null;
    try {
      if (!crm.findContactByEmail) throw new Error("CRM adapter has no read-only lookup");
      match = await crm.findContactByEmail(draft.fields.email, draft.idempotency_key);
    } catch (err) {
      deps.onEvent?.({
        kind: "crm_failed",
        step: "lookup",
        status: err instanceof GhlError ? (err.status ?? "network") : "error",
      });
      return toReviewAsNewLeadWouldSee("lookup_failed", null);
    }
    // createdHere: this process created it for an earlier attempt of a new lead, so it is not pre-existing.
    if (match && !match.createdHere) return toReviewAsNewLeadWouldSee("existing_contact", match.contactId);

    if (deps.admission) {
      const a = await deps.admission();
      if (!a.allowed) {
        log("intake not admitted", { reason: a.reason });
        return { status: 503, body: { ok: false, error: "capacity", reason: a.reason } };
      }
    }

    try {
      const synced = await crm.syncLead(buildCrmLead(draft));
      if (synced.warnings.length) log("crm sync warnings", { warnings: synced.warnings, contactId: synced.contactId });
      rt.recentlySynced.add(ref);
      return RECEIVED(null);
    } catch (err) {
      if (err instanceof GhlMatchedExistingError) return toReview(err.reason === "existing" ? "existing_contact" : "matched_on_upsert", err.contactId);
      deps.onEvent?.({
        kind: "crm_failed",
        step: err instanceof GhlError ? err.step : "unknown",
        status: err instanceof GhlError ? (err.status ?? "network") : "error",
      });
      log("crm sync failed", {
        error: err instanceof GhlError ? `${err.step}:${err.status ?? "network"}` : (err as Error).name,
        outcome: err instanceof GhlError ? err.outcome : undefined,
      });
      // Never drop a new lead: keep it durably for manual delivery. A partial
      // contact id (if one was created) goes with it so the owner can finish it.
      return toReview("delivery_failed", err instanceof GhlError ? (err.contactId ?? null) : null);
    }
  });
}

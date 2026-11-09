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
import { GhlError } from "../../integrations/ghl/client";
import type { RateLimiter } from "../../rate-limit";

import { inquiryRequestSchema, ownPageUrl, type InquiryFields, type InquiryRequest } from "./inquiry-schema";
import { getPackage, isPackageId, PRICING_VERSION } from "./packages";
import { getPolicy, isPublishable, policyVersionSnapshot, type PolicyId } from "./policies";
import { ipRateLimitKey } from "./request-guards";
import { styleTag } from "./styles";

export type InquiryStatus = "received" | "crm_synced" | "crm_failed";

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

export interface IntakeDeps {
  store: InquiryStore | null;
  crm: LeadCrm | null;
  rateLimiters: { ip: RateLimiter; email: RateLimiter };
  /** Always required: the route does not run without Turnstile configured. */
  verifyTurnstile: (token: string) => Promise<boolean>;
  now: () => Date;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

export type IntakeResponse =
  | { status: 200; body: { ok: true; state: "received"; reference: string | null } }
  | { status: 400; body: { ok: false; error: "invalid"; fieldErrors: Record<string, string[]> } }
  | { status: 400; body: { ok: false; error: "verification_failed" } }
  | { status: 429; body: { ok: false; error: "rate_limited"; retryAfterSeconds: number } }
  | { status: 502; body: { ok: false; error: "delivery_failed"; retryable: true } }
  | { status: 503; body: { ok: false; error: "unavailable" } };

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

  if (!deps.store && !deps.crm) {
    log("no store and no CRM configured");
    return { status: 503, body: { ok: false, error: "unavailable" } };
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

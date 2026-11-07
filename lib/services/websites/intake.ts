/**
 * Website preview inquiry processing (spec §8 lead processing 1–7).
 *
 * Orchestration only; every side effect is an injected dependency so the
 * whole flow is unit-tested without network or database.
 *
 * Order matters:
 *   validate → honeypot → rate limit → Turnstile → idempotent replay →
 *   durable record → CRM sync → record outcome → respond.
 * The inquiry is written to the store BEFORE the CRM is called, so a CRM
 * failure leaves a recoverable `crm_failed` row instead of a lost lead.
 */
import type { CrmLead, CrmSyncResult, LeadCrm } from "../../integrations/ghl/client";
import { GhlError } from "../../integrations/ghl/client";
import type { RateLimiter } from "../../rate-limit";

import { inquiryRequestSchema, type InquiryFields, type InquiryRequest } from "./inquiry-schema";
import { getPackage, PRICING_VERSION } from "./packages";
import { getPolicy, isPublishable, policyVersionSnapshot } from "./policies";
import { styleTag } from "./styles";

export type InquiryStatus = "received" | "crm_synced" | "crm_failed";

export interface ConsentEvidence {
  sms_consent: boolean;
  recorded_at: string;
  sms_disclosure_version: string;
  privacy_notice_version: string;
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
  ipHash: string | null;
  userAgent: string | null;
}

export interface IntakeDeps {
  store: InquiryStore | null;
  crm: LeadCrm | null;
  rateLimiters: { ip: RateLimiter; email: RateLimiter };
  /** null when Turnstile is not configured for this environment. */
  verifyTurnstile: ((token: string) => Promise<boolean>) | null;
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

const RECEIVED = (reference: string | null): IntakeResponse => ({
  status: 200,
  body: { ok: true, state: "received", reference },
});

export function buildCrmLead(record: Pick<InquiryRecord, "fields" | "consent" | "pricing_version" | "utm" | "submitted_at">): CrmLead {
  const f = record.fields;
  const pkg = f.package_interest ? getPackage(f.package_interest) : null;
  const tags = ["web-preview-request"];
  if (pkg) tags.push(`pkg-${pkg.id}`);
  if (f.style_interest) tags.push(styleTag(f.style_interest));
  // Spec §9: no automation-triggering SMS tag until SMS consent language is approved.
  if (record.consent.sms_consent && isPublishable("sms_consent")) tags.push("sms-consent");

  const utm = record.utm ?? {};
  const noteLines = [
    `Website preview request — ${record.submitted_at}`,
    `Package interest: ${pkg ? `${pkg.displayName} (${pkg.id})` : "not specified"}`,
    `Style interest: ${f.style_interest || "not specified"}`,
    `Business type: ${f.business_type}`,
    `Preferred contact: ${f.contact_method}`,
    f.message ? `Message:\n${f.message}` : null,
    `SMS consent: ${record.consent.sms_consent ? "yes" : "no"} (disclosure ${record.consent.sms_disclosure_version}, recorded ${record.consent.recorded_at}, page ${record.consent.page_url})`,
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
    customFields: {
      business_type: f.business_type,
      package_interest: f.package_interest || undefined,
      style_interest: f.style_interest || undefined,
      contact_method: f.contact_method,
      sms_consent: record.consent.sms_consent ? "yes" : "no",
      sms_consent_at: record.consent.sms_consent ? record.consent.recorded_at : undefined,
      sms_consent_version: record.consent.sms_disclosure_version,
      consent_page_url: record.consent.page_url,
      pricing_version: record.pricing_version,
    },
    opportunityName: `${f.business} — website preview`,
    note: noteLines.join("\n"),
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

  // 2. Honeypot: look successful, do nothing.
  if (req.hp) {
    log("honeypot hit");
    return RECEIVED(null);
  }

  // 3. Rate limit (per IP, per email).
  for (const [limiter, key] of [
    [deps.rateLimiters.ip, ctx.ipHash ? `ip:${ctx.ipHash}` : null],
    [deps.rateLimiters.email, `email:${req.fields.email}`],
  ] as const) {
    if (!key) continue;
    const r = limiter.check(key);
    if (!r.allowed) return { status: 429, body: { ok: false, error: "rate_limited", retryAfterSeconds: r.retryAfterSeconds } };
  }

  // 4. Bot verification.
  if (deps.verifyTurnstile) {
    const ok = req.turnstile_token ? await deps.verifyTurnstile(req.turnstile_token).catch(() => false) : false;
    if (!ok) return { status: 400, body: { ok: false, error: "verification_failed" } };
  }

  if (!deps.store && !deps.crm) {
    log("no store and no CRM configured");
    return { status: 503, body: { ok: false, error: "unavailable" } };
  }

  // 5. Idempotent replay.
  if (deps.store) {
    const prior = await deps.store.findByIdempotencyKey(req.idempotency_key);
    if (prior) return RECEIVED(prior.id);
  }

  const submittedAt = deps.now().toISOString();
  const draft: Omit<InquiryRecord, "id"> = {
    idempotency_key: req.idempotency_key,
    status: "received",
    fields: req.fields,
    consent: {
      sms_consent: req.fields.sms_consent,
      recorded_at: submittedAt,
      sms_disclosure_version: getPolicy("sms_consent").version,
      privacy_notice_version: getPolicy("privacy_notice").version,
      page_url: req.page_url,
      ip_hash: ctx.ipHash,
      user_agent: ctx.userAgent ? ctx.userAgent.slice(0, 400) : null,
    },
    policy_versions: policyVersionSnapshot(["pricing", "privacy_notice", "sms_consent"]),
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
  } catch (err) {
    failure = err instanceof GhlError ? `${err.step}:${err.status ?? "network"}` : (err as Error).message;
    log("crm sync failed", { error: failure, contactId: err instanceof GhlError ? err.contactId : undefined });
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

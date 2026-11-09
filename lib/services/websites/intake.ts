/**
 * Website preview inquiry processing (spec §8 lead processing 1–7).
 *
 * Orchestration only; every side effect is an injected dependency so the
 * whole flow is unit-tested without network or database.
 *
 * Order matters:
 *   validate → honeypot → per-IP rate limit → Turnstile → per-email rate
 *   limit → idempotent replay → durable record → CRM sync → record
 *   outcome → respond.
 * The per-email limit is charged only after Turnstile passes, so failed or
 * unverified submissions can't use up another person's allowance.
 * When a store is configured, the inquiry is written to it BEFORE the CRM
 * is called, so a CRM failure leaves a recoverable `crm_failed` row instead
 * of a lost lead. Without a store (CRM-only), a CRM failure returns a
 * retryable 502 and the form resubmits with the same idempotency key.
 * A submission held by the CRM adapter as an unverified match is recorded
 * as `crm_synced` with no opportunity; the review signal lives in the CRM
 * (tag and UNVERIFIED note), not in the row.
 */
import { createHash } from "node:crypto";

import type { CrmLead, CrmSyncResult, LeadCrm } from "../../integrations/ghl/client";
import { GhlError } from "../../integrations/ghl/client";
import type { RateLimiter } from "../../rate-limit";

import { buildInquiryRequestSchema, type InquiryFields, type InquiryRequest } from "./inquiry-schema";
import { WEBSITES_PRODUCTION_HOSTS } from "./hosts";
import { getPackage, isPackageId, PRICING_VERSION } from "./packages";
import { getPolicy, isPublishable, policyVersionSnapshot, type PolicyId } from "./policies";
import { styleTag } from "./styles";

export type InquiryStatus = "received" | "crm_synced" | "crm_failed";

export interface ConsentEvidence {
  sms_consent: boolean;
  recorded_at: string;
  /** Version of the SMS disclosure shown with the form, or null when none was shown. */
  sms_disclosure_version: string | null;
  /** Version of the privacy sentence shown with the form, or null when none was shown. */
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
  /** Salted client IP hash, stored as evidence; null when the IP is unknown. */
  ipHash: string | null;
  userAgent: string | null;
}

/** Rate-limit bucket for requests without a known client IP: they share one allowance. */
export const UNKNOWN_IP_BUCKET = "ip:unknown";

export interface IntakeDeps {
  store: InquiryStore | null;
  crm: LeadCrm | null;
  rateLimiters: { ip: RateLimiter; email: RateLimiter };
  /** Always required: an inquiry is never accepted without a verified Turnstile token. */
  verifyTurnstile: (token: string) => Promise<boolean>;
  /** Hosts page_url may name. Defaults to the production origin(s). */
  allowedPageHosts?: readonly string[];
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

/**
 * Consent evidence for one submission, recording only the wording the form
 * actually rendered: the privacy sentence once approved, and the SMS
 * disclosure once approved AND the visitor chose text contact (the form
 * shows the checkbox only then). An SMS consent flag sent without the
 * disclosure being shown is recorded as no consent.
 */
export function buildConsentEvidence(
  fields: Pick<InquiryFields, "sms_consent" | "contact_method">,
  meta: { recordedAt: string; pageUrl: string; ipHash: string | null; userAgent: string | null },
  publishable: (id: PolicyId) => boolean = isPublishable
): { consent: ConsentEvidence; policyVersions: Record<string, string> } {
  const smsShown = publishable("sms_consent") && fields.contact_method === "text";
  const privacyShown = publishable("privacy_notice");
  return {
    consent: {
      sms_consent: smsShown && fields.sms_consent,
      recorded_at: meta.recordedAt,
      sms_disclosure_version: smsShown ? getPolicy("sms_consent").version : null,
      privacy_notice_version: privacyShown ? getPolicy("privacy_notice").version : null,
      page_url: meta.pageUrl,
      ip_hash: meta.ipHash,
      user_agent: meta.userAgent ? meta.userAgent.slice(0, 400) : null,
    },
    policyVersions: policyVersionSnapshot([
      "pricing",
      ...(privacyShown ? (["privacy_notice"] as const) : []),
      ...(smsShown ? (["sms_consent"] as const) : []),
    ]),
  };
}

/** Tag for a submission that matched an existing CRM contact by email only. Not used for automations. */
export const UNVERIFIED_MATCH_TAG = "web-preview-unverified-match";

export function buildCrmLead(
  record: Pick<InquiryRecord, "idempotency_key" | "fields" | "consent" | "pricing_version" | "utm" | "submitted_at">
): CrmLead {
  const f = record.fields;
  const pkg = isPackageId(f.package_interest) ? getPackage(f.package_interest) : null;
  const tags = ["web-preview-request"];
  if (pkg) tags.push(`pkg-${pkg.id}`);
  if (f.style_interest) tags.push(styleTag(f.style_interest));
  // Spec §9: no automation-triggering SMS tag unless the approved SMS disclosure
  // was shown with this submission. Consent tags go only to a contact this
  // submission created (client.ts).
  const consentTags = record.consent.sms_consent && record.consent.sms_disclosure_version ? ["sms-consent"] : [];

  const utm = record.utm ?? {};
  const noteLines = [
    `Website preview request — ${record.submitted_at}`,
    "Submitted contact details (as typed on the form):",
    `  Name: ${f.name}`,
    `  Email: ${f.email}`,
    `  Phone: ${f.phone ?? "not given"}`,
    `  Business: ${f.business}`,
    `  Website: ${f.website ?? "not given"}`,
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
    consentTags,
    existingContactTags: [UNVERIFIED_MATCH_TAG],
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
    // Everything the visitor submitted and was shown, but no timestamps, so a
    // retry of the same submission has the same key and a changed one doesn't.
    contentKey: createHash("sha256")
      .update(
        JSON.stringify([
          record.fields,
          record.utm,
          record.consent.page_url,
          record.consent.sms_consent,
          record.consent.sms_disclosure_version,
          record.consent.privacy_notice_version,
          record.pricing_version,
        ])
      )
      .digest("hex"),
  };
}

export async function processInquiry(rawBody: unknown, ctx: IntakeContext, deps: IntakeDeps): Promise<IntakeResponse> {
  const log = deps.log ?? (() => {});

  // 1. Validate.
  const parsed = buildInquiryRequestSchema(deps.allowedPageHosts ?? WEBSITES_PRODUCTION_HOSTS).safeParse(rawBody);
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

  const limited = (r: { allowed: boolean; retryAfterSeconds: number }): IntakeResponse | null =>
    r.allowed ? null : { status: 429, body: { ok: false, error: "rate_limited", retryAfterSeconds: r.retryAfterSeconds } };

  // 3. Per-IP rate limit. Requests without a known IP share one bucket.
  const ipLimited = limited(deps.rateLimiters.ip.check(ctx.ipHash ? `ip:${ctx.ipHash}` : UNKNOWN_IP_BUCKET));
  if (ipLimited) return ipLimited;

  // 4. Bot verification. Required; any error fails closed.
  const verified = req.turnstile_token ? await deps.verifyTurnstile(req.turnstile_token).catch(() => false) : false;
  if (!verified) return { status: 400, body: { ok: false, error: "verification_failed" } };

  // 4b. Per-email rate limit, charged only for verified submissions.
  const emailLimited = limited(deps.rateLimiters.email.check(`email:${req.fields.email}`));
  if (emailLimited) return emailLimited;

  if (!deps.store && !deps.crm) {
    log("no store and no CRM configured");
    return { status: 503, body: { ok: false, error: "unavailable" } };
  }

  // 5. Idempotent replay. A failed lookup is not fatal: the insert below is
  //    atomic on the key, and without a store the CRM path still runs.
  if (deps.store) {
    try {
      const prior = await deps.store.findByIdempotencyKey(req.idempotency_key);
      if (prior) return RECEIVED(prior.id);
    } catch (err) {
      log("store lookup failed", { error: (err as Error).message });
    }
  }

  const submittedAt = deps.now().toISOString();
  const { consent, policyVersions } = buildConsentEvidence(req.fields, {
    recordedAt: submittedAt,
    pageUrl: req.page_url,
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
  });

  const draft: Omit<InquiryRecord, "id"> = {
    idempotency_key: req.idempotency_key,
    status: "received",
    fields: req.fields,
    consent,
    policy_versions: policyVersions,
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
    // No status: "network" if a request may have been sent, "not_sent" if the adapter skipped it.
    failure = err instanceof GhlError ? `${err.step}:${err.status ?? (err.outcome === "rejected" ? "not_sent" : "network")}` : (err as Error).message;
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

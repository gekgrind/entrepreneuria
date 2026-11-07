/**
 * Entrepreneuria Websites — commercial policy registry.
 *
 * Every customer-facing term carries the status the spec gives it. Only
 * APPROVED policies may be published or enforced as terms; PROPOSED flows
 * may run behind a flag for nonproduction testing (spec §13 CONDITIONAL GO)
 * but are never treated as approved language.
 *
 * Promoting a policy is a data edit here plus a version bump, reviewed by
 * the owner (and counsel where marked). Acceptance records store the
 * version, so changing wording never silently re-binds past customers.
 */

export type PolicyStatus = "approved" | "proposed" | "verify" | "legal_review";

export const POLICY_IDS = [
  "pricing",
  "billing_structure",
  "minimum_term",
  "domain_content_ownership",
  "cancellation",
  "setup_fee_refund",
  "customer_delay",
  "content_export",
  "revisions",
  "hosting_maintenance",
  "lead_response_target",
  "payment_recovery",
  "privacy_notice",
  "sms_consent",
  "service_agreement",
] as const;
export type PolicyId = (typeof POLICY_IDS)[number];

export interface Policy {
  id: PolicyId;
  status: PolicyStatus;
  /** Bumped whenever the wording or rule changes. Stored on acceptance. */
  version: string;
  /** Spec section the policy comes from. */
  specRef: string;
  /** Needs counsel before it can be approved. */
  requiresLegalReview: boolean;
}

export const POLICIES: Readonly<Record<PolicyId, Policy>> = {
  pricing: { id: "pricing", status: "approved", version: "2026-11-06.v1", specRef: "§2", requiresLegalReview: false },
  billing_structure: { id: "billing_structure", status: "approved", version: "2026-11-06.v1", specRef: "§2", requiresLegalReview: false },
  minimum_term: { id: "minimum_term", status: "approved", version: "2026-11-06.v1", specRef: "§3", requiresLegalReview: false },
  domain_content_ownership: { id: "domain_content_ownership", status: "approved", version: "2026-11-06.v1", specRef: "§5", requiresLegalReview: true },
  cancellation: { id: "cancellation", status: "proposed", version: "2026-11-06.p1", specRef: "§3", requiresLegalReview: true },
  setup_fee_refund: { id: "setup_fee_refund", status: "proposed", version: "2026-11-06.p1", specRef: "§4", requiresLegalReview: true },
  customer_delay: { id: "customer_delay", status: "proposed", version: "2026-11-06.p1", specRef: "§2", requiresLegalReview: true },
  content_export: { id: "content_export", status: "proposed", version: "2026-11-06.p1", specRef: "§5", requiresLegalReview: true },
  revisions: { id: "revisions", status: "verify", version: "2026-11-06.p1", specRef: "§6", requiresLegalReview: false },
  hosting_maintenance: { id: "hosting_maintenance", status: "verify", version: "2026-11-06.p1", specRef: "§7", requiresLegalReview: false },
  lead_response_target: { id: "lead_response_target", status: "proposed", version: "2026-11-06.p1", specRef: "§8", requiresLegalReview: false },
  payment_recovery: { id: "payment_recovery", status: "proposed", version: "2026-11-06.p1", specRef: "§10C (D-15)", requiresLegalReview: true },
  privacy_notice: { id: "privacy_notice", status: "legal_review", version: "2026-11-06.p1", specRef: "§9", requiresLegalReview: true },
  sms_consent: { id: "sms_consent", status: "legal_review", version: "2026-11-06.p1", specRef: "§9", requiresLegalReview: true },
  service_agreement: { id: "service_agreement", status: "legal_review", version: "2026-11-06.p1", specRef: "§12", requiresLegalReview: true },
};

export function getPolicy(id: PolicyId): Policy {
  return POLICIES[id];
}

/** True only for owner-approved policies. Gate all customer-facing copy on this. */
export function isPublishable(id: PolicyId): boolean {
  return POLICIES[id].status === "approved";
}

export class UnapprovedPolicyError extends Error {
  constructor(public readonly policyId: PolicyId) {
    super(`Policy "${policyId}" is ${POLICIES[policyId].status}, not approved`);
    this.name = "UnapprovedPolicyError";
  }
}

export function assertPublishable(id: PolicyId): Policy {
  if (!isPublishable(id)) throw new UnapprovedPolicyError(id);
  return POLICIES[id];
}

/** Snapshot of every policy version — stored with each acceptance/inquiry. */
export function policyVersionSnapshot(ids: readonly PolicyId[] = POLICY_IDS): Record<string, string> {
  return Object.fromEntries(ids.map((id) => [id, POLICIES[id].version]));
}

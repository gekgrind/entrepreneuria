/**
 * Customer acceptance evidence (spec §4 engineering requirement, §11).
 *
 * Captured when the customer approves the project. Stores exactly which
 * policy versions and pricing version they accepted, so later wording
 * changes never silently re-bind them.
 */
import { getPackage, PRICING_VERSION, type PackageId } from "./packages";
import { POLICIES, policyVersionSnapshot, type PolicyId } from "./policies";

/** Policies a customer must accept to approve a website project. */
export const PROJECT_APPROVAL_POLICIES: readonly PolicyId[] = [
  "service_agreement",
  "pricing",
  "billing_structure",
  "minimum_term",
  "cancellation",
  "setup_fee_refund",
  "domain_content_ownership",
  "privacy_notice",
];

export interface AcceptanceRecord {
  packageId: PackageId;
  pricingVersion: string;
  setupPriceCents: number;
  monthlyPriceCents: number;
  policyVersions: Record<string, string>;
  /** Policy statuses at acceptance time — evidence that terms were proposed, not approved. */
  policyStatuses: Record<string, string>;
  acceptedAt: string;
  ipHash: string | null;
  userAgent: string | null;
}

export function buildAcceptance(input: {
  packageId: PackageId;
  acceptedAt: Date;
  ipHash: string | null;
  userAgent: string | null;
}): AcceptanceRecord {
  const pkg = getPackage(input.packageId);
  return {
    packageId: pkg.id,
    pricingVersion: PRICING_VERSION,
    setupPriceCents: pkg.setupPriceCents,
    monthlyPriceCents: pkg.monthlyPriceCents,
    policyVersions: policyVersionSnapshot(PROJECT_APPROVAL_POLICIES),
    policyStatuses: Object.fromEntries(PROJECT_APPROVAL_POLICIES.map((id) => [id, POLICIES[id].status])),
    acceptedAt: input.acceptedAt.toISOString(),
    ipHash: input.ipHash,
    userAgent: input.userAgent?.slice(0, 400) ?? null,
  };
}

/** True when every required policy and the pricing version match what is current. */
export function isAcceptanceCurrent(a: AcceptanceRecord): boolean {
  if (a.pricingVersion !== PRICING_VERSION) return false;
  return PROJECT_APPROVAL_POLICIES.every((id) => a.policyVersions[id] === POLICIES[id].version);
}

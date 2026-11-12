/**
 * Customer acceptance evidence (spec §4 engineering requirement, §11).
 *
 * Captured when the customer approves the project. Stores exactly which
 * policy versions and pricing version they accepted, so later wording
 * changes never silently re-bind them.
 */
import { getPackage, PRICING_VERSION, type PackageId } from "./packages";
import { registryTerms } from "./terms";
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
  /** Untrusted on arrival: `approve` accepts it only if it equals the proposal's terms (terms.ts). */
  currency: "USD";
  setupPriceCents: number;
  monthlyPriceCents: number;
  /** Digest of the proposal terms the customer saw. Binds this acceptance to one proposal snapshot. */
  termsDigest: string;
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
  /** Digest of the proposal's terms. Defaults to the registry's current terms for the package. */
  termsDigest?: string;
}): AcceptanceRecord {
  const pkg = getPackage(input.packageId);
  return {
    packageId: pkg.id,
    pricingVersion: PRICING_VERSION,
    currency: pkg.currency,
    setupPriceCents: pkg.setupPriceCents,
    monthlyPriceCents: pkg.monthlyPriceCents,
    termsDigest: input.termsDigest ?? registryTerms(pkg.id).digest,
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

/**
 * Authoritative commercial terms for one proposal.
 *
 * The package registry (`packages.ts`) is the only source of prices. When the
 * owner sends a proposal, `snapshotTerms` copies the registry's terms for that
 * package into the project, with a digest. From then on:
 *
 *   - An incoming `AcceptanceRecord` is untrusted. `approve` accepts it only if
 *     every commercial field equals the proposal's snapshot: package, pricing
 *     version, currency, setup price, monthly price and the snapshot digest.
 *     Matching version strings are not enough.
 *   - Every amount sent to a payment provider, and every amount a provider
 *     confirms, comes from the snapshot, never from the acceptance record.
 *   - A snapshot must still equal the registry today (`termsProblem`). A price
 *     or version change after the proposal makes it stale: reissue the proposal
 *     and get a fresh acceptance. This fails closed, including against a project
 *     record whose snapshot and acceptance were both rewritten to match.
 *
 * The digest makes accidental or partial alteration of a stored snapshot
 * detectable. It is not a signature: someone who can write the project row can
 * recompute it, and the registry comparison is what stops that. A live
 * payment release should additionally sign or ledger the snapshot (see
 * docs/websites/FOUNDATION-LIFECYCLE-INTEGRATION.md).
 */
import { createHash } from "node:crypto";

import type { AcceptanceRecord } from "./acceptance";
import { getPackage, isOfferedPackageId, PRICING_VERSION, type PackageId } from "./packages";

export interface ProposalTerms {
  packageId: PackageId;
  pricingVersion: string;
  currency: "USD";
  setupPriceCents: number;
  monthlyPriceCents: number;
  minimumTermMonths: number;
  /** SHA-256 over the fields above, in a fixed order. */
  digest: string;
}

type TermsFields = Omit<ProposalTerms, "digest">;

export function termsDigest(t: TermsFields): string {
  const canonical = [t.packageId, t.pricingVersion, t.currency, t.setupPriceCents, t.monthlyPriceCents, t.minimumTermMonths].join("|");
  return createHash("sha256").update(`websites-terms-v1|${canonical}`).digest("hex");
}

/** The registry's current terms for any known package, offered or not. */
export function registryTerms(packageId: PackageId): ProposalTerms {
  const pkg = getPackage(packageId);
  const fields: TermsFields = {
    packageId: pkg.id,
    pricingVersion: PRICING_VERSION,
    currency: pkg.currency,
    setupPriceCents: pkg.setupPriceCents,
    monthlyPriceCents: pkg.monthlyPriceCents,
    minimumTermMonths: pkg.minimumTermMonths,
  };
  return { ...fields, digest: termsDigest(fields) };
}

/** The registry's current terms for a package that may be proposed. Throws for one that is not offered. */
export function snapshotTerms(packageId: PackageId): ProposalTerms {
  if (!isOfferedPackageId(packageId)) throw new Error(`package "${packageId}" is not offered`);
  return registryTerms(packageId);
}

const isCents = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;

/** Why these terms cannot be relied on, or null: well-formed, undamaged, and equal to the registry today. */
export function snapshotProblem(t: ProposalTerms | null | undefined): string | null {
  if (!t || typeof t !== "object") return "proposal terms are missing";
  if (!isCents(t.setupPriceCents) || !isCents(t.monthlyPriceCents)) return "proposal terms have invalid prices";
  if (t.digest !== termsDigest(t)) return "proposal terms were altered after they were issued";
  const current = isOfferedPackageId(t.packageId) ? snapshotTerms(t.packageId) : null;
  if (!current) return `package "${String(t.packageId)}" is not offered`;
  if (t.pricingVersion !== PRICING_VERSION) return "proposal terms are stale (pricing version changed); reissue the proposal";
  if (t.digest !== current.digest) return "proposal terms are stale (prices changed); reissue the proposal";
  return null;
}

/** Why an (untrusted) acceptance does not match the proposal's terms exactly, or null. */
export function acceptanceTermsProblem(a: AcceptanceRecord | null | undefined, t: ProposalTerms): string | null {
  if (!a || typeof a !== "object") return "acceptance is missing";
  if (a.packageId !== t.packageId) return "acceptance is for a different package";
  if (a.pricingVersion !== t.pricingVersion) return "acceptance is for a different pricing version";
  if (a.currency !== t.currency) return "acceptance currency differs from the proposal";
  if (a.setupPriceCents !== t.setupPriceCents) return "acceptance setup price differs from the proposal";
  if (a.monthlyPriceCents !== t.monthlyPriceCents) return "acceptance monthly price differs from the proposal";
  if (a.termsDigest !== t.digest) return "acceptance is not bound to this proposal's terms";
  return null;
}

/**
 * The terms billing and the lifecycle may use for amounts: only when the
 * snapshot is sound AND the recorded acceptance still matches it exactly.
 */
export function authoritativeTerms(
  proposal: { terms?: ProposalTerms } | null,
  acceptance: AcceptanceRecord | null
): { ok: true; terms: ProposalTerms } | { ok: false; reason: string; stale: boolean } {
  const terms = proposal?.terms;
  const problem = snapshotProblem(terms) ?? (terms ? acceptanceTermsProblem(acceptance, terms) : null);
  if (problem || !terms) return { ok: false, reason: problem ?? "proposal terms are missing", stale: Boolean(problem?.includes("stale")) };
  return { ok: true, terms };
}

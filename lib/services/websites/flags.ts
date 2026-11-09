/**
 * Entrepreneuria Websites — release flags.
 *
 * Environment-backed, server-side only (no NEXT_PUBLIC_), fail-closed.
 *
 *   WEBSITES_SERVICES_MODE
 *     off            (default) routes 404, nothing runs
 *     leads          free-preview requests only: no payment, no inquiry
 *                    store. Resolves to `off` unless
 *                    WEBSITES_LEADS_RELEASE_AUTHORIZED=true AND every leads
 *                    gate passed with evidence AND the required security
 *                    configuration is complete (leads-config.ts). Separate
 *                    from the production authorization below.
 *     nonproduction  intake + sandbox billing usable for staging/testing
 *     production     refused until every release gate passes AND the
 *                    owner sets WEBSITES_OWNER_RELEASE_AUTHORIZED=true
 *
 *   WEBSITES_PAYMENTS_MODE
 *     disabled       (default) no payment calls
 *     sandbox        in-memory/test-mode provider only, nonproduction only
 *     (there is intentionally no "live" value — spec §13 NO-GO)
 *
 *   WEBSITES_PROPOSED_POLICY_FLOWS
 *     comma list of PROPOSED policy flows to exercise in nonproduction,
 *     e.g. "cancellation,setup_fee_refund". Ignored everywhere else.
 */
import { leadsConfigProblems } from "./leads-config";
import { allLeadsGatesPassed, allReleaseGatesPassed, LEADS_RELEASE_GATES, type ReleaseGate } from "./release-gates";
import type { PolicyId } from "./policies";

export type ServicesMode = "off" | "leads" | "nonproduction" | "production";
export type PaymentsMode = "disabled" | "sandbox";

export type Env = Record<string, string | undefined>;

export function resolveServicesMode(
  env: Env = process.env,
  leadsGates: readonly ReleaseGate[] = LEADS_RELEASE_GATES
): ServicesMode {
  const raw = env.WEBSITES_SERVICES_MODE;
  if (raw === "nonproduction") return "nonproduction";
  if (raw === "production") {
    const authorized = env.WEBSITES_OWNER_RELEASE_AUTHORIZED === "true";
    return authorized && allReleaseGatesPassed() ? "production" : "off";
  }
  if (raw === "leads") return explainLeadsOff(env, leadsGates) === null ? "leads" : "off";
  return "off";
}

export type LeadsOffReason = "leads_not_authorized" | "leads_gates_open" | "leads_config_incomplete";

/**
 * Why `WEBSITES_SERVICES_MODE=leads` is not serving, or null when it may.
 * Separate authorization from production: authorizing leads can never
 * authorize production, and vice versa. Setting names only, never values.
 */
export function explainLeadsOff(
  env: Env = process.env,
  leadsGates: readonly ReleaseGate[] = LEADS_RELEASE_GATES
): { reason: LeadsOffReason; missing?: string[] } | null {
  if (env.WEBSITES_LEADS_RELEASE_AUTHORIZED !== "true") return { reason: "leads_not_authorized" };
  if (!allLeadsGatesPassed(leadsGates)) return { reason: "leads_gates_open" };
  const missing = leadsConfigProblems(env);
  if (missing.length > 0) return { reason: "leads_config_incomplete", missing };
  return null;
}

export function resolvePaymentsMode(env: Env = process.env): PaymentsMode {
  if (resolveServicesMode(env) !== "nonproduction") return "disabled";
  return env.WEBSITES_PAYMENTS_MODE === "sandbox" ? "sandbox" : "disabled";
}

export function isProposedFlowEnabled(id: PolicyId, env: Env = process.env): boolean {
  if (resolveServicesMode(env) !== "nonproduction") return false;
  return (env.WEBSITES_PROPOSED_POLICY_FLOWS ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes(id);
}

/**
 * The Supabase inquiry store may never serve the leads path. Migration 002
 * is not applied, and acknowledging a stored inquiry with no retry worker
 * would break the D-04 condition. Keyed on the RAW setting so it also holds
 * while the mode is still gated off.
 */
export function inquiryStoreAllowed(env: Env = process.env): boolean {
  return env.WEBSITES_SERVICES_MODE !== "leads";
}

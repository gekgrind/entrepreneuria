/**
 * Entrepreneuria Websites — release flags.
 *
 * Environment-backed, server-side only (no NEXT_PUBLIC_), fail-closed.
 *
 *   WEBSITES_SERVICES_MODE
 *     off            (default) routes 404, nothing runs
 *     nonproduction  intake + sandbox billing usable for staging/testing
 *     production     refused until every release gate passes AND the
 *                    owner sets WEBSITES_OWNER_RELEASE_AUTHORIZED=true
 *
 *   WEBSITES_PAYMENTS_MODE
 *     disabled       (default) no payment calls
 *     sandbox        in-memory/test-mode provider only
 *     (there is intentionally no "live" value — spec §13 NO-GO)
 *
 *   WEBSITES_PROPOSED_POLICY_FLOWS
 *     comma list of PROPOSED policy flows to exercise in nonproduction,
 *     e.g. "cancellation,setup_fee_refund". Ignored in production.
 */
import { allReleaseGatesPassed } from "./release-gates";
import type { PolicyId } from "./policies";

export type ServicesMode = "off" | "nonproduction" | "production";
export type PaymentsMode = "disabled" | "sandbox";

type Env = Record<string, string | undefined>;

export function resolveServicesMode(env: Env = process.env): ServicesMode {
  const raw = env.WEBSITES_SERVICES_MODE;
  if (raw === "nonproduction") return "nonproduction";
  if (raw === "production") {
    const authorized = env.WEBSITES_OWNER_RELEASE_AUTHORIZED === "true";
    return authorized && allReleaseGatesPassed() ? "production" : "off";
  }
  return "off";
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

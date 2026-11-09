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
 *
 * Per-request gate (resolveRequestServicesMode), used by the page and the
 * inquiry route. Any mode other than off additionally requires:
 *
 *   Host allowlist
 *     nonproduction  the request Host must be listed in
 *                    WEBSITES_NONPRODUCTION_HOSTS (comma list) and must not
 *                    be a production host (hosts.ts)
 *     production     the request Host must be a production host
 *
 *   Intake configuration (names only; values are never logged)
 *     WEBSITES_IP_HASH_SALT           at least 16 characters
 *     TURNSTILE_SECRET_KEY            server-side Turnstile secret
 *     NEXT_PUBLIC_TURNSTILE_SITE_KEY  so the form renders the challenge
 *
 * If any check fails the request resolves to off (404), never to a weaker
 * mode.
 */
import { isProductionHost, normalizeHost, parseHostList } from "./hosts";
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

export const MIN_IP_HASH_SALT_LENGTH = 16;

/** Missing intake configuration, by variable name only. Empty means ready. */
export function intakeConfigProblems(env: Env = process.env): string[] {
  const problems: string[] = [];
  if ((env.WEBSITES_IP_HASH_SALT ?? "").length < MIN_IP_HASH_SALT_LENGTH) {
    problems.push(`WEBSITES_IP_HASH_SALT must be set (at least ${MIN_IP_HASH_SALT_LENGTH} characters)`);
  }
  if (!env.TURNSTILE_SECRET_KEY) problems.push("TURNSTILE_SECRET_KEY must be set");
  if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) problems.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY must be set");
  return problems;
}

/** True when `host` (a raw Host header) may serve `mode`. Fails closed. */
export function isHostAllowedForMode(host: string | null | undefined, mode: ServicesMode, env: Env = process.env): boolean {
  const h = normalizeHost(host);
  if (!h || mode === "off") return false;
  if (mode === "production") return isProductionHost(h);
  return !isProductionHost(h) && parseHostList(env.WEBSITES_NONPRODUCTION_HOSTS).includes(h);
}

export interface RequestServicesGate {
  mode: ServicesMode;
  /** The normalized request host when mode is not off. */
  host: string | null;
  /** Why an enabled mode was refused (names only, safe to log). */
  refused: string[];
}

/**
 * The services mode for one request: the env mode, but only on an allowed
 * host and with the intake fully configured. Anything else is off.
 */
export function resolveRequestServicesGate(host: string | null | undefined, env: Env = process.env): RequestServicesGate {
  const mode = resolveServicesMode(env);
  if (mode === "off") return { mode: "off", host: null, refused: [] };
  const refused = intakeConfigProblems(env);
  if (!isHostAllowedForMode(host, mode, env)) refused.push(`request host is not allowed for ${mode} mode`);
  if (refused.length) return { mode: "off", host: null, refused };
  return { mode, host: normalizeHost(host), refused };
}

const reportedRefusals = new Set<string>();

/** Logs each distinct refusal reason once per process, so a misconfiguration is visible without log floods. */
export function reportGateRefusal(gate: RequestServicesGate, log: (msg: string) => void = (m) => console.error(m)): void {
  for (const reason of gate.refused) {
    if (reportedRefusals.has(reason)) continue;
    reportedRefusals.add(reason);
    log(`[websites] services disabled for this request: ${reason}`);
  }
}

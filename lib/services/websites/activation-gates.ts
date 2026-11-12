/**
 * Commercial activation gates (UX-01 preview → payment workflow).
 *
 *   Gate A  agreement_acceptance  record a customer's acceptance of the service agreement
 *   Gate B  setup_payment         issue the $199 GHL-hosted setup payment request
 *   Gate C  subscription          activate the $75/month subscription
 *   Gate D  production            any production intake, notification or commercial action
 *
 * Fail closed. A gate opens only when every condition holds; the result
 * lists every unmet condition by code (setting names, never values).
 *
 * Two modes, never mixed:
 *   - sandbox     synthetic projects in WEBSITES_SERVICES_MODE=nonproduction
 *                 (and WEBSITES_PAYMENTS_MODE=sandbox for B and C). Legal and
 *                 payment prerequisites are not required because nothing is
 *                 real: no acceptance binds anyone and no money moves.
 *   - production  requires production services mode (which itself requires
 *                 every release gate and the owner's release authorization),
 *                 every prerequisite below passed WITH evidence, the gate's
 *                 own owner authorization, and verified entity reinstatement.
 *                 There is no live payment provider, so B and C cannot open
 *                 in production at all today.
 *
 * Project preconditions (preview approval before agreement, agreement before
 * payment, verified launch before subscription) apply in both modes.
 *
 * A clearance is an unforgeable, single-project, single-mode token: only
 * `clearGate` creates one, and `transition()` refuses any other object.
 */
import { PROJECT_APPROVAL_POLICIES } from "./acceptance";
import { resolvePaymentsMode, resolveServicesMode, type Env } from "./flags";
import type { ProjectMode, ProjectState, WebsiteProject } from "./lifecycle";
import { isPublishable } from "./policies";

export type ConsequentialGate = "agreement_acceptance" | "setup_payment" | "subscription";
export type GateId = ConsequentialGate | "production";

export const GATE_LABELS: Readonly<Record<GateId, string>> = {
  agreement_acceptance: "Gate A: agreement acceptance",
  setup_payment: "Gate B: $199 setup payment request",
  subscription: "Gate C: $75/month subscription activation",
  production: "Gate D: production activation",
};

/** Per-gate owner authorization. Inert unless every other condition also holds. */
export const GATE_AUTHORIZATION_ENV: Readonly<Record<GateId, string>> = {
  agreement_acceptance: "WEBSITES_AGREEMENT_ACCEPTANCE_AUTHORIZED",
  setup_payment: "WEBSITES_SETUP_PAYMENT_AUTHORIZED",
  subscription: "WEBSITES_SUBSCRIPTION_AUTHORIZED",
  production: "WEBSITES_CUSTOMER_MESSAGES_AUTHORIZED",
};

export interface ActivationPrerequisite {
  id: string;
  gate: GateId;
  criterion: string;
  owner: "owner" | "legal" | "engineering";
  passed: boolean;
  evidence?: string;
}

/**
 * External launch checkpoints. Every item starts closed. Flip `passed` only
 * with an evidence reference (signed approval, registry screenshot, sandbox
 * run id) and the owner's written approval. Do not edit without both.
 */
export const ACTIVATION_PREREQUISITES: readonly ActivationPrerequisite[] = [
  // Gate A
  { id: "final-agreement-approved", gate: "agreement_acceptance", criterion: "Final managed website service agreement approved by the owner (PR #38 drafts finalized) and published as an immutable versioned file", owner: "owner", passed: false },
  { id: "legal-entity-name-confirmed", gate: "agreement_acceptance", criterion: "Agreement, proposal, GHL checkout and invoices name the contracting party as Entrepreneuria Global, LLC", owner: "owner", passed: false },
  { id: "customer-disclosures-present", gate: "agreement_acceptance", criterion: "Order summary discloses $199 setup, $75/month from launch, one-month minimum, cancellation, refunds, hosting, domain and content ownership", owner: "legal", passed: false },
  { id: "acceptance-evidence-defined", gate: "agreement_acceptance", criterion: "Acceptance method (GHL checkbox or e-signature), agreement version, and per-customer evidence record are defined and tested", owner: "engineering", passed: false },
  { id: "owner-authorized-agreement-acceptance", gate: "agreement_acceptance", criterion: "Owner authorizes activation of agreement acceptance", owner: "owner", passed: false },
  // Gate B
  { id: "ghl-payment-processor-verified", gate: "setup_payment", criterion: "GHL payment processor connected in the LLC's name and verified with a test-mode setup invoice for $199 (no custom checkout)", owner: "owner", passed: false },
  { id: "ghl-payment-adapter-built", gate: "setup_payment", criterion: "A GHL-hosted payment-request adapter implements PaymentProvider and passes the sandbox contract tests", owner: "engineering", passed: false },
  { id: "owner-authorized-setup-payment", gate: "setup_payment", criterion: "Owner authorizes live $199 setup payment requests", owner: "owner", passed: false },
  // Gate C
  { id: "ghl-subscription-at-launch-verified", gate: "subscription", criterion: "GHL $75/month subscription verified in test mode to start only at the recorded launch date", owner: "owner", passed: false },
  { id: "owner-authorized-subscription", gate: "subscription", criterion: "Owner authorizes live subscription activation", owner: "owner", passed: false },
  // Gate D
  { id: "entity-reinstatement-verified", gate: "production", criterion: "Entrepreneuria Global, LLC reinstatement verified on the Georgia SOS registry, status and date recorded (D-OWN-01a)", owner: "owner", passed: false },
  { id: "customer-templates-approved", gate: "production", criterion: "Customer communication templates approved for sending; legal and payment templates approved with the final agreement", owner: "owner", passed: false },
  { id: "owner-authorized-production", gate: "production", criterion: "Owner separately authorizes production intake, customer notifications and commercial actions", owner: "owner", passed: false },
];

const isPassed = (p: ActivationPrerequisite) => p.passed && Boolean(p.evidence?.trim());

export function openPrerequisites(gate?: GateId): ActivationPrerequisite[] {
  return ACTIVATION_PREREQUISITES.filter((p) => (gate ? p.gate === gate : true) && !isPassed(p));
}

/** Names of the GHL settings a production payment request would need. Names only. */
export function ghlConfigProblems(env: Env): string[] {
  return ["GHL_API_TOKEN", "GHL_LOCATION_ID"].filter((k) => !env[k]?.trim()).map((k) => `ghl_config_missing:${k}`);
}

export interface GateEvaluation {
  gate: GateId;
  mode: ProjectMode;
  open: boolean;
  unmet: string[];
}

/** Gate D: may production intake, customer notifications or commercial actions run? */
export function evaluateProductionGate(env: Env): GateEvaluation {
  const unmet: string[] = [];
  if (resolveServicesMode(env) !== "production") unmet.push("services_mode_not_production");
  for (const p of openPrerequisites("production")) unmet.push(`prerequisite:${p.id}`);
  if (env[GATE_AUTHORIZATION_ENV.production] !== "true") unmet.push(`owner_authorization:${GATE_AUTHORIZATION_ENV.production}`);
  return { gate: "production", mode: "production", open: unmet.length === 0, unmet };
}

function projectPreconditions(gate: ConsequentialGate, p: WebsiteProject, now: Date): string[] {
  const unmet: string[] = [];
  const inState = (...s: ProjectState[]) => {
    if (!s.includes(p.state)) unmet.push(`state:${p.state}`);
  };
  switch (gate) {
    case "agreement_acceptance":
      inState("proposal_sent");
      if (!p.previewApproval) unmet.push("preview_approval_missing");
      if (!p.proposal) unmet.push("proposal_missing");
      else if (now.getTime() >= Date.parse(p.proposal.expiresAt)) unmet.push("proposal_expired");
      break;
    case "setup_payment":
      inState("approved", "setup_payment_failed");
      if (!p.previewApproval) unmet.push("preview_approval_missing");
      if (!p.acceptance || !p.approvedAt) unmet.push("agreement_acceptance_missing");
      if (p.setupChargeId) unmet.push("setup_already_paid");
      break;
    case "subscription":
      inState("live");
      if (!p.setupPaidAt) unmet.push("setup_payment_unconfirmed");
      if (!p.implementationStartedAt) unmet.push("build_not_recorded");
      if (!p.launchApprovedAt) unmet.push("launch_approval_missing");
      if (!p.launchedAt) unmet.push("launch_not_recorded");
      if (!p.launchVerification) unmet.push("launch_not_verified");
      if (p.subscriptionId) unmet.push("subscription_exists");
      break;
  }
  return unmet;
}

export function evaluateGate(gate: ConsequentialGate, ctx: { project: WebsiteProject; env: Env; now: Date }): GateEvaluation {
  const { project, env, now } = ctx;
  const unmet = projectPreconditions(gate, project, now);

  if (project.mode === "sandbox") {
    if (resolveServicesMode(env) !== "nonproduction") unmet.push("services_mode_not_nonproduction");
    if (gate !== "agreement_acceptance" && resolvePaymentsMode(env) !== "sandbox") unmet.push("payments_mode_not_sandbox");
  } else {
    for (const u of evaluateProductionGate(env).unmet) if (!u.startsWith("owner_authorization:")) unmet.push(u);
    for (const p of openPrerequisites(gate)) unmet.push(`prerequisite:${p.id}`);
    if (env[GATE_AUTHORIZATION_ENV[gate]] !== "true") unmet.push(`owner_authorization:${GATE_AUTHORIZATION_ENV[gate]}`);
    if (gate === "agreement_acceptance") {
      for (const id of PROJECT_APPROVAL_POLICIES) if (!isPublishable(id)) unmet.push(`policy_not_approved:${id}`);
    } else {
      // resolvePaymentsMode has no live value and there is no live adapter (D-07).
      unmet.push("no_live_payment_provider");
      if (gate === "setup_payment") unmet.push(...ghlConfigProblems(env));
    }
  }
  return { gate, mode: project.mode, open: unmet.length === 0, unmet };
}

export class GateClosedError extends Error {
  constructor(public readonly evaluation: GateEvaluation) {
    super(`${GATE_LABELS[evaluation.gate]} is closed (${evaluation.mode}): ${evaluation.unmet.join(", ")}`);
    this.name = "GateClosedError";
  }
}

export interface GateClearance {
  readonly gate: ConsequentialGate;
  readonly projectId: string;
  readonly mode: ProjectMode;
  readonly clearedAt: string;
}

/**
 * Wall-clock time (ms) each clearance was issued, held outside the object so
 * a caller cannot edit it. A clearance is a short-lived permission, not a
 * standing one: if the owner closes the gate (or the project changes) after
 * it was issued, a stale clearance must not still work.
 */
const issued = new WeakMap<object, number>();

/** How long a clearance stays usable after `clearGate` issued it. */
export const CLEARANCE_TTL_MS = 15 * 60 * 1000;

/** Evaluates the gate and returns a clearance for this project, or throws GateClosedError. */
export function clearGate(gate: ConsequentialGate, ctx: { project: WebsiteProject; env: Env; now: Date }): GateClearance {
  const evaluation = evaluateGate(gate, ctx);
  if (!evaluation.open) throw new GateClosedError(evaluation);
  const clearance: GateClearance = Object.freeze({
    gate,
    projectId: ctx.project.id,
    mode: ctx.project.mode,
    clearedAt: ctx.now.toISOString(),
  });
  issued.set(clearance, Date.now());
  return clearance;
}

/**
 * Throws unless `c` was issued by clearGate for exactly this gate, project and
 * mode, and is still within `CLEARANCE_TTL_MS`. `nowMs` is the wall clock; it is
 * a parameter only so tests can age a clearance.
 */
export function assertClearance(
  c: unknown,
  expected: { gate: ConsequentialGate; projectId: string; mode: ProjectMode },
  nowMs: number = Date.now()
): void {
  if (!c || typeof c !== "object" || !issued.has(c)) throw new Error(`${GATE_LABELS[expected.gate]} clearance missing or not issued by the gate`);
  const k = c as GateClearance;
  if (k.gate !== expected.gate) throw new Error(`clearance is for ${k.gate}, not ${expected.gate}`);
  if (k.projectId !== expected.projectId) throw new Error("clearance is for a different project");
  if (k.mode !== expected.mode) throw new Error(`clearance mode ${k.mode} does not match project mode ${expected.mode}`);
  if (nowMs - issued.get(c)! > CLEARANCE_TTL_MS) throw new Error(`${GATE_LABELS[expected.gate]} clearance expired; evaluate the gate again`);
}

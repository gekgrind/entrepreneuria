/**
 * Customer project lifecycle (spec §10D).
 *
 *   preview_requested → proposal_sent → approved → setup_paid → in_progress
 *   → customer_review → launch_approved → live → cancellation_pending → canceled
 *
 * plus setup_payment_failed, customer_delay, launch_failed and past_due.
 *
 * Project approval, payment completion, customer launch approval and
 * successful deployment are separate events with separate timestamps.
 * `live` is reachable ONLY through `deployment_succeeded`, which is the
 * only event that records `launchedAt` — the billing anchor.
 *
 * Pure: `transition()` returns the next project plus an audit entry and
 * never mutates its input. Persistence is the caller's job.
 */
import { isAcceptanceCurrent, type AcceptanceRecord } from "./acceptance";
import type { PackageId } from "./packages";

export const PROJECT_STATES = [
  "preview_requested",
  "proposal_sent",
  "approved",
  "setup_payment_failed",
  "setup_paid",
  "in_progress",
  "customer_delay",
  "customer_review",
  "launch_approved",
  "launch_failed",
  "live",
  "past_due",
  "cancellation_pending",
  "canceled",
] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

/** States in which work may be paused for customer delay, and resumed to. */
const DELAYABLE = ["in_progress", "customer_review"] as const;
type DelayableState = (typeof DELAYABLE)[number];

const PRE_LAUNCH: readonly ProjectState[] = [
  "preview_requested",
  "proposal_sent",
  "approved",
  "setup_payment_failed",
  "setup_paid",
  "in_progress",
  "customer_delay",
  "customer_review",
  "launch_approved",
  "launch_failed",
];

export type ProjectEvent =
  | { type: "send_proposal"; packageId: PackageId }
  | { type: "approve"; acceptance: AcceptanceRecord }
  | { type: "setup_payment_succeeded"; chargeId: string }
  | { type: "setup_payment_failed"; reason: string }
  | { type: "start_implementation" }
  | { type: "flag_customer_delay"; reason: string }
  | { type: "resolve_customer_delay" }
  | { type: "submit_for_review" }
  | { type: "request_changes" }
  | { type: "approve_launch" }
  | { type: "deployment_succeeded"; deploymentRef: string }
  | { type: "deployment_failed"; reason: string }
  | { type: "subscription_activated"; subscriptionId: string }
  | { type: "subscription_payment_failed"; reason: string }
  | { type: "subscription_payment_recovered" }
  | { type: "request_cancellation"; effectiveAt: string }
  | { type: "withdraw_cancellation" }
  | { type: "cancellation_effective" }
  | { type: "cancel_before_launch"; reason: string };

export interface WebsiteProject {
  id: string;
  state: ProjectState;
  packageId: PackageId | null;
  acceptance: AcceptanceRecord | null;
  setupChargeId: string | null;
  subscriptionId: string | null;
  delayedFrom: DelayableState | null;
  approvedAt: string | null;
  setupPaidAt: string | null;
  implementationStartedAt: string | null;
  launchApprovedAt: string | null;
  launchedAt: string | null;
  cancellationRequestedAt: string | null;
  cancellationEffectiveAt: string | null;
  canceledAt: string | null;
}

export interface AuditEntry {
  projectId: string;
  event: ProjectEvent["type"];
  from: ProjectState;
  to: ProjectState;
  at: string;
  actor: string;
  detail?: Record<string, unknown>;
}

export class TransitionError extends Error {
  constructor(public readonly from: ProjectState, public readonly event: ProjectEvent["type"], reason: string) {
    super(`Cannot apply "${event}" in state "${from}": ${reason}`);
    this.name = "TransitionError";
  }
}

export function newProject(id: string): WebsiteProject {
  return {
    id,
    state: "preview_requested",
    packageId: null,
    acceptance: null,
    setupChargeId: null,
    subscriptionId: null,
    delayedFrom: null,
    approvedAt: null,
    setupPaidAt: null,
    implementationStartedAt: null,
    launchApprovedAt: null,
    launchedAt: null,
    cancellationRequestedAt: null,
    cancellationEffectiveAt: null,
    canceledAt: null,
  };
}

export function isPreLaunch(state: ProjectState): boolean {
  return PRE_LAUNCH.includes(state);
}

export function transition(
  p: WebsiteProject,
  e: ProjectEvent,
  meta: { at: Date; actor: string }
): { project: WebsiteProject; audit: AuditEntry } {
  const at = meta.at.toISOString();
  const fail = (reason: string): never => {
    throw new TransitionError(p.state, e.type, reason);
  };
  const expect = (...states: ProjectState[]) => {
    if (!states.includes(p.state)) fail(`expected one of ${states.join(", ")}`);
  };

  let next: WebsiteProject = { ...p };
  let detail: Record<string, unknown> | undefined;

  switch (e.type) {
    case "send_proposal":
      expect("preview_requested", "proposal_sent");
      next = { ...next, state: "proposal_sent", packageId: e.packageId };
      detail = { packageId: e.packageId };
      break;

    case "approve":
      expect("proposal_sent");
      if (!p.packageId) fail("no package on proposal");
      if (e.acceptance.packageId !== p.packageId) fail("acceptance is for a different package");
      if (!isAcceptanceCurrent(e.acceptance)) fail("acceptance does not match current policy/pricing versions");
      next = { ...next, state: "approved", acceptance: e.acceptance, approvedAt: at };
      detail = { policyVersions: e.acceptance.policyVersions, pricingVersion: e.acceptance.pricingVersion };
      break;

    case "setup_payment_succeeded":
      expect("approved", "setup_payment_failed");
      next = { ...next, state: "setup_paid", setupChargeId: e.chargeId, setupPaidAt: at };
      detail = { chargeId: e.chargeId };
      break;

    case "setup_payment_failed":
      expect("approved", "setup_payment_failed");
      next = { ...next, state: "setup_payment_failed" };
      detail = { reason: e.reason };
      break;

    case "start_implementation":
      expect("setup_paid");
      next = { ...next, state: "in_progress", implementationStartedAt: at };
      break;

    case "flag_customer_delay":
      expect(...DELAYABLE);
      next = { ...next, state: "customer_delay", delayedFrom: p.state as DelayableState };
      detail = { reason: e.reason };
      break;

    case "resolve_customer_delay":
      expect("customer_delay");
      next = { ...next, state: p.delayedFrom ?? "in_progress", delayedFrom: null };
      break;

    case "submit_for_review":
      expect("in_progress");
      next = { ...next, state: "customer_review" };
      break;

    case "request_changes":
      expect("customer_review");
      next = { ...next, state: "in_progress" };
      break;

    case "approve_launch":
      expect("customer_review");
      next = { ...next, state: "launch_approved", launchApprovedAt: at };
      break;

    case "deployment_succeeded":
      expect("launch_approved", "launch_failed");
      if (!p.launchApprovedAt) fail("customer launch approval not recorded");
      if (!p.setupPaidAt) fail("setup fee not paid");
      next = { ...next, state: "live", launchedAt: at };
      detail = { deploymentRef: e.deploymentRef };
      break;

    case "deployment_failed":
      expect("launch_approved", "launch_failed");
      next = { ...next, state: "launch_failed" };
      detail = { reason: e.reason };
      break;

    case "subscription_activated":
      // Recorded by the billing service after the provider confirms; no state change.
      expect("live");
      if (p.subscriptionId) fail("subscription already recorded");
      next = { ...next, subscriptionId: e.subscriptionId };
      detail = { subscriptionId: e.subscriptionId };
      break;

    case "subscription_payment_failed":
      expect("live", "past_due");
      next = { ...next, state: "past_due" };
      detail = { reason: e.reason };
      break;

    case "subscription_payment_recovered":
      expect("past_due");
      next = { ...next, state: "live" };
      break;

    case "request_cancellation":
      expect("live", "past_due");
      next = { ...next, state: "cancellation_pending", cancellationRequestedAt: at, cancellationEffectiveAt: e.effectiveAt };
      detail = { effectiveAt: e.effectiveAt };
      break;

    case "withdraw_cancellation":
      expect("cancellation_pending");
      next = { ...next, state: "live", cancellationRequestedAt: null, cancellationEffectiveAt: null };
      break;

    case "cancellation_effective":
      expect("cancellation_pending");
      if (p.cancellationEffectiveAt && meta.at.getTime() < Date.parse(p.cancellationEffectiveAt)) {
        fail(`effective date ${p.cancellationEffectiveAt} not reached`);
      }
      next = { ...next, state: "canceled", canceledAt: at };
      break;

    case "cancel_before_launch":
      if (!isPreLaunch(p.state)) fail("project is already live; use request_cancellation");
      next = { ...next, state: "canceled", canceledAt: at };
      detail = { reason: e.reason, setupPaid: Boolean(p.setupPaidAt), implementationStarted: Boolean(p.implementationStartedAt) };
      break;
  }

  return {
    project: next,
    audit: { projectId: p.id, event: e.type, from: p.state, to: next.state, at, actor: meta.actor, detail },
  };
}

/**
 * Customer project lifecycle (spec §10D, extended for UX-01: preview → payment).
 *
 * Pre-sale (free, no obligation):
 *   preview_requested → qualification_pending → qualified → preview_in_progress
 *   → preview_sent ⇄ revision_requested → preview_approved
 *   → proposal_sent (agreement pending) ⇄ proposal_expired
 *
 * Sale (Gate A, then Gate B):
 *   proposal_sent → approved (agreement accepted) → setup_payment_pending
 *   → setup_paid  (setup_payment_failed → setup_payment_pending on a new request)
 *
 * Delivery and billing (Gate C):
 *   setup_paid → in_progress ⇄ customer_review → launch_approved → live
 *   → (verify_launch) → (subscription_activated) → past_due / cancellation_pending → canceled
 *
 * plus customer_delay, launch_failed, and the terminal pre-sale `closed`
 * (disqualified, declined, abandoned, withdrawn, duplicate).
 *
 * Preview approval, agreement acceptance, setup payment request, setup
 * payment confirmation, customer launch approval, deployment, launch
 * verification and subscription activation are separate events with
 * separate timestamps. `live` is reachable ONLY through
 * `deployment_succeeded`, which is the only event that records `launchedAt`
 * — the billing anchor. Recurring billing additionally needs an
 * owner-recorded `verify_launch`.
 *
 * Legally or financially consequential events (`approve`,
 * `request_setup_payment`, `subscription_activated`) require a
 * `GateClearance` issued by activation-gates.ts for this project and mode.
 * Clearances cannot be forged or replayed across projects or modes.
 *
 * Pure: `transition()` returns the next project plus an audit entry and
 * never mutates its input. Persistence, idempotency and actor rules live in
 * workflow.ts.
 */
import { isAcceptanceCurrent, type AcceptanceRecord } from "./acceptance";
import { assertClearance, type GateClearance } from "./activation-gates";
import { isOfferedPackageId, type PackageId } from "./packages";
import { POLICIES } from "./policies";
import { acceptanceTermsProblem, authoritativeTerms, snapshotProblem, snapshotTerms, type ProposalTerms } from "./terms";

export const PROJECT_STATES = [
  // pre-sale
  "preview_requested",
  "qualification_pending",
  "qualified",
  "preview_in_progress",
  "preview_sent",
  "revision_requested",
  "preview_approved",
  "proposal_sent",
  "proposal_expired",
  // sale
  "approved",
  "setup_payment_pending",
  "setup_payment_failed",
  "setup_paid",
  // delivery
  "in_progress",
  "customer_delay",
  "customer_review",
  "launch_approved",
  "launch_failed",
  // post-launch
  "live",
  "past_due",
  "cancellation_pending",
  // terminal
  "canceled",
  "closed",
] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

/**
 * `sandbox` projects are synthetic and can only be cleared through sandbox
 * gates and sandbox providers. `production` projects can only be cleared
 * through production gates. Fixed at creation; never changes.
 */
export type ProjectMode = "sandbox" | "production";

/** Before agreement acceptance: nothing is owed and the inquiry can simply close. */
export const PRE_AGREEMENT_STATES: readonly ProjectState[] = [
  "preview_requested",
  "qualification_pending",
  "qualified",
  "preview_in_progress",
  "preview_sent",
  "revision_requested",
  "preview_approved",
  "proposal_sent",
  "proposal_expired",
];

/** After agreement acceptance, before launch: cancellation goes through `cancel_before_launch`. */
const POST_AGREEMENT_PRE_LAUNCH: readonly ProjectState[] = [
  "approved",
  "setup_payment_pending",
  "setup_payment_failed",
  "setup_paid",
  "in_progress",
  "customer_delay",
  "customer_review",
  "launch_approved",
  "launch_failed",
];

const PRE_LAUNCH: readonly ProjectState[] = [...PRE_AGREEMENT_STATES, ...POST_AGREEMENT_PRE_LAUNCH];

export const TERMINAL_STATES: readonly ProjectState[] = ["canceled", "closed"];

/** States in which work may be paused for customer delay, and resumed to. */
const DELAYABLE = ["in_progress", "customer_review"] as const;
type DelayableState = (typeof DELAYABLE)[number];

export const CLOSE_REASONS = [
  "disqualified",
  "prospect_declined",
  "abandoned",
  "withdrawn_by_prospect",
  "duplicate_request",
] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

/**
 * How a customer decision reached us. `ref` is an opaque pointer (a GHL
 * conversation/message id, a mailbox message id) — never message content
 * or personal data, so audit rows stay data-minimal.
 */
export interface CustomerEvidence {
  channel: "email" | "ghl_conversation" | "ghl_form" | "phone" | "in_person";
  ref: string;
}

export interface PreviewDelivery {
  revision: number;
  format: "link" | "image" | "pdf";
  /** Opaque reference to the delivered concept (asset id, private URL id). */
  ref: string;
  deliveredAt: string;
}

export interface RevisionRequest {
  afterRevision: number;
  requestedAt: string;
  evidence: CustomerEvidence;
}

export interface PreviewApproval {
  revision: number;
  approvedAt: string;
  evidence: CustomerEvidence;
}

export interface ProposalRecord {
  packageId: PackageId;
  /** service_agreement policy version the proposal links to. */
  agreementVersion: string;
  sentAt: string;
  expiresAt: string;
  /** 1 for the first proposal, +1 per revision or reissue. */
  issue: number;
  /** The registry's terms at the moment the proposal was sent. The only source of amounts. */
  terms: ProposalTerms;
}

export interface LaunchVerification {
  verifiedAt: string;
  /** Opaque reference to the verification evidence (check run id, screenshot id). */
  ref: string;
}

export type ProjectEvent =
  // pre-sale
  | { type: "acknowledge_request" }
  | { type: "qualify" }
  | { type: "start_preview" }
  | { type: "deliver_preview"; format: PreviewDelivery["format"]; ref: string }
  | { type: "request_revision"; evidence: CustomerEvidence }
  | { type: "approve_preview"; revision: number; evidence: CustomerEvidence }
  | { type: "send_proposal"; packageId: PackageId; expiresAt: string; agreementVersion: string }
  | { type: "expire_proposal" }
  | { type: "close_inquiry"; reason: CloseReason }
  // sale
  | { type: "approve"; acceptance: AcceptanceRecord; clearance: GateClearance }
  | { type: "request_setup_payment"; requestId: string; amountCents: number; clearance: GateClearance }
  | { type: "setup_payment_succeeded"; requestId: string; chargeId: string; amountCents: number }
  | { type: "setup_payment_failed"; requestId: string; reason: string }
  // delivery
  | { type: "start_implementation" }
  | { type: "flag_customer_delay"; reason: string }
  | { type: "resolve_customer_delay" }
  | { type: "submit_for_review" }
  | { type: "request_changes" }
  | { type: "approve_launch"; evidence: CustomerEvidence }
  | { type: "deployment_succeeded"; deploymentRef: string }
  | { type: "deployment_failed"; reason: string }
  | { type: "verify_launch"; ref: string }
  // billing
  | { type: "subscription_activated"; subscriptionId: string; clearance: GateClearance }
  | { type: "subscription_payment_failed"; reason: string }
  | { type: "subscription_payment_recovered" }
  | { type: "request_cancellation"; effectiveAt: string }
  | { type: "withdraw_cancellation" }
  | { type: "cancellation_effective" }
  | { type: "cancel_before_launch"; reason: string };

export type ProjectEventType = ProjectEvent["type"];

export interface WebsiteProject {
  id: string;
  mode: ProjectMode;
  state: ProjectState;
  packageId: PackageId | null;
  // pre-sale records
  acknowledgedAt: string | null;
  qualifiedAt: string | null;
  previewStartedAt: string | null;
  previewDeliveries: PreviewDelivery[];
  revisionRequests: RevisionRequest[];
  previewApproval: PreviewApproval | null;
  proposal: ProposalRecord | null;
  closedAt: string | null;
  closedReason: CloseReason | null;
  // sale records
  acceptance: AcceptanceRecord | null;
  approvedAt: string | null;
  setupPaymentRequestId: string | null;
  setupPaymentRequestedAt: string | null;
  setupPaymentAttempts: number;
  setupChargeId: string | null;
  setupPaidAt: string | null;
  // delivery records
  delayedFrom: DelayableState | null;
  implementationStartedAt: string | null;
  launchApprovedAt: string | null;
  launchApprovalEvidence: CustomerEvidence | null;
  launchedAt: string | null;
  launchVerification: LaunchVerification | null;
  // billing records
  subscriptionId: string | null;
  cancellationRequestedAt: string | null;
  cancellationEffectiveAt: string | null;
  canceledAt: string | null;
}

export interface AuditEntry {
  projectId: string;
  mode: ProjectMode;
  event: ProjectEventType;
  from: ProjectState;
  to: ProjectState;
  at: string;
  actor: string;
  detail?: Record<string, unknown>;
}

export class TransitionError extends Error {
  constructor(public readonly from: ProjectState, public readonly event: ProjectEventType, reason: string) {
    super(`Cannot apply "${event}" in state "${from}": ${reason}`);
    this.name = "TransitionError";
  }
}

export function newProject(id: string, opts: { mode?: ProjectMode } = {}): WebsiteProject {
  return {
    id,
    // Fail safe: an unspecified project can never reach a production gate.
    mode: opts.mode ?? "sandbox",
    state: "preview_requested",
    packageId: null,
    acknowledgedAt: null,
    qualifiedAt: null,
    previewStartedAt: null,
    previewDeliveries: [],
    revisionRequests: [],
    previewApproval: null,
    proposal: null,
    closedAt: null,
    closedReason: null,
    acceptance: null,
    approvedAt: null,
    setupPaymentRequestId: null,
    setupPaymentRequestedAt: null,
    setupPaymentAttempts: 0,
    setupChargeId: null,
    setupPaidAt: null,
    delayedFrom: null,
    implementationStartedAt: null,
    launchApprovedAt: null,
    launchApprovalEvidence: null,
    launchedAt: null,
    launchVerification: null,
    subscriptionId: null,
    cancellationRequestedAt: null,
    cancellationEffectiveAt: null,
    canceledAt: null,
  };
}

export function isPreLaunch(state: ProjectState): boolean {
  return PRE_LAUNCH.includes(state);
}

export function isPreAgreement(state: ProjectState): boolean {
  return PRE_AGREEMENT_STATES.includes(state);
}

export function isTerminal(state: ProjectState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function latestPreviewRevision(p: WebsiteProject): number {
  return p.previewDeliveries.at(-1)?.revision ?? 0;
}

/** True when the proposal on record has passed its expiry at `at`. */
export function isProposalExpired(p: WebsiteProject, at: Date): boolean {
  return Boolean(p.proposal && at.getTime() >= Date.parse(p.proposal.expiresAt));
}

/**
 * Recurring-billing status, derived (no extra state): the subscription is
 * `pending` from launch until the provider confirms activation.
 */
export function subscriptionStatus(p: WebsiteProject): "not_applicable" | "pending" | "active" | "ended" {
  if (p.state === "canceled") return p.subscriptionId ? "ended" : "not_applicable";
  if (!p.launchedAt) return "not_applicable";
  return p.subscriptionId ? "active" : "pending";
}

const isRef = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 200;

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
  const checkEvidence = (ev: CustomerEvidence | undefined) => {
    if (!ev || !isRef(ev.ref)) fail("customer evidence reference required");
  };
  const checkClearance = (c: GateClearance, gate: GateClearance["gate"]) => {
    try {
      assertClearance(c, { gate, projectId: p.id, mode: p.mode });
    } catch (err) {
      fail((err as Error).message);
    }
  };

  let next: WebsiteProject = { ...p };
  let detail: Record<string, unknown> | undefined;

  switch (e.type) {
    /* ---------- pre-sale ---------- */

    case "acknowledge_request":
      expect("preview_requested");
      next = { ...next, state: "qualification_pending", acknowledgedAt: at };
      break;

    case "qualify":
      expect("qualification_pending");
      next = { ...next, state: "qualified", qualifiedAt: at };
      break;

    case "start_preview":
      expect("qualified");
      next = { ...next, state: "preview_in_progress", previewStartedAt: at };
      break;

    case "deliver_preview": {
      expect("preview_in_progress", "revision_requested");
      if (!isRef(e.ref)) fail("preview reference required");
      const delivery: PreviewDelivery = { revision: latestPreviewRevision(p) + 1, format: e.format, ref: e.ref, deliveredAt: at };
      next = { ...next, state: "preview_sent", previewDeliveries: [...p.previewDeliveries, delivery] };
      detail = { revision: delivery.revision, format: e.format, ref: e.ref };
      break;
    }

    case "request_revision":
      expect("preview_sent");
      checkEvidence(e.evidence);
      next = {
        ...next,
        state: "revision_requested",
        revisionRequests: [...p.revisionRequests, { afterRevision: latestPreviewRevision(p), requestedAt: at, evidence: e.evidence }],
      };
      detail = { afterRevision: latestPreviewRevision(p), evidence: e.evidence };
      break;

    case "approve_preview":
      expect("preview_sent");
      checkEvidence(e.evidence);
      // The prospect approves the concept they were shown, not an older one.
      if (e.revision !== latestPreviewRevision(p)) {
        fail(`approval is for revision ${e.revision}, latest delivered is ${latestPreviewRevision(p)}`);
      }
      next = { ...next, state: "preview_approved", previewApproval: { revision: e.revision, approvedAt: at, evidence: e.evidence } };
      detail = { revision: e.revision, evidence: e.evidence };
      break;

    case "send_proposal": {
      expect("preview_approved", "proposal_sent", "proposal_expired");
      if (!p.previewApproval) fail("preview approval not recorded");
      if (!isOfferedPackageId(e.packageId)) fail(`package "${e.packageId}" is not offered`);
      const expires = Date.parse(e.expiresAt);
      if (!Number.isFinite(expires) || expires <= meta.at.getTime()) fail("proposal expiry must be in the future");
      if (e.agreementVersion !== POLICIES.service_agreement.version) {
        fail(`proposal links agreement ${e.agreementVersion}, current is ${POLICIES.service_agreement.version}`);
      }
      const proposal: ProposalRecord = {
        packageId: e.packageId,
        agreementVersion: e.agreementVersion,
        sentAt: at,
        expiresAt: new Date(expires).toISOString(),
        issue: (p.proposal?.issue ?? 0) + 1,
        terms: snapshotTerms(e.packageId),
      };
      next = { ...next, state: "proposal_sent", packageId: e.packageId, proposal };
      detail = { packageId: e.packageId, agreementVersion: e.agreementVersion, expiresAt: proposal.expiresAt, issue: proposal.issue };
      break;
    }

    case "expire_proposal":
      expect("proposal_sent");
      if (!isProposalExpired(p, meta.at)) fail(`proposal valid until ${p.proposal?.expiresAt}`);
      next = { ...next, state: "proposal_expired" };
      break;

    case "close_inquiry":
      if (!isPreAgreement(p.state)) fail("only open inquiries can be closed; use cancel_before_launch after agreement");
      if (!(CLOSE_REASONS as readonly string[]).includes(e.reason)) fail(`unknown close reason "${e.reason}"`);
      next = { ...next, state: "closed", closedAt: at, closedReason: e.reason };
      detail = { reason: e.reason };
      break;

    /* ---------- sale ---------- */

    case "approve": {
      expect("proposal_sent");
      checkClearance(e.clearance, "agreement_acceptance");
      const proposal = p.proposal;
      if (!p.previewApproval) fail("preview approval not recorded");
      if (!proposal || !p.packageId) return fail("no proposal on record");
      if (isProposalExpired(p, meta.at)) fail("proposal has expired");
      if (e.acceptance.packageId !== p.packageId) fail("acceptance is for a different package");
      if (e.acceptance.policyVersions.service_agreement !== proposal.agreementVersion) fail("acceptance is for a different agreement version");
      if (!isAcceptanceCurrent(e.acceptance)) fail("acceptance does not match current policy/pricing versions");
      // The acceptance is untrusted. Every commercial field must equal the proposal's terms,
      // and those terms must still equal the registry. Matching version strings are not enough.
      const termsFault = snapshotProblem(proposal.terms) ?? acceptanceTermsProblem(e.acceptance, proposal.terms);
      if (termsFault) fail(termsFault);
      next = { ...next, state: "approved", acceptance: e.acceptance, approvedAt: at };
      detail = {
        policyVersions: e.acceptance.policyVersions,
        pricingVersion: e.acceptance.pricingVersion,
        clearance: { gate: e.clearance.gate, mode: e.clearance.mode },
      };
      break;
    }

    case "request_setup_payment": {
      expect("approved", "setup_payment_failed");
      checkClearance(e.clearance, "setup_payment");
      const acceptance = p.acceptance;
      if (!p.previewApproval) fail("preview approval not recorded");
      if (!acceptance || !p.approvedAt) return fail("agreement acceptance not recorded");
      if (p.setupChargeId) fail("setup fee already paid");
      if (!isRef(e.requestId)) fail("payment request id required");
      const setupTerms = authoritativeTerms(p.proposal, acceptance);
      if (!setupTerms.ok) return fail(setupTerms.reason);
      if (e.amountCents !== setupTerms.terms.setupPriceCents) fail("request amount differs from the accepted setup fee");
      const attempt = p.setupPaymentAttempts + 1;
      next = { ...next, state: "setup_payment_pending", setupPaymentRequestId: e.requestId, setupPaymentRequestedAt: at, setupPaymentAttempts: attempt };
      detail = { requestId: e.requestId, amountCents: e.amountCents, attempt, clearance: { gate: e.clearance.gate, mode: e.clearance.mode } };
      break;
    }

    case "setup_payment_succeeded":
      expect("setup_payment_pending");
      if (e.requestId !== p.setupPaymentRequestId) fail("confirmation is for a different payment request");
      const paidTerms = authoritativeTerms(p.proposal, p.acceptance);
      if (!paidTerms.ok) return fail(paidTerms.reason);
      if (e.amountCents !== paidTerms.terms.setupPriceCents) fail("confirmed amount differs from the accepted setup fee");
      if (!isRef(e.chargeId)) fail("charge id required");
      next = { ...next, state: "setup_paid", setupChargeId: e.chargeId, setupPaidAt: at };
      detail = { requestId: e.requestId, chargeId: e.chargeId, amountCents: e.amountCents };
      break;

    case "setup_payment_failed":
      expect("setup_payment_pending");
      if (e.requestId !== p.setupPaymentRequestId) fail("failure is for a different payment request");
      next = { ...next, state: "setup_payment_failed" };
      detail = { requestId: e.requestId, reason: e.reason };
      break;

    /* ---------- delivery ---------- */

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
      checkEvidence(e.evidence);
      next = { ...next, state: "launch_approved", launchApprovedAt: at, launchApprovalEvidence: e.evidence };
      detail = { evidence: e.evidence };
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

    case "verify_launch":
      expect("live");
      if (p.launchVerification) fail("launch already verified");
      if (!isRef(e.ref)) fail("verification reference required");
      next = { ...next, launchVerification: { verifiedAt: at, ref: e.ref } };
      detail = { ref: e.ref };
      break;

    /* ---------- billing ---------- */

    case "subscription_activated":
      // Recorded after the provider confirms; no state change.
      expect("live");
      checkClearance(e.clearance, "subscription");
      if (!p.launchVerification) fail("launch not verified");
      if (p.subscriptionId) fail("subscription already recorded");
      next = { ...next, subscriptionId: e.subscriptionId };
      detail = { subscriptionId: e.subscriptionId, clearance: { gate: e.clearance.gate, mode: e.clearance.mode } };
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
      if (!POST_AGREEMENT_PRE_LAUNCH.includes(p.state)) {
        fail(isPreAgreement(p.state) ? "no agreement yet; use close_inquiry" : "project is live or closed; use request_cancellation");
      }
      next = { ...next, state: "canceled", canceledAt: at };
      detail = { reason: e.reason, setupPaid: Boolean(p.setupPaidAt), implementationStarted: Boolean(p.implementationStartedAt) };
      break;

    default: {
      const unknown: never = e;
      throw new TransitionError(p.state, (unknown as { type: ProjectEventType }).type, "unknown event");
    }
  }

  return {
    project: next,
    audit: { projectId: p.id, mode: p.mode, event: e.type, from: p.state, to: next.state, at, actor: meta.actor, detail },
  };
}

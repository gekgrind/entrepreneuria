/**
 * Synthetic fixtures for lifecycle, gate, billing and workflow tests.
 * No real people, businesses, payment references or GHL ids.
 */
import { buildAcceptance } from "./acceptance";
import { clearGate } from "./activation-gates";
import type { Env } from "./flags";
import { newProject, transition, type CustomerEvidence, type ProjectEvent, type ProjectMode, type WebsiteProject } from "./lifecycle";
import { getPackage } from "./packages";
import { POLICIES } from "./policies";

export const T0 = new Date("2026-11-20T15:00:00.000Z");
export const DAY_MS = 24 * 60 * 60 * 1000;
export const SANDBOX_ENV: Env = { WEBSITES_SERVICES_MODE: "nonproduction", WEBSITES_PAYMENTS_MODE: "sandbox" };
export const EVIDENCE: CustomerEvidence = { channel: "email", ref: "synthetic-msg-001" };
export const AGREEMENT_VERSION = POLICIES.service_agreement.version;
export const STARTER = getPackage("starter");

export const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

export function step(p: WebsiteProject, e: ProjectEvent, when: Date | string = T0): WebsiteProject {
  return transition(p, e, { at: new Date(when), actor: "owner:test" }).project;
}

export function proposalEvent(expiresAt: Date = plusDays(T0, 14)): ProjectEvent {
  return { type: "send_proposal", packageId: "starter", expiresAt: expiresAt.toISOString(), agreementVersion: AGREEMENT_VERSION };
}

export function toPreviewSent(id = "p1", mode: ProjectMode = "sandbox"): WebsiteProject {
  let p = newProject(id, { mode });
  p = step(p, { type: "acknowledge_request" });
  p = step(p, { type: "qualify" });
  p = step(p, { type: "start_preview" });
  return step(p, { type: "deliver_preview", format: "link", ref: "synthetic-concept-r1" });
}

export function toPreviewApproved(id = "p1", mode: ProjectMode = "sandbox"): WebsiteProject {
  return step(toPreviewSent(id, mode), { type: "approve_preview", revision: 1, evidence: EVIDENCE });
}

export function toProposal(id = "p1"): WebsiteProject {
  return step(toPreviewApproved(id), proposalEvent());
}

export function acceptanceEvent(p: WebsiteProject, now: Date = T0, env: Env = SANDBOX_ENV): ProjectEvent {
  return {
    type: "approve",
    acceptance: buildAcceptance({ packageId: "starter", acceptedAt: now, ipHash: null, userAgent: null }),
    clearance: clearGate("agreement_acceptance", { project: p, env, now }),
  };
}

export function toApproved(id = "p1"): WebsiteProject {
  const p = toProposal(id);
  return step(p, acceptanceEvent(p));
}

export function setupRequestEvent(p: WebsiteProject, requestId = "preq_synthetic_1", now: Date = T0): ProjectEvent {
  return {
    type: "request_setup_payment",
    requestId,
    amountCents: STARTER.setupPriceCents,
    clearance: clearGate("setup_payment", { project: p, env: SANDBOX_ENV, now }),
  };
}

export function toSetupPending(id = "p1"): WebsiteProject {
  const p = toApproved(id);
  return step(p, setupRequestEvent(p));
}

export function toSetupPaid(id = "p1"): WebsiteProject {
  return step(toSetupPending(id), {
    type: "setup_payment_succeeded",
    requestId: "preq_synthetic_1",
    chargeId: "ch_synthetic_1",
    amountCents: STARTER.setupPriceCents,
  });
}

export function toReview(id = "p1"): WebsiteProject {
  let p = toSetupPaid(id);
  p = step(p, { type: "start_implementation" });
  return step(p, { type: "submit_for_review" });
}

export function toLive(id = "p1", launchAt = "2026-12-02T09:00:00.000Z"): WebsiteProject {
  let p = step(toReview(id), { type: "approve_launch", evidence: EVIDENCE });
  p = step(p, { type: "deployment_succeeded", deploymentRef: "dep_synthetic_1" }, launchAt);
  return p;
}

export function toVerifiedLive(id = "p1", launchAt = "2026-12-02T09:00:00.000Z"): WebsiteProject {
  return step(toLive(id, launchAt), { type: "verify_launch", ref: "synthetic-check-1" }, launchAt);
}

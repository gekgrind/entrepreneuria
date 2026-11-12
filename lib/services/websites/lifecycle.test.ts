import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAcceptance } from "./acceptance";
import { clearGate } from "./activation-gates";
import { crmStageFor } from "./crm-stages";
import {
  CLOSE_REASONS,
  isPreAgreement,
  newProject,
  PROJECT_STATES,
  subscriptionStatus,
  transition,
  TransitionError,
  type ProjectEvent,
  type WebsiteProject,
} from "./lifecycle";
import {
  acceptanceEvent,
  AGREEMENT_VERSION,
  EVIDENCE,
  plusDays,
  proposalEvent,
  SANDBOX_ENV,
  setupRequestEvent,
  STARTER,
  step,
  T0,
  toApproved,
  toLive,
  toPreviewApproved,
  toPreviewSent,
  toProposal,
  toReview,
  toSetupPaid,
  toSetupPending,
  toVerifiedLive,
} from "./lifecycle.test-helper";

const rejects = (p: WebsiteProject, e: ProjectEvent, re?: RegExp, when: Date | string = T0) =>
  assert.throws(() => step(p, e, when), (err: unknown) => err instanceof TransitionError && (!re || re.test(err.message)));

describe("preview → payment lifecycle: happy path", () => {
  it("walks request → preview → proposal → agreement → setup payment → build → launch → subscription", () => {
    let p = newProject("happy");
    assert.equal(p.mode, "sandbox");
    p = step(p, { type: "acknowledge_request" });
    assert.equal(p.state, "qualification_pending");
    p = step(p, { type: "qualify" });
    p = step(p, { type: "start_preview" });
    p = step(p, { type: "deliver_preview", format: "link", ref: "concept-r1" });
    assert.equal(p.state, "preview_sent");
    p = step(p, { type: "request_revision", evidence: EVIDENCE });
    assert.equal(p.state, "revision_requested");
    p = step(p, { type: "deliver_preview", format: "image", ref: "concept-r2" });
    assert.deepEqual(p.previewDeliveries.map((d) => d.revision), [1, 2]);
    p = step(p, { type: "approve_preview", revision: 2, evidence: EVIDENCE });
    assert.equal(p.state, "preview_approved");
    assert.equal(p.previewApproval?.revision, 2);
    p = step(p, proposalEvent());
    assert.equal(p.state, "proposal_sent");
    assert.equal(p.proposal?.agreementVersion, AGREEMENT_VERSION);
    p = step(p, acceptanceEvent(p));
    assert.equal(p.state, "approved");
    assert.equal(p.setupPaidAt, null, "agreement acceptance never records payment");
    assert.equal(p.subscriptionId, null);
    p = step(p, setupRequestEvent(p));
    assert.equal(p.state, "setup_payment_pending");
    p = step(p, { type: "setup_payment_succeeded", requestId: "preq_synthetic_1", chargeId: "ch_1", amountCents: 19_900 });
    assert.equal(p.state, "setup_paid");
    assert.equal(subscriptionStatus(p), "not_applicable", "setup payment never starts the subscription");
    p = step(p, { type: "start_implementation" });
    p = step(p, { type: "submit_for_review" });
    p = step(p, { type: "approve_launch", evidence: EVIDENCE });
    p = step(p, { type: "deployment_succeeded", deploymentRef: "dep" }, "2026-12-02T09:00:00.000Z");
    assert.equal(p.state, "live");
    assert.equal(subscriptionStatus(p), "pending");
    p = step(p, { type: "verify_launch", ref: "check-1" });
    const clearance = clearGate("subscription", { project: p, env: SANDBOX_ENV, now: T0 });
    p = step(p, { type: "subscription_activated", subscriptionId: "sub_1", clearance });
    assert.equal(subscriptionStatus(p), "active");
  });

  it("every state maps to a CRM stage", () => {
    for (const s of PROJECT_STATES) assert.ok(crmStageFor(s).stage);
    assert.deepEqual(crmStageFor("setup_paid"), { stage: "build", status: "won" });
    assert.deepEqual(crmStageFor("closed", "abandoned"), { stage: "lost", status: "abandoned" });
  });
});

describe("preview → payment lifecycle: invalid and out-of-order transitions", () => {
  it("cannot skip qualification or preview steps", () => {
    const fresh = newProject("o1");
    rejects(fresh, { type: "qualify" });
    rejects(fresh, { type: "start_preview" });
    rejects(fresh, { type: "deliver_preview", format: "link", ref: "x" });
    rejects(fresh, { type: "approve_preview", revision: 1, evidence: EVIDENCE });
    rejects(fresh, proposalEvent());
  });

  it("cannot send a proposal before the preview is approved", () => {
    rejects(toPreviewSent("o2"), proposalEvent(), /expected one of/);
  });

  it("approves only the latest delivered preview revision, with evidence", () => {
    let p = toPreviewSent("o3");
    p = step(p, { type: "request_revision", evidence: EVIDENCE });
    p = step(p, { type: "deliver_preview", format: "pdf", ref: "concept-r2" });
    rejects(p, { type: "approve_preview", revision: 1, evidence: EVIDENCE }, /latest delivered is 2/);
    rejects(p, { type: "approve_preview", revision: 2, evidence: { channel: "email", ref: "" } }, /evidence/);
  });

  it("a proposal only offers an offered package, links the current agreement and expires in the future", () => {
    const p = toPreviewApproved("o4");
    rejects(p, { ...proposalEvent(), packageId: "growth" } as ProjectEvent, /not offered/);
    rejects(p, { ...proposalEvent(), agreementVersion: "2020-01-01.v0" } as ProjectEvent, /current is/);
    rejects(p, proposalEvent(plusDays(T0, -1)), /future/);
  });

  it("agreement acceptance requires a clearance issued for this project", () => {
    const p = toProposal("o5");
    const acceptance = buildAcceptance({ packageId: "starter", acceptedAt: T0, ipHash: null, userAgent: null });
    const forged = { gate: "agreement_acceptance", projectId: p.id, mode: "sandbox", clearedAt: T0.toISOString() } as const;
    rejects(p, { type: "approve", acceptance, clearance: forged }, /not issued by the gate/);
    const other = toProposal("o5-other");
    const foreign = clearGate("agreement_acceptance", { project: other, env: SANDBOX_ENV, now: T0 });
    rejects(p, { type: "approve", acceptance, clearance: foreign }, /different project/);
    const wrongGate = clearGate("setup_payment", { project: toApproved("o5"), env: SANDBOX_ENV, now: T0 });
    rejects(p, { type: "approve", acceptance, clearance: wrongGate }, /not agreement_acceptance/);
  });

  it("missing agreement acceptance blocks the setup payment request", () => {
    const p = toProposal("o6");
    assert.throws(() => clearGate("setup_payment", { project: p, env: SANDBOX_ENV, now: T0 }), /agreement_acceptance_missing/);
    const clearance = clearGate("setup_payment", { project: toApproved("o6"), env: SANDBOX_ENV, now: T0 });
    rejects(p, { type: "request_setup_payment", requestId: "r", amountCents: 19_900, clearance }, /expected one of/);
  });

  it("setup payment cannot be requested before preview approval, at a different amount, or confirmed without a request", () => {
    for (const early of [newProject("o7"), toPreviewSent("o7"), toPreviewApproved("o7")]) {
      assert.throws(() => clearGate("setup_payment", { project: early, env: SANDBOX_ENV, now: T0 }));
      rejects(early, { type: "setup_payment_succeeded", requestId: "r", chargeId: "c", amountCents: 19_900 });
    }
    const approved = toApproved("o8");
    const clearance = clearGate("setup_payment", { project: approved, env: SANDBOX_ENV, now: T0 });
    rejects(approved, { type: "request_setup_payment", requestId: "r", amountCents: 9_900, clearance }, /accepted setup fee/);
    rejects(approved, { type: "setup_payment_succeeded", requestId: "r", chargeId: "c", amountCents: 19_900 }, /expected one of/);
    const pending = toSetupPending("o9");
    rejects(pending, { type: "setup_payment_succeeded", requestId: "preq_synthetic_1", chargeId: "c", amountCents: 7_500 }, /accepted setup fee/);
  });

  it("subscription cannot be activated before launch, before verification, or with a pre-launch clearance", () => {
    for (const p of [toApproved("o10"), toSetupPaid("o10"), toReview("o10"), toLive("o10")]) {
      assert.throws(() => clearGate("subscription", { project: p, env: SANDBOX_ENV, now: T0 }));
    }
    const clearance = clearGate("subscription", { project: toVerifiedLive("o10"), env: SANDBOX_ENV, now: T0 });
    rejects(toSetupPaid("o10"), { type: "subscription_activated", subscriptionId: "s", clearance }, /expected one of/);
    rejects(toLive("o10"), { type: "subscription_activated", subscriptionId: "s", clearance }, /launch not verified/);
  });

  it("build cannot start before the setup payment is confirmed", () => {
    rejects(toApproved("o11"), { type: "start_implementation" });
    rejects(toSetupPending("o11"), { type: "start_implementation" });
  });

  it("launch verification happens once, only after deployment", () => {
    rejects(toReview("o12"), { type: "verify_launch", ref: "x" });
    rejects(toVerifiedLive("o12"), { type: "verify_launch", ref: "x" }, /already verified/);
  });
});

describe("preview → payment lifecycle: expiry, rejection and abandonment", () => {
  it("an expired proposal cannot be accepted and can be reissued", () => {
    let p = toProposal("e1");
    const expiry = Date.parse(p.proposal!.expiresAt);
    rejects(p, { type: "expire_proposal" }, /valid until/);
    // Acceptance at/after expiry fails at the gate and in the transition.
    const late = new Date(expiry);
    assert.throws(() => clearGate("agreement_acceptance", { project: p, env: SANDBOX_ENV, now: late }), /proposal_expired/);
    const clearance = clearGate("agreement_acceptance", { project: p, env: SANDBOX_ENV, now: T0 });
    const acceptance = buildAcceptance({ packageId: "starter", acceptedAt: late, ipHash: null, userAgent: null });
    rejects(p, { type: "approve", acceptance, clearance }, /expired/, late);
    p = step(p, { type: "expire_proposal" }, late);
    assert.equal(p.state, "proposal_expired");
    p = step(p, proposalEvent(plusDays(late, 14)), late);
    assert.equal(p.state, "proposal_sent");
    assert.equal(p.proposal?.issue, 2);
  });

  it("open inquiries close with a reason from any pre-agreement state", () => {
    for (const [p, reason] of [
      [newProject("c1"), "duplicate_request"],
      [step(step(newProject("c2"), { type: "acknowledge_request" }), { type: "qualify" }), "disqualified"],
      [toPreviewSent("c3"), "prospect_declined"],
      [toProposal("c4"), "abandoned"],
    ] as const) {
      assert.ok(isPreAgreement(p.state));
      const closed = step(p, { type: "close_inquiry", reason });
      assert.equal(closed.state, "closed");
      assert.equal(closed.closedReason, reason);
      rejects(closed, { type: "acknowledge_request" });
      rejects(closed, proposalEvent());
    }
    assert.ok(CLOSE_REASONS.includes("withdrawn_by_prospect"));
  });

  it("after agreement, an inquiry cannot be closed; it is canceled before launch with refund facts recorded", () => {
    const p = toSetupPaid("c5");
    rejects(p, { type: "close_inquiry", reason: "abandoned" }, /cancel_before_launch/);
    const r = transition(p, { type: "cancel_before_launch", reason: "customer request" }, { at: T0, actor: "owner:test" });
    assert.equal(r.project.state, "canceled");
    assert.deepEqual(r.audit.detail, { reason: "customer request", setupPaid: true, implementationStarted: false });
    rejects(toPreviewSent("c6"), { type: "cancel_before_launch", reason: "x" }, /close_inquiry/);
  });

  it("transition never mutates its input and audits mode and actor", () => {
    const p = toPreviewApproved("m1");
    const snapshot = JSON.stringify(p);
    const r = transition(p, proposalEvent(), { at: T0, actor: "owner:test" });
    assert.equal(JSON.stringify(p), snapshot);
    assert.equal(r.audit.mode, "sandbox");
    assert.equal(r.audit.actor, "owner:test");
    assert.equal(r.audit.from, "preview_approved");
    assert.equal(r.audit.to, "proposal_sent");
    assert.equal(STARTER.setupPriceCents, 19_900);
    assert.equal(STARTER.monthlyPriceCents, 7_500);
  });
});

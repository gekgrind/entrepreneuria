import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAcceptance } from "./acceptance";
import { clearGate } from "./activation-gates";
import {
  activateSubscriptionAtLaunch,
  addMonthsUtc,
  BillingGuardError,
  quoteCancellation,
  requestSetupPayment,
} from "./billing";
import { isProposedFlowEnabled, resolvePaymentsMode, resolveServicesMode } from "./flags";
import { TransitionError } from "./lifecycle";
import {
  acceptanceEvent,
  EVIDENCE,
  SANDBOX_ENV,
  STARTER,
  step,
  T0,
  toApproved,
  toLive,
  toProposal,
  toReview,
  toVerifiedLive,
} from "./lifecycle.test-helper";
import { formatUsd, getPackage, getPublishableEntitlements, WEBSITE_PACKAGES } from "./packages";
import { createSandboxProvider } from "./payments/sandbox";
import { isSuspensionAllowed, paymentRecoverySchedule } from "./payment-recovery";
import { assertPublishable, isPublishable, UnapprovedPolicyError } from "./policies";
import { allReleaseGatesPassed } from "./release-gates";

describe("package registry", () => {
  it("holds the three approved prices in integer cents", () => {
    assert.deepEqual(
      WEBSITE_PACKAGES.map((p) => [p.id, p.displayName, p.setupPriceCents, p.monthlyPriceCents]),
      [
        ["starter", "Website Starter", 19_900, 7_500],
        ["growth", "Growth Website", 24_900, 14_900],
        ["business", "Business Growth System", 39_900, 24_900],
      ]
    );
    for (const p of WEBSITE_PACKAGES) {
      assert.equal(p.minimumTermMonths, 1);
      assert.equal(p.billingInterval, "month");
    }
  });

  it("formats whole-dollar prices without cents", () => {
    assert.equal(formatUsd(19_900), "$199");
    assert.equal(formatUsd(7_550), "$75.50");
  });

  it("exposes only the two approved commitments and keeps unverified features hidden", () => {
    for (const p of WEBSITE_PACKAGES) {
      assert.equal(p.entitlementsStatus, "pending_verification");
      const published = getPublishableEntitlements(p);
      assert.deepEqual(published, [
        { id: "design-build", label: "Website designed and built for you", status: "committed" },
        { id: "hosting", label: "Website hosting", status: "committed" },
      ]);
      assert.deepEqual(getPublishableEntitlements({
        ...p,
        entitlements: [...p.entitlements, { id: "unverified", label: "Unverified feature", status: "pending_verification" }],
      }), published);
    }
  });
});

describe("policy registry", () => {
  it("only approved policies are publishable", () => {
    assert.equal(isPublishable("pricing"), true);
    assert.equal(isPublishable("minimum_term"), true);
    assert.equal(isPublishable("cancellation"), false);
    assert.equal(isPublishable("setup_fee_refund"), false);
    assert.throws(() => assertPublishable("sms_consent"), UnapprovedPolicyError);
  });
});

describe("release flags", () => {
  it("defaults to off and refuses production while gates are open", () => {
    assert.equal(resolveServicesMode({}), "off");
    assert.equal(allReleaseGatesPassed(), false);
    assert.equal(resolveServicesMode({ WEBSITES_SERVICES_MODE: "production", WEBSITES_OWNER_RELEASE_AUTHORIZED: "true" }), "off");
    assert.equal(resolveServicesMode({ WEBSITES_SERVICES_MODE: "nonproduction" }), "nonproduction");
  });

  it("payments are sandbox-only and only in nonproduction", () => {
    assert.equal(resolvePaymentsMode({ WEBSITES_PAYMENTS_MODE: "sandbox" }), "disabled");
    assert.equal(resolvePaymentsMode({ WEBSITES_SERVICES_MODE: "nonproduction", WEBSITES_PAYMENTS_MODE: "live" }), "disabled");
    assert.equal(resolvePaymentsMode({ WEBSITES_SERVICES_MODE: "nonproduction", WEBSITES_PAYMENTS_MODE: "sandbox" }), "sandbox");
  });

  it("proposed policy flows need nonproduction + explicit opt-in", () => {
    const env = { WEBSITES_SERVICES_MODE: "nonproduction", WEBSITES_PROPOSED_POLICY_FLOWS: "cancellation" };
    assert.equal(isProposedFlowEnabled("cancellation", env), true);
    assert.equal(isProposedFlowEnabled("setup_fee_refund", env), false);
    assert.equal(isProposedFlowEnabled("cancellation", { WEBSITES_PROPOSED_POLICY_FLOWS: "cancellation" }), false);
  });
});

describe("project lifecycle", () => {
  it("runs the full happy path with separate approval, payment, launch-approval and deployment events", () => {
    let p = toReview();
    p = step(p, { type: "approve_launch", evidence: EVIDENCE }, "2026-12-01T10:00:00.000Z");
    assert.equal(p.launchedAt, null);
    p = step(p, { type: "deployment_succeeded", deploymentRef: "dep_1" }, "2026-12-02T09:00:00.000Z");
    assert.equal(p.state, "live");
    assert.equal(p.launchApprovedAt, "2026-12-01T10:00:00.000Z");
    assert.equal(p.launchedAt, "2026-12-02T09:00:00.000Z");
  });

  it("cannot go live without customer launch approval", () => {
    const p = toReview();
    assert.throws(() => step(p, { type: "deployment_succeeded", deploymentRef: "d" }), TransitionError);
  });

  it("rejects approval against stale policy versions", () => {
    let p = toProposal("p2");
    const clearance = clearGate("agreement_acceptance", { project: p, env: SANDBOX_ENV, now: T0 });
    const stale = buildAcceptance({ packageId: "starter", acceptedAt: T0, ipHash: null, userAgent: null });
    stale.policyVersions.cancellation = "old";
    assert.throws(() => step(p, { type: "approve", acceptance: stale, clearance }), /policy\/pricing versions/);
    const wrongPkg = buildAcceptance({ packageId: "business", acceptedAt: T0, ipHash: null, userAgent: null });
    assert.throws(() => step(p, { type: "approve", acceptance: wrongPkg, clearance }), /different package/);
    p = step(p, acceptanceEvent(p));
    assert.equal(p.state, "approved");
  });

  it("customer delay pauses and resumes to the prior state", () => {
    let p = toReview();
    p = step(p, { type: "flag_customer_delay", reason: "awaiting logo" });
    assert.equal(p.state, "customer_delay");
    p = step(p, { type: "resolve_customer_delay" });
    assert.equal(p.state, "customer_review");
  });

  it("launch failure can be retried", () => {
    let p = step(toReview(), { type: "approve_launch", evidence: EVIDENCE });
    p = step(p, { type: "deployment_failed", reason: "dns" });
    assert.equal(p.state, "launch_failed");
    p = step(p, { type: "deployment_succeeded", deploymentRef: "d2" });
    assert.equal(p.state, "live");
  });

  it("cancellation cannot complete before its effective date", () => {
    let p = toLive();
    p = step(p, { type: "request_cancellation", effectiveAt: "2027-01-06T15:00:00.000Z" });
    assert.throws(() => step(p, { type: "cancellation_effective" }, "2027-01-01T00:00:00.000Z"), /not reached/);
    p = step(p, { type: "cancellation_effective" }, "2027-01-06T15:00:00.000Z");
    assert.equal(p.state, "canceled");
  });
});

describe("billing", () => {
  it("adds calendar months with end-of-month clamping", () => {
    assert.equal(addMonthsUtc(new Date("2026-01-31T12:00:00Z"), 1).toISOString(), "2026-02-28T12:00:00.000Z");
    assert.equal(addMonthsUtc(new Date("2028-01-31T00:00:00Z"), 1).toISOString(), "2028-02-29T00:00:00.000Z");
    assert.equal(addMonthsUtc(new Date("2026-11-15T00:00:00Z"), 2).toISOString(), "2027-01-15T00:00:00.000Z");
  });

  it("requests the accepted setup fee once per attempt, idempotently, with no payment link", async () => {
    const provider = createSandboxProvider({ webhookSecret: "s", now: () => T0 });
    const proposal = toProposal("b1");
    // No clearance can be issued before acceptance.
    assert.throws(() => clearGate("setup_payment", { project: proposal, env: SANDBOX_ENV, now: T0 }), /agreement_acceptance_missing/);
    const p = toApproved("b1");
    const clearance = clearGate("setup_payment", { project: p, env: SANDBOX_ENV, now: T0 });
    const a = await requestSetupPayment(p, provider, "c1", clearance);
    const b = await requestSetupPayment(p, provider, "c1", clearance);
    assert.equal(a.amountCents, 19_900);
    assert.equal(a.amountCents, getPackage("starter").setupPriceCents);
    assert.equal(a.hostedUrl, null);
    assert.equal(a.id, b.id);
    assert.equal(provider.requests.size, 1);
    assert.equal(provider.charges.size, 0);
  });

  it("a failed setup payment can be retried with a new request", async () => {
    const failing = new Set(["c2"]);
    const provider = createSandboxProvider({ webhookSecret: "s", failingCustomers: failing });
    let p = toApproved("b2");
    const c1 = clearGate("setup_payment", { project: p, env: SANDBOX_ENV, now: T0 });
    const r1 = await requestSetupPayment(p, provider, "c2", c1);
    p = step(p, { type: "request_setup_payment", requestId: r1.id, amountCents: r1.amountCents, clearance: c1 });
    const first = provider.simulateSetupPayment(r1.id);
    assert.equal(first.charge.status, "failed");
    p = step(p, { type: "setup_payment_failed", requestId: r1.id, reason: "card_declined" });
    failing.clear();
    const c2 = clearGate("setup_payment", { project: p, env: SANDBOX_ENV, now: T0 });
    const r2 = await requestSetupPayment(p, provider, "c2", c2);
    assert.notEqual(r2.id, r1.id);
    p = step(p, { type: "request_setup_payment", requestId: r2.id, amountCents: r2.amountCents, clearance: c2 });
    const second = provider.simulateSetupPayment(r2.id);
    assert.equal(second.charge.status, "succeeded");
    // A confirmation for the stale first request is refused.
    assert.throws(
      () => step(p, { type: "setup_payment_succeeded", requestId: r1.id, chargeId: second.charge.id, amountCents: 19_900 }),
      /different payment request/
    );
    p = step(p, { type: "setup_payment_succeeded", requestId: r2.id, chargeId: second.charge.id, amountCents: second.charge.amountCents });
    assert.equal(p.state, "setup_paid");
    assert.equal(p.setupPaymentAttempts, 2);
  });

  it("refuses recurring billing in every pre-launch state", async () => {
    const provider = createSandboxProvider({ webhookSecret: "s", now: () => new Date("2027-01-01T00:00:00Z") });
    const review = toReview("b3");
    for (const p of [review, step(review, { type: "approve_launch", evidence: EVIDENCE })]) {
      assert.throws(() => clearGate("subscription", { project: p, env: SANDBOX_ENV, now: T0 }), /state:/);
    }
    // Even a clearance obtained for the live project cannot be used on a pre-launch copy.
    const clearance = clearGate("subscription", { project: toVerifiedLive("b3"), env: SANDBOX_ENV, now: T0 });
    await assert.rejects(activateSubscriptionAtLaunch(review, provider, "c3", clearance), /cannot start before launch/);
    assert.equal(provider.subscriptions.size, 0);
  });

  it("anchors the subscription to the launch timestamp and never creates two", async () => {
    const provider = createSandboxProvider({ webhookSecret: "s", now: () => new Date("2027-01-01T00:00:00Z") });
    let p = toVerifiedLive("b4", "2026-12-31T08:00:00.000Z");
    const clearance = clearGate("subscription", { project: p, env: SANDBOX_ENV, now: T0 });
    const sub = await activateSubscriptionAtLaunch(p, provider, "c4", clearance);
    assert.equal(sub.anchorAt.toISOString(), "2026-12-31T08:00:00.000Z");
    assert.equal(sub.currentPeriodEnd.toISOString(), "2027-01-31T08:00:00.000Z");
    assert.equal(sub.amountCents, STARTER.monthlyPriceCents);
    assert.equal(sub.amountCents, 7_500);
    await assert.rejects(activateSubscriptionAtLaunch(p, provider, "c4", clearance), /already exists/);
    p = step(p, { type: "subscription_activated", subscriptionId: sub.id, clearance });
    await assert.rejects(activateSubscriptionAtLaunch(p, provider, "c4", clearance), /already exists/);
    assert.equal(provider.subscriptions.size, 1);
  });

  it("refuses a subscription before the launch is verified", async () => {
    const provider = createSandboxProvider({ webhookSecret: "s", now: () => new Date("2027-01-01T00:00:00Z") });
    const unverified = toLive("b5");
    assert.throws(() => clearGate("subscription", { project: unverified, env: SANDBOX_ENV, now: T0 }), /launch_not_verified/);
    const clearance = clearGate("subscription", { project: toVerifiedLive("b5"), env: SANDBOX_ENV, now: T0 });
    await assert.rejects(activateSubscriptionAtLaunch(unverified, provider, "c5", clearance), BillingGuardError);
    assert.equal(provider.subscriptions.size, 0);
  });

  it("cancellation quote is gated on the proposed policy flag", () => {
    const input = {
      launchedAt: new Date("2026-12-02T09:00:00Z"),
      currentPeriodEnd: new Date("2027-01-02T09:00:00Z"),
      monthlyPriceCents: 7_500,
      minimumTermMonths: 1,
    };
    assert.throws(() => quoteCancellation(input, false), /not approved/);
    const q = quoteCancellation(input, true);
    assert.equal(q.effectiveAt, "2027-01-02T09:00:00.000Z");
    assert.equal(q.remainingChargesCents, 0);
    assert.equal(q.policyStatus, "proposed");
  });

  it("proposed recovery: three retries in seven days, seven-day grace, no suspension", () => {
    const s = paymentRecoverySchedule(new Date("2027-02-01T12:00:00Z"));
    assert.deepEqual(s.retryAt, ["2027-02-02T12:00:00.000Z", "2027-02-04T12:00:00.000Z", "2027-02-08T12:00:00.000Z"]);
    assert.equal(s.retryWindowEndsAt, "2027-02-08T12:00:00.000Z");
    assert.equal(s.graceEndsAt, "2027-02-15T12:00:00.000Z");
    assert.equal(s.policyStatus, "proposed");
    assert.equal(isSuspensionAllowed(s, new Date("2027-12-31T00:00:00Z")), false);
  });

  it("verifies sandbox webhook signatures", async () => {
    const { signSandboxWebhook } = await import("./billing");
    const provider = createSandboxProvider({ webhookSecret: "whsec" });
    const body = JSON.stringify({ id: "evt_1", type: "charge.succeeded", payload: {} });
    assert.equal(await provider.verifyWebhook(body, null), null);
    assert.equal(await provider.verifyWebhook(body, signSandboxWebhook(body, "wrong")), null);
    assert.equal((await provider.verifyWebhook(body, signSandboxWebhook(body, "whsec")))?.id, "evt_1");
  });
});

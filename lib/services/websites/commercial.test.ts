import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAcceptance } from "./acceptance";
import {
  activateSubscriptionAtLaunch,
  addMonthsUtc,
  BillingGuardError,
  chargeSetupFee,
  quoteCancellation,
} from "./billing";
import { isProposedFlowEnabled, resolvePaymentsMode, resolveServicesMode } from "./flags";
import { newProject, transition, TransitionError, type ProjectEvent, type WebsiteProject } from "./lifecycle";
import { formatUsd, getPackage, getPublishableEntitlements, WEBSITE_PACKAGES } from "./packages";
import { createSandboxProvider } from "./payments/sandbox";
import { isSuspensionAllowed, paymentRecoverySchedule } from "./payment-recovery";
import { assertPublishable, isPublishable, UnapprovedPolicyError } from "./policies";
import { allReleaseGatesPassed } from "./release-gates";

const T0 = new Date("2026-11-06T15:00:00.000Z");
const at = (iso: string) => ({ at: new Date(iso), actor: "test" });

function step(p: WebsiteProject, e: ProjectEvent, iso = T0.toISOString()) {
  return transition(p, e, at(iso)).project;
}

function toReview(id = "p1", pkg: "starter" | "growth" | "business" = "growth") {
  let p = newProject(id);
  p = step(p, { type: "send_proposal", packageId: pkg });
  p = step(p, { type: "approve", acceptance: buildAcceptance({ packageId: pkg, acceptedAt: T0, ipHash: null, userAgent: null }) });
  p = step(p, { type: "setup_payment_succeeded", chargeId: "ch_1" });
  p = step(p, { type: "start_implementation" });
  return step(p, { type: "submit_for_review" });
}

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

  it("exposes no entitlements until verified", () => {
    for (const p of WEBSITE_PACKAGES) {
      assert.equal(p.entitlementsStatus, "pending_verification");
      assert.deepEqual(getPublishableEntitlements(p), []);
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
    p = step(p, { type: "approve_launch" }, "2026-12-01T10:00:00.000Z");
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
    let p = step(newProject("p2"), { type: "send_proposal", packageId: "starter" });
    const stale = buildAcceptance({ packageId: "starter", acceptedAt: T0, ipHash: null, userAgent: null });
    stale.policyVersions.cancellation = "old";
    assert.throws(() => step(p, { type: "approve", acceptance: stale }), /policy\/pricing versions/);
    const wrongPkg = buildAcceptance({ packageId: "business", acceptedAt: T0, ipHash: null, userAgent: null });
    assert.throws(() => step(p, { type: "approve", acceptance: wrongPkg }), /different package/);
    p = step(p, { type: "approve", acceptance: buildAcceptance({ packageId: "starter", acceptedAt: T0, ipHash: null, userAgent: null }) });
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
    let p = step(toReview(), { type: "approve_launch" });
    p = step(p, { type: "deployment_failed", reason: "dns" });
    assert.equal(p.state, "launch_failed");
    p = step(p, { type: "deployment_succeeded", deploymentRef: "d2" });
    assert.equal(p.state, "live");
  });

  it("cancellation cannot complete before its effective date", () => {
    let p = step(step(toReview(), { type: "approve_launch" }), { type: "deployment_succeeded", deploymentRef: "d" });
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

  it("charges the accepted setup fee once, idempotently", async () => {
    const provider = createSandboxProvider({ webhookSecret: "s", now: () => T0 });
    let p = step(newProject("b1"), { type: "send_proposal", packageId: "business" });
    await assert.rejects(chargeSetupFee(p, provider, "c1"), BillingGuardError);
    p = step(p, { type: "approve", acceptance: buildAcceptance({ packageId: "business", acceptedAt: T0, ipHash: null, userAgent: null }) });
    const a = await chargeSetupFee(p, provider, "c1");
    const b = await chargeSetupFee(p, provider, "c1");
    assert.equal(a.amountCents, getPackage("business").setupPriceCents);
    assert.equal(a.id, b.id);
    assert.equal(provider.charges.size, 1);
  });

  it("a failed setup charge can be retried", async () => {
    const failing = new Set(["c2"]);
    const provider = createSandboxProvider({ webhookSecret: "s", failingCustomers: failing });
    let p = step(newProject("b2"), { type: "send_proposal", packageId: "starter" });
    p = step(p, { type: "approve", acceptance: buildAcceptance({ packageId: "starter", acceptedAt: T0, ipHash: null, userAgent: null }) });
    const first = await chargeSetupFee(p, provider, "c2");
    assert.equal(first.status, "failed");
    p = step(p, { type: "setup_payment_failed", reason: "card_declined" });
    failing.clear();
    const second = await chargeSetupFee(p, provider, "c2");
    assert.equal(second.status, "succeeded");
    p = step(p, { type: "setup_payment_succeeded", chargeId: second.id });
    assert.equal(p.state, "setup_paid");
  });

  it("refuses recurring billing in every pre-launch state", async () => {
    const provider = createSandboxProvider({ webhookSecret: "s", now: () => new Date("2027-01-01T00:00:00Z") });
    const review = toReview("b3");
    for (const p of [review, step(review, { type: "approve_launch" })]) {
      await assert.rejects(activateSubscriptionAtLaunch(p, provider, "c3"), /cannot start before launch/);
    }
    assert.equal(provider.subscriptions.size, 0);
  });

  it("anchors the subscription to the launch timestamp and never creates two", async () => {
    const provider = createSandboxProvider({ webhookSecret: "s", now: () => new Date("2027-01-01T00:00:00Z") });
    let p = step(toReview("b4"), { type: "approve_launch" });
    p = step(p, { type: "deployment_succeeded", deploymentRef: "d" }, "2026-12-31T08:00:00.000Z");
    const sub = await activateSubscriptionAtLaunch(p, provider, "c4");
    assert.equal(sub.anchorAt.toISOString(), "2026-12-31T08:00:00.000Z");
    assert.equal(sub.currentPeriodEnd.toISOString(), "2027-01-31T08:00:00.000Z");
    assert.equal(sub.amountCents, getPackage("growth").monthlyPriceCents);
    await assert.rejects(activateSubscriptionAtLaunch(p, provider, "c4"), /already exists/);
    p = step(p, { type: "subscription_activated", subscriptionId: sub.id });
    await assert.rejects(activateSubscriptionAtLaunch(p, provider, "c4"), /already exists/);
    assert.equal(provider.subscriptions.size, 1);
  });

  it("cancellation quote is gated on the proposed policy flag", () => {
    const input = {
      launchedAt: new Date("2026-12-02T09:00:00Z"),
      currentPeriodEnd: new Date("2027-01-02T09:00:00Z"),
      monthlyPriceCents: 14_900,
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

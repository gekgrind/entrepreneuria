/**
 * Regression tests for gaps found while reconciling the preview-to-payment
 * lifecycle (PR #39) with the commercial foundation. Each test failed against
 * PR #39's head before its fix. Synthetic data only; no network, no money.
 */
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { assertClearance, clearGate, CLEARANCE_TTL_MS } from "./activation-gates";
import { requestSetupPayment, signSandboxWebhook } from "./billing";
import { MAX_EVENT_SKEW_MS, applyLifecycleEvent, createMemoryLifecycleStore, type Actor, type EventEnvelope } from "./workflow";
import { newProject, transition, type ProjectEvent } from "./lifecycle";
import {
  acceptanceEvent,
  plusDays,
  SANDBOX_ENV,
  STARTER,
  step,
  T0,
  toApproved,
  toProposal,
  toVerifiedLive,
} from "./lifecycle.test-helper";
import { createSandboxProvider } from "./payments/sandbox";
import { verifyProviderCallback } from "./payments/verified-event";

const OWNER: Actor = { kind: "owner", id: "owner-synthetic" };
const CUSTOMER: Actor = { kind: "customer", id: "ghl-form" };
const PROVIDER: Actor = { kind: "provider", id: "sandbox" };
const LAUNCH = "2026-12-02T09:00:00.000Z";
const rejects = (fn: () => unknown, re: RegExp) => assert.throws(fn, re);

describe("hardening: one-month minimum is enforced, not only quoted", () => {
  it("refuses a cancellation that would take effect before launch + 1 month", () => {
    const live = toVerifiedLive("m1", LAUNCH);
    rejects(() => step(live, { type: "request_cancellation", effectiveAt: "2026-12-10T00:00:00.000Z" }, "2026-12-05T00:00:00.000Z"), /minimum term/);
    rejects(() => step(live, { type: "request_cancellation", effectiveAt: "2027-01-02T08:59:59.999Z" }, "2026-12-05T00:00:00.000Z"), /minimum term/);
  });

  it("allows a cancellation effective exactly at, or after, the minimum", () => {
    const live = toVerifiedLive("m2", LAUNCH);
    const atMinimum = step(live, { type: "request_cancellation", effectiveAt: "2027-01-02T09:00:00.000Z" }, "2026-12-05T00:00:00.000Z");
    assert.equal(atMinimum.state, "cancellation_pending");
    assert.equal(atMinimum.cancellationEffectiveAt, "2027-01-02T09:00:00.000Z");
  });

  it("refuses a missing or unparseable effective date", () => {
    const live = toVerifiedLive("m3", LAUNCH);
    rejects(() => step(live, { type: "request_cancellation", effectiveAt: "" }), /effective date/);
    rejects(() => step(live, { type: "request_cancellation", effectiveAt: "soon" }), /effective date/);
  });

  it("a rejected early cancellation leaves the project live", () => {
    const live = toVerifiedLive("m4", LAUNCH);
    assert.throws(() => step(live, { type: "request_cancellation", effectiveAt: "2026-12-03T00:00:00.000Z" }));
    assert.equal(live.state, "live");
    assert.equal(live.cancellationEffectiveAt, null);
  });
});

describe("hardening: the server clock decides, not the envelope", () => {
  const serverNow = plusDays(T0, 20); // the proposal (valid 14 days from T0) has expired

  it("a backdated event time cannot accept an expired proposal", async () => {
    const p = toProposal("c1");
    const clearance = acceptanceEvent(p, T0); // issued while the proposal was still valid
    const store = createMemoryLifecycleStore([p]);
    const e: EventEnvelope = { eventId: "e-back", projectId: "c1", event: clearance, actor: CUSTOMER, at: T0 };
    const out = await applyLifecycleEvent(store, e, { now: () => serverNow });
    assert.equal(out.status, "rejected");
    assert.equal(out.status === "rejected" && out.code, "invalid_envelope");
    assert.equal((await store.load("c1"))?.project.state, "proposal_sent");
    assert.equal(store.rejections.length, 1);
  });

  it("a future-dated event is rejected too", async () => {
    const p = toProposal("c2");
    const store = createMemoryLifecycleStore([p]);
    const out = await applyLifecycleEvent(store, { eventId: "e-fut", projectId: "c2", event: { type: "close_inquiry", reason: "abandoned" }, actor: OWNER, at: plusDays(T0, 30) }, { now: () => T0 });
    assert.equal(out.status === "rejected" && out.code, "invalid_envelope");
  });

  it("an event inside the tolerance is applied", async () => {
    const p = toProposal("c3");
    const store = createMemoryLifecycleStore([p]);
    const at = new Date(T0.getTime() - MAX_EVENT_SKEW_MS + 1000);
    const out = await applyLifecycleEvent(store, { eventId: "e-ok", projectId: "c3", event: { type: "close_inquiry", reason: "abandoned" }, actor: OWNER, at }, { now: () => T0 });
    assert.equal(out.status, "applied");
  });

  it("with no injected clock the real clock is used", async () => {
    // T0 is a fixed past or future date, so it is never within the tolerance of the real clock.
    const store = createMemoryLifecycleStore([toProposal("c4")]);
    const out = await applyLifecycleEvent(store, { eventId: "e-real", projectId: "c4", event: { type: "close_inquiry", reason: "abandoned" }, actor: OWNER, at: T0 });
    assert.equal(out.status === "rejected" && out.code, "invalid_envelope");
  });

  it("rejection rows are size-capped", async () => {
    const store = createMemoryLifecycleStore();
    await applyLifecycleEvent(store, { eventId: "x".repeat(50_000), projectId: "y".repeat(50_000), event: { type: "qualify" }, actor: { kind: "owner", id: "z".repeat(50_000) }, at: T0 }, { now: () => T0 });
    const r = store.rejections[0];
    assert.ok(r.eventId.length <= 200 && r.projectId.length <= 200 && r.actor.length <= 200 && r.reason.length <= 300);
  });
});

describe("hardening: gate clearances are short-lived", () => {
  it("a clearance expires after the TTL", () => {
    const p = toProposal("g1");
    const clearance = clearGate("agreement_acceptance", { project: p, env: SANDBOX_ENV, now: T0 });
    const expected = { gate: "agreement_acceptance", projectId: "g1", mode: "sandbox" } as const;
    assert.doesNotThrow(() => assertClearance(clearance, expected));
    assert.throws(() => assertClearance(clearance, expected, Date.now() + CLEARANCE_TTL_MS + 1000), /clearance expired/);
  });

  it("transition() refuses a stale clearance even if the gate was open when issued", () => {
    const p = toProposal("g2");
    const event = acceptanceEvent(p);
    mock.timers.enable({ apis: ["Date"], now: Date.now() });
    try {
      mock.timers.tick(CLEARANCE_TTL_MS + 1000);
      rejects(() => transition(p, event, { at: T0, actor: "customer:test" }), /clearance expired/);
    } finally {
      mock.timers.reset();
    }
    assert.doesNotThrow(() => transition(p, event, { at: T0, actor: "customer:test" }));
  });

  it("the billing guard refuses a stale clearance before asking the provider for a payment request", async () => {
    const approved = toApproved("g3");
    const provider = createSandboxProvider({ webhookSecret: "s" });
    const clearance = clearGate("setup_payment", { project: approved, env: SANDBOX_ENV, now: T0 });
    mock.timers.enable({ apis: ["Date"], now: Date.now() });
    try {
      mock.timers.tick(CLEARANCE_TTL_MS + 1000);
      await assert.rejects(requestSetupPayment(approved, provider, "cust-synthetic", clearance), /clearance expired/);
    } finally {
      mock.timers.reset();
    }
    assert.equal(provider.requests.size, 0);
  });
});

describe("hardening: subscription facts are bound to the accepted subscription", () => {
  const SECRET = "whsec-hardening";
  const signer = createSandboxProvider({ webhookSecret: SECRET });
  const verify = async (type: string, payload: Record<string, unknown>) => {
    const raw = JSON.stringify({ id: `evt-${type}-${Math.random()}`, type, payload });
    return verifyProviderCallback(signer, raw, signSandboxWebhook(raw, SECRET));
  };

  it("subscription.activated without the signed amount never verifies", async () => {
    assert.equal(await verify("subscription.activated", { projectId: "s1", subscriptionId: "sub_a" }), null);
    assert.ok(await verify("subscription.activated", { projectId: "s1", subscriptionId: "sub_a", amountCents: 7_500 }));
  });

  it("payment failed/recovered callbacks must name the subscription", async () => {
    assert.equal(await verify("subscription.payment_failed", { projectId: "s1" }), null);
    assert.equal(await verify("subscription.payment_recovered", { projectId: "s1" }), null);
  });

  it("the recorded amount must equal the accepted $75 monthly price", () => {
    const live = toVerifiedLive("s2", LAUNCH);
    const clearance = clearGate("subscription", { project: live, env: SANDBOX_ENV, now: T0 });
    const event = (amountCents: number): ProjectEvent => ({ type: "subscription_activated", subscriptionId: "sub_a", amountCents, clearance });
    rejects(() => step(live, event(100)), /accepted monthly price/);
    rejects(() => step(live, event(STARTER.monthlyPriceCents + 1)), /accepted monthly price/);
    assert.equal(step(live, event(7_500)).subscriptionId, "sub_a");
  });

  it("a payment failure cannot be recorded before, or against another, subscription", () => {
    const live = toVerifiedLive("s3", LAUNCH);
    rejects(() => step(live, { type: "subscription_payment_failed", subscriptionId: "sub_a", reason: "x" }), /no subscription recorded/);
    const clearance = clearGate("subscription", { project: live, env: SANDBOX_ENV, now: T0 });
    const active = step(live, { type: "subscription_activated", subscriptionId: "sub_a", amountCents: 7_500, clearance });
    rejects(() => step(active, { type: "subscription_payment_failed", subscriptionId: "sub_other", reason: "x" }), /different subscription/);
    const pastDue = step(active, { type: "subscription_payment_failed", subscriptionId: "sub_a", reason: "x" });
    assert.equal(pastDue.state, "past_due");
    rejects(() => step(pastDue, { type: "subscription_payment_recovered", subscriptionId: "sub_other" }), /different subscription/);
    assert.equal(step(pastDue, { type: "subscription_payment_recovered", subscriptionId: "sub_a" }).state, "live");
  });

  it("end to end: a verified activation for the wrong amount is rejected and nothing is recorded", async () => {
    const live = toVerifiedLive("s4", LAUNCH);
    const store = createMemoryLifecycleStore([live]);
    const clearance = clearGate("subscription", { project: live, env: SANDBOX_ENV, now: T0 });
    const v = await verify("subscription.activated", { projectId: "s4", subscriptionId: "sub_cheap", amountCents: 100 });
    assert.ok(v);
    const out = await applyLifecycleEvent(
      store,
      { eventId: v.providerEventId, projectId: "s4", event: { type: "subscription_activated", subscriptionId: "sub_cheap", amountCents: 100, clearance }, actor: PROVIDER, at: T0, provenance: v },
      { now: () => T0 }
    );
    assert.equal(out.status === "rejected" && out.code, "invalid_transition");
    assert.equal((await store.load("s4"))?.project.subscriptionId, null);
  });
});

describe("hardening: accepted payment facts keep their provenance, never the raw callback", () => {
  it("records the provider event id, signed fields and a digest of the body — not the body or the signature", async () => {
    const { createHash } = await import("node:crypto");
    const { toSetupPending } = await import("./lifecycle.test-helper");
    const pending = toSetupPending("pf1");
    const store = createMemoryLifecycleStore([pending]);
    const provider = createSandboxProvider({ webhookSecret: "whsec-provenance" });
    const raw = JSON.stringify({
      id: "evt-pf1",
      type: "setup_payment.succeeded",
      payload: { projectId: "pf1", requestId: pending.setupPaymentRequestId, chargeId: "ch_pf1", amountCents: 19_900 },
    });
    const signature = signSandboxWebhook(raw, "whsec-provenance");
    const v = await verifyProviderCallback(provider, raw, signature);
    assert.ok(v);
    assert.equal(v.bodySha256, createHash("sha256").update(raw).digest("hex"));
    const out = await applyLifecycleEvent(
      store,
      {
        eventId: v.providerEventId,
        projectId: "pf1",
        event: { type: "setup_payment_succeeded", requestId: pending.setupPaymentRequestId!, chargeId: "ch_pf1", amountCents: 19_900 },
        actor: PROVIDER,
        at: T0,
        provenance: v,
      },
      { now: () => T0 }
    );
    assert.equal(out.status, "applied");
    assert.equal(store.paymentFacts.length, 1);
    const fact = store.paymentFacts[0];
    assert.equal(fact.providerEventId, "evt-pf1");
    assert.equal(fact.mode, "sandbox");
    assert.deepEqual(fact.attested, { requestId: pending.setupPaymentRequestId, chargeId: "ch_pf1", amountCents: 19_900 });
    const stored = JSON.stringify({ fact, audit: store.audit, rejections: store.rejections });
    assert.ok(!stored.includes(signature), "the signature is never stored");
    assert.ok(!stored.includes("whsec-provenance"), "the signing secret is never stored");
    assert.ok(!stored.includes(raw), "the raw callback body is never stored");
    // Non-payment events carry no provider fact.
    const owner = createMemoryLifecycleStore([newProject("pf-own")]);
    await applyLifecycleEvent(owner, { eventId: "o1", projectId: "pf-own", event: { type: "acknowledge_request" }, actor: OWNER, at: T0 }, { now: () => T0 });
    assert.equal(owner.paymentFacts.length, 0);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clearGate } from "./activation-gates";
import { activateSubscriptionAtLaunch, requestSetupPayment, signSandboxWebhook } from "./billing";
import { newProject, type ProjectEvent, type WebsiteProject } from "./lifecycle";
import {
  EVIDENCE,
  proposalEvent,
  SANDBOX_ENV,
  setupRequestEvent,
  STARTER,
  T0,
  toApproved,
  toLive,
  toPreviewSent,
  toSetupPending,
  toVerifiedLive,
} from "./lifecycle.test-helper";
import { createSandboxProvider } from "./payments/sandbox";
import { PROVIDER_ATTESTED_EVENTS, verifyProviderCallback, type VerifiedProviderEvent } from "./payments/verified-event";
import {
  ACTOR_RULES,
  applyLifecycleEvent as applyWithServerClock,
  createMemoryLifecycleStore,
  LifecycleConcurrencyError,
  type Actor,
  type EventEnvelope,
} from "./workflow";

/**
 * These fixtures use fixed synthetic dates, so the server clock is pinned to each
 * event's own time. The skew guard itself is tested in hardening.test.ts.
 */
const applyLifecycleEvent: typeof applyWithServerClock = (store, e, o = {}) =>
  applyWithServerClock(store, e, { now: () => (e.at instanceof Date ? e.at : new Date()), ...o });

const OWNER: Actor = { kind: "owner", id: "owner-synthetic" };
const PROVIDER: Actor = { kind: "provider", id: "sandbox" };
const CUSTOMER: Actor = { kind: "customer", id: "ghl-form" };

let seq = 0;
function env(projectId: string, event: ProjectEvent, actor: Actor = OWNER, eventId = `evt-${++seq}`, at = T0): EventEnvelope {
  return { eventId, projectId, event, actor, at };
}

/** A sandbox provider and a correctly signed callback, verified the only supported way. */
const SECRET = "whsec-synthetic";
const signer = createSandboxProvider({ webhookSecret: SECRET });
async function callback(id: string, type: string, payload: Record<string, unknown>, provider = signer, secret = SECRET) {
  const raw = JSON.stringify({ id, type, payload });
  const verified = await verifyProviderCallback(provider, raw, signSandboxWebhook(raw, secret));
  assert.ok(verified, `callback ${id} should verify`);
  return verified;
}
function providerEnv(projectId: string, event: ProjectEvent, provenance: VerifiedProviderEvent, at = T0): EventEnvelope {
  return { eventId: provenance.providerEventId, projectId, event, actor: PROVIDER, at, provenance };
}
const PAID = { type: "setup_payment_succeeded", requestId: "preq_synthetic_1", chargeId: "ch_a", amountCents: 19_900 } as const;
const paidPayload = (projectId: string, over: Record<string, unknown> = {}) => ({
  projectId,
  requestId: PAID.requestId,
  chargeId: PAID.chargeId,
  amountCents: PAID.amountCents,
  ...over,
});

function storeWith(p: WebsiteProject) {
  return createMemoryLifecycleStore([p]);
}

describe("workflow: idempotent event processing", () => {
  it("replaying an event id is a no-op that returns the current project", async () => {
    const store = storeWith(newProject("w1"));
    const e = env("w1", { type: "acknowledge_request" }, OWNER, "ack-1");
    const first = await applyLifecycleEvent(store, e);
    assert.equal(first.status, "applied");
    const again = await applyLifecycleEvent(store, e);
    assert.deepEqual(again.status === "duplicate" && again.reason, "event_id_replayed");
    assert.equal(store.audit.length, 1);
  });

  it("emits communication intents (never sends) and the CRM stage with each applied event", async () => {
    const store = storeWith(newProject("w2"));
    const out = await applyLifecycleEvent(store, env("w2", { type: "acknowledge_request" }));
    assert.equal(out.status, "applied");
    if (out.status !== "applied") return;
    assert.deepEqual(out.intents.map((i) => [i.templateId, i.delivery]), [["request_acknowledgment", "not_sent"]]);
    assert.deepEqual(out.crmStage, { stage: "qualifying", status: "open" });
    assert.equal(store.intents.length, 1);
  });

  it("duplicate preview approval under a new id is a no-op; a different revision is rejected", async () => {
    const store = storeWith(toPreviewSent("w3"));
    const approve: ProjectEvent = { type: "approve_preview", revision: 1, evidence: EVIDENCE };
    assert.equal((await applyLifecycleEvent(store, env("w3", approve, CUSTOMER))).status, "applied");
    const dup = await applyLifecycleEvent(store, env("w3", approve, OWNER));
    assert.equal(dup.status === "duplicate" && dup.reason, "already_recorded");
    const other = await applyLifecycleEvent(store, env("w3", { ...approve, revision: 2 }));
    assert.equal(other.status === "rejected" && other.code, "conflicting_duplicate");
    assert.equal(store.audit.filter((a) => a.event === "approve_preview").length, 1);
  });

  it("duplicate payment confirmation is a no-op; a second, different charge is flagged as a possible double payment", async () => {
    const store = storeWith(toSetupPending("w4"));
    const first = await callback("prov-evt-1", "setup_payment.succeeded", paidPayload("w4"));
    assert.equal((await applyLifecycleEvent(store, providerEnv("w4", PAID, first))).status, "applied");
    assert.equal((await applyLifecycleEvent(store, providerEnv("w4", PAID, first))).status, "duplicate");
    const redelivered = await callback("prov-evt-2", "setup_payment.succeeded", paidPayload("w4"));
    assert.equal((await applyLifecycleEvent(store, providerEnv("w4", PAID, redelivered))).status, "duplicate");
    const otherCharge = await callback("prov-evt-3", "setup_payment.succeeded", paidPayload("w4", { chargeId: "ch_b" }));
    const second = await applyLifecycleEvent(store, providerEnv("w4", { ...PAID, chargeId: "ch_b" }, otherCharge));
    assert.equal(second.status === "rejected" && second.code, "possible_double_payment");
    assert.equal(store.rejections.at(-1)?.code, "possible_double_payment");
    // A late failure for the paid request changes nothing.
    const lateFailure = await callback("prov-evt-4", "setup_payment.failed", { projectId: "w4", requestId: PAID.requestId, reason: "x" });
    const late = await applyLifecycleEvent(store, providerEnv("w4", { type: "setup_payment_failed", requestId: PAID.requestId, reason: "x" }, lateFailure));
    assert.equal(late.status, "duplicate");
    const stored = await store.load("w4");
    assert.equal(stored?.project.setupChargeId, "ch_a");
    assert.equal(stored?.project.state, "setup_paid");
  });

  it("duplicate launch events do not move the launch date", async () => {
    const live = toLive("w5", "2026-12-02T09:00:00.000Z");
    const store = storeWith(live);
    const again = await applyLifecycleEvent(store, env("w5", { type: "deployment_succeeded", deploymentRef: "dep-2" }, OWNER, "dep-evt-2", new Date("2026-12-05T00:00:00Z")));
    assert.equal(again.status, "duplicate");
    assert.equal((await store.load("w5"))?.project.launchedAt, "2026-12-02T09:00:00.000Z");
    assert.equal((await applyLifecycleEvent(store, env("w5", { type: "verify_launch", ref: "chk" }))).status, "applied");
    assert.equal((await applyLifecycleEvent(store, env("w5", { type: "verify_launch", ref: "chk-2" }))).status, "duplicate");
  });

  it("duplicate subscription activation is a no-op; a different subscription id is rejected", async () => {
    const p = toVerifiedLive("w6");
    const store = storeWith(p);
    const clearance = clearGate("subscription", { project: p, env: SANDBOX_ENV, now: T0 });
    const ev: ProjectEvent = { type: "subscription_activated", subscriptionId: "sub_a", amountCents: 7_500, clearance };
    const activated = await callback("sub-evt-1", "subscription.activated", { projectId: "w6", subscriptionId: "sub_a", amountCents: 7_500 });
    assert.equal((await applyLifecycleEvent(store, providerEnv("w6", ev, activated))).status, "applied");
    assert.equal((await applyLifecycleEvent(store, providerEnv("w6", ev, activated))).status, "duplicate");
    const otherSub = await callback("sub-evt-2", "subscription.activated", { projectId: "w6", subscriptionId: "sub_b", amountCents: 7_500 });
    const other = await applyLifecycleEvent(store, providerEnv("w6", { ...ev, subscriptionId: "sub_b" }, otherSub));
    assert.equal(other.status === "rejected" && other.code, "conflicting_duplicate");
  });
});

describe("workflow: safe handling of bad, missing and out-of-order events", () => {
  it("rejects and records events for unknown projects and malformed envelopes", async () => {
    const store = createMemoryLifecycleStore();
    const missing = await applyLifecycleEvent(store, env("nope", { type: "acknowledge_request" }));
    assert.equal(missing.status === "rejected" && missing.code, "unknown_project");
    const bad = await applyLifecycleEvent(store, { eventId: "", projectId: "x", event: { type: "qualify" }, actor: OWNER, at: T0 });
    assert.equal(bad.status === "rejected" && bad.code, "invalid_envelope");
    const badTime = await applyLifecycleEvent(store, { eventId: "e", projectId: "x", event: { type: "qualify" }, actor: OWNER, at: new Date("nope") });
    assert.equal(badTime.status === "rejected" && badTime.code, "invalid_envelope");
    const unknown = await applyLifecycleEvent(store, env("x", { type: "teleport" } as unknown as ProjectEvent));
    assert.equal(unknown.status === "rejected" && unknown.code, "invalid_envelope");
    assert.equal(store.rejections.length, 4);
  });

  it("out-of-order events are rejected without changing state", async () => {
    const store = storeWith(newProject("w7"));
    for (const e of [proposalEvent(), { type: "deployment_succeeded", deploymentRef: "d" }, { type: "start_implementation" }] as ProjectEvent[]) {
      const out = await applyLifecycleEvent(store, env("w7", e));
      assert.equal(out.status === "rejected" && out.code, "invalid_transition", e.type);
    }
    // Even a genuinely verified payment callback cannot skip the lifecycle.
    const early = await callback("w7-pay", "setup_payment.succeeded", paidPayload("w7"));
    const out = await applyLifecycleEvent(store, providerEnv("w7", PAID, early));
    assert.equal(out.status === "rejected" && out.code, "invalid_transition");
    assert.equal((await store.load("w7"))?.project.state, "preview_requested");
    assert.equal(store.audit.length, 0);
  });

  it("owner-controlled steps cannot come from a customer or provider; payments cannot come from a customer", async () => {
    const store = storeWith(newProject("w8"));
    const fromCustomer = await applyLifecycleEvent(store, env("w8", { type: "acknowledge_request" }, CUSTOMER));
    assert.equal(fromCustomer.status === "rejected" && fromCustomer.code, "actor_not_permitted");
    const paid = storeWith(toSetupPending("w9"));
    const customerPay = await applyLifecycleEvent(paid, env("w9", { type: "setup_payment_succeeded", requestId: "preq_synthetic_1", chargeId: "c", amountCents: 19_900 }, CUSTOMER));
    assert.equal(customerPay.status === "rejected" && customerPay.code, "actor_not_permitted");
    for (const ev of ["send_proposal", "request_setup_payment", "verify_launch", "start_implementation"] as const) {
      assert.deepEqual(ACTOR_RULES[ev], ["owner"], ev);
    }
    for (const ev of PROVIDER_ATTESTED_EVENTS) assert.deepEqual(ACTOR_RULES[ev], ["provider"], ev);
  });

  it("a gated event without a valid clearance is rejected and recorded", async () => {
    const p = toApproved("w10");
    const store = storeWith(p);
    const forged = { gate: "setup_payment", projectId: "w10", mode: "sandbox", clearedAt: T0.toISOString() } as const;
    const out = await applyLifecycleEvent(store, env("w10", { type: "request_setup_payment", requestId: "r", amountCents: 19_900, clearance: forged }));
    assert.equal(out.status === "rejected" && out.code, "invalid_transition");
    assert.match(store.rejections[0].reason, /not issued by the gate/);
  });
});

describe("workflow: retry and failure handling", () => {
  it("a failed commit changes nothing, and retrying the same event id applies it exactly once", async () => {
    const store = storeWith(newProject("r1"));
    store.failNextCommits(1);
    const e = env("r1", { type: "acknowledge_request" }, OWNER, "retry-1");
    await assert.rejects(applyLifecycleEvent(store, e), /simulated store failure/);
    assert.equal((await store.load("r1"))?.project.state, "preview_requested");
    assert.equal((await applyLifecycleEvent(store, e)).status, "applied");
    assert.equal((await applyLifecycleEvent(store, e)).status, "duplicate");
    assert.equal(store.audit.length, 1);
  });

  it("re-evaluates after a concurrent write and gives up after bounded attempts", async () => {
    const store = storeWith(newProject("r2"));
    const realCommit = store.commit;
    let conflicts = 1;
    store.commit = async (input) => {
      if (conflicts-- > 0) store.bumpVersion("r2");
      return realCommit(input);
    };
    assert.equal((await applyLifecycleEvent(store, env("r2", { type: "acknowledge_request" }))).status, "applied");

    const always = storeWith(newProject("r3"));
    const commit3 = always.commit;
    always.commit = async (input) => {
      always.bumpVersion("r3");
      return commit3(input);
    };
    await assert.rejects(applyLifecycleEvent(always, env("r3", { type: "acknowledge_request" }), { maxAttempts: 2 }), LifecycleConcurrencyError);
    assert.equal(always.audit.length, 0);
  });

  it("sandbox end to end: hosted request, signed confirmation, retry after failure — no link, no live call", async () => {
    const failing = new Set(["cust-synthetic"]);
    const provider = createSandboxProvider({ webhookSecret: "whsec-synthetic", failingCustomers: failing, now: () => T0 });
    const p0 = toApproved("e2e");
    const store = storeWith(p0);

    const pay = async () => {
      const current = (await store.load("e2e"))!.project;
      const clearance = clearGate("setup_payment", { project: current, env: SANDBOX_ENV, now: T0 });
      const req = await requestSetupPayment(current, provider, "cust-synthetic", clearance);
      assert.equal(req.hostedUrl, null);
      const recorded = await applyLifecycleEvent(store, env("e2e", { type: "request_setup_payment", requestId: req.id, amountCents: req.amountCents, clearance }));
      assert.equal(recorded.status, "applied");
      const sim = provider.simulateSetupPayment(req.id);
      const verified = await verifyProviderCallback(provider, sim.rawBody, sim.signature);
      assert.ok(verified);
      const a = verified.attested as { requestId: string; chargeId: string; amountCents: number };
      const event: ProjectEvent =
        verified.type === "setup_payment_succeeded"
          ? { type: "setup_payment_succeeded", requestId: a.requestId, chargeId: a.chargeId, amountCents: a.amountCents }
          : { type: "setup_payment_failed", requestId: a.requestId, reason: verified.reason ?? "failed" };
      return applyLifecycleEvent(store, providerEnv("e2e", event, verified));
    };

    const failed = await pay();
    assert.equal(failed.status === "applied" && failed.project.state, "setup_payment_failed");
    failing.clear();
    const ok = await pay();
    assert.equal(ok.status === "applied" && ok.project.state, "setup_paid");
    assert.equal(ok.status === "applied" && ok.project.setupPaymentAttempts, 2);
    assert.equal(provider.subscriptions.size, 0, "no subscription exists before launch");
    assert.deepEqual(
      store.intents.map((i) => i.templateId),
      ["setup_payment_instructions", "setup_payment_instructions"]
    );
    assert.equal(STARTER.setupPriceCents, 19_900);
    // Gate B refuses a project that has not accepted the agreement.
    assert.throws(() => setupRequestEvent({ ...toApproved("e2e-other"), state: "proposal_sent" }), /state:proposal_sent/);
  });
});

describe("workflow: payment callbacks need verified provider provenance", () => {
  it("a payment fact without a verified callback is rejected, whoever claims to send it", async () => {
    const store = storeWith(toSetupPending("pv1"));
    const claimed = await applyLifecycleEvent(store, env("pv1", PAID, PROVIDER, "claimed-1"));
    assert.equal(claimed.status === "rejected" && claimed.code, "unverified_provenance");
    const byOwner = await applyLifecycleEvent(store, env("pv1", PAID, OWNER, "owner-1"));
    assert.equal(byOwner.status === "rejected" && byOwner.code, "actor_not_permitted");
    const real = await callback("pv1-real", "setup_payment.succeeded", paidPayload("pv1"));
    const forged = { ...real } as VerifiedProviderEvent;
    const copied = await applyLifecycleEvent(store, providerEnv("pv1", PAID, forged));
    assert.equal(copied.status === "rejected" && copied.code, "unverified_provenance", "a copied provenance object is not issued");
    assert.equal((await store.load("pv1"))?.project.state, "setup_payment_pending");
    assert.equal(store.audit.length, 0);
  });

  it("the event must match what the provider signed: id, project, type, request, charge and amount", async () => {
    const store = storeWith(toSetupPending("pv2"));
    const v = await callback("pv2-evt", "setup_payment.succeeded", paidPayload("pv2"));
    const cases: Array<[string, EventEnvelope]> = [
      ["different eventId", { ...providerEnv("pv2", PAID, v), eventId: "not-the-provider-id" }],
      ["different amount", providerEnv("pv2", { ...PAID, amountCents: 100 }, v)],
      ["different charge", providerEnv("pv2", { ...PAID, chargeId: "ch_other" }, v)],
      ["different request", providerEnv("pv2", { ...PAID, requestId: "preq_other" }, v)],
      ["different event type", providerEnv("pv2", { type: "setup_payment_failed", requestId: PAID.requestId, reason: "x" }, v)],
    ];
    for (const [name, envelope] of cases) {
      const out = await applyLifecycleEvent(store, envelope);
      assert.equal(out.status === "rejected" && out.code, "unverified_provenance", name);
    }
    const elsewhere = storeWith(toSetupPending("pv3"));
    const wrongProject = await applyLifecycleEvent(elsewhere, providerEnv("pv3", PAID, v));
    assert.equal(wrongProject.status === "rejected" && wrongProject.code, "unverified_provenance");
    assert.equal((await store.load("pv2"))?.project.state, "setup_payment_pending");
  });

  it("bad, unsigned, wrongly signed, unknown or malformed callbacks never verify", async () => {
    const raw = JSON.stringify({ id: "e1", type: "setup_payment.succeeded", payload: paidPayload("pv4") });
    assert.equal(await verifyProviderCallback(signer, raw, null), null);
    assert.equal(await verifyProviderCallback(signer, raw, "00"), null);
    assert.equal(await verifyProviderCallback(signer, raw, signSandboxWebhook(raw, "wrong-secret")), null);
    const tampered = raw.replace("19900", "100");
    assert.equal(await verifyProviderCallback(signer, tampered, signSandboxWebhook(raw, SECRET)), null);
    for (const [type, payload] of [
      ["charge.refunded", paidPayload("pv4")],
      ["setup_payment.succeeded", paidPayload("pv4", { amountCents: -5 })],
      ["setup_payment.succeeded", paidPayload("pv4", { chargeId: "" })],
      ["setup_payment.succeeded", { requestId: "r", chargeId: "c", amountCents: 19_900 }],
      ["subscription.activated", { projectId: "pv4" }],
    ] as const) {
      const body = JSON.stringify({ id: "e2", type, payload });
      assert.equal(await verifyProviderCallback(signer, body, signSandboxWebhook(body, SECRET)), null, `${type} ${JSON.stringify(payload)}`);
    }
  });

  it("a sandbox-verified callback cannot confirm payment on a production project", async () => {
    const store = storeWith({ ...toSetupPending("pv5"), mode: "production" });
    const v = await callback("pv5-evt", "setup_payment.succeeded", paidPayload("pv5"));
    const out = await applyLifecycleEvent(store, providerEnv("pv5", PAID, v));
    assert.equal(out.status === "rejected" && out.code, "unverified_provenance");
    assert.match(out.status === "rejected" ? out.reason : "", /sandbox provider; project mode is production/);
  });

  it("subscription: created only after verified launch, recorded only from its verified callback", async () => {
    const provider = createSandboxProvider({ webhookSecret: SECRET, now: () => new Date("2026-12-10T00:00:00Z") });
    const live = toVerifiedLive("pv6");
    const store = storeWith(live);
    const clearance = clearGate("subscription", { project: live, env: SANDBOX_ENV, now: T0 });
    const sub = await activateSubscriptionAtLaunch(live, provider, "cust-synthetic", clearance);
    assert.equal(sub.anchorAt.toISOString(), live.launchedAt);
    const sim = provider.simulateSubscriptionEvent(sub.id, "subscription.activated");
    const v = await verifyProviderCallback(provider, sim.rawBody, sim.signature);
    assert.ok(v);
    const ev: ProjectEvent = { type: "subscription_activated", subscriptionId: sub.id, amountCents: sub.amountCents, clearance };
    assert.equal((await applyLifecycleEvent(store, env("pv6", ev, PROVIDER, v.providerEventId))).status, "rejected", "no provenance");
    const ok = await applyLifecycleEvent(store, providerEnv("pv6", ev, v));
    assert.equal(ok.status === "applied" && ok.project.subscriptionId, sub.id);
    const failed = provider.simulateSubscriptionEvent(sub.id, "subscription.payment_failed");
    const vf = await verifyProviderCallback(provider, failed.rawBody, failed.signature);
    assert.ok(vf);
    const pastDue = await applyLifecycleEvent(store, providerEnv("pv6", { type: "subscription_payment_failed", subscriptionId: sub.id, reason: vf.reason ?? "failed" }, vf));
    assert.equal(pastDue.status === "applied" && pastDue.project.state, "past_due");
  });
});

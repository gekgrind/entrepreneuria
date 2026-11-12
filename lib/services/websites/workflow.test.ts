import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clearGate } from "./activation-gates";
import { requestSetupPayment } from "./billing";
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
import {
  ACTOR_RULES,
  applyLifecycleEvent,
  createMemoryLifecycleStore,
  LifecycleConcurrencyError,
  type Actor,
  type EventEnvelope,
} from "./workflow";

const OWNER: Actor = { kind: "owner", id: "owner-synthetic" };
const PROVIDER: Actor = { kind: "provider", id: "sandbox" };
const CUSTOMER: Actor = { kind: "customer", id: "ghl-form" };

let seq = 0;
function env(projectId: string, event: ProjectEvent, actor: Actor = OWNER, eventId = `evt-${++seq}`, at = T0): EventEnvelope {
  return { eventId, projectId, event, actor, at };
}

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
    const paid: ProjectEvent = { type: "setup_payment_succeeded", requestId: "preq_synthetic_1", chargeId: "ch_a", amountCents: 19_900 };
    assert.equal((await applyLifecycleEvent(store, env("w4", paid, PROVIDER, "prov-evt-1"))).status, "applied");
    assert.equal((await applyLifecycleEvent(store, env("w4", paid, PROVIDER, "prov-evt-1"))).status, "duplicate");
    assert.equal((await applyLifecycleEvent(store, env("w4", paid, PROVIDER, "prov-evt-2"))).status, "duplicate");
    const second = await applyLifecycleEvent(store, env("w4", { ...paid, chargeId: "ch_b" }, PROVIDER, "prov-evt-3"));
    assert.equal(second.status === "rejected" && second.code, "possible_double_payment");
    assert.equal(store.rejections.at(-1)?.code, "possible_double_payment");
    // A late failure for the paid request changes nothing.
    const late = await applyLifecycleEvent(store, env("w4", { type: "setup_payment_failed", requestId: "preq_synthetic_1", reason: "x" }, PROVIDER));
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
    const ev: ProjectEvent = { type: "subscription_activated", subscriptionId: "sub_a", clearance };
    assert.equal((await applyLifecycleEvent(store, env("w6", ev, PROVIDER))).status, "applied");
    assert.equal((await applyLifecycleEvent(store, env("w6", ev, PROVIDER))).status, "duplicate");
    const other = await applyLifecycleEvent(store, env("w6", { ...ev, subscriptionId: "sub_b" }, PROVIDER));
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
    for (const e of [
      proposalEvent(),
      { type: "setup_payment_succeeded", requestId: "r", chargeId: "c", amountCents: 19_900 },
      { type: "deployment_succeeded", deploymentRef: "d" },
      { type: "start_implementation" },
    ] as ProjectEvent[]) {
      const actor = e.type === "setup_payment_succeeded" ? PROVIDER : OWNER;
      const out = await applyLifecycleEvent(store, env("w7", e, actor));
      assert.equal(out.status === "rejected" && out.code, "invalid_transition", e.type);
    }
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
      const verified = await provider.verifyWebhook(sim.rawBody, sim.signature);
      assert.ok(verified);
      const payload = verified.payload as { requestId: string; chargeId: string; amountCents: number; reason?: string };
      const event: ProjectEvent =
        verified.type === "setup_payment.succeeded"
          ? { type: "setup_payment_succeeded", requestId: payload.requestId, chargeId: payload.chargeId, amountCents: payload.amountCents }
          : { type: "setup_payment_failed", requestId: payload.requestId, reason: payload.reason ?? "failed" };
      return applyLifecycleEvent(store, env("e2e", event, PROVIDER, verified.id));
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

/**
 * The whole customer journey, driven only through the idempotent workflow
 * with a sandbox provider: free preview request → … → $199 setup payment →
 * launch → owner verification → $75/month subscription. Synthetic data;
 * no network, no payment link, no money.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clearGate, GateClosedError } from "./activation-gates";
import { activateSubscriptionAtLaunch, requestSetupPayment } from "./billing";
import type { Env } from "./flags";
import { newProject, type ProjectEvent, type WebsiteProject } from "./lifecycle";
import {
  acceptanceEvent,
  EVIDENCE,
  plusDays,
  proposalEvent,
  SANDBOX_ENV,
  STARTER,
  T0,
  toApproved,
  toPreviewSent,
  toSetupPending,
} from "./lifecycle.test-helper";
import { createSandboxProvider, type SandboxProvider } from "./payments/sandbox";
import { verifyProviderCallback, type VerifiedProviderEvent } from "./payments/verified-event";
import { applyLifecycleEvent, createMemoryLifecycleStore, type Actor, type Outcome } from "./workflow";

const OWNER: Actor = { kind: "owner", id: "owner-synthetic" };
const CUSTOMER: Actor = { kind: "customer", id: "ghl-form" };
const PROVIDER: Actor = { kind: "provider", id: "sandbox" };
const SECRET = "whsec-journey";

let seq = 0;
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

function runner(store: ReturnType<typeof createMemoryLifecycleStore>) {
  return (projectId: string, event: ProjectEvent, actor: Actor, at: Date, provenance?: VerifiedProviderEvent, eventId?: string): Promise<Outcome> =>
    applyLifecycleEvent(store, { eventId: eventId ?? provenance?.providerEventId ?? `j-${++seq}`, projectId, event, actor, at, provenance }, { now: () => at });
}

async function verified(provider: SandboxProvider, sim: { rawBody: string; signature: string }) {
  const v = await verifyProviderCallback(provider, sim.rawBody, sim.signature);
  assert.ok(v, "the sandbox provider's own callback must verify");
  return v;
}

const applied = (o: Outcome) => {
  assert.equal(o.status, "applied", o.status === "rejected" ? `${o.code}: ${o.reason}` : o.status);
  return o.status === "applied" ? o.project : (undefined as never);
};

describe("journey: free preview to $75/month, every gate in order", () => {
  it("runs the eleven steps and refuses each shortcut", async () => {
    const id = "j-main";
    const provider = createSandboxProvider({ webhookSecret: SECRET, now: () => plusDays(T0, 40) });
    const store = createMemoryLifecycleStore([newProject(id)]);
    const run = runner(store);
    const state = async () => (await store.load(id))!.project;

    // 1–2. Free preview request is acknowledged and qualified.
    applied(await run(id, { type: "acknowledge_request" }, OWNER, minutes(1)));
    applied(await run(id, { type: "qualify" }, OWNER, minutes(2)));

    // No proposal and no agreement before the preview is approved.
    const early = await run(id, proposalEvent(plusDays(T0, 14)), OWNER, minutes(3));
    assert.equal(early.status === "rejected" && early.code, "invalid_transition");

    // 3. Concept created and delivered.
    applied(await run(id, { type: "start_preview" }, OWNER, minutes(4)));
    applied(await run(id, { type: "deliver_preview", format: "link", ref: "synthetic-concept-r1" }, OWNER, minutes(5)));

    // 4. Customer asks for a revision, then approves the new concept (not the old one).
    applied(await run(id, { type: "request_revision", evidence: EVIDENCE }, CUSTOMER, minutes(6)));
    applied(await run(id, { type: "deliver_preview", format: "link", ref: "synthetic-concept-r2" }, OWNER, minutes(7)));
    const stale = await run(id, { type: "approve_preview", revision: 1, evidence: EVIDENCE }, CUSTOMER, minutes(8));
    assert.equal(stale.status === "rejected" && stale.code, "invalid_transition");
    assert.equal(applied(await run(id, { type: "approve_preview", revision: 2, evidence: EVIDENCE }, CUSTOMER, minutes(9))).state, "preview_approved");

    // 5–6. Proposal only now; the customer accepts the current agreement version (Gate A).
    const proposed = applied(await run(id, proposalEvent(plusDays(T0, 14)), OWNER, minutes(10)));
    assert.equal(proposed.state, "proposal_sent");
    const accept = acceptanceEvent(proposed, minutes(11));
    const premature = await run(id, { type: "request_setup_payment", requestId: "preq_x", amountCents: 19_900, clearance: (accept as Extract<ProjectEvent, { type: "approve" }>).clearance }, OWNER, minutes(11));
    assert.equal(premature.status, "rejected", "no setup payment request before agreement acceptance");
    const accepted = applied(await run(id, accept, CUSTOMER, minutes(11)));
    assert.equal(accepted.acceptance?.setupPriceCents, 19_900);
    assert.equal(accepted.acceptance?.monthlyPriceCents, 7_500);

    // 7. $199 GHL-hosted payment request (sandbox: no link). Gate B.
    const requestClearance = clearGate("setup_payment", { project: accepted, env: SANDBOX_ENV, now: minutes(12) });
    const req = await requestSetupPayment(accepted, provider, "cust-synthetic", requestClearance);
    assert.equal(req.amountCents, 19_900);
    assert.equal(req.hostedUrl, null, "a sandbox request never carries a payment link");
    applied(await run(id, { type: "request_setup_payment", requestId: req.id, amountCents: req.amountCents, clearance: requestClearance }, OWNER, minutes(12)));

    // 8. Confirmation is recorded only from the verified callback; the same callback twice records once.
    const paid = await verified(provider, provider.simulateSetupPayment(req.id));
    const a = paid.attested as { requestId: string; chargeId: string; amountCents: number };
    const paidEvent: ProjectEvent = { type: "setup_payment_succeeded", requestId: a.requestId, chargeId: a.chargeId, amountCents: a.amountCents };
    assert.equal((await run(id, paidEvent, OWNER, minutes(13))).status, "rejected", "the owner cannot record a payment by hand");
    assert.equal(applied(await run(id, paidEvent, PROVIDER, minutes(13), paid)).state, "setup_paid");
    const replay = await run(id, paidEvent, PROVIDER, minutes(14), paid);
    assert.equal(replay.status, "duplicate");
    assert.equal(store.audit.filter((e) => e.event === "setup_payment_succeeded").length, 1);

    // 9. Build, customer launch approval, deployment.
    applied(await run(id, { type: "start_implementation" }, OWNER, minutes(20)));
    applied(await run(id, { type: "submit_for_review" }, OWNER, minutes(21)));
    applied(await run(id, { type: "approve_launch", evidence: EVIDENCE }, CUSTOMER, minutes(22)));
    const launchAt = minutes(23);
    const live = applied(await run(id, { type: "deployment_succeeded", deploymentRef: "dep_synthetic" }, OWNER, launchAt));
    assert.equal(live.state, "live");
    assert.equal(live.subscriptionId, null, "launch alone starts no subscription");

    // 10–11. Subscription is not eligible until the owner verifies the launch.
    assert.throws(() => clearGate("subscription", { project: live, env: SANDBOX_ENV, now: minutes(24) }), (e) => e instanceof GateClosedError && e.evaluation.unmet.includes("launch_not_verified"));
    applied(await run(id, { type: "verify_launch", ref: "synthetic-check" }, OWNER, minutes(25)));
    const eligible = await state();
    const subClearance = clearGate("subscription", { project: eligible, env: SANDBOX_ENV, now: minutes(26) });
    const sub = await activateSubscriptionAtLaunch(eligible, provider, "cust-synthetic", subClearance);
    assert.equal(sub.amountCents, 7_500);
    assert.equal(sub.anchorAt.toISOString(), eligible.launchedAt);
    const activated = await verified(provider, provider.simulateSubscriptionEvent(sub.id, "subscription.activated"));
    const subEvent: ProjectEvent = { type: "subscription_activated", subscriptionId: sub.id, amountCents: sub.amountCents, clearance: subClearance };
    const final = applied(await run(id, subEvent, PROVIDER, minutes(27), activated));
    assert.equal(final.subscriptionId, sub.id);
    assert.equal((await run(id, subEvent, PROVIDER, minutes(28), activated)).status, "duplicate", "subscription start is idempotent");
    await assert.rejects(activateSubscriptionAtLaunch(final, provider, "cust-synthetic", subClearance), /already exists/);
    assert.equal(provider.subscriptions.size, 1);

    // One-month minimum: no cancellation can take effect inside the first month.
    const early2 = await run(id, { type: "request_cancellation", effectiveAt: plusDays(launchAt, 5).toISOString() }, OWNER, minutes(30));
    assert.equal(early2.status === "rejected" && early2.code, "invalid_transition");
    assert.equal((await state()).state, "live");

    // Customer messages are intents only, never sends.
    assert.ok(store.intents.length > 0);
    assert.ok(store.intents.every((i) => (i as { delivery?: string }).delivery === undefined || (i as { delivery?: string }).delivery === "not_sent"));
  });
});

describe("journey: expiry, concurrency and replay", () => {
  it("an expired proposal cannot be accepted, at the gate or at the workflow", async () => {
    const id = "j-exp";
    const p = (await (async () => {
      const s = createMemoryLifecycleStore([toPreviewSent(id)]);
      const r = runner(s);
      applied(await r(id, { type: "approve_preview", revision: 1, evidence: EVIDENCE }, CUSTOMER, minutes(1)));
      return applied(await r(id, proposalEvent(plusDays(T0, 14)), OWNER, minutes(2)));
    })());
    assert.throws(() => clearGate("agreement_acceptance", { project: p, env: SANDBOX_ENV, now: plusDays(T0, 15) }), /proposal_expired/);
    const store = createMemoryLifecycleStore([p]);
    const run = runner(store);
    const accept = acceptanceEvent(p, minutes(3)); // a clearance obtained while still valid
    const late = await run(id, accept, CUSTOMER, plusDays(T0, 15));
    assert.equal(late.status === "rejected" && late.code, "invalid_transition");
    assert.equal(late.status === "rejected" && /expired/.test(late.reason), true);
    assert.equal((await store.load(id))!.project.state, "proposal_sent");
  });

  it("concurrent identical approvals record one approval", async () => {
    const id = "j-conc-1";
    const store = createMemoryLifecycleStore([toPreviewSent(id)]);
    const run = runner(store);
    const approve: ProjectEvent = { type: "approve_preview", revision: 1, evidence: EVIDENCE };
    const results = await Promise.all([run(id, approve, CUSTOMER, T0), run(id, approve, CUSTOMER, T0), run(id, approve, OWNER, T0)]);
    assert.equal(results.filter((r) => r.status === "applied").length, 1);
    assert.equal(store.audit.filter((e) => e.event === "approve_preview").length, 1);
  });

  it("concurrent conflicting charges: one is recorded, the other is held for owner review", async () => {
    const id = "j-conc-2";
    const pending = toSetupPending(id);
    const store = createMemoryLifecycleStore([pending]);
    const run = runner(store);
    const provider = createSandboxProvider({ webhookSecret: SECRET });
    const sign = async (eventId: string, chargeId: string) => {
      const raw = JSON.stringify({ id: eventId, type: "setup_payment.succeeded", payload: { projectId: id, requestId: pending.setupPaymentRequestId, chargeId, amountCents: STARTER.setupPriceCents } });
      const { signSandboxWebhook } = await import("./billing");
      const v = await verifyProviderCallback(provider, raw, signSandboxWebhook(raw, SECRET));
      assert.ok(v);
      return v;
    };
    const [va, vb] = [await sign("evt-a", "ch_a"), await sign("evt-b", "ch_b")];
    const ev = (c: string): ProjectEvent => ({ type: "setup_payment_succeeded", requestId: pending.setupPaymentRequestId!, chargeId: c, amountCents: STARTER.setupPriceCents });
    const [ra, rb] = await Promise.all([run(id, ev("ch_a"), PROVIDER, T0, va), run(id, ev("ch_b"), PROVIDER, T0, vb)]);
    assert.deepEqual([ra.status, rb.status].sort(), ["applied", "rejected"]);
    const loser = ra.status === "rejected" ? ra : rb;
    assert.equal(loser.status === "rejected" && loser.code, "possible_double_payment");
    assert.equal((await store.load(id))!.project.state, "setup_paid");
    assert.equal(store.audit.filter((e) => e.event === "setup_payment_succeeded").length, 1);
  });

  it("a verified callback for one project cannot confirm another project's payment", async () => {
    const a = toSetupPending("j-a");
    const b: WebsiteProject = { ...toSetupPending("j-b"), setupPaymentRequestId: a.setupPaymentRequestId };
    const store = createMemoryLifecycleStore([a, b]);
    const run = runner(store);
    const provider = createSandboxProvider({ webhookSecret: SECRET });
    const { signSandboxWebhook } = await import("./billing");
    const raw = JSON.stringify({ id: "evt-cross", type: "setup_payment.succeeded", payload: { projectId: "j-a", requestId: a.setupPaymentRequestId, chargeId: "ch_cross", amountCents: 19_900 } });
    const v = await verifyProviderCallback(provider, raw, signSandboxWebhook(raw, SECRET));
    assert.ok(v);
    const event: ProjectEvent = { type: "setup_payment_succeeded", requestId: a.setupPaymentRequestId!, chargeId: "ch_cross", amountCents: 19_900 };
    const onB = await run("j-b", event, PROVIDER, T0, v);
    assert.equal(onB.status === "rejected" && onB.code, "unverified_provenance");
    assert.equal((await store.load("j-b"))!.project.state, "setup_payment_pending");
    assert.equal(applied(await run("j-a", event, PROVIDER, T0, v)).state, "setup_paid");
  });
});

describe("journey: production stays closed even with every flag on", () => {
  const EVERYTHING_ON: Env = {
    WEBSITES_SERVICES_MODE: "production",
    WEBSITES_PAYMENTS_MODE: "sandbox",
    WEBSITES_OWNER_RELEASE_AUTHORIZED: "true",
    WEBSITES_AGREEMENT_ACCEPTANCE_AUTHORIZED: "true",
    WEBSITES_SETUP_PAYMENT_AUTHORIZED: "true",
    WEBSITES_SUBSCRIPTION_AUTHORIZED: "true",
    WEBSITES_CUSTOMER_MESSAGES_AUTHORIZED: "true",
    GHL_API_TOKEN: "synthetic-token",
    GHL_LOCATION_ID: "synthetic-location",
  };

  it("no gate opens for a production project, and a sandbox-mode env cannot open it either", () => {
    const prod = toApproved("j-prod");
    const production: WebsiteProject = { ...prod, mode: "production" };
    for (const gate of ["agreement_acceptance", "setup_payment", "subscription"] as const) {
      assert.throws(() => clearGate(gate, { project: production, env: EVERYTHING_ON, now: T0 }), GateClosedError, gate);
      assert.throws(() => clearGate(gate, { project: production, env: SANDBOX_ENV, now: T0 }), GateClosedError, gate);
    }
  });

  it("the sandbox provider cannot serve a production project", async () => {
    const production: WebsiteProject = { ...toApproved("j-prod2"), mode: "production" };
    const provider = createSandboxProvider({ webhookSecret: SECRET });
    assert.throws(() => clearGate("setup_payment", { project: production, env: EVERYTHING_ON, now: T0 }), GateClosedError);
    assert.equal(provider.requests.size, 0);
  });
});

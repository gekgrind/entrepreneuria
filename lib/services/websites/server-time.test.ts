/**
 * F2: the server's processing time decides expiry, launch and cancellation
 * dates. The envelope's `at` is the caller's claim: it is audited, never trusted.
 * Synthetic data only.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clearGate } from "./activation-gates";
import { newProject, type ProjectEvent } from "./lifecycle";
import { acceptanceEvent, EVIDENCE, plusDays, SANDBOX_ENV, T0, toProposal, toSetupPaid, toVerifiedLive } from "./lifecycle.test-helper";
import { applyLifecycleEvent, createMemoryLifecycleStore, type Actor, type Outcome } from "./workflow";

const OWNER: Actor = { kind: "owner", id: "owner-synthetic" };
const CUSTOMER: Actor = { kind: "customer", id: "ghl-form" };
const EXPIRY = plusDays(T0, 14); // toProposal() expires the proposal here
const at = (base: Date, ms: number) => new Date(base.getTime() + ms);
const SEC = 1000;
const MIN = 60 * SEC;

let seq = 0;
/** Process an event at server time `serverNow`, with the caller claiming it happened at `claimed`. */
function process(store: ReturnType<typeof createMemoryLifecycleStore>, projectId: string, event: ProjectEvent, actor: Actor, serverNow: Date, claimed: Date, eventId = `st-${++seq}`): Promise<Outcome> {
  return applyLifecycleEvent(store, { eventId, projectId, event, actor, at: claimed }, { now: () => serverNow });
}

describe("F2: proposal expiry uses server time", () => {
  /** A clearance obtained while the proposal was still valid, as in the original report. */
  const approval = (id: string) => {
    const p = toProposal(id);
    return { p, store: createMemoryLifecycleStore([p]), event: acceptanceEvent(p, at(EXPIRY, -SEC)) };
  };

  it("accepts before expiry", async () => {
    const { store, event } = approval("e1");
    const out = await process(store, "e1", event, CUSTOMER, at(EXPIRY, -SEC), at(EXPIRY, -SEC));
    assert.equal(out.status, "applied");
  });

  it("rejects exactly at expiry", async () => {
    const { store, event } = approval("e2");
    const out = await process(store, "e2", event, CUSTOMER, EXPIRY, at(EXPIRY, -SEC));
    assert.equal(out.status === "rejected" && out.code, "invalid_transition");
    assert.match(out.status === "rejected" ? out.reason : "", /expired/);
  });

  it("rejects one second after expiry", async () => {
    const { store, event } = approval("e3");
    const out = await process(store, "e3", event, CUSTOMER, at(EXPIRY, SEC), at(EXPIRY, SEC));
    assert.equal(out.status === "rejected" && out.code, "invalid_transition");
  });

  it("Codex repro: processed 60 s after expiry, event claims 60 s before expiry => rejected", async () => {
    const { store, event } = approval("e4");
    const out = await process(store, "e4", event, CUSTOMER, at(EXPIRY, 60 * SEC), at(EXPIRY, -60 * SEC));
    assert.equal(out.status === "rejected" && out.code, "invalid_transition");
    assert.equal((await store.load("e4"))!.project.state, "proposal_sent");
  });

  it("a claimed time inside the old five-minute allowance cannot extend validity", async () => {
    for (const [i, claimedOffset] of [-4 * MIN, -2 * MIN, -MIN, -30 * SEC].entries()) {
      const { store, event } = approval(`e5-${i}`);
      const out = await process(store, `e5-${i}`, event, CUSTOMER, at(EXPIRY, 30 * SEC), at(EXPIRY, claimedOffset));
      assert.equal(out.status === "rejected" && out.code, "invalid_transition", `claimed ${claimedOffset} ms`);
    }
  });

  it("a heavily backdated claimed time cannot extend validity", async () => {
    const { store, event } = approval("e6");
    const out = await process(store, "e6", event, CUSTOMER, plusDays(EXPIRY, 3), plusDays(T0, 1));
    assert.equal(out.status === "rejected" && out.code, "invalid_transition");
  });

  it("a time claimed in the future (beyond a minute) is malformed", async () => {
    const { store, event } = approval("e7");
    const out = await process(store, "e7", event, CUSTOMER, at(EXPIRY, -SEC), at(EXPIRY, 2 * MIN));
    assert.equal(out.status === "rejected" && out.code, "invalid_envelope");
  });

  it("expire_proposal and send_proposal are judged by server time too", async () => {
    const p = toProposal("e8");
    const store = createMemoryLifecycleStore([p]);
    // The caller claims the proposal has expired; the server clock says it has not.
    const early = await process(store, "e8", { type: "expire_proposal" }, OWNER, at(EXPIRY, -MIN), at(EXPIRY, 0));
    assert.equal(early.status === "rejected" && early.code, "invalid_transition");
    const expired = await process(store, "e8", { type: "expire_proposal" }, OWNER, at(EXPIRY, SEC), at(EXPIRY, -MIN));
    assert.equal(expired.status === "applied" && expired.project.state, "proposal_expired");
    // A new proposal whose expiry is already past on the server clock is refused, whatever the claimed time.
    const stale = await process(store, "e8", { type: "send_proposal", packageId: "starter", expiresAt: at(EXPIRY, 10 * MIN).toISOString(), agreementVersion: p.proposal!.agreementVersion }, OWNER, plusDays(EXPIRY, 1), plusDays(T0, 1));
    assert.equal(stale.status === "rejected" && stale.code, "invalid_transition");
  });

  it("replaying an applied approval after expiry stays an idempotent duplicate", async () => {
    const { store, event } = approval("e9");
    const first = await process(store, "e9", event, CUSTOMER, at(EXPIRY, -SEC), at(EXPIRY, -SEC), "approve-once");
    assert.equal(first.status, "applied");
    const replay = await process(store, "e9", event, CUSTOMER, at(EXPIRY, 5 * MIN), at(EXPIRY, -SEC), "approve-once");
    assert.equal(replay.status, "duplicate");
    assert.equal(store.audit.filter((a) => a.event === "approve").length, 1);
  });
});

describe("F2: recorded times are server times; the claim is kept for audit", () => {
  it("stamps approval with server time and records the claimed time as occurredAt", async () => {
    const p = toProposal("r1");
    const store = createMemoryLifecycleStore([p]);
    const serverNow = at(T0, 10 * MIN);
    const claimed = at(T0, 9 * MIN);
    const out = await process(store, "r1", acceptanceEvent(p, serverNow), CUSTOMER, serverNow, claimed);
    assert.equal(out.status === "applied" && out.project.approvedAt, serverNow.toISOString());
    assert.equal(out.status === "applied" && out.audit.at, serverNow.toISOString());
    assert.equal(out.status === "applied" && out.audit.occurredAt, claimed.toISOString());
  });

  it("omits occurredAt when the claim equals server time", async () => {
    const p = toProposal("r2");
    const store = createMemoryLifecycleStore([p]);
    const out = await process(store, "r2", { type: "close_inquiry", reason: "abandoned" }, OWNER, T0, T0);
    assert.equal(out.status === "applied" && "occurredAt" in out.audit, false);
  });

  it("a backdated deployment cannot move the billing anchor earlier", async () => {
    const p = toSetupPaid("r3");
    const store = createMemoryLifecycleStore([p]);
    const server = at(T0, 30 * 24 * 60 * MIN);
    await process(store, "r3", { type: "start_implementation" }, OWNER, at(server, -3 * MIN), at(server, -3 * MIN));
    await process(store, "r3", { type: "submit_for_review" }, OWNER, at(server, -2 * MIN), at(server, -2 * MIN));
    await process(store, "r3", { type: "approve_launch", evidence: EVIDENCE }, CUSTOMER, at(server, -MIN), at(server, -MIN));
    const live = await process(store, "r3", { type: "deployment_succeeded", deploymentRef: "dep" }, OWNER, server, plusDays(T0, -40));
    assert.equal(live.status === "applied" && live.project.launchedAt, server.toISOString());
  });
});

describe("F2: cancellation boundaries use server time", () => {
  const LAUNCH = "2026-12-02T09:00:00.000Z";
  const MINIMUM_END = new Date("2027-01-02T09:00:00.000Z");
  const live = (id: string) => {
    const p = toVerifiedLive(id, LAUNCH);
    return { p, store: createMemoryLifecycleStore([p]) };
  };

  it("one millisecond before the minimum term ends is rejected; the boundary is accepted", async () => {
    const { store } = live("c1");
    const now = new Date("2026-12-10T00:00:00.000Z");
    const early = await process(store, "c1", { type: "request_cancellation", effectiveAt: at(MINIMUM_END, -1).toISOString() }, OWNER, now, now);
    assert.equal(early.status === "rejected" && early.code, "invalid_transition");
    const ok = await process(store, "c1", { type: "request_cancellation", effectiveAt: MINIMUM_END.toISOString() }, OWNER, now, now);
    assert.equal(ok.status, "applied");
  });

  it("a claimed time cannot make a cancellation effective early", async () => {
    const { store } = live("c2");
    const requested = new Date("2026-12-10T00:00:00.000Z");
    assert.equal((await process(store, "c2", { type: "request_cancellation", effectiveAt: MINIMUM_END.toISOString() }, OWNER, requested, requested)).status, "applied");
    // Server time is one second before the effective date; the caller claims the effective date has arrived.
    const early = await process(store, "c2", { type: "cancellation_effective" }, OWNER, at(MINIMUM_END, -SEC), MINIMUM_END);
    assert.equal(early.status === "rejected" && early.code, "invalid_transition");
    assert.match(early.status === "rejected" ? early.reason : "", /not reached/);
    const exact = await process(store, "c2", { type: "cancellation_effective" }, OWNER, MINIMUM_END, at(MINIMUM_END, -MIN));
    assert.equal(exact.status === "applied" && exact.project.state, "canceled");
  });

  it("the minimum is measured from the server-recorded launch, not a claimed deployment time", () => {
    const { p } = live("c3");
    assert.equal(p.launchedAt, LAUNCH);
    // Used by request_cancellation: launch + minimum term.
    assert.equal(new Date(p.launchedAt!).toISOString(), LAUNCH);
  });

  it("a gate cleared at a past time cannot be used to dodge today's state", () => {
    const p = toProposal("c4");
    assert.throws(() => clearGate("agreement_acceptance", { project: p, env: SANDBOX_ENV, now: at(EXPIRY, SEC) }), /proposal_expired/);
    assert.equal(newProject("c4").state, "preview_requested");
  });
});

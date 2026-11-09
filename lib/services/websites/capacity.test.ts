import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAdmission } from "./capacity";

function rig(over: { intake?: "open" | "paused"; maxOpen?: number; open?: number; fail?: boolean } = {}) {
  let t = 1_000_000;
  const state = { open: over.open ?? 0, fail: over.fail ?? false, calls: 0, unavailable: 0 };
  const admit = createAdmission({
    intake: over.intake ?? "open",
    maxOpen: over.maxOpen ?? 5,
    now: () => t,
    cacheMs: 30_000,
    count: async () => {
      state.calls += 1;
      if (state.fail) throw new Error("ghl down");
      return state.open;
    },
    onCountUnavailable: () => (state.unavailable += 1),
  });
  return { admit, state, advance: (ms: number) => (t += ms) };
}

describe("capacity admission", () => {
  it("paused refuses without calling GHL", async () => {
    const r = rig({ intake: "paused", open: 0 });
    assert.deepEqual(await r.admit(), { allowed: false, reason: "paused" });
    assert.equal(r.state.calls, 0);
  });

  it("admits below the limit and refuses at the limit (the sixth request at five)", async () => {
    const below = rig({ open: 4, maxOpen: 5 });
    assert.deepEqual(await below.admit(), { allowed: true });
    const at = rig({ open: 5, maxOpen: 5 });
    assert.deepEqual(await at.admit(), { allowed: false, reason: "full" });
    const above = rig({ open: 9, maxOpen: 5 });
    assert.deepEqual(await above.admit(), { allowed: false, reason: "full" });
  });

  it("counts accepted requests optimistically so a burst cannot far exceed the limit", async () => {
    const r = rig({ open: 3, maxOpen: 5 });
    assert.equal((await r.admit()).allowed, true);
    assert.equal((await r.admit()).allowed, true);
    assert.deepEqual(await r.admit(), { allowed: false, reason: "full" });
    assert.equal(r.state.calls, 1);
  });

  it("caches the count briefly, then refreshes and resets the optimistic tally", async () => {
    const r = rig({ open: 5, maxOpen: 5 });
    assert.equal((await r.admit()).allowed, false);
    r.state.open = 2; // the owner worked through the queue
    assert.equal((await r.admit()).allowed, false); // still cached
    assert.equal(r.state.calls, 1);
    r.advance(31_000);
    assert.equal((await r.admit()).allowed, true);
    assert.equal(r.state.calls, 2);
  });

  it("accepts and alerts when the count is unavailable, then recovers", async () => {
    const r = rig({ fail: true, maxOpen: 1 });
    assert.deepEqual(await r.admit(), { allowed: true });
    assert.deepEqual(await r.admit(), { allowed: true });
    assert.equal(r.state.unavailable, 2);
    r.state.fail = false;
    r.state.open = 1;
    assert.deepEqual(await r.admit(), { allowed: false, reason: "full" });
  });

  it("treats a nonsensical count as unavailable", async () => {
    const admit = createAdmission({
      intake: "open",
      maxOpen: 1,
      count: async () => -3,
      onCountUnavailable: () => {},
    });
    assert.deepEqual(await admit(), { allowed: true });
  });
});

describe("capacity level signals (owner notified before intake is exhausted)", () => {
  function levelRig(maxOpen: number, open: number) {
    const levels: string[] = [];
    let current = open;
    const admit = createAdmission({
      intake: "open",
      maxOpen,
      now: () => 0,
      count: async () => current,
      onCountUnavailable: () => {},
      onLevel: (level, o, m) => levels.push(`${level}:${o}/${m}`),
    });
    return { admit, levels, setOpen: (n: number) => (current = n) };
  }

  it("signals nothing while well below the limit", async () => {
    const r = levelRig(5, 1);
    await r.admit(); // 2 open
    assert.deepEqual(r.levels, []);
  });

  it("signals near when one slot remains, then full when the last slot is taken", async () => {
    const r = levelRig(5, 3);
    assert.deepEqual(await r.admit(), { allowed: true }); // 4 open
    assert.deepEqual(await r.admit(), { allowed: true }); // 5 open
    assert.deepEqual(await r.admit(), { allowed: false, reason: "full" });
    assert.deepEqual(r.levels, ["near:4/5", "full:5/5", "full:5/5"]);
  });

  it("a limit of 1 goes straight to full", async () => {
    const r = levelRig(1, 0);
    await r.admit();
    assert.deepEqual(r.levels, ["full:1/1"]);
  });

  it("count unavailable never signals a level", async () => {
    const levels: string[] = [];
    const admit = createAdmission({
      intake: "open",
      maxOpen: 5,
      count: async () => {
        throw new Error("down");
      },
      onCountUnavailable: () => {},
      onLevel: (l) => levels.push(l),
    });
    assert.deepEqual(await admit(), { allowed: true });
    assert.deepEqual(levels, []);
  });
});

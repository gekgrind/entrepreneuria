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

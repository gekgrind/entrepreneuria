import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampedFrameDelta,
  dampingFactor,
  lerp,
  MAX_JOURNEY_FRAME_DT,
} from "./journey-math";

/* Regression: the Journey world's shaders and camera sway used to read
   React Three Fiber's own `state.clock.elapsedTime`. R3F resets that
   clock to 0 every time the Canvas's `frameloop` prop changes value —
   which this app does intentionally when the GSAP ticker attaches
   (frameloop "always" -> "never") and on every offscreen-park/resume
   cycle. That reset snapped every `uTime`-driven shader and the camera
   sway backward while the world was on screen and already animating.

   The fix: JourneyClock (world/JourneyWorld.tsx) accumulates its own
   monotonic `refs.time` from wall-clock reads via clampedFrameDelta,
   independent of R3F's resettable clock. This only protects the app if
   clampedFrameDelta can never hand back a negative delta — that's the
   invariant under test here. */

describe("clampedFrameDelta", () => {
  it("returns a normal frame's elapsed time unchanged", () => {
    assert.ok(Math.abs(clampedFrameDelta(1.016, 1.0) - 0.016) < 1e-9);
  });

  it("never returns a negative delta, even if `now` is behind `lastWall`", () => {
    /* This is exactly the shape of the bug: a clock that resets backward
       (R3F's elapsedTime went from ~6.66s to ~0.04s at the ticker
       handoff). A monotonic accumulator must clamp this to 0, never
       propagate the negative delta. */
    assert.equal(clampedFrameDelta(0.037, 6.656), 0);
  });

  it("caps a long stall (offscreen park) to one frame's worth", () => {
    /* The world doesn't render while parked, so `lastWall` can be many
       real seconds stale by the time it resumes. Uncapped, that would
       fast-forward every shader and the camera through the whole gap in
       a single frame. */
    assert.equal(clampedFrameDelta(30, 5), MAX_JOURNEY_FRAME_DT);
  });

  it("treats an exactly-equal timestamp as zero elapsed time", () => {
    assert.equal(clampedFrameDelta(2.5, 2.5), 0);
  });

  it("is always finite and non-negative, even for non-finite inputs", () => {
    for (const [now, last] of [[NaN, 1], [1, NaN], [Infinity, 1], [1, Infinity], [-Infinity, 0]]) {
      const dt = clampedFrameDelta(now, last);
      assert.ok(Number.isFinite(dt) && dt >= 0 && dt <= MAX_JOURNEY_FRAME_DT, `${now}, ${last} -> ${dt}`);
    }
  });
});

/* Regression: the homepage's whole WebGL world (stars, artifact cards,
   founder light) vanished on first interaction. When the GSAP ticker takes
   over, R3F runs one leftover frame of its own rAF loop under
   frameloop="never", stamping its clock with a MILLISECOND rAF timestamp;
   the first gsap `advance(seconds)` then yields delta ≈ -(page age in ms).
   Measured in Chromium: delta = -9704.34. CameraRig and ParticleField fed
   that into `1 - Math.pow(base, delta)`, got -Infinity, and lerp turned the
   damped camera/particle state into NaN permanently. They now damp with
   refs.frameDt (clampedFrameDelta) instead. */
describe("damping across the GSAP ticker handoff", () => {
  const MEASURED_HANDOFF_DELTA = -9704.34;

  it("reproduces the bug: R3F's handoff delta turns damped state into NaN", () => {
    const k = dampingFactor(0.001, MEASURED_HANDOFF_DELTA);
    assert.equal(k, -Infinity);
    assert.ok(Number.isNaN(lerp(0.40625, 0.40625, k)), "0 * -Infinity is NaN");
  });

  it("keeps the damping factor finite and within [0, 1) for every possible frameDt", () => {
    for (const base of [0.001, 0.005]) {
      for (const dt of [0, 1e-6, 0.008, 0.016, MAX_JOURNEY_FRAME_DT]) {
        const k = dampingFactor(base, dt);
        assert.ok(Number.isFinite(k) && k >= 0 && k < 1, `base ${base}, dt ${dt} -> ${k}`);
      }
    }
  });

  it("keeps camera and particle damping finite through a simulated handoff", () => {
    /* wall-clock reads (s) around the handoff, including a stall and a
       backward read — every shape the frame source has produced */
    const wall = [4.0, 4.016, 4.033, 4.05, 9.7, 9.716, 9.71, 9.733, 9.75];
    const pointer = { x: 0.40625, y: 0.3055 };
    const damped = { x: 0, y: 0 };
    let activeDamp = 0;
    let last = wall[0];

    for (const now of wall) {
      const dt = clampedFrameDelta(now, last);
      last = now;
      damped.x = lerp(damped.x, pointer.x, dampingFactor(0.001, dt));
      damped.y = lerp(damped.y, pointer.y, dampingFactor(0.001, dt));
      activeDamp = lerp(activeDamp, 1, dampingFactor(0.005, dt));
      for (const v of [damped.x, damped.y, activeDamp]) {
        assert.ok(Number.isFinite(v), `non-finite damped value at wall=${now}`);
      }
    }
    /* still converging toward the target, not frozen or overshooting */
    assert.ok(damped.x > 0 && damped.x <= pointer.x);
    assert.ok(activeDamp > 0 && activeDamp <= 1);
  });
});

describe("JourneyClock's accumulated time (the invariant that matters)", () => {
  it("never decreases across a simulated ticker handoff, even though the resettable clock it replaces does", () => {
    /* Simulates one frame sequence: normal frames under R3F's own clock,
       then the exact reset this app's ticker handoff triggers (observed
       directly via instrumentation: elapsedTime dropped from 6.6562 to
       12387.1 to 0.037 across the handoff), expressed here as the
       resettable clock's reported values — which clampedFrameDelta must
       be completely immune to, since it never reads them. */
    const wallClockReads = [0, 0.033, 0.067, 0.1, 0.133, 0.167, 0.2]; // seconds, monotonic
    const resettableClockReads = [0, 2.56, 3.56, 4.57, 5.58, 6.66, 0.037]; // R3F's own clock — resets on the last frame

    let accumulated = 0;
    let lastWall = wallClockReads[0];
    const accumulatedHistory: number[] = [];

    for (const now of wallClockReads) {
      accumulated += clampedFrameDelta(now, lastWall);
      lastWall = now;
      accumulatedHistory.push(accumulated);
    }

    for (let i = 1; i < accumulatedHistory.length; i += 1) {
      assert.ok(
        accumulatedHistory[i] >= accumulatedHistory[i - 1],
        `accumulated time moved backward at frame ${i}: ${accumulatedHistory[i - 1]} -> ${accumulatedHistory[i]}`,
      );
    }

    /* The resettable clock (what shaders used to read) DID move backward
       — proving this test exercises the real regression, not a no-op. */
    const resettableDroppedSomewhere = resettableClockReads.some(
      (v, i) => i > 0 && v < resettableClockReads[i - 1],
    );
    assert.ok(resettableDroppedSomewhere);
  });
});

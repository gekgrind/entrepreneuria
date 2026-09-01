/**
 * proof-shapes — the particle "product frame" for the Scene 6 → 7 handoff.
 *
 * When the visitor leaves Scene 6, the Prospra brain doesn't vanish: its
 * particles loosen, stretch into directional streams, and trace the
 * perimeter of the first product frame — the intelligence visibly BECOMES
 * the product experience. This module computes those target positions,
 * once, deterministically (same seeded-PRNG convention as brain-shape).
 *
 * Output is in WORLD space (the proof frame is a screen-composition
 * element, not a brain-local one — see PROOF_FRAME in journey-math).
 * Only the brain-role subset of the master field consumes it.
 */
import { PROOF_FRAME } from "../journey-math";

/** Deterministic PRNG (mulberry32) — identical to brain-shape. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rounded-rectangle (superellipse) point, t in [0,1). */
function superellipse(t: number, hw: number, hh: number): [number, number] {
  const a = t * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const n = 0.38; /* exponent — lower = rounder corners, 1 = diamond-ish */
  return [
    Math.sign(c) * Math.pow(Math.abs(c), n) * hw,
    Math.sign(s) * Math.pow(Math.abs(s), n) * hh,
  ];
}

const cache = new Map<number, Float32Array>();

/**
 * One position per brain particle:
 *  ~68% perimeter trace (the luminous frame edge)
 *  ~17% streamers (stretched along the tangent — the "directional streams")
 *  ~15% interior haze (sparse dust the UI emerges through)
 */
export function getProofFramePositions(count: number): Float32Array {
  const hit = cache.get(count);
  if (hit) return hit;

  const rand = mulberry32(0x5eed07);
  const out = new Float32Array(count * 3);
  const [cx, cy, cz] = PROOF_FRAME.center;
  const hw = PROOF_FRAME.halfW;
  const hh = PROOF_FRAME.halfH;

  for (let i = 0; i < count; i += 1) {
    const role = rand();
    let x = 0;
    let y = 0;
    let z = 0;

    if (role < 0.68) {
      /* perimeter trace with a soft normal-direction jitter */
      const t = rand();
      const [px, py] = superellipse(t, hw, hh);
      const jit = (rand() - 0.5) * 0.09;
      const len = Math.max(Math.hypot(px / hw, py / hh), 0.001);
      x = px + (px / hw / len) * jit * hw;
      y = py + (py / hh / len) * jit * hh;
      z = (rand() - 0.5) * 0.3;
    } else if (role < 0.85) {
      /* streamers — stretched along the perimeter tangent */
      const t = rand();
      const [px, py] = superellipse(t, hw, hh);
      const [qx, qy] = superellipse(t + 0.002, hw, hh);
      const tx = qx - px;
      const ty = qy - py;
      const tl = Math.max(Math.hypot(tx, ty), 0.0001);
      const stretch = (rand() - 0.5) * 0.85;
      x = px + (tx / tl) * stretch;
      y = py + (ty / tl) * stretch;
      z = (rand() - 0.5) * 0.4 - 0.1;
    } else {
      /* interior haze — sparse, pushed slightly behind the frame plane */
      x = (rand() * 2 - 1) * hw * 0.92;
      y = (rand() * 2 - 1) * hh * 0.9;
      z = -0.15 - rand() * 0.5;
    }

    out[i * 3] = cx + x;
    out[i * 3 + 1] = cy + y;
    out[i * 3 + 2] = cz + z;
  }

  cache.set(count, out);
  return out;
}

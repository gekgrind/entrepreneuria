/**
 * brain-shape — the Prospra particle brain, generated ONCE, deterministically.
 *
 * The master particle field retargets a subset of its particles onto these
 * exact positions (aBrain attribute), and the axon line layer connects the
 * SAME points — so the glowing filaments always join real particles.
 * Deterministic (seeded PRNG) because the two consumers build at different
 * times and must agree without coordination.
 *
 * Local brain space: centered at (0,0,0), roughly ±1.4 units. The shader /
 * scene group apply getBrainTransform (journey-math) to place it right of
 * the Prospra copy.
 */

/** Deterministic PRNG (mulberry32) — shared output across consumers. */
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

const cache = new Map<number, Float32Array>();

/**
 * Point-cloud brain: two cortex-biased hemispheres split by a longitudinal
 * fissure, gentle gyri wrinkle, and a taper toward the brainstem. Elegant
 * and dimensional — a silhouette that reads as a brain made of stars.
 */
export function getBrainPositions(count: number): Float32Array {
  const hit = cache.get(count);
  if (hit) return hit;

  const rand = mulberry32(0x5eed_b1a1);
  const out = new Float32Array(count * 3);
  /* hemisphere ellipsoid radii */
  const RX = 1.12;
  const RY = 0.86;
  const RZ = 0.95;

  for (let i = 0; i < count; i += 1) {
    /* random direction on the unit sphere */
    const theta = rand() * Math.PI * 2;
    const cosPhi = rand() * 2 - 1;
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
    /* cortex bias: most particles near the surface, some interior */
    const rr = 0.5 + 0.5 * Math.pow(rand(), 0.42);

    let x = sinPhi * Math.cos(theta) * rr * RX;
    let y = cosPhi * rr * RY;
    let z = sinPhi * Math.sin(theta) * rr * RZ;

    /* longitudinal fissure — compress x toward the midline, then split */
    const side = x >= 0 ? 1 : -1;
    x = side * (Math.abs(x) * 0.52 + 0.13 + rand() * 0.045);

    /* gyri suggestion — low-frequency surface wrinkle */
    const w = 0.045;
    x += Math.sin(y * 6.1 + z * 3.7) * w;
    y += Math.sin(z * 5.3 + x * 4.1) * w;
    z += Math.sin(x * 4.7 + y * 3.9) * w;

    /* taper the lower back toward a brainstem-ish silhouette */
    if (y < -0.4 && z > 0.25) {
      const k = Math.min(1, (-y - 0.4) * 2.2) * Math.min(1, (z - 0.25) * 2.5);
      y *= 1 - k * 0.22;
      z *= 1 - k * 0.3;
      x *= 1 - k * 0.18;
    }

    /* overall scale — reads clearly at the Prospra composition depth */
    const S = 1.45;
    out[i * 3] = x * S;
    out[i * 3 + 1] = y * S;
    out[i * 3 + 2] = z * S;
  }

  cache.set(count, out);
  return out;
}

/**
 * Axon segments: pairs of brain points close enough to read as neural
 * connections. Deterministic — built from the same seeded positions.
 */
export function getBrainAxons(count: number, maxSegments: number): Float32Array {
  const pts = getBrainPositions(count);
  const rand = mulberry32(0x5eeda40);
  const segs: number[] = [];
  const LINK_DIST = 0.42;
  const LINK_DIST2 = LINK_DIST * LINK_DIST;
  const stride = Math.max(1, Math.floor(count / 900));

  for (let i = 0; i < count && segs.length / 6 < maxSegments; i += stride) {
    /* try a few random partners; keep the first close one */
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const j = Math.floor(rand() * count);
      if (j === i) continue;
      const dx = pts[i * 3] - pts[j * 3];
      const dy = pts[i * 3 + 1] - pts[j * 3 + 1];
      const dz = pts[i * 3 + 2] - pts[j * 3 + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 0.04 && d2 < LINK_DIST2) {
        segs.push(
          pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2],
          pts[j * 3], pts[j * 3 + 1], pts[j * 3 + 2],
        );
        break;
      }
    }
  }
  return new Float32Array(segs);
}

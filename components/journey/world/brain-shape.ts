/**
 * brain-shape — the Prospra particle brain, generated ONCE, deterministically.
 *
 * The master particle field retargets a subset of its particles onto these
 * exact positions (aBrain attribute), and the axon line layer connects the
 * SAME neural pathways — so the glowing filaments always join real particles.
 * Deterministic (seeded PRNG) because the consumers build at different times
 * and must agree without coordination.
 *
 * Local brain space: centered near (0,0,0), FACING +X (right), up +Y,
 * roughly ±1.5 units after SCALE. The shader / scene group apply
 * getBrainTransform (journey-math) to place it right of the Prospra copy.
 *
 * ANATOMY — a RIGHT-FACING LATERAL PROFILE of a human brain.
 *
 * The single most important design decision here: the silhouette is ONE
 * CLOSED CONTOUR sampled from hand-placed anatomical control points, not
 * a pair of y(x) envelopes. An envelope pair physically cannot express a
 * lateral brain, because the underside outline doubles back on itself at
 * the temporal pole — and that concave sylvian notch between the temporal
 * pole and the frontal lobe's orbital surface is the feature that
 * separates "brain" from "dome". The contour therefore carries, in order:
 *
 *   frontal pole (right) → dorsal sweep over the frontal/parietal vertex
 *   → occipital pole (left) → cerebellum, bulging below and behind and
 *   CONTINUOUS with the cerebrum → the notch above the medulla →
 *   brainstem (short, thick, tucked) → temporal lobe underside sweeping
 *   forward → temporal pole → SYLVIAN NOTCH → frontal orbital surface →
 *   back to the frontal pole.
 *
 * Everything else hangs off that contour:
 *   · sulci — fold curves driven INWARD along the contour normal, so the
 *     gyral striation always runs perpendicular to the surface (the way
 *     real folds read) instead of banding parallel to it
 *   · sylvian + central fissures — the two named creases a viewer reads
 *   · cerebellar folia — fine, close, differently-oriented texture
 *   · brainstem rings
 *   · neural pathways — bright internal arcs the axon lines and signal
 *     pulses reuse
 *
 * Contour brightness follows LOCAL CURVATURE, so the anatomical landmarks
 * (poles, temporal tip, sylvian notch, cerebellar curve) light themselves
 * and the long flat stretches stay quiet — a contour that is described by
 * bright landmarks rather than outlined by a uniform neon rim.
 *
 * Each point carries a structure WEIGHT (0..1) so the shader can keep the
 * anatomy legible instead of blowing out the middle.
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

type Vec2 = readonly [number, number];
type Vec3 = [number, number, number];

/* ------------------------------------------------------------------ */
/* 1 · The lateral silhouette                                          */
/* ------------------------------------------------------------------ */

/**
 * Closed lateral outline, clockwise from the frontal pole. +x anterior
 * (the brain faces right), +y dorsal. Control points are placed by
 * anatomy, not by formula — this is the one piece of the system that
 * must be authored rather than generated.
 */
const OUTLINE: readonly Vec2[] = [
  /* frontal pole, then the dorsal sweep back over the vertex */
  [1.0, 0.1],
  [0.99, 0.27],
  [0.9, 0.43],
  [0.74, 0.55],
  [0.52, 0.62],
  [0.26, 0.645],
  [0.0, 0.63],
  [-0.26, 0.575],
  [-0.5, 0.47],
  [-0.68, 0.32],
  [-0.8, 0.13],
  /* occipital pole — the rounded back of the cerebrum */
  [-0.86, -0.07],
  [-0.845, -0.2],
  /* preoccipital notch — the shallow step that reads as the tentorium,
     separating the cerebellum without detaching it */
  [-0.795, -0.265],
  /* cerebellum: continuous with the cerebrum, bulging below and behind */
  [-0.815, -0.375],
  [-0.72, -0.48],
  [-0.59, -0.55],
  [-0.45, -0.55],
  /* the notch where the cerebellum meets the medulla */
  [-0.35, -0.47],
  /* brainstem — short and thick: posterior edge, floor, anterior edge */
  [-0.315, -0.585],
  [-0.285, -0.685],
  [-0.195, -0.715],
  [-0.13, -0.63],
  [-0.08, -0.5],
  /* pons junction, then the temporal lobe underside sweeping forward */
  [-0.02, -0.43],
  [0.1, -0.465],
  [0.27, -0.5],
  [0.44, -0.505],
  [0.58, -0.465],
  /* temporal pole — the forward-pointing tip of the temporal lobe */
  [0.7, -0.385],
  [0.755, -0.29],
  [0.745, -0.2],
  [0.68, -0.145],
  /* SYLVIAN NOTCH — the concave apex the whole read depends on */
  [0.6, -0.115],
  /* frontal orbital surface, sweeping forward to close the loop */
  [0.66, -0.04],
  [0.79, -0.02],
  [0.9, 0.01],
  [0.975, 0.055],
];

/** Uniform Catmull-Rom on a closed loop. */
function crPoint(pts: readonly Vec2[], i: number, t: number): Vec2 {
  const n = pts.length;
  const p0 = pts[(i - 1 + n) % n];
  const p1 = pts[i % n];
  const p2 = pts[(i + 1) % n];
  const p3 = pts[(i + 2) % n];
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

const CONTOUR_SAMPLES = 720;

interface Contour {
  /** xy pairs, evenly spaced in curve parameter */
  pts: Float32Array;
  /** inward unit normals (pointing into the brain), xy pairs */
  nrm: Float32Array;
  /** cumulative arc length; last entry is the perimeter */
  cum: Float32Array;
  /** normalized local curvature 0..1 (drives landmark brightness) */
  curve: Float32Array;
}

let contourCache: Contour | null = null;

function buildContour(): Contour {
  if (contourCache) return contourCache;
  const n = OUTLINE.length;
  const per = Math.round(CONTOUR_SAMPLES / n);
  const total = per * n;
  const pts = new Float32Array(total * 2);
  for (let i = 0; i < n; i += 1) {
    for (let k = 0; k < per; k += 1) {
      const [x, y] = crPoint(OUTLINE, i, k / per);
      const o = (i * per + k) * 2;
      pts[o] = x;
      pts[o + 1] = y;
    }
  }

  /* signed area tells us which side is "inside" so the normal always
     points into the tissue regardless of winding order */
  let area2 = 0;
  for (let i = 0; i < total; i += 1) {
    const j = (i + 1) % total;
    area2 += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1];
  }
  const inward = area2 > 0 ? 1 : -1;

  const nrm = new Float32Array(total * 2);
  const cum = new Float32Array(total + 1);
  const curve = new Float32Array(total);
  for (let i = 0; i < total; i += 1) {
    const a = (i - 1 + total) % total;
    const b = (i + 1) % total;
    let tx = pts[b * 2] - pts[a * 2];
    let ty = pts[b * 2 + 1] - pts[a * 2 + 1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    /* rotate the tangent 90° and orient it inward */
    nrm[i * 2] = -ty * inward;
    nrm[i * 2 + 1] = tx * inward;

    const dx = pts[b * 2] - pts[i * 2];
    const dy = pts[b * 2 + 1] - pts[i * 2 + 1];
    cum[i + 1] = cum[i] + Math.hypot(dx, dy);
  }

  /* curvature: turn rate of the normal over a short window — high at the
     poles, the temporal tip and the sylvian notch, near zero along the
     long dorsal sweep */
  const W = 9;
  for (let i = 0; i < total; i += 1) {
    const a = (i - W + total) % total;
    const b = (i + W) % total;
    const dot = nrm[a * 2] * nrm[b * 2] + nrm[a * 2 + 1] * nrm[b * 2 + 1];
    curve[i] = clamp01((1 - dot) * 2.6);
  }

  contourCache = { pts, nrm, cum, curve };
  return contourCache;
}

/** Sample the contour at a normalized ARC LENGTH position (0..1). */
function contourAt(c: Contour, s: number): { i: number; x: number; y: number } {
  const total = c.curve.length;
  const target = (s - Math.floor(s)) * c.cum[total];
  let lo = 0;
  let hi = total;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (c.cum[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.min(total - 1, Math.max(0, lo - 1));
  return { i, x: c.pts[i * 2], y: c.pts[i * 2 + 1] };
}

/* ------------------------------------------------------------------ */
/* 2 · Region tests + lateral depth                                    */
/* ------------------------------------------------------------------ */

/** True where the contour belongs to the cerebrum (the part that folds). */
function isCerebral(x: number, y: number): boolean {
  if (y < -0.32 && x < -0.3) return false; /* cerebellum */
  if (y < -0.4 && x > -0.34 && x < 0.0) return false; /* brainstem */
  return true;
}

/** Half-thickness of the cerebrum at (x,y) — the lateral shell that gives
 *  the profile volume without ever disturbing the silhouette. */
function zHalf(x: number, y: number): number {
  const nx = (x - 0.0) / 1.0;
  const ny = (y - 0.14) / 0.58;
  const q = nx * nx + ny * ny;
  return 0.44 * Math.sqrt(Math.max(0.04, 1 - Math.min(q, 0.96)));
}

/* ------------------------------------------------------------------ */
/* 3 · Neural pathways — bright internal arcs (axons + pulses reuse)   */
/* ------------------------------------------------------------------ */

type Bez = readonly [Vec3, Vec3, Vec3];

const THALAMUS: Vec3 = [-0.02, -0.02, 0.0];

const PATHWAY_BEZ: readonly Bez[] = [
  /* corona radiata — the fan from the thalamus up into the cortex */
  [THALAMUS, [0.06, 0.22, 0.2], [0.1, 0.46, 0.12]],
  [THALAMUS, [0.4, 0.14, 0.22], [0.55, 0.34, 0.14]],
  [THALAMUS, [-0.24, 0.2, 0.22], [-0.38, 0.4, 0.12]],
  /* long anterior ↔ posterior association bundle */
  [[0.78, 0.06, 0.1], [0.0, 0.34, 0.24], [-0.66, 0.14, 0.08]],
  /* arcuate — frontal → temporal, hooking under the sylvian fissure */
  [[0.6, 0.14, 0.16], [0.54, -0.2, 0.28], [0.24, -0.36, 0.18]],
  /* optic/occipital radiation */
  [THALAMUS, [-0.4, -0.12, 0.2], [-0.68, 0.0, 0.1]],
  /* ascending brainstem → thalamus */
  [[-0.19, -0.6, 0.0], [-0.1, -0.32, 0.06], THALAMUS],
];

function bezPoint(bez: Bez, t: number): Vec3 {
  const u = 1 - t;
  return [
    u * u * bez[0][0] + 2 * u * t * bez[1][0] + t * t * bez[2][0],
    u * u * bez[0][1] + 2 * u * t * bez[1][1] + t * t * bez[2][1],
    u * u * bez[0][2] + 2 * u * t * bez[1][2] + t * t * bez[2][2],
  ];
}

const PATHWAY_SAMPLES = 64;
let pathwayCache: Float32Array[] | null = null;

/** The neural-pathway polylines in FINAL local brain space — posed and
 *  scaled, exactly matching the particle positions. Shared by the axon
 *  line layer and the signal pulses. */
export function getBrainPathways(): Float32Array[] {
  if (pathwayCache) return pathwayCache;
  pathwayCache = PATHWAY_BEZ.map((bez) => {
    const pts = new Float32Array(PATHWAY_SAMPLES * 3);
    for (let i = 0; i < PATHWAY_SAMPLES; i += 1) {
      const [x, y, z] = bezPoint(bez, i / (PATHWAY_SAMPLES - 1));
      const [px, py, pz] = pose(x, y, z);
      pts[i * 3] = px * SCALE;
      pts[i * 3 + 1] = py * SCALE;
      pts[i * 3 + 2] = pz * SCALE;
    }
    return pts;
  });
  return pathwayCache;
}

/* ------------------------------------------------------------------ */
/* 4 · Pose + build                                                    */
/* ------------------------------------------------------------------ */

interface BrainGeometry {
  positions: Float32Array;
  weights: Float32Array;
}

const geomCache = new Map<number, BrainGeometry>();

const SCALE = 1.62;

/* The pose is baked into the geometry (the shader places the brain with
   scale + offset only), so the axon lines and pulses — built from the
   same curves — always coincide with the particles. It is deliberately
   SMALL: the lateral profile is the entire recognition cue, and rotating
   away from it foreshortens the one axis that carries the read. Just
   enough yaw and pitch to prove the form has volume. */
const POSE_Y = -0.11; /* yaw — frontal pole eases toward the viewer */
const POSE_X = 0.05; /* pitch — a breath of the dorsal surface */
const COS_Y = Math.cos(POSE_Y);
const SIN_Y = Math.sin(POSE_Y);
const COS_X = Math.cos(POSE_X);
const SIN_X = Math.sin(POSE_X);

function pose(x: number, y: number, z: number): Vec3 {
  const x1 = x * COS_Y + z * SIN_Y;
  const z1 = -x * SIN_Y + z * COS_Y;
  const y2 = y * COS_X - z1 * SIN_X;
  const z2 = y * SIN_X + z1 * COS_X;
  return [x1, y2, z2];
}

function buildBrain(count: number): BrainGeometry {
  const rand = mulberry32(0x5eed_b1a1);
  const c = buildContour();
  const total = c.curve.length;
  const positions = new Float32Array(count * 3);
  const weights = new Float32Array(count);
  let o = 0;

  const put = (x: number, y: number, z: number, w: number) => {
    if (o >= count) return;
    const [px, py, pz] = pose(x, y, z);
    positions[o * 3] = px * SCALE;
    positions[o * 3 + 1] = py * SCALE;
    positions[o * 3 + 2] = pz * SCALE;
    weights[o] = w;
    o += 1;
  };

  /* Budget. The contour and the folds carry the read; the interior is
     deliberately sparse so the silhouette never collapses into a blob. */
  const nContour = Math.floor(count * 0.26);
  const nSulci = Math.floor(count * 0.345);
  const nFissure = Math.floor(count * 0.05);
  const nCbl = Math.floor(count * 0.075);
  const nStem = Math.floor(count * 0.05);
  const nPath = Math.floor(count * 0.11);
  const nNodes = Math.floor(count * 0.05);

  /* ---- 1 · the silhouette contour ------------------------------------
     Evenly spaced by ARC LENGTH so density never pools in tight corners,
     with brightness following local curvature: the frontal pole, the
     vertex shoulder, the occipital pole, the cerebellar curve, the
     temporal tip and the sylvian notch describe themselves, and the long
     stretches between them stay restrained. No uniform neon rim. */
  for (let i = 0; i < nContour; i += 1) {
    const s = (i + rand() * 0.6) / nContour;
    const { i: ci, x, y } = contourAt(c, s);
    const jitter = 0.008;
    const landmark = c.curve[ci];
    put(
      x + (rand() - 0.5) * jitter,
      y + (rand() - 0.5) * jitter,
      (rand() - 0.5) * 0.05,
      0.46 + landmark * 0.54,
    );
  }

  /* ---- 2 · sulci — fold curves driven INWARD along the contour normal.
     Perpendicular to the surface, which is how gyral striation actually
     reads; the gaps between them are the dark sulci. Depth, bend and
     lateral offset vary per fold, and each lives on the near or far
     hemisphere so the folds interleave in z instead of stacking flat. */
  const SULCI = 44;
  const SULCI_SCAN = 58; /* scan more of the contour; non-cerebral hits skip */
  const perSulcus = Math.floor(nSulci / SULCI);
  let placed = 0;
  for (let f = 0; f < SULCI_SCAN && placed < SULCI; f += 1) {
    /* walk the contour by arc length, skipping the cerebellum + stem */
    const s = f / SULCI_SCAN;
    const { i: ci, x: ax, y: ay } = contourAt(c, s);
    if (!isCerebral(ax, ay)) continue;
    placed += 1;

    const nx = c.nrm[ci * 2];
    const ny = c.nrm[ci * 2 + 1];
    const tx = -ny;
    const ty = nx;
    const depth = 0.12 + rand() * 0.22;
    const bend = (rand() - 0.5) * 0.16;
    const wob = 2.0 + rand() * 2.4;
    const phase = rand() * Math.PI * 2;
    const u = (rand() * 2 - 1) * 0.92; /* which lateral layer this fold sits on */
    const bright = 0.5 + rand() * 0.3;

    for (let k = 0; k < perSulcus; k += 1) {
      const t = k / Math.max(1, perSulcus - 1);
      /* folds are densest near the surface and taper inward */
      const d = depth * Math.pow(t, 0.78);
      const drift = Math.sin(t * Math.PI) * bend + Math.sin(t * wob + phase) * 0.018;
      const x = ax + nx * d + tx * drift;
      const y = ay + ny * d + ty * drift;
      const z = u * zHalf(x, y) * (0.35 + 0.65 * Math.pow(t, 0.5));
      /* ridges brighten near the surface, dim as they sink */
      put(x, y, z, bright * (1 - 0.55 * t));
    }
  }

  /* ---- 3 · the two named creases a viewer actually reads -------------
     The sylvian fissure lifting the temporal lobe, and the central
     sulcus crossing the vertex. Dim: these are grooves, not ridges. */
  const CREASES: ReadonlyArray<readonly [Vec2, Vec2, Vec2, number]> = [
    /* sylvian: from the notch, back and slightly down into the cerebrum */
    [[0.6, -0.12], [0.28, -0.16], [-0.16, -0.02], 0.3],
    /* central sulcus: vertex → down and forward toward the sylvian */
    [[0.16, 0.63], [0.24, 0.3], [0.36, 0.0], 0.26],
    /* precentral companion — the second crease that implies the rest */
    [[-0.1, 0.61], [-0.02, 0.28], [0.1, -0.02], 0.22],
  ];
  const perCrease = Math.floor(nFissure / CREASES.length);
  for (const [p0, p1, p2, w] of CREASES) {
    for (let k = 0; k < perCrease; k += 1) {
      const t = k / Math.max(1, perCrease - 1);
      const u = 1 - t;
      const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
      const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
      put(
        x + (rand() - 0.5) * 0.012,
        y + (rand() - 0.5) * 0.012,
        zHalf(x, y) * 0.72 + (rand() - 0.5) * 0.03,
        w,
      );
    }
  }

  /* ---- 4 · cerebellum — fine, close, differently-oriented folia. The
     texture change is what makes the little brain read as its own organ
     while the contour keeps it attached to the cerebrum. */
  const CBL_CX = -0.6;
  const CBL_CY = -0.375;
  const FOLIA = 11;
  const perFolia = Math.floor(nCbl / (FOLIA + 1));
  for (let r = 0; r < FOLIA; r += 1) {
    const t = (r + 0.5) / FOLIA;
    /* folia radiate from the cerebellar hilum — short, close, irregular
       strokes at a different angle to the cerebral folds, so the little
       brain reads as its own organ by TEXTURE, not by a gap */
    const a = lerp(Math.PI * 0.68, Math.PI * 1.72, t) + (rand() - 0.5) * 0.09;
    const r0 = 0.035 + rand() * 0.025;
    const r1 = 0.105 + rand() * 0.035;
    const u = (rand() * 2 - 1) * 0.7;
    for (let k = 0; k < perFolia; k += 1) {
      const s = k / Math.max(1, perFolia - 1);
      const rr = lerp(r0, r1, s);
      const x = CBL_CX + Math.cos(a) * rr * 1.05;
      const y = CBL_CY + Math.sin(a) * rr;
      put(x, y, u * 0.16 + (rand() - 0.5) * 0.03, 0.3 + s * 0.2);
    }
  }
  /* the tentorium: the dim step that reads as the shadow between the
     cerebrum's underside and the cerebellum's crown */
  const nTent = nCbl - perFolia * FOLIA;
  for (let i = 0; i < nTent; i += 1) {
    const s = i / Math.max(1, nTent - 1);
    const x = lerp(-0.85, -0.36, s);
    const y = -0.235 - Math.sin(s * Math.PI) * 0.035;
    put(x, y, (rand() - 0.5) * 0.22, 0.2);
  }

  /* ---- 5 · brainstem — a soft, short column: scattered depth inside the
        contour rather than stacked rings, which rasterize into a ladder
        and drag the eye away from the cerebrum */
  for (let k = 0; k < nStem; k += 1) {
    const t = Math.pow(rand(), 0.85);
    const ax = lerp(-0.055, -0.235, t);
    const ay = lerp(-0.43, -0.7, t);
    const ar = lerp(0.1, 0.045, Math.pow(t, 0.7)) * (1 + 0.22 * Math.sin(t * Math.PI));
    const a = rand() * Math.PI * 2;
    put(
      ax + Math.cos(a) * ar * 0.5,
      ay + (rand() - 0.5) * 0.03,
      Math.sin(a) * ar,
      0.34 + 0.24 * (1 - t),
    );
  }

  /* ---- 6 · neural pathways — the bright internal wiring the axon lines
        and the signal pulses reuse */
  const perPath = Math.floor(nPath / PATHWAY_BEZ.length);
  for (const bez of PATHWAY_BEZ) {
    for (let k = 0; k < perPath; k += 1) {
      const s = k / Math.max(1, perPath - 1);
      const [x, y, z] = bezPoint(bez, s);
      put(
        x + (rand() - 0.5) * 0.022,
        y + (rand() - 0.5) * 0.022,
        z + (rand() - 0.5) * 0.022,
        0.72,
      );
    }
  }

  /* ---- 7 · internal neural nodes — a scatter of brighter points at the
        pathway crossings, so the interior reads as a constellation of
        nodes rather than a fog of tissue */
  for (let i = 0; i < nNodes; i += 1) {
    const bez = PATHWAY_BEZ[Math.floor(rand() * PATHWAY_BEZ.length)];
    const [bx, by, bz] = bezPoint(bez, rand());
    const spread = 0.1;
    put(
      bx + (rand() - 0.5) * spread,
      by + (rand() - 0.5) * spread,
      bz + (rand() - 0.5) * spread,
      0.14 + rand() * 0.2,
    );
  }

  /* the count must match exactly — any remainder reinforces the contour */
  while (o < count) {
    const { i: ci, x, y } = contourAt(c, rand());
    put(x, y, (rand() - 0.5) * 0.05, 0.46 + c.curve[ci] * 0.54);
  }
  void total;

  return { positions, weights };
}

function getBrainGeometry(count: number): BrainGeometry {
  const hit = geomCache.get(count);
  if (hit) return hit;
  const built = buildBrain(count);
  geomCache.set(count, built);
  return built;
}

/** One position per brain particle — deterministic, anatomy-first. */
export function getBrainPositions(count: number): Float32Array {
  return getBrainGeometry(count).positions;
}

/** Per-particle structure weight (0..1): contour landmarks and neural
 *  pathways brightest, interior nearly dark. Same ordering as
 *  getBrainPositions. */
export function getBrainWeights(count: number): Float32Array {
  return getBrainGeometry(count).weights;
}

/**
 * Axon segments: the visible neural wiring. Built from the SAME pathway
 * curves the particles and pulses use — long clean runs along each arc
 * plus a restrained set of short bridges between nearby pathway points.
 */
export function getBrainAxons(_count: number, maxSegments: number): Float32Array {
  const pathways = getBrainPathways();
  const rand = mulberry32(0x5eeda40);
  const segs: number[] = [];

  const STRIDE = 3;
  for (const pts of pathways) {
    for (let i = 0; i + STRIDE < PATHWAY_SAMPLES && segs.length / 6 < maxSegments; i += STRIDE) {
      segs.push(
        pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2],
        pts[(i + STRIDE) * 3], pts[(i + STRIDE) * 3 + 1], pts[(i + STRIDE) * 3 + 2],
      );
    }
  }

  /* a FEW short bridges — enough to suggest a network, never a web */
  const bridgeBudget = Math.min(maxSegments, segs.length / 6 + maxSegments * 0.04);
  const BRIDGE_DIST2 = 0.5 * 0.5;
  let guard = 0;
  while (segs.length / 6 < bridgeBudget && guard < maxSegments * 8) {
    guard += 1;
    const pa = pathways[Math.floor(rand() * pathways.length)];
    const pb = pathways[Math.floor(rand() * pathways.length)];
    if (pa === pb) continue;
    const ia = Math.floor(rand() * PATHWAY_SAMPLES);
    const ib = Math.floor(rand() * PATHWAY_SAMPLES);
    const dx = pa[ia * 3] - pb[ib * 3];
    const dy = pa[ia * 3 + 1] - pb[ib * 3 + 1];
    const dz = pa[ia * 3 + 2] - pb[ib * 3 + 2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > 0.03 && d2 < BRIDGE_DIST2) {
      segs.push(
        pa[ia * 3], pa[ia * 3 + 1], pa[ia * 3 + 2],
        pb[ib * 3], pb[ib * 3 + 1], pb[ib * 3 + 2],
      );
    }
  }

  return new Float32Array(segs);
}

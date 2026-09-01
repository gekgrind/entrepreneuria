/**
 * brain-shape — the Prospra particle brain, generated ONCE, deterministically.
 *
 * The master particle field retargets a subset of its particles onto these
 * exact positions (aBrain attribute), and the axon line layer connects the
 * SAME neural pathways — so the glowing filaments always join real particles.
 * Deterministic (seeded PRNG) because the consumers build at different times
 * and must agree without coordination.
 *
 * Local brain space: centered at (0,0,0), facing +X (right), up +Y, roughly
 * ±1.5 units after scaling. The shader / scene group apply getBrainTransform
 * (journey-math) to place it right of the Prospra copy.
 *
 * ANATOMY — a three-quarter side profile of a human brain facing right.
 * This is NOT a brain-shaped volume of random points. It is a layered
 * CURVE SYSTEM — every particle lives on an intentional anatomical stroke,
 * so the folds and regions survive both a static screenshot and a glance:
 *
 *   · silhouette contours — the closed side-profile outline (frontal pole
 *     right, occipital pole left), the single strongest recognition cue
 *   · gyri ridges — long, meandering front-to-back fold curves with dark
 *     sulci (negative space) between them, plus short branching
 *     secondary folds (the interrupted folding of real cortex)
 *   · longitudinal fissure — a sunken dim groove along the dorsal midline,
 *     flanked by bright para-midline ridges (the hemisphere separation)
 *   · sylvian fissure — the curved line lifting the temporal lobe
 *   · cerebellum — a distinct smaller mass under the occipital pole,
 *     textured with fine, close parallel folia and separated from the
 *     cerebrum by a dim tentorium step line
 *   · brainstem — a ring-built column descending from the cerebrum's
 *     underside with a pons bulge and defined front/back edges
 *   · neural pathways — bright internal arcs (thalamus fan, long
 *     front-back bundles) that the axon lines and signal pulses reuse
 *
 * Each point also carries a structure WEIGHT (contours and pathways
 * brightest, interior nearly dark) so the shader can keep the anatomy
 * legible instead of blowing out the center.
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

/* ------------------------------------------------------------------ */
/* Side-profile envelopes (x right = frontal, y up = dorsal)           */
/* ------------------------------------------------------------------ */

type Vec3 = [number, number, number];

/** Cosine-eased interpolation through control points (organic, C1-ish). */
function envelope(ctrl: ReadonlyArray<readonly [number, number]>) {
  return (x: number): number => {
    const first = ctrl[0];
    if (x <= first[0]) return first[1];
    for (let i = 0; i < ctrl.length - 1; i += 1) {
      const [x0, y0] = ctrl[i];
      const [x1, y1] = ctrl[i + 1];
      if (x <= x1) {
        const t = (x - x0) / (x1 - x0);
        const k = 0.5 - 0.5 * Math.cos(t * Math.PI);
        return y0 + (y1 - y0) * k;
      }
    }
    return ctrl[ctrl.length - 1][1];
  };
}

/** Dorsal (top) envelope of the cerebrum side profile. */
const topEnv = envelope([
  [-0.88, 0.46],
  [-0.48, 0.7],
  [0.02, 0.78],
  [0.45, 0.74],
  [0.9, 0.5],
]);

/** Ventral (underside) envelope — the temporal line, with the step up
 *  toward the occipital pole that leaves the tentorium gap the
 *  cerebellum tucks into. */
const botEnv = envelope([
  [-0.88, -0.06],
  [-0.62, -0.16],
  [-0.42, -0.24],
  [-0.05, -0.3],
  [0.38, -0.3],
  [0.72, -0.22],
  [0.9, -0.02],
]);

/* cerebrum ellipsoid approximation for lateral (z) surface depth */
const CEREBRUM_CX = 0.02;
const CEREBRUM_CY = 0.16;
const CEREBRUM_RX = 1.02;
const CEREBRUM_RY = 0.64;
const CEREBRUM_RZ = 0.5;

/** Lateral surface depth of the cerebrum at (x, y) — always ≥ a sliver
 *  so ridge curves stay defined right up to the silhouette. */
function zSurface(x: number, y: number): number {
  const nx = (x - CEREBRUM_CX) / CEREBRUM_RX;
  const ny = (y - CEREBRUM_CY) / CEREBRUM_RY;
  const q = Math.min(nx * nx + ny * ny, 0.97);
  return CEREBRUM_RZ * Math.sqrt(Math.max(0.03, 1 - q));
}

/* cerebellum — a distinct, smaller mass under the occipital pole, set
 *  low and back enough that the tentorium gap separates it clearly
 *  from the cerebrum above */
const CBL_CX = -0.64;
const CBL_CY = -0.47;
const CBL_RX = 0.32;
const CBL_RY = 0.18;
const CBL_RZ = 0.34;

function zCerebellum(x: number, y: number): number {
  const nx = (x - CBL_CX) / CBL_RX;
  const ny = (y - CBL_CY) / CBL_RY;
  const q = Math.min(nx * nx + ny * ny, 0.97);
  return CBL_RZ * Math.sqrt(Math.max(0.03, 1 - q));
}

/* ------------------------------------------------------------------ */
/* Neural pathways — bright internal arcs (reused by axons + pulses)   */
/* ------------------------------------------------------------------ */

type Bez = readonly [Vec3, Vec3, Vec3];

const THALAMUS: Vec3 = [0.0, -0.06, 0.0];

/** Quadratic-beziér arcs (p0, ctrl, p1) in local brain space. The fan
 *  from the thalamus toward the cortex plus long association bundles —
 *  the intentional internal wiring of the brain. */
const PATHWAY_BEZ: readonly Bez[] = [
  /* corona radiata fan — thalamus → cortex */
  [THALAMUS, [0.16, 0.2, 0.3], [0.12, 0.58, 0.18]],
  [THALAMUS, [0.45, 0.12, 0.34], [0.58, 0.34, 0.22]],
  [THALAMUS, [-0.2, 0.2, 0.3], [-0.34, 0.48, 0.16]],
  [THALAMUS, [0.3, -0.1, 0.36], [0.16, -0.22, 0.26]],
  /* long front ↔ back association bundle */
  [[0.74, 0.12, 0.12], [0.0, 0.36, 0.3], [-0.68, 0.16, 0.1]],
  /* arcuate — frontal → temporal */
  [[0.62, 0.18, 0.2], [0.5, -0.02, 0.38], [0.08, -0.22, 0.24]],
  /* ascending stem → thalamus */
  [[-0.04, -0.52, 0.02], [-0.02, -0.28, 0.1], THALAMUS],
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

/** The 7 neural-pathway polylines (clean curves, no jitter) in FINAL
 *  local brain space — posed and scaled, exactly matching the particle
 *  positions. Shared by the axon line layer and the signal pulses. */
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
/* Brainstem axis                                                      */
/* ------------------------------------------------------------------ */

const STEM_POINTS: ReadonlyArray<readonly [number, number, number]> = [
  /* x, y, radius — descending from the cerebrum's underside, drifting
     back toward the cerebellum, with the pons bulge near the top */
  [0.06, -0.26, 0.085],
  [0.0, -0.38, 0.095],
  [-0.08, -0.52, 0.115],
  [-0.15, -0.66, 0.065],
  [-0.19, -0.76, 0.045],
];

function stemAt(t: number): Vec3 {
  const n = STEM_POINTS.length - 1;
  const ft = Math.min(t, 0.9999) * n;
  const i = Math.floor(ft);
  const k = ft - i;
  const a = STEM_POINTS[i];
  const b = STEM_POINTS[Math.min(i + 1, n)];
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}

/* ------------------------------------------------------------------ */
/* The deterministic build                                             */
/* ------------------------------------------------------------------ */

interface BrainGeometry {
  positions: Float32Array;
  weights: Float32Array;
}

const geomCache = new Map<number, BrainGeometry>();

const SCALE = 1.45;

/* The baked three-quarter pose: the particle brain is placed by the
   shader (scale + offset only, no rotation), so the anatomical 3/4 view
   must live IN the geometry — then the axon lines and pulses, built
   from the same curves, always coincide. The frontal pole tips gently
   toward the viewer and the dorsal surface tilts into view: the
   textbook three-quarter anatomical read, present even in a still
   frame. Subtle live motion (sway, pointer) stays on top, restrained. */
const POSE_Y = -0.3; /* around Y — frontal pole (+X) toward the camera */
const POSE_X = 0.14; /* around X — dorsal midline toward the camera */
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
  const positions = new Float32Array(count * 3);
  const weights = new Float32Array(count);
  let o = 0; /* particle cursor */

  const put = (x: number, y: number, z: number, w: number) => {
    if (o >= count) return;
    const [px, py, pz] = pose(x, y, z);
    positions[o * 3] = px * SCALE;
    positions[o * 3 + 1] = py * SCALE;
    positions[o * 3 + 2] = pz * SCALE;
    weights[o] = w;
    o += 1;
  };

  /* budget — the folds now carry slightly more of the read than the
     silhouette; the interior stays nearly empty so the form never
     collapses into a glowing blob */
  const nSil = Math.floor(count * 0.155);
  const nGyri = Math.floor(count * 0.47);
  const nFissure = Math.floor(count * 0.025);
  const nSylvian = Math.floor(count * 0.015);
  const nCbl = Math.floor(count * 0.1);
  const nStem = Math.floor(count * 0.08);
  const nPath = Math.floor(count * 0.12);
  const nFill = count - (nSil + nGyri + nFissure + nSylvian + nCbl + nStem + nPath);

  /* ---- 1 · silhouette contours (brightest — the outer read, but
        deliberately thinned toward the upper-frontal corner so the
        contour stays crisp instead of hot) --------------------------- */
  const sil = (x: number, y: number, wMul = 1) =>
    put(
      x + (rand() - 0.5) * 0.02,
      y + (rand() - 0.5) * 0.02,
      (rand() - 0.5) * 0.05,
      (0.95 + rand() * 0.05) * wMul,
    );
  const nSilDorsal = Math.floor(nSil * 0.44);
  const nSilVentral = Math.floor(nSil * 0.22);
  const nSilFrontal = Math.floor(nSil * 0.12);
  /* dorsal + ventral outlines come straight from the profile envelopes */
  for (let i = 0; i < nSilDorsal; i += 1) {
    const x = lerp(-0.88, 0.9, i / Math.max(1, nSilDorsal - 1));
    sil(x, topEnv(x), x > 0.62 ? 0.85 : 1);
  }
  for (let i = 0; i < nSilVentral; i += 1) {
    const x = lerp(-0.85, 0.88, i / Math.max(1, nSilVentral - 1));
    sil(x, botEnv(x));
  }
  /* frontal cap — the rounded forehead projecting to the right; the
     upper arc is kept quieter so the edge never blooms */
  for (let i = 0; i < nSilFrontal; i += 1) {
    const a = lerp(-1.35, 1.35, i / Math.max(1, nSilFrontal - 1));
    sil(0.86 + Math.cos(a) * 0.16, 0.22 + Math.sin(a) * 0.3, a > 0.3 ? 0.8 : 1);
  }
  /* occipital cap — the rounded back of the brain on the left */
  const nSilOcc = nSil - nSilDorsal - nSilVentral - nSilFrontal;
  for (let i = 0; i < nSilOcc; i += 1) {
    const a = lerp(Math.PI - 1.2, Math.PI + 1.2, i / Math.max(1, nSilOcc - 1));
    sil(-0.84 + Math.cos(a) * 0.17, 0.2 + Math.sin(a) * 0.3);
  }

  /* ---- 2 · gyri ridges — long meandering fold curves with dark sulci
        between them, plus short branching secondary folds so the
        cortical surface reads as anatomy, not just outline.
        (band ℓ: 0 = temporal line → 1 = dorsal midline; u: lateral
        position on the surface, +z = near hemisphere) ---------------- */
  const emitRidge = (
    band: number,
    u: number,
    pts: number,
    sStart: number,
    sEnd: number,
    yFork: (s: number) => number,
  ) => {
    if (pts <= 0) return;
    const phase = rand() * Math.PI * 2;
    const phase2 = rand() * Math.PI * 2;
    const waves = 4.5 + rand() * 2.5;
    const amp = 0.05 + rand() * 0.025;
    const w = 0.7 + rand() * 0.15;
    for (let k = 0; k < pts; k += 1) {
      const s = lerp(sStart, sEnd, k / Math.max(1, pts - 1));
      /* ventral ridges run shorter (frontal base → temporal back);
         dorsal ridges sweep pole to pole */
      const xF = lerp(0.72, 0.92, band);
      const xB = lerp(-0.52, -0.88, Math.min(1, band * 1.2));
      const x0 = lerp(xF, xB, s);
      const fade = Math.pow(Math.sin(s * Math.PI), 0.45);
      const meander =
        Math.sin(s * waves * Math.PI * 2 + phase) +
        0.45 * Math.sin(s * waves * 4.6 + phase2);
      const y =
        lerp(botEnv(x0), topEnv(x0), band) + meander * amp * fade + yFork(s);
      const x = x0 + 0.35 * amp * fade * Math.sin(s * waves * 3.7 + phase * 1.7);
      const z =
        zSurface(x, y) * u +
        Math.sign(u) * 0.014 +
        0.02 * fade * Math.sin(s * waves * 5.3 + phase2 * 1.3);
      put(x, y, z, w);
    }
  };

  const RIDGES: ReadonlyArray<readonly [number, number]> = [
    [0.05, 0.85],
    [0.1, -0.5],
    [0.13, 0.5],
    [0.22, 0.9],
    [0.31, 0.45],
    [0.36, 0.62],
    [0.4, 0.85],
    [0.49, 0.4],
    [0.49, -0.45] /* far-side ridge — depth behind the near folds */,
    [0.58, 0.8],
    [0.62, 0.65],
    [0.67, 0.5],
    [0.67, -0.35],
    [0.75, 0.85],
    [0.82, 0.45],
    [0.85, 0.95] /* high outer fold — the upper outer surface */,
    [0.88, 0.75],
    [0.93, 0.32],
    /* para-midline pair — the bright banks of the longitudinal fissure */
    [0.97, 0.16],
    [0.97, -0.16],
  ];

  /* short branching folds — Y-shaped offshoots that fork away from a
     parent ridge, the interrupted, irregular folding of real cortex */
  const BRANCH_FOLDS: ReadonlyArray<
    readonly [number, number, number, number, number]
  > = [
    /* band, u, sStart, sEnd, fork direction (±y) */
    [0.3, 0.55, 0.35, 0.9, -1],
    [0.44, 0.9, 0.3, 0.85, 1],
    [0.55, 0.45, 0.4, 0.95, -1],
    [0.66, 0.8, 0.3, 0.8, 1],
    [0.74, 0.5, 0.35, 0.9, -1],
    [0.86, 0.7, 0.3, 0.85, 1],
  ];

  const perRidge = Math.floor(nGyri / 24);
  for (const [band, u] of RIDGES) {
    emitRidge(band, u, perRidge, 0, 1, () => 0);
  }
  const perBranch = Math.floor(perRidge * 0.55);
  for (const [band, u, s0, s1, dir] of BRANCH_FOLDS) {
    emitRidge(band, u, perBranch, s0, s1, (s) => dir * Math.max(0, s - s0) * 0.16);
  }

  /* ---- 3 · longitudinal fissure — a sunken dim groove along the
        dorsal midline; the dark line that splits the hemispheres ----- */
  for (let i = 0; i < nFissure; i += 1) {
    const s = i / Math.max(1, nFissure - 1);
    const x = lerp(0.88, -0.84, s);
    put(
      x,
      topEnv(x) - 0.045 + (rand() - 0.5) * 0.015,
      (rand() - 0.5) * 0.025,
      0.26,
    );
  }

  /* ---- 4 · sylvian fissure — the curved crease lifting the temporal
        lobe away from the frontal/parietal mass ---------------------- */
  for (let i = 0; i < nSylvian; i += 1) {
    const s = i / Math.max(1, nSylvian - 1);
    const x = lerp(0.72, -0.36, s);
    const y = lerp(-0.04, -0.2, s) - Math.sin(s * Math.PI) * 0.02;
    put(
      x + (rand() - 0.5) * 0.015,
      y + (rand() - 0.5) * 0.015,
      zSurface(x, y) * 0.78,
      0.34,
    );
  }

  /* ---- 5 · cerebellum — fine, close parallel folia; a clearly
        different texture under the occipital pole, separated from the
        cerebrum by a visible tentorium step -------------------------- */
  const nTent = Math.max(12, Math.floor(nCbl * 0.09));
  const FOLIA_ROWS = 8;
  const perFolia = Math.floor((nCbl - nTent) / (FOLIA_ROWS + 1));
  for (let r = 0; r < FOLIA_ROWS; r += 1) {
    const yRow = -0.355 - r * 0.0275;
    const u = r % 2 === 0 ? 0.95 : 0.6;
    for (let k = 0; k < perFolia; k += 1) {
      const s = k / Math.max(1, perFolia - 1);
      const x = lerp(-0.89, -0.4, s);
      const y = yRow + Math.sin(s * Math.PI) * 0.02;
      put(x, y, zCerebellum(x, y) * u + Math.sign(u) * 0.01, 0.72);
    }
  }
  /* cerebellum outline — the lower/back silhouette of the little brain */
  const nCblOutline = nCbl - nTent - perFolia * FOLIA_ROWS;
  for (let k = 0; k < nCblOutline; k += 1) {
    const a = lerp(Math.PI * 0.35, Math.PI * 1.75, k / Math.max(1, nCblOutline - 1));
    put(
      CBL_CX + Math.cos(a) * CBL_RX + (rand() - 0.5) * 0.015,
      CBL_CY + Math.sin(a) * CBL_RY + (rand() - 0.5) * 0.015,
      (rand() - 0.5) * 0.04,
      0.85,
    );
  }
  /* tentorium — the dim step line between the cerebrum's underside and
     the cerebellum's crown; the shadow that makes the little brain its
     own mass */
  for (let i = 0; i < nTent; i += 1) {
    const s = i / Math.max(1, nTent - 1);
    const x = lerp(-0.86, -0.42, s);
    const y = -0.255 - Math.sin(s * Math.PI) * 0.02;
    put(x, y, zSurface(x, y) * 0.55, 0.22);
  }

  /* ---- 6 · brainstem — stacked rings along the descending axis, with
        defined anterior AND posterior edge lines so the stem reads as
        an intentional anatomical cord, not a loose extension --------- */
  const nStemRings = 10;
  const perRing = Math.floor(nStem * 0.62 / nStemRings);
  for (let r = 0; r < nStemRings; r += 1) {
    const t = r / (nStemRings - 1);
    const [ax, ay, ar] = stemAt(t);
    for (let k = 0; k < perRing; k += 1) {
      const a = (k / perRing) * Math.PI * 2 + r * 0.4;
      put(ax + Math.cos(a) * ar, ay, Math.sin(a) * ar * 0.9, 0.75);
    }
  }
  const nStemLine = nStem - perRing * nStemRings;
  const nAnt = Math.floor(nStemLine * 0.6);
  for (let k = 0; k < nAnt; k += 1) {
    const t = k / Math.max(1, nAnt - 1);
    const [ax, ay, ar] = stemAt(t);
    put(
      ax + ar * 0.92 + (rand() - 0.5) * 0.015,
      ay + (rand() - 0.5) * 0.015,
      (rand() - 0.5) * 0.03,
      0.85,
    );
  }
  for (let k = 0; k < nStemLine - nAnt; k += 1) {
    const t = k / Math.max(1, nStemLine - nAnt - 1);
    const [ax, ay, ar] = stemAt(t);
    put(
      ax - ar * 0.92 + (rand() - 0.5) * 0.015,
      ay + (rand() - 0.5) * 0.015,
      (rand() - 0.5) * 0.03,
      0.72,
    );
  }

  /* ---- 7 · neural pathways — bright internal arcs; the wiring the
        axon lines and signal pulses reuse ---------------------------- */
  const perPath = Math.floor(nPath / PATHWAY_BEZ.length);
  let pathExtra = nPath - perPath * PATHWAY_BEZ.length;
  for (const bez of PATHWAY_BEZ) {
    const pts = perPath + (pathExtra > 0 ? 1 : 0);
    pathExtra -= 1;
    for (let k = 0; k < pts; k += 1) {
      const s = k / Math.max(1, pts - 1);
      const [x, y, z] = bezPoint(bez, s);
      put(
        x + (rand() - 0.5) * 0.03,
        y + (rand() - 0.5) * 0.03,
        z + (rand() - 0.5) * 0.03,
        0.88,
      );
    }
  }

  /* ---- 8 · sparse interior fill — just enough to keep the tissue
        present behind the folds; deliberately dark ------------------- */
  for (let i = 0; i < nFill; i += 1) {
    const theta = rand() * Math.PI * 2;
    const cosPhi = rand() * 2 - 1;
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
    const rr = 0.35 + 0.45 * Math.pow(rand(), 0.6);
    const x = sinPhi * Math.cos(theta) * rr * CEREBRUM_RX;
    const y = cosPhi * rr * CEREBRUM_RY;
    if (y < botEnv(x) || y > topEnv(x)) continue;
    put(
      x,
      y,
      sinPhi * Math.sin(theta) * rr * CEREBRUM_RZ * 0.8,
      0.1,
    );
  }

  /* any points skipped by the interior envelope check are topped up
     along the dorsal silhouette — the count must always match exactly */
  while (o < count) {
    const x = lerp(-0.88, 0.9, rand());
    put(x, topEnv(x), (rand() - 0.5) * 0.05, 0.9);
  }

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

/** Per-particle structure weight (0..1): contours and neural pathways
 *  brightest, interior nearly dark. Same ordering as getBrainPositions. */
export function getBrainWeights(count: number): Float32Array {
  return getBrainGeometry(count).weights;
}

/**
 * Axon segments: the visible neural wiring. Built from the SAME pathway
 * curves the particles and pulses use — long clean runs along each arc
 * plus a restrained set of short bridges between nearby pathway points.
 * Deterministic — built from the same seeded curves.
 */
export function getBrainAxons(_count: number, maxSegments: number): Float32Array {
  const pathways = getBrainPathways();
  const rand = mulberry32(0x5eeda40);
  const segs: number[] = [];

  /* long runs along the pathways themselves (stride keeps them clean);
     pathways already live in final local brain space (posed + scaled) */
  const STRIDE = 3;
  for (const pts of pathways) {
    for (let i = 0; i + STRIDE < PATHWAY_SAMPLES && segs.length / 6 < maxSegments; i += STRIDE) {
      segs.push(
        pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2],
        pts[(i + STRIDE) * 3], pts[(i + STRIDE) * 3 + 1], pts[(i + STRIDE) * 3 + 2],
      );
    }
  }

  /* short bridges between nearby points on DIFFERENT pathways — the
     network feel without tangled static (pathways are in final scaled
     brain space, so the threshold is scaled too) */
  const BRIDGE_DIST2 = 0.65 * 0.65;
  let guard = 0;
  while (segs.length / 6 < maxSegments && guard < maxSegments * 8) {
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

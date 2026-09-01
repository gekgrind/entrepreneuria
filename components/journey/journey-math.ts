/**
 * Journey POC — shared math, refs, quality tiers, and dev stats.
 *
 * The whole experience is driven by ONE smoothed master progress value,
 * written by the GSAP timeline and read by the WebGL world (useFrame).
 * Because every visual is a pure function of that progress, reverse
 * scrolling always reconstructs the exact scene state.
 *
 * Progress is expressed in TIMELINE UNITS (0..450) — the same units as
 * the GSAP timeline positions — so world math and DOM choreography share
 * one coordinate system:
 *
 *   0–42    Scene 1  CHAOS
 *   42–70   Scene 2  TUNNEL
 *   70–100  Scene 3  THE TURN
 *   100–150 Scene 4  THE ECOSYSTEM FORMS
 *   150–205 Scene 5  PRODUCT EXPLORATION
 *   205–250 Scene 6  MEET PROSPRA
 *   250–320 Scene 7  PROOF (intelligence becomes product experience)
 *   320–385 Scene 8  BELIEF (value cards → particle disintegration)
 *   385–450 Scene 9  RESOLUTION (the ecosystem reforms + final CTA)
 */

export const TIMELINE_UNITS = 450;

/** Scroll length per timeline unit — keeps scene pacing density identical
 *  to the approved Scenes 1–6 (250 units over 1100vh). */
export const VH_PER_UNIT = 4.4;

export const SCENE = {
  /** overall progress where Scene 1 (chaos) ends */
  chaosEnd: 42,
  /** overall progress where Scene 2 (tunnel) ends */
  tunnelEnd: 70,
  /** Scene 3 dissolution completes / galaxy assembly begins */
  ecoStart: 100,
  /** ecosystem fully resolved (nodes, halos, copy settled) */
  ecoAssembled: 142,
  /** product exploration window (cards cycle, nodes interactive) */
  exploreStart: 150,
  exploreEnd: 203,
  /** galaxy departure completes (loosened material trails toward Prospra) */
  departEnd: 216,
  /** brain fully assembled; stable end composition */
  brainAssembled: 242,
  /** Scene 7: brain→frame trace begins / screenshot stack window */
  proofStart: 250,
  proofTraceDone: 262,
  proofEnd: 320,
  /** Scene 8: belief cards window; disintegration releases the material */
  beliefStart: 320,
  disintegrateStart: 378,
  beliefEnd: 385,
  /** Scene 9: the ecosystem reforms; copy then CTA resolve */
  reformStart: 385,
  reformAssembled: 411,
  finalCopyStart: 412,
  end: TIMELINE_UNITS,
} as const;

/** Tunnel depth in world units (particles live along -z). */
export const TUNNEL_LEN = 64;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Progress of `p` inside the [a,b] window, clamped to 0..1. */
export const seg = (p: number, a: number, b: number) =>
  clamp01((p - a) / (b - a));

export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/* World-space layout transforms                                        */
/*                                                                      */
/* The particle shader transforms galaxy/brain HOMES by these values;   */
/* scene-graph objects (rings, nodes, axons) live inside groups that    */
/* receive the same transform — one source of truth keeps them aligned. */
/* ------------------------------------------------------------------ */

export interface WorldTransform {
  offset: [number, number, number];
  scale: number;
}

/** Galaxy occupies left / center-left on wide screens; on stacked
 *  (mobile) layouts it lifts above the copy and shrinks. */
export function getGalaxyTransform(stacked: boolean): WorldTransform {
  return stacked
    ? { offset: [0, 1.5, -3.2], scale: 0.55 }
    : { offset: [-1.95, -0.05, -2.5], scale: 0.82 };
}

/** Prospra's brain forms to the RIGHT of the copy; stacked lifts it
 *  above the copy — centered and large enough that the anatomy still
 *  reads on a phone screen. */
export function getBrainTransform(stacked: boolean): WorldTransform {
  return stacked
    ? { offset: [0.15, 2.75, -3.9], scale: 0.5 }
    : { offset: [2.05, -0.05, -2.1], scale: 1 };
}

/** Scene 9: the SAME ecosystem returns — but resolved: centered above the
 *  closing statement, slightly deeper and calmer than Scene 4's left-side
 *  discovery composition. Stacked lifts it clear of the copy + CTA. */
export function getFinalGalaxyTransform(stacked: boolean): WorldTransform {
  return stacked
    ? { offset: [0, 2.0, -4.4], scale: 0.5 }
    : { offset: [0, 1.05, -3.8], scale: 0.76 };
}

/** Scene 7: the particle frame the Prospra brain dissolves into, in world
 *  space — slightly LARGER than the centered screenshot card so the trace
 *  reads as a luminous edge around it (decorative dust, not a measured
 *  border). Stacked viewports rescale it via uProofXY. */
export const PROOF_FRAME = {
  center: [0, 0.3, -1.3] as [number, number, number],
  halfW: 3.45,
  halfH: 2.7,
} as const;

/* ------------------------------------------------------------------ */
/* Shared mutable refs (never React state — read at 60fps)             */
/* ------------------------------------------------------------------ */

export interface JourneyRefs {
  /** Smoothed master progress 0..TIMELINE_UNITS (from the GSAP timeline). */
  overall: { current: number };
  /** Normalized pointer -1..1 (fine pointers only; 0 on touch). */
  pointer: { current: { x: number; y: number } };
  /** Product slug highlighted by scroll position (card dwell window). */
  activeProduct: { current: string | null };
  /** Product slug highlighted by pointer/focus — overrides activeProduct. */
  hoverProduct: { current: string | null };
  /** Stacked (mobile-class) composition toggle. */
  stacked: { current: boolean };
  /** DOM hotspot buttons for the galaxy nodes — positioned every frame
      from the world (accessible interaction without canvas raycasting). */
  nodeButtons: { current: Array<HTMLElement | null> };
  /** DOM product identifiers for the galaxy nodes — projected every frame
      alongside the hotspots (aria-hidden; the buttons carry semantics). */
  nodeLabels: { current: Array<HTMLElement | null> };
}

export function createJourneyRefs(): JourneyRefs {
  return {
    overall: { current: 0 },
    pointer: { current: { x: 0, y: 0 } },
    activeProduct: { current: null },
    hoverProduct: { current: null },
    stacked: { current: false },
    nodeButtons: { current: [] },
    nodeLabels: { current: [] },
  };
}

/* ------------------------------------------------------------------ */
/* Quality tiers                                                       */
/* ------------------------------------------------------------------ */

export type QualityTier = "high" | "mid" | "low";

export interface QualitySpec {
  tier: QualityTier;
  /** master particle field count (stars + galaxy + brain material) */
  particles: number;
  /** particles retargeted into the Prospra brain point cloud */
  brain: number;
  /** instanced business-artifact cards */
  artifacts: number;
  /** tangled orbit-line rings */
  rings: number;
  /** devicePixelRatio ceiling */
  dprMax: number;
}

export const QUALITY: Record<QualityTier, QualitySpec> = {
  high: { tier: "high", particles: 45000, brain: 4600, artifacts: 34, rings: 12, dprMax: 1.75 },
  mid: { tier: "mid", particles: 25000, brain: 3200, artifacts: 24, rings: 10, dprMax: 1.5 },
  low: { tier: "low", particles: 12000, brain: 2000, artifacts: 13, rings: 8, dprMax: 1.4 },
};

/** Client-only. Small/coarse-pointer devices get the reduced world. */
export function detectQuality(): QualityTier {
  if (typeof window === "undefined") return "low";
  const w = window.innerWidth;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (w < 768 || (coarse && w < 1024)) return "low";
  const cores = navigator.hardwareConcurrency ?? 4;
  if (w < 1440 || cores <= 4) return "mid";
  return "high";
}

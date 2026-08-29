/**
 * Journey POC — shared math, refs, quality tiers, and dev stats.
 *
 * The whole experience is driven by ONE smoothed master progress value,
 * written by the GSAP timeline and read by the WebGL world (useFrame).
 * Because every visual is a pure function of that progress, reverse
 * scrolling always reconstructs the exact scene state.
 *
 * Progress is expressed in TIMELINE UNITS (0..250) — the same units as
 * the GSAP timeline positions — so world math and DOM choreography share
 * one coordinate system:
 *
 *   0–42    Scene 1  CHAOS
 *   42–70   Scene 2  TUNNEL
 *   70–100  Scene 3  THE TURN
 *   100–150 Scene 4  THE ECOSYSTEM FORMS
 *   150–205 Scene 5  PRODUCT EXPLORATION
 *   205–250 Scene 6  MEET PROSPRA
 */

export const TIMELINE_UNITS = 250;

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

/** Prospra's brain forms to the RIGHT of the copy; stacked lifts it up. */
export function getBrainTransform(stacked: boolean): WorldTransform {
  return stacked
    ? { offset: [0.62, 2.85, -4.3], scale: 0.36 }
    : { offset: [2.05, -0.05, -2.1], scale: 1 };
}

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
}

export function createJourneyRefs(): JourneyRefs {
  return {
    overall: { current: 0 },
    pointer: { current: { x: 0, y: 0 } },
    activeProduct: { current: null },
    hoverProduct: { current: null },
    stacked: { current: false },
    nodeButtons: { current: [] },
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
  high: { tier: "high", particles: 45000, brain: 9000, artifacts: 34, rings: 12, dprMax: 1.75 },
  mid: { tier: "mid", particles: 25000, brain: 6000, artifacts: 24, rings: 10, dprMax: 1.5 },
  low: { tier: "low", particles: 12000, brain: 3200, artifacts: 13, rings: 8, dprMax: 1.4 },
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

/* ------------------------------------------------------------------ */
/* Dev HUD stats — written by a probe inside the Canvas, read by a     */
/* DOM overlay. Module singleton, no React state in the hot path.      */
/* ------------------------------------------------------------------ */

export interface JourneyStats {
  fps: number;
  dpr: number;
  calls: number;
  triangles: number;
  particles: number;
  progress: number;
  tier: QualityTier;
  ready: boolean;
}

export const journeyStats: JourneyStats = {
  fps: 0,
  dpr: 1,
  calls: 0,
  triangles: 0,
  particles: 0,
  progress: 0,
  tier: "low",
  ready: false,
};

/**
 * Journey POC — shared math, refs, quality tiers, and dev stats.
 *
 * The whole experience is driven by ONE smoothed master progress value
 * (0..1 over the 500vh pinned stage), written by the GSAP timeline and
 * read by both the WebGL world (useFrame) and nothing else. Because every
 * visual is a pure function of that progress, reverse scrolling always
 * reconstructs the exact scene state.
 */

export const SCENE = {
  /** overall progress where Scene 1 (chaos) ends */
  chaosEnd: 0.42,
  /** overall progress where Scene 2 (tunnel) ends */
  tunnelEnd: 0.7,
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
/* Shared mutable refs (never React state — read at 60fps)             */
/* ------------------------------------------------------------------ */

export interface JourneyRefs {
  /** Smoothed master progress 0..1 (from the scrubbed GSAP timeline). */
  overall: { current: number };
  /** Normalized pointer -1..1 (fine pointers only; 0 on touch). */
  pointer: { current: { x: number; y: number } };
}

export function createJourneyRefs(): JourneyRefs {
  return {
    overall: { current: 0 },
    pointer: { current: { x: 0, y: 0 } },
  };
}

/* ------------------------------------------------------------------ */
/* Quality tiers                                                       */
/* ------------------------------------------------------------------ */

export type QualityTier = "high" | "mid" | "low";

export interface QualitySpec {
  tier: QualityTier;
  /** master particle field count (stars + shards + streaks) */
  particles: number;
  /** instanced business-artifact cards */
  artifacts: number;
  /** tangled orbit-line rings */
  rings: number;
  /** devicePixelRatio ceiling */
  dprMax: number;
}

export const QUALITY: Record<QualityTier, QualitySpec> = {
  high: { tier: "high", particles: 45000, artifacts: 34, rings: 12, dprMax: 1.75 },
  mid: { tier: "mid", particles: 25000, artifacts: 24, rings: 10, dprMax: 1.5 },
  low: { tier: "low", particles: 12000, artifacts: 13, rings: 8, dprMax: 1.4 },
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

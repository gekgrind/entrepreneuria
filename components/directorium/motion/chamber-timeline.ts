import {
  ADVISORS,
  TENSION_PAIRS,
  VERDICT_DISSENT,
  advisorById,
  type AdvisorId,
} from "@/lib/directorium/advisors";
import {
  CENTER,
  seatPoint,
  tensionApex,
} from "@/components/directorium/chamber/chamber-geometry";

import type { DirectoriumEngine } from "./engine";

/**
 * The chamber master timeline — ONE paused GSAP timeline per chamber that
 * contains the whole deliberation as a continuous sequence, with a label
 * at each approved composition:
 *
 *   idle ─ dormant ─ convened ─ debate ─ verdict
 *   (the decision arrives → convene → connect → contend → converge)
 *
 * The visitor never jumps between illustrations: a director tweens the
 * playhead to the requested label, so moving from dormant to verdict
 * plays convening and debate on the way, and scrolling back plays the
 * same causality in reverse. Every value is written inline over the
 * chamber's `data-motion="gsap"` mode (see chamber.module.css), and each
 * label's frame matches the static CSS composition for that state.
 *
 * Paint-conscious by construction: opacity, SVG transforms, and stroke
 * drawing (DrawSVG) only — no filters, no layout properties.
 */

type Gsap = DirectoriumEngine["gsap"];
export type Timeline = ReturnType<Gsap["timeline"]>;
export type ChamberLabel = "idle" | "dormant" | "convened" | "debate" | "verdict";

export const LABEL_SEQUENCE: readonly ChamberLabel[] = [
  "idle",
  "dormant",
  "convened",
  "debate",
  "verdict",
];

/** Six Hats: independent minds do not arrive in lockstep. Deterministic
 *  (no Math.random) so every visit reads the same. */
const ASYNC_ARRIVAL: Record<AdvisorId, { delay: number; pace: number }> = {
  strategist: { delay: 0, pace: 1 },
  "risk-analyst": { delay: 0.2, pace: 0.78 },
  operator: { delay: 0.46, pace: 1.18 },
  contrarian: { delay: 0.66, pace: 0.7 },
  "growth-architect": { delay: 0.84, pace: 1.05 },
  capitalist: { delay: 1.06, pace: 0.9 },
};

const EASE = {
  settle: "power2.out",
  draw: "power2.inOut",
  ignite: "expo.out",
  exchange: "sine.inOut",
} as const;

type Targets = Element | null | undefined | readonly (Element | null | undefined)[];

const list = (t: Targets): Element[] =>
  (Array.isArray(t) ? t : [t]).filter((el): el is Element => Boolean(el));

export function chamberParts(root: Element) {
  const one = (c: string) => root.querySelector(`[data-c="${c}"]`);
  const all = (c: string) => Array.from(root.querySelectorAll(`[data-c="${c}"]`));
  const of = (c: string, id: AdvisorId) =>
    root.querySelector(`[data-c="${c}"][data-advisor="${id}"]`);
  const pair = (c: string, a: AdvisorId) =>
    Array.from(root.querySelectorAll(`[data-c="${c}"][data-pair="${a}"]`));
  return {
    orbit: one("orbit"),
    ticks: all("seat-tick"),
    halos: all("halo"),
    spokes: all("spoke"),
    labels: all("label"),
    glyphs: all("glyph"),
    stances: all("stance"),
    aligned: all("aligned"),
    halves: all("tension-half"),
    contentions: all("contention"),
    coreGlow: one("core-glow"),
    coreRing: one("core-ring"),
    coreDot: one("core-dot"),
    bloom: one("bloom"),
    verdictTrack: one("verdict-track"),
    verdictArc: one("verdict-arc"),
    verdictTick: one("verdict-tick"),
    seatGlow: one("seat-glow"),
    seatRing: one("seat-ring"),
    seatRingInner: one("seat-ring-inner"),
    of,
    pair,
  };
}

export type ChamberParts = ReturnType<typeof chamberParts>;

const seatOrigin = (el: Element) => {
  const id = el.getAttribute("data-advisor") as AdvisorId | null;
  if (!id) return `${CENTER} ${CENTER}`;
  const p = seatPoint(advisorById(id).seat);
  return `${p.x} ${p.y}`;
};

const contentionOrigin = (el: Element) => {
  const id = el.getAttribute("data-pair") as AdvisorId | null;
  if (!id) return `${CENTER} ${CENTER}`;
  const p = tensionApex(advisorById(id).seat);
  return `${p.x} ${p.y}`;
};

const CORE_ORIGIN = `${CENTER} ${CENTER}`;

/** Timeline helper that silently skips parts a chamber variant lacks. */
export function timelineTo(tl: Timeline) {
  return (t: Targets, vars: gsap.TweenVars, at: number) => {
    const els = list(t);
    if (els.length) tl.to(els, vars, at);
  };
}

/**
 * Idle frame shared by every sequence: the chamber before the board has
 * convened — faint architecture, unlit seats, nothing drawn.
 */
export function applyIdle(
  gsap: Gsap,
  P: ChamberParts,
  { core = "ember" }: { core?: "ember" | "off" } = {},
) {
  const set = (t: Targets, vars: gsap.TweenVars) => {
    const els = list(t);
    if (els.length) gsap.set(els, vars);
  };
  set(P.orbit, { opacity: 0.08 });
  set(P.halos, { opacity: 0, scale: 0.55, svgOrigin: (_: number, el: Element) => seatOrigin(el) });
  set(P.glyphs, { opacity: 0.36 });
  set(P.labels, { opacity: 0.5 });
  set(P.spokes, { opacity: 0, drawSVG: "0% 0%" });
  set(P.halves, { opacity: 0, drawSVG: "0% 0%" });
  set(P.contentions, { opacity: 0, scale: 0, svgOrigin: (_: number, el: Element) => contentionOrigin(el) });
  set(P.stances, { opacity: 0, drawSVG: "50% 50%" });
  set(P.aligned, { opacity: 0, drawSVG: "50% 50%" });
  set(P.bloom, { opacity: 0, scale: 0.7, svgOrigin: CORE_ORIGIN });
  set(P.verdictTrack, { opacity: 0 });
  set(P.verdictTick, { opacity: 0 });
  set(P.verdictArc, { opacity: 0, drawSVG: "0% 0%" });
  const ember = core === "ember" ? 0.38 : 0;
  set(P.coreGlow, { opacity: ember, scale: 0.82, svgOrigin: CORE_ORIGIN });
  set(P.coreRing, { opacity: ember });
  set(P.coreDot, { opacity: ember, scale: 0.6, svgOrigin: CORE_ORIGIN });
}

export function buildChamberTimeline(
  gsap: Gsap,
  root: Element,
  { order = "board" }: { order?: "board" | "async" } = {},
): Timeline {
  const P = chamberParts(root);
  const tl = gsap.timeline({ paused: true });
  const to = timelineTo(tl);

  applyIdle(gsap, P);
  tl.addLabel("idle", 0);

  /* ── I · THE DECISION ARRIVES — the founder's core ignites ─────────── */
  let t = 0.05;
  to(P.coreGlow, { opacity: 1, scale: 1, duration: 1.3, ease: EASE.ignite }, t);
  to(P.coreDot, { opacity: 1, scale: 1, duration: 0.9, ease: "back.out(2)" }, t + 0.12);
  to(P.coreRing, { opacity: 1, duration: 0.9, ease: EASE.settle }, t + 0.25);
  t += 1.3;
  tl.addLabel("dormant", t);

  /* ── II · THE BOARD CONVENES — seats activate, connections draw ──── */
  const T2 = t + 0.15;
  let lastArrival = 0;
  ADVISORS.forEach((a, i) => {
    const arrival =
      order === "board" ? { delay: i * 0.18, pace: 1 } : ASYNC_ARRIVAL[a.id];
    const d = T2 + arrival.delay;
    const k = arrival.pace;
    lastArrival = Math.max(lastArrival, arrival.delay + 1.1 * k);
    to(P.of("glyph", a.id), { opacity: 1, duration: 0.6 * k, ease: EASE.settle }, d);
    to(P.of("halo", a.id), { opacity: 1, scale: 1, duration: 1.1 * k, ease: EASE.ignite }, d);
    to(P.of("label", a.id), { opacity: 0.9, duration: 0.6, ease: EASE.settle }, d + 0.2);
    to(P.of("spoke", a.id), { opacity: 0.55, duration: 0.15, ease: "none" }, d + 0.25);
    to(P.of("spoke", a.id), { drawSVG: "0% 100%", duration: 0.85 * k, ease: EASE.draw }, d + 0.25);
  });
  // the structure completes once every seat is connected
  to(P.orbit, { opacity: 0.12, duration: 0.9, ease: EASE.settle }, T2 + lastArrival - 0.3);
  t = T2 + lastArrival + 0.35;
  tl.addLabel("convened", t);

  /* ── III · THE DEBATE BEGINS — positions advance and meet ────────── */
  const T3 = t + 0.1;
  // attention leaves the spokes for the table
  to(P.spokes, { opacity: 0.16, duration: 0.9, ease: EASE.settle }, T3);
  to(P.halos, { opacity: 0.75, duration: 0.9, ease: EASE.settle }, T3);
  TENSION_PAIRS.forEach((pair, k) => {
    const d = T3 + 0.3 + k * 0.28;
    const a = advisorById(pair.a);
    const b = advisorById(pair.b);
    const halves = P.pair("tension-half", pair.a);
    // each advisor takes a position …
    to([P.of("stance", a.id), P.of("stance", b.id)], { opacity: 1, duration: 0.12, ease: "none" }, d);
    to([P.of("stance", a.id), P.of("stance", b.id)], { drawSVG: "0% 100%", duration: 0.7, ease: EASE.settle }, d);
    // … and advances it across the table until they meet
    to(halves, { opacity: 1, duration: 0.12, ease: "none" }, d + 0.1);
    to(halves, { drawSVG: "0% 100%", duration: 1.05, ease: EASE.draw }, d + 0.1);
    to(P.pair("contention", pair.a), { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2.4)" }, d + 1.1);
  });
  // restrained contention: opposing halves trade brightness twice, then hold level
  const C = T3 + 0.3 + 2 * 0.28 + 1.4;
  TENSION_PAIRS.forEach((pair, k) => {
    const [ha, hb] = P.pair("tension-half", pair.a);
    const low = pair.primary ? 0.32 : 0.6;
    const c = C + k * 0.12;
    to(ha, { opacity: low, duration: 0.5, ease: EASE.exchange }, c);
    to(ha, { opacity: 1, duration: 0.5, ease: EASE.exchange }, c + 0.5);
    to(hb, { opacity: low, duration: 0.5, ease: EASE.exchange }, c + 0.5);
    to(hb, { opacity: 1, duration: 0.5, ease: EASE.exchange }, c + 1.0);
  });
  t = C + 0.24 + 1.6;
  tl.addLabel("debate", t);

  /* ── IV · THE VERDICT — resolve, align, converge, confidence ─────── */
  const T4 = t + 0.1;
  to(P.halves, { opacity: 0.1, duration: 1.0, ease: EASE.settle }, T4);
  to(P.contentions, { opacity: 0.1, duration: 0.8, ease: EASE.settle }, T4);
  ADVISORS.filter((a) => a.id !== VERDICT_DISSENT).forEach((a, i) => {
    const d = T4 + 0.35 + i * 0.16;
    to(P.of("stance", a.id), { opacity: 0, duration: 0.6, ease: EASE.settle }, d);
    to(P.of("aligned", a.id), { opacity: 1, duration: 0.12, ease: "none" }, d);
    to(P.of("aligned", a.id), { drawSVG: "0% 100%", duration: 0.7, ease: EASE.settle }, d);
  });
  // connections converge on the decision, seat by seat
  ADVISORS.forEach((a, i) => {
    to(P.of("spoke", a.id), { opacity: 0.9, duration: 0.8, ease: EASE.settle }, T4 + 0.7 + i * 0.08);
  });
  to(P.halos, { opacity: 0.85, duration: 0.9, ease: EASE.settle }, T4 + 0.7);
  to(P.bloom, { opacity: 1, scale: 1, duration: 1.5, ease: EASE.ignite }, T4 + 1.3);
  to([P.verdictTrack, P.verdictTick], { opacity: 1, duration: 0.6, ease: EASE.settle }, T4 + 1.35);
  to(P.verdictArc, { opacity: 1, duration: 0.1, ease: "none" }, T4 + 1.45);
  to(P.verdictArc, { drawSVG: "0% 100%", duration: 1.5, ease: EASE.draw }, T4 + 1.45);
  t = T4 + 3.1;
  tl.addLabel("verdict", t);

  return tl;
}

/**
 * Director — moves a chamber timeline between labels. A single step
 * plays at authored speed; skipping several (fast scrolling) compresses
 * the journey so it still passes through every state without lagging
 * the reader. Reverse plays the same causality back, a little quicker.
 */
export function createDirector(tl: Timeline) {
  let target: ChamberLabel = "idle";
  let active: ReturnType<Timeline["tweenTo"]> | null = null;

  const position = (label: ChamberLabel) => tl.labels[label] ?? 0;

  return {
    get target() {
      return target;
    },
    seek(label: ChamberLabel) {
      active?.kill();
      active = null;
      target = label;
      tl.pause(position(label), false);
    },
    goTo(label: ChamberLabel, { timeScale = 1 }: { timeScale?: number } = {}) {
      if (label === target) return;
      target = label;
      active?.kill();
      const from = tl.time();
      const to = position(label);
      const forward = to > from;
      const distance = Math.abs(to - from);
      const crossed = LABEL_SEQUENCE.filter((l) => {
        const p = position(l);
        return p > Math.min(from, to) + 0.01 && p <= Math.max(from, to) + 0.01;
      }).length;
      const duration = forward
        ? crossed <= 1
          ? distance
          : Math.min(distance, 1.6 + crossed * 0.7)
        : Math.min(distance * 0.6, 1.8);
      active = tl.tweenTo(to, { duration: duration / timeScale, ease: "none" });
    },
    /** Stop and discard the timeline (rebuilds, teardown). */
    destroy() {
      active?.kill();
      active = null;
      tl.kill();
    },
  };
}

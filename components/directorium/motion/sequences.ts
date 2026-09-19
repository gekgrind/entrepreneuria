import { ADVISORS, type AdvisorId } from "@/lib/directorium/advisors";
import { CENTER } from "@/components/directorium/chamber/chamber-geometry";

import {
  applyIdle,
  chamberParts,
  timelineTo,
  type Timeline,
} from "./chamber-timeline";
import type { DirectoriumEngine } from "./engine";

type Gsap = DirectoriumEngine["gsap"];

/**
 * One-shot sequences (play once, then hold) and the board glyph
 * inspection timelines. Same vocabulary as the process master timeline:
 * opacity, SVG transforms, DrawSVG — no filters, no layout.
 */

/* ------------------------------------------------------------------ */
/* Six Hats — LEFT: one model, six prompts                              */
/* Everything moves in unison: one source lights, six identical outputs */
/* answer on the same beat, and echo it once more, fainter.             */
/* ------------------------------------------------------------------ */

export function buildEchoTimeline(gsap: Gsap, root: Element): Timeline {
  const q = (e: string) => Array.from(root.querySelectorAll(`[data-e="${e}"]`));
  const source = q("source");
  const broadcast = q("broadcast");
  const personas = q("persona");
  const masks = q("mask");

  gsap.set(source, { opacity: 0.3 });
  gsap.set(broadcast, { opacity: 0 });
  gsap.set(personas, { opacity: 0.25, transformOrigin: "50% 50%" });
  gsap.set(masks, { opacity: 0 });

  const tl = gsap.timeline({ paused: true });
  tl.to(source, { opacity: 1, duration: 0.6, ease: "power2.out" }, 0)
    // one broadcast, all six at once — no stagger, by design
    .to(broadcast, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.45)
    .to(personas, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.75)
    .to(masks, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.75);

  // the echo: the source speaks and all six answer identically, on the
  // identical beat — twice, the second fainter. Ends on the static frame.
  const pulse = (at: number, strength: number) => {
    tl.to(source, { opacity: 0.55, duration: 0.18, ease: "power1.out" }, at - 0.18)
      .to(source, { opacity: 1, duration: 0.3, ease: "power2.out" }, at)
      .to(broadcast, { opacity: 0.25, duration: 0.2, ease: "power1.out" }, at - 0.2)
      .to(broadcast, { opacity: 1, duration: 0.35, ease: "power2.out" }, at)
      .to(personas, { opacity: 0.4, duration: 0.2, ease: "power1.out" }, at - 0.2)
      .to(personas, { opacity: 1, duration: 0.35, ease: "power2.out" }, at + 0.12)
      .to(personas, { scale: 1 + 0.12 * strength, duration: 0.3, ease: "sine.out" }, at + 0.12)
      .to(personas, { scale: 1, duration: 0.45, ease: "sine.inOut" }, at + 0.42);
  };
  pulse(1.55, 1);
  pulse(2.55, 0.55);
  return tl;
}

/* ------------------------------------------------------------------ */
/* Final CTA — the board convenes around the founder's open seat        */
/* ------------------------------------------------------------------ */

export function buildConveneTimeline(
  gsap: Gsap,
  root: Element,
  ctaGlow: Element | null,
): Timeline {
  const P = chamberParts(root);
  const tl = gsap.timeline({ paused: true });
  const to = timelineTo(tl);
  const set = (t: Element | null | Element[], vars: gsap.TweenVars) => {
    const els = (Array.isArray(t) ? t : [t]).filter(Boolean) as Element[];
    if (els.length) gsap.set(els, vars);
  };

  applyIdle(gsap, P, { core: "off" });
  set(P.orbit, { opacity: 0.04 });
  set(P.labels, { opacity: 0 });
  set(P.ticks, { opacity: 0.25 });
  set(P.seatGlow, { opacity: 0.12, scale: 0.9, svgOrigin: `${CENTER} ${CENTER}` });
  set(P.seatRing, { opacity: 0.3, scale: 0.97, svgOrigin: `${CENTER} ${CENTER}` });
  set(P.seatRingInner, { opacity: 0 });
  set(ctaGlow, { opacity: 0, scale: 0.6 });

  to(P.orbit, { opacity: 0.12, duration: 1.4, ease: "power2.out" }, 0);
  ADVISORS.forEach((a, i) => {
    const d = 0.25 + i * 0.16;
    to(P.of("glyph", a.id), { opacity: 1, duration: 0.6, ease: "power2.out" }, d);
    to(P.of("halo", a.id), { opacity: 1, scale: 1, duration: 1.1, ease: "expo.out" }, d);
    to(P.of("seat-tick", a.id), { opacity: 1, duration: 0.6, ease: "power2.out" }, d);
    to(P.of("label", a.id), { opacity: 0.9, duration: 0.6, ease: "power2.out" }, d + 0.2);
    // connections resolve inward, toward the founder
    to(P.of("spoke", a.id), { opacity: 0.55, duration: 0.15, ease: "none" }, d + 0.3);
    to(P.of("spoke", a.id), { drawSVG: "0% 100%", duration: 0.9, ease: "power2.inOut" }, d + 0.3);
  });
  const arrive = 0.25 + 5 * 0.16 + 0.3 + 0.9; // last connection reaches the seat
  to(P.seatRing, { opacity: 1, scale: 1, duration: 0.9, ease: "power3.out" }, arrive - 0.35);
  to(P.seatRingInner, { opacity: 1, duration: 0.9, ease: "power2.out" }, arrive - 0.2);
  to(P.seatGlow, { opacity: 0.55, scale: 1, duration: 1.6, ease: "expo.out" }, arrive - 0.35);
  // the destination: the founder's action takes the light, then holds
  to(ctaGlow, { opacity: 1, scale: 1, duration: 1.3, ease: "expo.out" }, arrive - 0.1);
  to(ctaGlow, { opacity: 0.6, duration: 1.4, ease: "power2.inOut" }, arrive + 1.2);
  return tl;
}

/* ------------------------------------------------------------------ */
/* Board — glyph inspection (~600ms). Only the glyph's internal         */
/* geometry responds: an instrument reacting to being looked at.        */
/* Played forward on enter, reversed on leave.                          */
/* ------------------------------------------------------------------ */

export function buildGlyphTimeline(gsap: Gsap, svg: Element): Timeline | null {
  const id = svg.getAttribute("data-glyph") as AdvisorId | null;
  if (!id) return null;
  const g = (name: string) => Array.from(svg.querySelectorAll(`[data-g="${name}"]`));
  const O = { svgOrigin: "0 0" };
  const tl = gsap.timeline({ paused: true, defaults: { duration: 0.6, ease: "power2.inOut" } });

  switch (id) {
    case "strategist":
      // the range turns; the bearing checks its heading and holds
      tl.to(g("range"), { rotation: 60, ...O }, 0)
        .to(g("bearing"), { rotation: -14, duration: 0.3, ease: "power2.out", ...O }, 0)
        .to(g("bearing"), { rotation: 0, duration: 0.3, ease: "power2.inOut", ...O }, 0.3);
      break;
    case "capitalist":
      // tiers advance at compounding rates
      tl.to(g("tier-1"), { rotation: 36, ...O }, 0)
        .to(g("tier-2"), { rotation: 24, ...O }, 0)
        .to(g("tier-3"), { rotation: 14, ...O }, 0);
      break;
    case "growth-architect":
      // growth reaches the outer nodes, branch by branch
      tl.to(g("lattice"), { opacity: 0.7, duration: 0.2, ease: "power1.out" }, 0)
        .to(g("lattice"), { opacity: 1, duration: 0.4 }, 0.2)
        .to(g("leaf"), {
          scale: 1.7,
          transformOrigin: "50% 50%",
          duration: 0.3,
          ease: "power2.out",
          stagger: { each: 0.06, from: "center" },
        }, 0.05)
        .to(g("leaf"), {
          scale: 1,
          duration: 0.3,
          ease: "power2.inOut",
          stagger: { each: 0.06, from: "center" },
        }, 0.3);
      break;
    case "operator":
      // the hand advances one tick
      tl.to(g("hand"), { rotation: 30, ease: "back.out(1.8)", ...O }, 0)
        .to(g("dial"), { scale: 1.18, duration: 0.25, ease: "power2.out", ...O }, 0)
        .to(g("dial"), { scale: 1, duration: 0.35, ease: "power2.inOut", ...O }, 0.25);
      break;
    case "risk-analyst":
      // the sweep crosses the perimeter; the fault line is flagged
      tl.to(g("sweep"), { rotation: 120, ...O }, 0)
        .to(g("fault"), { opacity: 0.35, duration: 0.2, ease: "power1.out" }, 0.15)
        .to(g("fault"), { opacity: 1, duration: 0.25, ease: "power1.in" }, 0.35);
      break;
    case "contrarian":
      // the off-axis centre crosses to the other side
      tl.to(g("counter"), { x: -9, y: 7, ease: "power3.inOut" }, 0)
        .to(g("chevron"), { x: -3, duration: 0.3, ease: "power2.out" }, 0.15);
      break;
  }
  return tl;
}

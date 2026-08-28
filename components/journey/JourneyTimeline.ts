/**
 * JourneyTimeline â€” the master scrubbed timeline (GSAP owns time).
 *
 * One ScrollTrigger over the 500vh sticky stage drives EVERYTHING:
 * the smoothed master progress ref consumed by the WebGL world, all
 * DOM text choreography, and the background color journey. Timeline
 * duration is normalized to 100 units so positions map to overall
 * progress percentages:
 *
 *   0â€“42   Scene 1  CHAOS   (hero recedes, interior questions, vortex)
 *   42â€“70  Scene 2  TUNNEL  (world-only; DOM quiet)
 *   70â€“100 Scene 3  THE TURN (copy arrives, dwell, dissolution)
 *
 * Because every tween is scrubbed on one timeline, reverse scrolling
 * reconstructs every state exactly.
 */
import type { gsap } from "gsap";

type TweenVars = gsap.TweenVars;

import type { MotionEngine } from "@/components/home/motion/gsap-setup";
import type { JourneyRefs } from "./journey-math";

export function buildJourneyTimeline(
  engine: MotionEngine,
  stage: HTMLElement,
  refs: JourneyRefs,
): () => void {
  const { gsap, SplitText } = engine;
  const q = <T extends HTMLElement = HTMLElement>(sel: string) =>
    stage.querySelector<T>(sel);

  const hero = q("[data-j-hero]");
  const q1 = q("[data-j-q1]");
  const q2 = q("[data-j-q2]");
  const q3 = q("[data-j-q3]");
  const turnKicker = q("[data-j-turn-kicker]");
  const turnPrimary = q("[data-j-turn-primary]");
  const turnSupport = q("[data-j-turn-support]");

  /* Split the Scene 3 copy into chars for the dissolution. The source
     text stays semantic DOM; chars are visual fragments of the same nodes. */
  const splits: Array<{ revert: () => void }> = [];
  /* words,chars: chars dissolve individually, but word wrappers keep
     line-breaking at word boundaries (no mid-word wraps) */
  const primarySplit = turnPrimary
    ? new SplitText(turnPrimary, { type: "words,chars" })
    : null;
  const supportSplit = turnSupport
    ? new SplitText(turnSupport, { type: "words,chars" })
    : null;
  if (primarySplit) splits.push(primarySplit);
  if (supportSplit) splits.push(supportSplit);

  gsap.set([q1, q2, q3], { opacity: 0, transformPerspective: 1200 });
  gsap.set([turnKicker, turnPrimary, turnSupport], {
    opacity: 0,
    transformPerspective: 1200,
  });

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: stage,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.45,
    },
  });

  /* The WebGL world reads the SMOOTHED timeline progress â€” DOM and GL
     share one clock. */
  tl.eventCallback("onUpdate", () => {
    refs.overall.current = tl.progress();
  });

  /* normalize the timeline to exactly 100 units */
  tl.set({}, {}, 100);

  /* ---------------- background color journey ---------------- */
  tl.to(stage, { backgroundColor: "#050b14", duration: 30 } as TweenVars, 0);
  tl.to(stage, { backgroundColor: "#04070f", duration: 15 } as TweenVars, 30);
  tl.to(stage, { backgroundColor: "#02040a", duration: 25 } as TweenVars, 45);
  tl.to(stage, { backgroundColor: "#081527", duration: 12 } as TweenVars, 88);

  /* ---------------- Scene 1 â€” CHAOS ---------------- */
  if (hero) {
    tl.to(
      hero,
      { z: -280, y: -60, opacity: 0, duration: 8, ease: "power2.in" },
      6,
    );
  }

  const question = (
    el: HTMLElement | null,
    from: TweenVars,
    inAt: number,
    outAt: number,
  ) => {
    if (!el) return;
    tl.fromTo(
      el,
      { ...from, opacity: 0 },
      { x: 0, y: 0, z: 0, rotation: 0, opacity: 1, duration: 9, ease: "power2.out" },
      inAt,
    );
    tl.to(
      el,
      { x: 120, y: 80, z: 260, scale: 0.55, opacity: 0, duration: 7, ease: "power2.in" },
      outAt,
    );
  };

  /* questions exit INTO the vortex before the collapse (Scene 1 = 0â€“42) */
  question(q1, { x: -360, y: -150, z: -450, rotation: -7 }, 15, 30);
  question(q2, { x: 340, y: 60, z: -380, rotation: 5 }, 19, 33);
  question(q3, { x: -80, y: 260, z: -300, rotation: 4 }, 23, 36);

  /* ---------------- Scene 3 â€” THE TURN ---------------- */
  if (turnKicker) {
    tl.fromTo(
      turnKicker,
      { opacity: 0, y: 24, z: -120 },
      { opacity: 1, y: 0, z: 0, duration: 4, ease: "power2.out" },
      73,
    );
    tl.to(turnKicker, { opacity: 0, duration: 2, ease: "power1.in" }, 91);
  }
  if (turnPrimary) {
    tl.fromTo(
      turnPrimary,
      { opacity: 0, z: -460, y: 70 },
      { opacity: 1, z: 0, y: 0, duration: 6.5, ease: "power2.out" },
      75,
    );
  }
  if (turnSupport) {
    tl.fromTo(
      turnSupport,
      { opacity: 0, x: -220, y: 130, z: -220, rotation: 3 },
      { opacity: 1, x: 0, y: 0, z: 0, rotation: 0, duration: 5.5, ease: "power2.out" },
      81.5,
    );
  }

  /* dwell: 87â€“91 â€” nothing moves but the stars */

  /* dissolution: the copy fragments into the space it came from */
  if (primarySplit?.chars?.length) {
    tl.to(
      primarySplit.chars,
      {
        x: () => gsap.utils.random(-460, 460),
        y: () => gsap.utils.random(-360, 260),
        z: () => gsap.utils.random(-520, -80),
        rotation: () => gsap.utils.random(-100, 100),
        opacity: 0,
        duration: 7,
        ease: "power1.in",
        stagger: { each: 0.02, from: "random" },
      },
      91.5,
    );
  }
  if (supportSplit?.chars?.length) {
    tl.to(
      supportSplit.chars,
      {
        x: () => gsap.utils.random(-380, 380),
        y: () => gsap.utils.random(-260, 320),
        z: () => gsap.utils.random(-460, -60),
        rotation: () => gsap.utils.random(-80, 80),
        opacity: 0,
        duration: 7,
        ease: "power1.in",
        stagger: { each: 0.015, from: "random" },
      },
      92.5,
    );
  }

  return () => {
    tl.scrollTrigger?.kill();
    tl.kill();
    splits.forEach((s) => s.revert());
  };
}

/**
 * JourneyTimeline — the master scrubbed timeline (GSAP owns time).
 *
 * One ScrollTrigger over the sticky stage drives EVERYTHING: the
 * smoothed master progress ref consumed by the WebGL world, all DOM
 * text choreography, and the background color journey. Timeline
 * positions are expressed in the same units the world reads
 * (refs.overall.current = tl.progress() * TIMELINE_UNITS):
 *
 *   0–42    Scene 1  CHAOS   (hero recedes, interior questions, vortex)
 *   42–70   Scene 2  TUNNEL  (world-only; DOM quiet)
 *   70–100  Scene 3  THE TURN (copy arrives, dwell, dissolution)
 *   100–150 Scene 4  THE ECOSYSTEM FORMS (assembly, copy right)
 *   150–205 Scene 5  PRODUCT EXPLORATION (cards cycle the reading plane)
 *   205–250 Scene 6  MEET PROSPRA (brain assembles, copy left)
 *   250–320 Scene 7  PROOF (screenshot stack rises through the trace)
 *   320–385 Scene 8  BELIEF (glass cards, then disintegration)
 *   385–450 Scene 9  RESOLUTION (ecosystem reforms, statement, CTA)
 *
 * Because every tween is scrubbed on one timeline, reverse scrolling
 * reconstructs every state exactly.
 */
import type { gsap } from "gsap";

type TweenVars = gsap.TweenVars;

import type { MotionEngine } from "@/components/home/motion/gsap-setup";
import { SCENE, TIMELINE_UNITS, type JourneyRefs } from "./journey-math";

/* ------------------------------------------------------------------ */
/* Scene 5 card windows — shared with the DOM layer so hotspot clicks  */
/* can scroll a product into its reading plane.                        */
/* ------------------------------------------------------------------ */

export interface CardWindow {
  enter: number;
  exit: number;
}

export function cardWindowFor(index: number): CardWindow {
  const enter = 151 + index * 10.2;
  return { enter, exit: enter + 7.6 };
}

export function buildJourneyTimeline(
  engine: MotionEngine,
  stage: HTMLElement,
  refs: JourneyRefs,
  exploreSlugs: string[],
  onActiveProduct?: (slug: string | null) => void,
): () => void {
  const { gsap, SplitText } = engine;
  const q = <T extends HTMLElement = HTMLElement>(sel: string) =>
    stage.querySelector<T>(sel);
  const qa = <T extends HTMLElement = HTMLElement>(sel: string) =>
    Array.from(stage.querySelectorAll<T>(sel));

  const hero = q("[data-j-hero]");
  const q1 = q("[data-j-q1]");
  const q2 = q("[data-j-q2]");
  const q3 = q("[data-j-q3]");
  const turnKicker = q("[data-j-turn-kicker]");
  const turnPrimary = q("[data-j-turn-primary]");
  const turnSupport = q("[data-j-turn-support]");
  const ecoKicker = q("[data-j-eco-kicker]");
  const ecoHeading = q("[data-j-eco-heading]");
  const ecoLede = q("[data-j-eco-lede]");
  const proKicker = q("[data-j-pro-kicker]");
  const proHeading = q("[data-j-pro-heading]");
  const proLede = q("[data-j-pro-lede]");
  const proBullets = qa("[data-j-pro-bullet]");
  const proCta = q("[data-j-pro-cta]");
  const cards = qa("[data-j-card]");
  /* Scene 7 — the proof stack */
  const proofKicker = q("[data-j-proof-kicker]");
  const proofLine = q("[data-j-proof-line]");
  const shotCards = qa("[data-j-shot]");
  /* Scene 8 — the belief cards */
  const belKicker = q("[data-j-bel-kicker]");
  const beliefCards = qa("[data-j-bcard]");
  const beliefSurfaces = qa("[data-j-bsurface]");
  const beliefTitles = qa("[data-j-btitle]");
  const beliefBodies = qa("[data-j-bbody]");
  const shardLists = beliefCards.map((c) =>
    Array.from(c.querySelectorAll<HTMLElement>("[data-j-bshard]")),
  );
  /* Scene 9 — the resolution */
  const finKicker = q("[data-j-fin-kicker]");
  const finH2 = q("[data-j-fin-h2]");
  const finLede = q("[data-j-fin-lede]");
  const finCta = q("[data-j-fin-cta]");

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
  /* Scene 8 headings split for the disintegration — same approved
     pattern as the Scene 3 dissolution (text stays semantic DOM) */
  const beliefSplits = beliefTitles.map(
    (t) => new SplitText(t, { type: "words,chars" }),
  );
  splits.push(...beliefSplits);

  /* stacked (mobile-class) compositions damp the depth choreography */
  const st = refs.stacked.current;

  gsap.set([q1, q2, q3], { opacity: 0, transformPerspective: 1200 });
  gsap.set([turnKicker, turnPrimary, turnSupport], {
    opacity: 0,
    transformPerspective: 1200,
  });
  gsap.set(
    [ecoKicker, ecoHeading, ecoLede, proKicker, proHeading, proLede, proCta, ...proBullets],
    { opacity: 0, transformPerspective: 1200 },
  );
  gsap.set(cards, { transformPerspective: 1200 });
  gsap.set([proofKicker, proofLine, belKicker, finKicker, finH2, finLede, finCta], {
    opacity: 0,
    transformPerspective: 1200,
  });
  /* proof stack: centered via percent offsets, depth via transforms */
  gsap.set(shotCards, {
    xPercent: -50,
    yPercent: -50,
    opacity: 0,
    transformPerspective: 1200,
    filter: "brightness(1)",
  });
  gsap.set(beliefCards, {
    xPercent: -50,
    yPercent: -50,
    opacity: 0,
    transformPerspective: 1200,
    "--focus": 0,
  } as TweenVars);
  gsap.set(beliefSurfaces, { filter: "blur(0px) brightness(1)" });
  shardLists.forEach((shards) => gsap.set(shards, { autoAlpha: 0 }));

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: stage,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.45,
    },
  });

  /* The WebGL world reads the SMOOTHED timeline progress (in timeline
     units) — DOM and GL share one clock. The same hook derives the
     scroll-driven active product for the galaxy highlight. */
  tl.eventCallback("onUpdate", () => {
    const units = tl.progress() * TIMELINE_UNITS;
    refs.overall.current = units;
    let active: string | null = null;
    for (let i = 0; i < exploreSlugs.length; i += 1) {
      const w = cardWindowFor(i);
      if (units > w.enter + 2.5 && units < w.exit + 1.2) {
        active = exploreSlugs[i] ?? null;
        break;
      }
    }
    if (refs.activeProduct.current !== active) {
      refs.activeProduct.current = active;
      /* the DOM layer mirrors the change (card ↔ node relationship) —
         ref writes alone never re-render */
      onActiveProduct?.(active);
    }
  });

  /* normalize the timeline to exactly TIMELINE_UNITS units */
  tl.set({}, {}, TIMELINE_UNITS);

  /* ---------------- background color journey ---------------- */
  tl.to(stage, { backgroundColor: "#050b14", duration: 30 } as TweenVars, 0);
  tl.to(stage, { backgroundColor: "#04070f", duration: 15 } as TweenVars, 30);
  tl.to(stage, { backgroundColor: "#02040a", duration: 25 } as TweenVars, 45);
  tl.to(stage, { backgroundColor: "#081527", duration: 12 } as TweenVars, 88);
  /* Scenes 4–6: environmental navy shifts, never section bands */
  tl.to(stage, { backgroundColor: "#061021", duration: 16 } as TweenVars, 106);
  tl.to(stage, { backgroundColor: "#040a16", duration: 20 } as TweenVars, 122);
  tl.to(stage, { backgroundColor: "#07162b", duration: 16 } as TweenVars, 208);
  tl.to(stage, { backgroundColor: "#081527", duration: 16 } as TweenVars, 224);
  /* Scenes 7–9: deepened for the proof, intimate for belief, then the
     resolution returns to the SAME void the journey opened in */
  tl.to(stage, { backgroundColor: "#030710", duration: 14 } as TweenVars, 252);
  tl.to(stage, { backgroundColor: "#020409", duration: 16 } as TweenVars, 322);
  tl.to(stage, { backgroundColor: "#081527", duration: 18 } as TweenVars, 390);

  /* ---------------- Scene 1 — CHAOS ---------------- */
  if (hero) {
    tl.to(
      hero,
      { z: -280, y: -60, autoAlpha: 0, duration: 8, ease: "power2.in" },
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

  /* questions exit INTO the vortex before the collapse (Scene 1 = 0–42) */
  question(q1, { x: -360, y: -150, z: -450, rotation: -7 }, 15, 30);
  question(q2, { x: 340, y: 60, z: -380, rotation: 5 }, 19, 33);
  question(q3, { x: -80, y: 260, z: -300, rotation: 4 }, 23, 36);

  /* ---------------- Scene 3 — THE TURN ---------------- */
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

  /* dwell: 87–91 — nothing moves but the stars */

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

  /* ---------------- Scene 4 — THE ECOSYSTEM FORMS ---------------- */
  /* The world does the talking 100–133: dispersed stars find gravity,
       streams appear, orbits resolve. Copy enters late, from depth. */
  if (ecoKicker) {
    tl.fromTo(
      ecoKicker,
      { autoAlpha: 0, x: 110, z: -160 },
      { autoAlpha: 1, x: 0, z: 0, duration: 4.5, ease: "power2.out" },
      133,
    );
  }
  if (ecoHeading) {
    tl.fromTo(
      ecoHeading,
      { autoAlpha: 0, z: -540, y: 60 },
      { autoAlpha: 1, z: 0, y: 0, duration: 6.5, ease: "power2.out" },
      135.5,
    );
  }
  if (ecoLede) {
    tl.fromTo(
      ecoLede,
      { autoAlpha: 0, x: 140, y: 110, z: -260, rotation: 2 },
      { autoAlpha: 1, x: 0, y: 0, z: 0, rotation: 0, duration: 6, ease: "power2.out" },
      138.5,
    );
  }
  /* hand off to exploration — the heading recedes before the cards arrive */
  tl.to(
    [ecoKicker, ecoHeading, ecoLede].filter(Boolean) as HTMLElement[],
    { autoAlpha: 0, z: -260, y: -50, duration: 4, ease: "power2.in", stagger: 0.5 },
    146.5,
  );

  /* ---------------- Scene 5 — PRODUCT EXPLORATION ---------------- */
  /* Each card enters from the lower-right depth, settles into the
     reading plane, then drifts back toward the galaxy it came from.
     Cards overlap slightly so the next is always arriving. */
  cards.forEach((card, i) => {
    const w = cardWindowFor(i);
    tl.fromTo(
      card,
      { autoAlpha: 0, x: 230, y: 120, z: -420, rotation: 3 },
      { autoAlpha: 1, x: 0, y: 0, z: 0, rotation: 0, duration: 4.5, ease: "power2.out" },
      w.enter,
    );
    tl.to(
      card,
      { autoAlpha: 0, x: -90, y: -130, z: -360, rotation: -2, duration: 2.8, ease: "power2.in" },
      w.exit,
    );
  });

  /* ---------------- Scene 6 — MEET PROSPRA ---------------- */
  /* The galaxy departs in the world; copy builds on the left while the
     brain gathers on the right. This composition STAYS — it is the end
     state of the phase. */
  if (proKicker) {
    tl.fromTo(
      proKicker,
      { autoAlpha: 0, x: -110, z: -150 },
      { autoAlpha: 1, x: 0, z: 0, duration: 4.5, ease: "power2.out" },
      230,
    );
  }
  if (proHeading) {
    tl.fromTo(
      proHeading,
      { autoAlpha: 0, z: -500, y: 56 },
      { autoAlpha: 1, z: 0, y: 0, duration: 6.5, ease: "power2.out" },
      232.5,
    );
  }
  if (proLede) {
    tl.fromTo(
      proLede,
      { autoAlpha: 0, x: -190, y: 115, z: -250, rotation: 2 },
      { autoAlpha: 1, x: 0, y: 0, z: 0, rotation: 0, duration: 6, ease: "power2.out" },
      236,
    );
  }
  proBullets.forEach((b, i) => {
    tl.fromTo(
      b,
      { autoAlpha: 0, x: -50, y: 36 },
      { autoAlpha: 1, x: 0, y: 0, duration: 4, ease: "power2.out" },
      239.5 + i * 1.3,
    );
  });
  if (proCta) {
    tl.fromTo(
      proCta,
      { autoAlpha: 0, y: 26 },
      { autoAlpha: 1, y: 0, duration: 4, ease: "power2.out" },
      243.5,
    );
  }

  /* ---------------- Scene 6 → 7 — intelligence becomes product -------- */
  /* The Prospra copy yields the stage; in the world, the brain streams
     onto the proof-frame perimeter (uProofT, same scrubbed clock). */
  const proGroup = [proKicker, proHeading, proLede, ...proBullets, proCta].filter(
    Boolean,
  ) as HTMLElement[];
  tl.to(
    proGroup,
    { autoAlpha: 0, z: -240, y: -44, duration: 4.5, ease: "power2.in", stagger: 0.35 },
    250.5,
  );

  /* Scene 7 intro: why the visitor is seeing this — then it gets out
     of the way of the product (fully gone before the first card rises
     into its space) */
  if (proofKicker) {
    tl.fromTo(
      proofKicker,
      { autoAlpha: 0, x: -90, z: -140 },
      { autoAlpha: 1, x: 0, z: 0, duration: 4, ease: "power2.out" },
      256.5,
    );
  }
  if (proofLine) {
    tl.fromTo(
      proofLine,
      { autoAlpha: 0, x: -120, y: 60, z: -180 },
      { autoAlpha: 1, x: 0, y: 0, z: 0, duration: 4, ease: "power2.out" },
      258,
    );
  }
  tl.to(
    [proofKicker, proofLine].filter(Boolean) as HTMLElement[],
    { autoAlpha: 0, y: -28, duration: 2.5, ease: "power1.in" },
    262.5,
  );

  /* ---------------- Scene 7 — THE PROOF STACK ---------------- */
  /* Each card rises from lower/deeper space into the readable plane,
     dwells, then steps back as the next arrives — evidence accumulating
     into an architectural stack. No autoplay: scroll owns every state. */
  const shotEnter = st
    ? { y: 220, z: -160, rotationX: 0 }
    : { y: 300, z: -520, rotationX: 7 };
  const shotBack1 = st
    ? { y: -34, z: -70, scale: 0.95 }
    : { y: -56, z: -170, scale: 0.93 };
  const shotBack2 = st
    ? { y: -60, z: -125, scale: 0.91 }
    : { y: -100, z: -310, scale: 0.885 };

  shotCards.forEach((card, i) => {
    const enter = 261 + i * 19;
    tl.fromTo(
      card,
      { autoAlpha: 0, ...shotEnter },
      { autoAlpha: 1, x: 0, y: 0, z: 0, rotationX: 0, duration: 5.5, ease: "power2.out" },
      enter,
    );
  });
  if (shotCards[0]) {
    tl.to(
      shotCards[0],
      { ...shotBack1, filter: "brightness(0.55)", duration: 4, ease: "power2.inOut" },
      279.5,
    );
    tl.to(
      shotCards[0],
      { ...shotBack2, filter: "brightness(0.36)", duration: 4, ease: "power2.inOut" },
      298.9,
    );
  }
  if (shotCards[1]) {
    tl.to(
      shotCards[1],
      { ...shotBack1, filter: "brightness(0.55)", duration: 4, ease: "power2.inOut" },
      298.5,
    );
  }
  /* 7 → 8: the stack compresses and recedes — evidence → meaning */
  tl.to(
    shotCards,
    { autoAlpha: 0, z: -560, y: 70, filter: "brightness(0.2)", duration: 6, ease: "power2.in", stagger: 0.7 },
    318.5,
  );

  /* ---------------- Scene 8 — BELIEF / VALUE PROOF ---------------- */
  /* Cards progress left → right through the center focus. The focused
     card owns attention (cyan emphasis via --focus); released cards
     recede to a dim side plane and WAIT — all three disintegrate. */
  if (belKicker) {
    tl.fromTo(
      belKicker,
      { autoAlpha: 0, y: 20 },
      { autoAlpha: 1, y: 0, duration: 4, ease: "power2.out" },
      322,
    );
    tl.to(belKicker, { autoAlpha: 0, duration: 2, ease: "power1.in" }, 376.5);
  }

  const belIn = st
    ? { x: -280, z: -140, rotationY: 0 }
    : { x: -580, z: -340, rotationY: -9 };
  const belOut = st
    ? { x: 250, z: -110, rotationY: 0 }
    : { x: 540, z: -260, rotationY: 7 };

  beliefCards.forEach((card, i) => {
    const approach = 324 + i * 17;
    const focusAt = approach + 4;
    const releaseAt = approach + 17;
    tl.fromTo(
      card,
      { autoAlpha: 0, ...belIn },
      { autoAlpha: 1, x: 0, y: 0, z: 0, rotationY: 0, duration: 5.5, ease: "power2.out" },
      approach,
    );
    tl.to(card, { "--focus": 1, duration: 2.5, ease: "power1.inOut" } as TweenVars, focusAt);
    if (i < beliefCards.length - 1) {
      /* released cards recede to a staggered side plane, still present */
      const depth = 1 + (beliefCards.length - 1 - i) * 0.38;
      tl.to(
        card,
        {
          x: belOut.x * depth,
          z: belOut.z * depth,
          rotationY: belOut.rotationY,
          autoAlpha: 0.26 - (beliefCards.length - 1 - i) * 0.08,
          duration: 4.5,
          ease: "power2.in",
        },
        releaseAt,
      );
      tl.to(card, { "--focus": 0.12, duration: 2.5 } as TweenVars, releaseAt + 0.5);
    }
  });

  /* ---------------- Scene 8 — DISINTEGRATION ---------------- */
  /* The cards don't fade: glass edges fragment into points, surfaces
     lose cohesion, typography scatters (semantic DOM, same approved
     SplitText pattern as Scene 3) — and the SAME scrubbed scroll
     reconstructs every fragment on reverse. */
  beliefCards.forEach((card, i) => {
    const at = SCENE.disintegrateStart + i * 0.8;
    const surface = beliefSurfaces[i];
    const body = beliefBodies[i];
    const split = beliefSplits[i];
    const shards = shardLists[i] ?? [];

    tl.to(card, { "--focus": 0, duration: 2 } as TweenVars, at);
    if (surface) {
      tl.to(
        surface,
        { autoAlpha: 0, filter: "blur(14px) brightness(0.55)", duration: 5.5, ease: "power1.in" },
        at,
      );
    }
    if (body) {
      tl.to(body, { autoAlpha: 0, y: -18, duration: 3.5, ease: "power1.in" }, at + 0.3);
    }
    if (split?.chars?.length) {
      tl.to(
        split.chars,
        {
          x: () => gsap.utils.random(-320, 320),
          y: () => gsap.utils.random(-240, 240),
          z: () => gsap.utils.random(-420, -60),
          rotation: () => gsap.utils.random(-90, 90),
          autoAlpha: 0,
          duration: 5,
          ease: "power1.in",
          stagger: { each: 0.025, from: "random" },
        },
        at + 0.4,
      );
    }
    if (shards.length) {
      tl.fromTo(
        shards,
        { autoAlpha: 1 },
        {
          x: () => gsap.utils.random(-260, 260),
          y: () => gsap.utils.random(-220, 220),
          z: () => gsap.utils.random(-320, -40),
          scale: 0.4,
          autoAlpha: 0,
          duration: 6,
          ease: "power1.in",
          stagger: { each: 0.04, from: "random" },
          immediateRender: false,
        },
        at + 0.5,
      );
    }
    /* the empty shell sinks — nothing is left but the released material */
    tl.to(card, { z: -140, duration: 6, ease: "power1.in" }, at + 0.5);
  });

  /* ---------------- Scene 9 — RESOLUTION ---------------- */
  /* The world reforms the ecosystem 385–411; then quiet; then the
     statement; dwell; supporting copy; and only then the CTA. */
  if (finKicker) {
    tl.fromTo(
      finKicker,
      { autoAlpha: 0, y: 18 },
      { autoAlpha: 1, y: 0, duration: 3.5, ease: "power2.out" },
      412.5,
    );
  }
  if (finH2) {
    tl.fromTo(
      finH2,
      { autoAlpha: 0, z: -380, y: 52 },
      { autoAlpha: 1, z: 0, y: 0, duration: 6.5, ease: "power2.out" },
      414,
    );
  }
  /* dwell 420–425 — the statement lands before anything else arrives */
  if (finLede) {
    tl.fromTo(
      finLede,
      { autoAlpha: 0, y: 26 },
      { autoAlpha: 1, y: 0, duration: 4.5, ease: "power2.out" },
      425.5,
    );
  }
  if (finCta) {
    tl.fromTo(
      finCta,
      { autoAlpha: 0, y: 22 },
      { autoAlpha: 1, y: 0, duration: 4.5, ease: "power2.out" },
      430.5,
    );
  }

  return () => {
    tl.scrollTrigger?.kill();
    tl.kill();
    splits.forEach((s) => s.revert());
  };
}

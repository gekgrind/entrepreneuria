"use client";

import { useEffect } from "react";

import { loadMotionEngine, prefersReducedMotion } from "./gsap-setup";
import { SmoothScroll } from "./SmoothScroll";

/**
 * HomeMotion — the homepage's scroll-choreography orchestrator.
 *
 * A single client island: loads the deferred motion engine (post-load,
 * post-interaction, idle slot — see gsap-setup.ts), then wires every
 * scene's motion via data attributes. The page is complete HTML without
 * it; this layer only ever enhances.
 *
 * Motion language: IGNITION. Things light up — they don't slide in.
 *   - IgniteReveal   [data-ignite]            once, soft rise + de-blur
 *   - KineticLines   [data-kinetic-line]      scrub; interior questions linger
 *   - LockIgnite     [data-lock-ignite]       Scene 2: the light locks + fires
 *   - ArcDraw        [data-c-spoke]/[data-c-arc]  constellation lines draw;
 *                    [data-c-node]            nodes ignite, Prospra first
 *   - Rails          [data-rail]              journey hairlines grow
 *   - Founder        [data-founder-portrait] / [data-signature]
 *
 * Reduced-motion contract: this island never mounts its effects; the
 * static DOM (fully-formed states) is the reduced-motion experience.
 */
export function HomeMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    let cancelled = false;
    let revert: (() => void) | undefined;
    const cleanups: Array<() => void> = [];

    loadMotionEngine().then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return;

      const ctx = gsap.context(() => {
        /* ---- Cursor-reactive hero light (fine pointers only) ---------- */
        const heroLight = document.querySelector<HTMLElement>(
          "[data-hero-light]",
        );
        if (
          heroLight &&
          window.matchMedia("(any-pointer: fine)").matches
        ) {
          const xTo = gsap.quickTo(heroLight, "x", {
            duration: 1.2,
            ease: "power3.out",
          });
          const yTo = gsap.quickTo(heroLight, "y", {
            duration: 1.2,
            ease: "power3.out",
          });
          const onMove = (e: PointerEvent) => {
            xTo((e.clientX / window.innerWidth - 0.5) * 40);
            yTo((e.clientY / window.innerHeight - 0.5) * 24);
          };
          window.addEventListener("pointermove", onMove, { passive: true });
          cleanups.push(() =>
            window.removeEventListener("pointermove", onMove),
          );
        }

        /* ---- IgniteReveal: soft light-up, once ------------------------ */
        gsap.utils.toArray<HTMLElement>("[data-ignite]").forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 14,
            filter: "blur(4px)",
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 84%", once: true },
          });
        });

        /* ---- KineticLines: scrubbed cadence; interior lingers --------- */
        gsap.utils
          .toArray<HTMLElement>("[data-kinetic-line]")
          .forEach((el) => {
            // Lines already near the viewport at setup time stay fully
            // revealed — late engine arrival never hides readable text.
            if (el.getBoundingClientRect().top < window.innerHeight * 0.6)
              return;
            const interior = el.hasAttribute("data-kinetic-interior");
            gsap.fromTo(
              el,
              { opacity: 0.08, y: 26 },
              {
                opacity: 1,
                y: 0,
                ease: "none",
                scrollTrigger: {
                  trigger: el,
                  start: "top 88%",
                  // interior questions resolve later — they linger on screen
                  end: interior ? "top 38%" : "top 48%",
                  scrub: true,
                },
              },
            );
          });

        /* ---- LockIgnite: the wandering light locks and fires ---------- */
        const lock = document.querySelector<HTMLElement>("[data-lock-ignite]");
        if (lock) {
          gsap.fromTo(
            lock,
            { scale: 0.4, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              ease: "power2.out",
              scrollTrigger: {
                trigger: "[data-scene-turn]",
                start: "top 75%",
                end: "center 55%",
                scrub: true,
              },
            },
          );
        }

        /* ---- The constellation: rings → spokes → nodes → arcs --------- */
        const stage = document.querySelector<HTMLElement>(
          "[data-constellation-stage]",
        );
        if (stage) {
          const q = gsap.utils.selector(stage);
          const spokes = q("[data-c-spoke]");
          const arcs = q("[data-c-arc]");
          const drawable = [...spokes, ...arcs] as unknown as SVGGeometryElement[];
          drawable.forEach((el) => {
            const len = el.getTotalLength();
            el.style.strokeDasharray = `${len}`;
            el.style.strokeDashoffset = `${len}`;
          });

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: stage,
              start: "top 82%",
              end: "center 42%",
              scrub: true,
            },
          });
          tl.from(q("[data-c-ring]"), { opacity: 0, duration: 0.25 })
            .to(drawable, {
              strokeDashoffset: 0,
              duration: 0.9,
              stagger: 0.08,
              ease: "none",
            })
            .from(
              q("[data-c-node]"),
              {
                opacity: 0,
                scale: 0.3,
                transformOrigin: "center",
                duration: 0.5,
                stagger: 0.18, // registry order: Prospra ignites first
                ease: "back.out(2)",
              },
              "-=0.5",
            )
            .from(
              q("[data-c-center]"),
              { opacity: 0, scale: 0.5, transformOrigin: "center", duration: 0.4 },
              "-=0.9",
            );
        }

        /* ---- Mobile mini-map: cards ignite their points --------------- */
        gsap.utils
          .toArray<HTMLElement>("[data-product-card]")
          .forEach((card) => {
            const slug = card.getAttribute("data-product-card");
            const node = document.querySelector(`[data-mm-node="${slug}"]`);
            if (!node) return;
            ScrollTrigger.create({
              trigger: card,
              start: "top 70%",
              end: "bottom 30%",
              onToggle: (self) =>
                node.setAttribute("data-lit", self.isActive ? "true" : "false"),
            });
          });

        /* ---- Journey rails -------------------------------------------- */
        gsap.utils.toArray<HTMLElement>("[data-rail]").forEach((el) => {
          gsap.from(el, {
            scaleX: 0,
            transformOrigin: "left center",
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 86%", once: true },
          });
        });

        /* ---- The Heartbeat: slow, respectful -------------------------- */
        const portrait = document.querySelector("[data-founder-portrait]");
        if (portrait) {
          gsap.from(portrait, {
            y: 32,
            opacity: 0,
            duration: 1.1,
            ease: "power2.out",
            scrollTrigger: { trigger: portrait, start: "top 82%", once: true },
          });
        }
        const signature = document.querySelector("[data-signature]");
        if (signature) {
          gsap.fromTo(
            signature,
            { clipPath: "inset(0 100% 0 0)" },
            {
              clipPath: "inset(0 0% 0 0)",
              duration: 1.2,
              ease: "power2.inOut",
              scrollTrigger: { trigger: signature, start: "top 88%", once: true },
            },
          );
        }

        /* ---- The Proof: the artifact tilts into focus ----------------- */
        const heroShot = document.querySelector("[data-shot='hero']");
        if (heroShot) {
          const inner = heroShot.querySelector("[data-shot-inner]");
          const glow = heroShot.querySelector("[data-shot-glow]");
          if (inner) {
            gsap.fromTo(
              inner,
              { rotateX: 9, y: 70, scale: 0.96, opacity: 0.35 },
              {
                rotateX: 0,
                y: 0,
                scale: 1,
                opacity: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: heroShot,
                  start: "top 94%",
                  end: "top 42%",
                  scrub: true,
                },
              },
            );
          }
          if (glow) {
            gsap.fromTo(
              glow,
              { opacity: 0 },
              {
                opacity: 0.7,
                ease: "none",
                scrollTrigger: {
                  trigger: heroShot,
                  start: "top 94%",
                  end: "top 50%",
                  scrub: true,
                },
              },
            );
          }
        }
        gsap.utils
          .toArray<HTMLElement>("[data-shot='support']")
          .forEach((el) => {
            gsap.fromTo(
              el,
              { y: 44, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: el,
                  start: "top 96%",
                  end: "top 58%",
                  scrub: true,
                },
              },
            );
          });

        /* ---- The close: constellation settles in ---------------------- */
        const closeMap = document.querySelector("[data-close-constellation]");
        if (closeMap) {
          gsap.from(closeMap, {
            opacity: 0,
            scale: 0.94,
            duration: 1,
            ease: "power2.out",
            scrollTrigger: { trigger: closeMap, start: "top 90%", once: true },
          });
        }
      });
      revert = () => ctx.revert();
    });

    return () => {
      cancelled = true;
      revert?.();
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return <SmoothScroll />;
}

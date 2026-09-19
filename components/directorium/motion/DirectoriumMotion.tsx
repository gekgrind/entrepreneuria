"use client";

import { useEffect } from "react";

import {
  buildChamberTimeline,
  createDirector,
  type ChamberLabel,
} from "./chamber-timeline";
import { loadDirectoriumEngine, motionAllowed, notYetSeen } from "./engine";
import {
  buildConveneTimeline,
  buildEchoTimeline,
  buildGlyphTimeline,
} from "./sequences";

/**
 * DirectoriumMotion — the page's scroll choreography orchestrator
 * (the HomeMotion pattern). Renders nothing; wires motion onto the
 * server-rendered sections through data hooks once the deferred engine
 * arrives. Without it — no JS, reduced motion, the static kill switch,
 * or before the engine loads — every section is already its finished
 * composition.
 *
 *   [data-dm="six-hats"]   echo vs. independent minds (once)
 *   [data-dm="board"]      entries reveal in board order; glyph inspection
 *   [data-dm="process"]    the chamber master timeline, driven by the
 *                          reading band (ProcessStateSync events)
 *   [data-dm="cta"]        the board convenes around the founder (once)
 *
 * The hero assembly is CSS (see chamber.module.css) and its ambient
 * pause/parallax lives in HeroChamberStage.
 *
 * Nothing loops. One-shots finish and hold; the process timeline only
 * runs while tweening between labels; glyph timelines only on hover.
 */

const PROCESS_LABELS: readonly ChamberLabel[] = ["dormant", "convened", "debate", "verdict"];
const ONE_SHOT_START = "top 72%";

export function DirectoriumMotion() {
  useEffect(() => {
    if (!motionAllowed()) return;

    let cancelled = false;
    let revert: (() => void) | undefined;

    loadDirectoriumEngine().then(async (engine) => {
      await document.fonts.ready;
      if (cancelled) return;
      const { gsap, ScrollTrigger } = engine;
      const motionChambers = new Set<HTMLElement>();

      const takeOver = (chamber: HTMLElement) => {
        chamber.dataset.motion = "gsap";
        motionChambers.add(chamber);
      };

      const mm = gsap.matchMedia();

      mm.add(
        {
          desktop: "(min-width: 1024px)",
          compact: "(max-width: 1023.98px)",
          hover: "(hover: hover) and (pointer: fine)",
        },
        (context) => {
          const { desktop, hover } = context.conditions as Record<string, boolean>;
          const local: Array<() => void> = [];

          /* ── SIX HATS ────────────────────────────────────────────── */
          const sixHats = document.querySelector('[data-dm="six-hats"]');
          if (sixHats) {
            const echoFigure = sixHats.querySelector("[data-dm-figure='echo']");
            const boardFigure = sixHats.querySelector("[data-dm-figure='board']");
            const echoEl = echoFigure?.querySelector("[data-echo]");
            const chamber = boardFigure?.querySelector<HTMLElement>("[data-chamber]");
            let echoStartedAt = -1;

            if (echoFigure && echoEl && notYetSeen(echoFigure)) {
              const echo = buildEchoTimeline(gsap, echoEl);
              ScrollTrigger.create({
                trigger: echoFigure,
                start: ONE_SHOT_START,
                once: true,
                onEnter: () => {
                  echoStartedAt = performance.now();
                  echo.play();
                },
              });
            }

            if (boardFigure && chamber && notYetSeen(boardFigure)) {
              takeOver(chamber);
              const tl = buildChamberTimeline(gsap, chamber, { order: "async" });
              tl.pause("idle");
              ScrollTrigger.create({
                trigger: boardFigure,
                start: ONE_SHOT_START,
                once: true,
                onEnter: () => {
                  // side by side, the independent board answers after the
                  // echo has made its point; stacked, it plays on arrival
                  const sinceEcho =
                    echoStartedAt < 0 ? Infinity : (performance.now() - echoStartedAt) / 1000;
                  const wait = Math.max(0, 2.7 - sinceEcho);
                  // every beat at authored pacing (a touch brisker), from
                  // the empty table to the debate — then hold
                  const span = (tl.labels.debate ?? tl.duration()) - (tl.labels.idle ?? 0);
                  tl.tweenFromTo("idle", "debate", {
                    duration: span / 1.3,
                    ease: "none",
                    delay: wait,
                  });
                },
              });
            }
          }

          /* ── BOARD ───────────────────────────────────────────────── */
          const board = document.querySelector('[data-dm="board"]');
          if (board) {
            const entries = Array.from(board.querySelectorAll<HTMLElement>("[data-dm-entry]"));
            const unseen = entries.filter(notYetSeen);
            if (unseen.length) {
              gsap.set(unseen, { opacity: 0, y: 28 });
              ScrollTrigger.batch(unseen, {
                start: "top 88%",
                once: true,
                onEnter: (batch) =>
                  gsap.to(batch, {
                    opacity: 1,
                    y: 0,
                    duration: 0.9,
                    ease: "expo.out",
                    stagger: 0.1,
                    overwrite: true,
                  }),
              });
            }

            if (hover) {
              entries.forEach((entry) => {
                const glyph = entry.querySelector("[data-glyph]");
                if (!glyph) return;
                const tl = buildGlyphTimeline(gsap, glyph);
                if (!tl) return;
                const inspect = () => tl.play();
                const release = () => tl.reverse();
                entry.addEventListener("mouseenter", inspect);
                entry.addEventListener("mouseleave", release);
                entry.addEventListener("focusin", inspect);
                entry.addEventListener("focusout", release);
                local.push(() => {
                  entry.removeEventListener("mouseenter", inspect);
                  entry.removeEventListener("mouseleave", release);
                  entry.removeEventListener("focusin", inspect);
                  entry.removeEventListener("focusout", release);
                });
              });
            }
          }

          /* ── PROCESS ─────────────────────────────────────────────── */
          const process = document.querySelector<HTMLElement>('[data-dm="process"]');
          if (process) {
            if (desktop) {
              // one sticky chamber, driven by the step in the reading band
              const chamber = process.querySelector<HTMLElement>(
                "[data-process-chamber] [data-chamber]",
              );
              if (chamber) {
                const build = () => {
                  takeOver(chamber);
                  return createDirector(buildChamberTimeline(gsap, chamber));
                };
                let director = build();

                const activeLabel = (): ChamberLabel => {
                  const active = process.querySelector<HTMLElement>(
                    "[data-process-step][data-active]",
                  );
                  const index = Number(active?.dataset.stepIndex ?? 0);
                  return PROCESS_LABELS[index] ?? "dormant";
                };

                // not reached yet → the decision hasn't arrived; the
                // reading band will ignite it. Already in view → hold the
                // current state without replaying it.
                director.seek(notYetSeen(process) ? "idle" : activeLabel());

                const onStep = (event: Event) => {
                  const index = (event as CustomEvent<{ index: number }>).detail.index;
                  director.goTo(PROCESS_LABELS[index] ?? "dormant");
                };
                process.addEventListener("directorium:process-step", onStep);
                local.push(() => process.removeEventListener("directorium:process-step", onStep));

                // DrawSVG measures on-screen stroke length (non-scaling
                // strokes); rebuild at the current state if the chamber
                // is resized so every drawn line still lands exactly.
                let width = chamber.getBoundingClientRect().width;
                const ro = new ResizeObserver(() => {
                  const next = chamber.getBoundingClientRect().width;
                  if (Math.abs(next - width) < 2) return;
                  width = next;
                  const label = director.target;
                  director.destroy();
                  director = build();
                  director.seek(label);
                });
                ro.observe(chamber);
                local.push(() => ro.disconnect());
              }
            } else {
              // compact: each step's inline chamber transitions INTO its
              // state from the previous one as it arrives, and back when
              // the reader scrolls above it — reversible, no sticky
              const steps = Array.from(process.querySelectorAll<HTMLElement>("[data-process-step]"));
              steps.forEach((step, index) => {
                const chamber = step.querySelector<HTMLElement>("[data-inline-chamber] [data-chamber]");
                if (!chamber || !notYetSeen(chamber)) return;
                takeOver(chamber);
                const director = createDirector(buildChamberTimeline(gsap, chamber));
                const own = PROCESS_LABELS[index] ?? "verdict";
                const previous: ChamberLabel = index === 0 ? "idle" : PROCESS_LABELS[index - 1];
                director.seek(previous);
                ScrollTrigger.create({
                  trigger: chamber,
                  start: "top 78%",
                  onEnter: () => director.goTo(own),
                  onLeaveBack: () => director.goTo(previous),
                });
              });
            }
          }

          /* ── CTA ─────────────────────────────────────────────────── */
          const cta = document.querySelector('[data-dm="cta"]');
          const ctaChamber = cta?.querySelector<HTMLElement>("[data-chamber]");
          if (cta && ctaChamber && notYetSeen(ctaChamber)) {
            takeOver(ctaChamber);
            const tl = buildConveneTimeline(gsap, ctaChamber, cta.querySelector("[data-cta-glow]"));
            ScrollTrigger.create({
              trigger: ctaChamber,
              start: "top 70%",
              once: true,
              onEnter: () => tl.play(),
            });
          }

          return () => {
            local.forEach((fn) => fn());
            // matchMedia reverts every tween/ScrollTrigger created here;
            // hand the chambers back to their static compositions
            motionChambers.forEach((c) => delete c.dataset.motion);
            motionChambers.clear();
          };
        },
      );

      ScrollTrigger.refresh();
      revert = () => mm.revert();
    });

    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);

  return null;
}

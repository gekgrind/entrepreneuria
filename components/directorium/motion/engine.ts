import {
  loadMotionEngine,
  prefersReducedMotion,
  type MotionEngine,
} from "@/components/home/motion/gsap-setup";
import { CONSTELLATION_MODE } from "@/lib/constellation";

/**
 * Directorium's motion engine: the site's deferred GSAP engine (loaded
 * after window load + first interaction, never on the critical path)
 * plus GSAP's own DrawSVGPlugin for stroke drawing — it compensates for
 * `vector-effect: non-scaling-stroke`, which every chamber line uses.
 * No additional animation library.
 */
export type DirectoriumEngine = MotionEngine;

let promise: Promise<DirectoriumEngine> | null = null;

export function loadDirectoriumEngine(): Promise<DirectoriumEngine> {
  if (!promise) {
    promise = (async () => {
      const engine = await loadMotionEngine();
      const { DrawSVGPlugin } = await import("gsap/DrawSVGPlugin");
      engine.gsap.registerPlugin(DrawSVGPlugin);
      return engine;
    })();
  }
  return promise;
}

/** Motion is welcome: no reduced-motion preference and the site-wide
 *  static kill switch (NEXT_PUBLIC_CONSTELLATION_MODE=static) is off. */
export const motionAllowed = () =>
  !prefersReducedMotion() && CONSTELLATION_MODE !== "static";

/** True when the element has not yet been seen — its top is still below
 *  the viewport. Sequences only pre-hide content the visitor hasn't met;
 *  anything already on screen when the engine arrives stays finished. */
export const notYetSeen = (el: Element) =>
  el.getBoundingClientRect().top > window.innerHeight * 0.92;

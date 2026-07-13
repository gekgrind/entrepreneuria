import type { gsap as GSAP } from "gsap";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";
import type { SplitText as SplitTextType } from "gsap/SplitText";

/**
 * The motion engine (GSAP + plugins) loads AFTER the window load event and
 * an idle slot, in a separate async chunk — the homepage paints and becomes
 * interactive first, the choreography arrives as a progressive enhancement.
 * Every consumer defends against late arrival (late-skip intros, below-fold
 * reveals), so deferring costs nothing visually on fast devices and saves
 * ~1s of main-thread hydration work on slow ones.
 */
export type MotionEngine = {
  gsap: typeof GSAP;
  ScrollTrigger: typeof ScrollTriggerType;
  SplitText: typeof SplitTextType;
};

let enginePromise: Promise<MotionEngine> | null = null;

const INTERACTION_EVENTS = [
  "pointerdown",
  "pointermove",
  "wheel",
  "touchstart",
  "scroll",
  "keydown",
] as const;

function firstInteraction(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      INTERACTION_EVENTS.forEach((t) => window.removeEventListener(t, done));
      resolve();
    };
    INTERACTION_EVENTS.forEach((t) =>
      window.addEventListener(t, done, { passive: true }),
    );
  });
}

export function loadMotionEngine(): Promise<MotionEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      if (document.readyState !== "complete") {
        await new Promise((resolve) =>
          window.addEventListener("load", resolve, { once: true }),
        );
      }
      // Evaluate the engine only once the user shows intent (or after a
      // long fallback) — its ~0.5s eval never blocks initial interactivity.
      // The chunks are prefetched meanwhile, so the actual import is a
      // cache hit and choreography starts the instant the cursor moves.
      await Promise.race([
        firstInteraction(),
        new Promise((resolve) => setTimeout(resolve, 9000)),
      ]);
      await new Promise((resolve) =>
        "requestIdleCallback" in window
          ? requestIdleCallback(() => resolve(undefined), { timeout: 500 })
          : setTimeout(resolve, 100),
      );
      const [{ gsap }, { ScrollTrigger }, { SplitText }] = await Promise.all([
        import(/* webpackPrefetch: true */ "gsap"),
        import(/* webpackPrefetch: true */ "gsap/ScrollTrigger"),
        import(/* webpackPrefetch: true */ "gsap/SplitText"),
      ]);
      gsap.registerPlugin(ScrollTrigger, SplitText);
      return { gsap, ScrollTrigger, SplitText };
    })();
  }
  return enginePromise;
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * True when the device has any precise pointer or a desktop-sized viewport.
 * Used to pick the WebGL quality tier — hybrid Windows touchscreens report
 * a coarse primary pointer but still have desktop-class GPUs.
 */
export const isHighTierDevice = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(any-pointer: fine)").matches ||
    window.innerWidth >= 1024);

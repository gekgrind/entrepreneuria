"use client";

import { useEffect } from "react";

import { setLenisInstance } from "@/components/transition/lenis-handle";

import { loadMotionEngine, prefersReducedMotion } from "./gsap-setup";

/**
 * True when the device has a mouse, trackpad, or stylus — the only inputs
 * Lenis actually smooths. `any-pointer` (not `pointer`) so hybrid laptops
 * with a touchscreen still count as fine-pointer devices, matching
 * `isHighTierDevice()` and the custom cursor.
 */
const hasFinePointer = () =>
  window.matchMedia("(any-pointer: fine)").matches;

/**
 * Homepage-scoped inertial smooth scroll. Mounts nothing visual; wires Lenis
 * into GSAP's ticker so ScrollTrigger timelines stay in sync. Lenis only
 * virtualizes wheel input — `syncTouch` is off, so it never animates touch
 * scrolling.
 *
 * FINE POINTERS ONLY. On a touch-only device Lenis has nothing to smooth,
 * but mounting it still costs two things that read as scroll judder:
 *   - its VirtualScroll registers `touchstart`/`touchmove` on window as
 *     NON-PASSIVE regardless of syncTouch, which takes touch scrolling off
 *     the compositor fast path and paces every scroll frame on a main
 *     thread already running the WebGL world and the scrubbed timeline;
 *   - it requires `gsap.ticker.lagSmoothing(0)` globally, so a dropped
 *     frame advances the scrub by the full elapsed time instead of a
 *     clamped step — a lurch rather than a smooth catch-up.
 * Phones and tablets therefore get untouched native scrolling and GSAP's
 * default lag smoothing; desktop and hybrid devices keep the approved
 * wheel smoothing unchanged.
 *
 * Loads with the deferred motion engine; skipped entirely for
 * reduced-motion users.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!hasFinePointer()) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    Promise.all([
      loadMotionEngine(),
      import(/* webpackPrefetch: true */ "lenis"),
    ]).then(
      ([{ gsap, ScrollTrigger }, { default: Lenis }]) => {
        if (cancelled) return;

        const lenis = new Lenis({
          duration: 1.05,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          anchors: true,
          autoRaf: false,
        });

        // Published so the route transition can freeze scrolling while covered.
        setLenisInstance(lenis);

        const update = () => ScrollTrigger.update();
        lenis.on("scroll", update);

        const raf = (time: number) => {
          lenis.raf(time * 1000);
        };
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);

        cleanup = () => {
          setLenisInstance(null);
          gsap.ticker.remove(raf);
          lenis.destroy();
          gsap.ticker.lagSmoothing(500, 33);
        };
      },
    );

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}

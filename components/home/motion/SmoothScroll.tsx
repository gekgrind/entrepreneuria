"use client";

import { useEffect } from "react";

import { setLenisInstance } from "@/components/transition/lenis-handle";

import { loadMotionEngine, prefersReducedMotion } from "./gsap-setup";

/**
 * Homepage-scoped inertial smooth scroll. Mounts nothing visual; wires Lenis
 * into GSAP's ticker so ScrollTrigger timelines stay in sync. Lenis only
 * virtualizes wheel input — touch scrolling stays native (syncTouch is off),
 * so hybrid/touch devices keep their platform momentum. Loads with the
 * deferred motion engine; skipped entirely for reduced-motion users.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

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

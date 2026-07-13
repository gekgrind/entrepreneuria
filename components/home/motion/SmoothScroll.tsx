"use client";

import { useEffect } from "react";
import Lenis from "lenis";

import { gsap, ScrollTrigger, prefersReducedMotion } from "./gsap-setup";

/**
 * Homepage-scoped inertial smooth scroll. Mounts nothing visual; wires Lenis
 * into GSAP's ticker so ScrollTrigger timelines stay in sync. Lenis only
 * virtualizes wheel input — touch scrolling stays native (syncTouch is off),
 * so hybrid/touch devices keep their platform momentum. Skipped entirely for
 * users who prefer reduced motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      anchors: true,
      autoRaf: false,
    });

    const update = () => ScrollTrigger.update();
    lenis.on("scroll", update);

    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      gsap.ticker.lagSmoothing(500, 33);
    };
  }, []);

  return null;
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { loadMotionEngine, prefersReducedMotion } from "./gsap-setup";

type ParallaxDriftProps = {
  children: ReactNode;
  className?: string;
  /** Total vertical travel in px across the element's scroll journey. */
  travel?: number;
};

/**
 * Gentle scroll-scrubbed vertical drift — the element moves slower than the
 * page around it, adding depth without pinning. Reduced motion: static.
 */
export function ParallaxDrift({
  children,
  className,
  travel = 48,
}: ParallaxDriftProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    loadMotionEngine().then(({ gsap }) => {
      if (cancelled || !el.isConnected) return;

      const tween = gsap.fromTo(
        el,
        { y: travel / 2 },
        {
          y: -travel / 2,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );

      cleanup = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        gsap.set(el, { clearProps: "transform" });
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [travel]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

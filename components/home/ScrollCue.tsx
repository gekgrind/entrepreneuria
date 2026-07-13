"use client";

import { useLayoutEffect, useRef, useState } from "react";

import {
  gsap,
  prefersReducedMotion,
} from "@/components/home/motion/gsap-setup";

/**
 * Minimal scroll affordance for the hero — a hairline track with a dot that
 * keeps dropping (CSS keyframes), fading out as soon as the user starts to
 * scroll. Purely decorative; not rendered for reduced-motion users.
 */
export function ScrollCue() {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    setEnabled(true);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const tween = gsap.to(el, {
      autoAlpha: 0,
      ease: "none",
      scrollTrigger: { start: 10, end: 140, scrub: true },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute bottom-7 left-1/2 hidden -translate-x-1/2 lg:block"
    >
      <div className="relative h-14 w-px overflow-hidden bg-white/12">
        <span className="scroll-cue-dot absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--brand-accent)] shadow-[0_0_10px_rgba(0,212,255,0.7)]" />
      </div>
    </div>
  );
}

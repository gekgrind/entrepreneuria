"use client";

import { useEffect, useRef, useState } from "react";

import {
  loadMotionEngine,
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

  useEffect(() => {
    if (prefersReducedMotion()) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    loadMotionEngine().then(({ gsap }) => {
      if (cancelled || !el.isConnected) return;

      const tween = gsap.to(el, {
        autoAlpha: 0,
        ease: "none",
        scrollTrigger: { start: 10, end: 140, scrub: true },
      });

      cleanup = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute bottom-7 left-1/2 z-20 -translate-x-1/2"
    >
      <div className="relative h-14 w-px overflow-hidden bg-white/12">
        <span className="scroll-cue-dot absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--brand-accent)] shadow-[0_0_10px_rgba(0,212,255,0.7)]" />
      </div>
    </div>
  );
}

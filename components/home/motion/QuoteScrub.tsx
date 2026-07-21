"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { loadMotionEngine, prefersReducedMotion } from "./gsap-setup";

type QuoteScrubProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Scroll-scrubbed word-by-word reveal for the founder pull-quote: words sit
 * at low opacity and resolve to full ink as the reader scrolls through them.
 * Reduced motion: quote renders untouched.
 */
export function QuoteScrub({ children, className }: QuoteScrubProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = ref.current;
    const target = wrapper?.firstElementChild as HTMLElement | null;
    if (!wrapper || !target || prefersReducedMotion()) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    loadMotionEngine().then(({ gsap, SplitText }) => {
      if (cancelled || !target.isConnected) return;

      let split: InstanceType<typeof SplitText>;
      try {
        split = new SplitText(target, { type: "words" });
      } catch {
        return;
      }

      const tween = gsap.from(split.words, {
        opacity: 0.14,
        stagger: 0.04,
        ease: "none",
        scrollTrigger: {
          trigger: target,
          start: "top 80%",
          end: "top 34%",
          scrub: true,
        },
      });

      cleanup = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        split.revert();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

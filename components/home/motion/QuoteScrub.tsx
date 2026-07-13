"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import { gsap, SplitText, prefersReducedMotion } from "./gsap-setup";

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

  useLayoutEffect(() => {
    const wrapper = ref.current;
    const target = wrapper?.firstElementChild as HTMLElement | null;
    if (!wrapper || !target || prefersReducedMotion()) return;

    let split: SplitText | null = null;
    let tween: gsap.core.Tween | null = null;

    try {
      split = new SplitText(target, { type: "words" });
    } catch {
      return;
    }

    tween = gsap.from(split.words, {
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

    return () => {
      tween?.scrollTrigger?.kill();
      tween?.kill();
      split?.revert();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

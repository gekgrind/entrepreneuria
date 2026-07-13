"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import { gsap, SplitText, prefersReducedMotion } from "./gsap-setup";

type SplitRevealProps = {
  children: ReactNode;
  /** "load" animates on mount (above the fold); "scroll" waits for the viewport. */
  trigger?: "load" | "scroll";
  delay?: number;
  className?: string;
};

/**
 * Masked line reveal for headings. Wrap a single heading element; each wrapped
 * line rises out of an overflow mask. The heading should carry
 * `data-motion-hide` so it stays hidden until GSAP takes control (a CSS
 * safety animation reveals it if JS never runs — see globals.css).
 * Reduced motion: heading renders untouched, instantly visible.
 */
export function SplitReveal({
  children,
  trigger = "scroll",
  delay = 0,
  className,
}: SplitRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wrapper = ref.current;
    const target = wrapper?.firstElementChild as HTMLElement | null;
    if (!wrapper || !target) return;

    if (prefersReducedMotion()) {
      target.removeAttribute("data-motion-hide");
      return;
    }

    let split: SplitText | null = null;
    let tl: gsap.core.Timeline | null = null;
    let cancelled = false;

    // Split after fonts settle so line boxes are measured correctly.
    document.fonts.ready.then(() => {
      if (cancelled || !target.isConnected) return;

      try {
        split = new SplitText(target, {
          type: "lines",
          mask: "lines",
          linesClass: "split-line",
        });
      } catch {
        // Old engine / unexpected markup: just show the heading.
        target.removeAttribute("data-motion-hide");
        gsap.set(target, { autoAlpha: 1 });
        return;
      }

      tl = gsap.timeline({
        delay,
        ...(trigger === "scroll"
          ? {
              scrollTrigger: {
                trigger: target,
                start: "top 84%",
                once: true,
              },
            }
          : {}),
      });

      tl.set(target, { autoAlpha: 1 }, 0).from(
        split.lines,
        {
          yPercent: 112,
          duration: 1.05,
          ease: "power4.out",
          stagger: 0.09,
        },
        0,
      );

      // GSAP owns visibility from here; drop the CSS safety net.
      target.removeAttribute("data-motion-hide");
    });

    return () => {
      cancelled = true;
      tl?.scrollTrigger?.kill();
      tl?.kill();
      split?.revert();
    };
  }, [trigger, delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

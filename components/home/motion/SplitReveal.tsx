"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { loadMotionEngine, prefersReducedMotion } from "./gsap-setup";

type SplitRevealProps = {
  children: ReactNode;
  /** "load" animates on mount (above the fold); "scroll" waits for the viewport. */
  trigger?: "load" | "scroll";
  delay?: number;
  className?: string;
};

/**
 * Masked line reveal for headings. Wrap a single heading element; each wrapped
 * line rises out of an overflow mask.
 *
 * Paint-first, animate-after: the server HTML ships fully visible (LCP is the
 * heading's first paint) and the engine arrives post-load. "load" targets are
 * LCP candidates, so their own paint is never toggled — the masked lines carry
 * the reveal — and the intro is skipped when the engine arrives late, so slow
 * devices get instant content instead of a delayed re-animation.
 * Reduced motion: heading renders untouched.
 */
const LATE_HYDRATION_MS = 2500;

export function SplitReveal({
  children,
  trigger = "scroll",
  delay = 0,
  className,
}: SplitRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = ref.current;
    const target = wrapper?.firstElementChild as HTMLElement | null;
    if (!wrapper || !target) return;
    if (prefersReducedMotion()) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    Promise.all([loadMotionEngine(), document.fonts.ready]).then(
      ([{ gsap, SplitText }]) => {
        if (cancelled || !target.isConnected) return;
        if (trigger === "load" && performance.now() > LATE_HYDRATION_MS) return;

        let split: InstanceType<typeof SplitText>;
        try {
          split = new SplitText(target, {
            type: "lines",
            mask: "lines",
            linesClass: "split-line",
          });
        } catch {
          return;
        }

        // Scroll targets sit below the fold and may hide until triggered;
        // "load" targets never toggle their own paint (LCP safety).
        if (trigger === "scroll") {
          gsap.set(target, { autoAlpha: 0 });
        }

        const tl = gsap.timeline({
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

        if (trigger === "scroll") {
          tl.set(target, { autoAlpha: 1 }, 0);
        }
        tl.from(
          split.lines,
          {
            yPercent: 112,
            duration: 1.05,
            ease: "power4.out",
            stagger: 0.09,
          },
          0,
        );

        cleanup = () => {
          tl.scrollTrigger?.kill();
          tl.kill();
          split.revert();
          gsap.set(target, { clearProps: "opacity,visibility" });
        };
      },
    );

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [trigger, delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

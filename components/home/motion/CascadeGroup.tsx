"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { loadMotionEngine, prefersReducedMotion } from "./gsap-setup";

type CascadeGroupProps = {
  children: ReactNode;
  className?: string;
  /** Which descendants cascade. Defaults to direct children. */
  selector?: string;
  /** "scroll" fires on viewport entry; "load" fires on mount (above the fold). */
  trigger?: "scroll" | "load";
  stagger?: number;
  y?: number;
  delay?: number;
  start?: string;
};

const LATE_HYDRATION_MS = 2500;

/**
 * Staggered entrance for a group of siblings (cards, list rows, terms).
 * Server HTML ships visible (paint-first); items hide only once the deferred
 * motion engine arrives and reveal on trigger. A "load" cascade is skipped
 * when the engine arrives late so slow devices see content immediately.
 * Reduced motion: children render untouched.
 */
export function CascadeGroup({
  children,
  className,
  selector,
  trigger = "scroll",
  stagger = 0.09,
  y = 28,
  delay = 0,
  start = "top 85%",
}: CascadeGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    loadMotionEngine().then(({ gsap, ScrollTrigger }) => {
      if (cancelled || !el.isConnected) return;
      if (trigger === "load" && performance.now() > LATE_HYDRATION_MS) return;

      const items = selector
        ? Array.from(el.querySelectorAll<HTMLElement>(selector))
        : (Array.from(el.children) as HTMLElement[]);
      if (items.length === 0) return;

      // opacity (not visibility) so pre-reveal content stays in the
      // accessibility tree for screen readers
      gsap.set(items, { opacity: 0, y });

      const reveal = () => {
        gsap.to(items, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          delay,
          ease: "power3.out",
          stagger,
          clearProps: "transform",
        });
      };

      let st: InstanceType<typeof ScrollTrigger> | null = null;
      if (trigger === "load") {
        reveal();
      } else {
        st = ScrollTrigger.create({ trigger: el, start, once: true, onEnter: reveal });
      }

      cleanup = () => {
        st?.kill();
        gsap.set(items, { clearProps: "all" });
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [selector, trigger, stagger, y, delay, start]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

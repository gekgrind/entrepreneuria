"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import { gsap, ScrollTrigger, prefersReducedMotion } from "./gsap-setup";

type CascadeGroupProps = {
  children: ReactNode;
  className?: string;
  /** Which descendants cascade. Defaults to direct children. */
  selector?: string;
  stagger?: number;
  y?: number;
  delay?: number;
  start?: string;
};

/**
 * Staggered entrance for a group of siblings (cards, list rows, terms).
 * Fires once when the group scrolls into view. Reduced motion: children
 * render untouched.
 */
export function CascadeGroup({
  children,
  className,
  selector,
  stagger = 0.09,
  y = 28,
  delay = 0,
  start = "top 85%",
}: CascadeGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const items = selector
      ? Array.from(el.querySelectorAll<HTMLElement>(selector))
      : (Array.from(el.children) as HTMLElement[]);
    if (items.length === 0) return;

    gsap.set(items, { autoAlpha: 0, y });

    const st = ScrollTrigger.create({
      trigger: el,
      start,
      once: true,
      onEnter: () => {
        gsap.to(items, {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          delay,
          ease: "power3.out",
          stagger,
          clearProps: "transform",
        });
      },
    });

    return () => {
      st.kill();
      gsap.set(items, { clearProps: "all" });
    };
  }, [selector, stagger, y, delay, start]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

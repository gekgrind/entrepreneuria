"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import { gsap, ScrollTrigger, prefersReducedMotion } from "./gsap-setup";

type TermsMotionProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Waitlist terms: rows cascade in once, then each row's index number
 * catches the brand accent as the reader scrolls past it — a quiet nod to
 * a path being walked. Expects `li` rows whose first element is the index
 * number. Reduced motion: static list.
 */
export function TermsMotion({ children, className }: TermsMotionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const rows = Array.from(el.querySelectorAll<HTMLElement>("li"));
    if (rows.length === 0) return;

    gsap.set(rows, { autoAlpha: 0, x: -24 });

    const triggers: ScrollTrigger[] = [
      ScrollTrigger.create({
        trigger: el,
        start: "top 82%",
        once: true,
        onEnter: () => {
          gsap.to(rows, {
            autoAlpha: 1,
            x: 0,
            duration: 0.85,
            ease: "power3.out",
            stagger: 0.12,
            clearProps: "transform",
          });
        },
      }),
    ];

    for (const row of rows) {
      const num = row.querySelector<HTMLElement>("span");
      if (!num) continue;
      triggers.push(
        ScrollTrigger.create({
          trigger: row,
          start: "top 62%",
          once: true,
          onEnter: () => {
            gsap.to(num, {
              color: "#00d4ff",
              textShadow: "0 0 12px rgba(0,212,255,0.45)",
              duration: 0.5,
              ease: "power2.out",
            });
          },
        }),
      );
    }

    return () => {
      triggers.forEach((t) => t.kill());
      gsap.set(rows, { clearProps: "all" });
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

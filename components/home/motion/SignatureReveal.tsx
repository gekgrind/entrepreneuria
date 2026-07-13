"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import { gsap, ScrollTrigger, prefersReducedMotion } from "./gsap-setup";

type SignatureRevealProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Left-to-right wipe for the founder signature — reads as the signature
 * being signed as it enters the viewport. Reduced motion: fully visible.
 */
export function SignatureReveal({ children, className }: SignatureRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    gsap.set(el, { clipPath: "inset(-8% 100% -8% 0)" });

    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      once: true,
      onEnter: () => {
        gsap.to(el, {
          clipPath: "inset(-8% 0% -8% 0)",
          duration: 1.4,
          ease: "power2.inOut",
        });
      },
    });

    return () => {
      st.kill();
      gsap.set(el, { clearProps: "clipPath" });
    };
  }, []);

  return (
    <span ref={ref} className={`inline-block ${className ?? ""}`}>
      {children}
    </span>
  );
}

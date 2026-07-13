"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { loadMotionEngine, prefersReducedMotion } from "./gsap-setup";

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

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    loadMotionEngine().then(({ gsap, ScrollTrigger }) => {
      if (cancelled || !el.isConnected) return;

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

      cleanup = () => {
        st.kill();
        gsap.set(el, { clearProps: "clipPath" });
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <span ref={ref} className={`inline-block ${className ?? ""}`}>
      {children}
    </span>
  );
}

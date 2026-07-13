"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";

type MagneticWrapProps = {
  children: ReactNode;
  className?: string;
  /** How far the element leans toward the cursor (0–1). */
  strength?: number;
};

/**
 * Magnetic cursor pull for CTAs. Mouse-only by design — touch and
 * reduced-motion users get the element exactly where it sits.
 */
export function MagneticWrap({
  children,
  className,
  strength = 0.25,
}: MagneticWrapProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 16, mass: 0.2 });
  const sy = useSpring(y, { stiffness: 180, damping: 16, mass: 0.2 });

  function handleMove(event: React.PointerEvent<HTMLSpanElement>) {
    if (reduced || event.pointerType !== "mouse" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
  }

  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.span
      ref={ref}
      className={className}
      style={{ x: sx, y: sy, display: "inline-block" }}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {children}
    </motion.span>
  );
}

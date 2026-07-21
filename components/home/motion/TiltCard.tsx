"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";

type TiltCardProps = {
  children: ReactNode;
  className?: string;
  /** Maximum tilt in degrees. */
  maxTilt?: number;
};

/**
 * Cursor-following 3D tilt with the site's existing hover-glow treatment
 * (reuses .hover-glow-card CSS from globals.css — the radial glow tracks
 * --mouse-x/--mouse-y). Touch devices get a tap-scale state instead of
 * hover; reduced motion disables the tilt entirely.
 */
export function TiltCard({ children, className, maxTilt = 6 }: TiltCardProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 220, damping: 18, mass: 0.4 });
  const sry = useSpring(ry, { stiffness: 220, damping: 18, mass: 0.4 });

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || event.pointerType !== "mouse") return;

    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    el.style.setProperty("--mouse-x", `${px * 100}%`);
    el.style.setProperty("--mouse-y", `${py * 100}%`);

    if (reduced) return;
    ry.set((px - 0.5) * 2 * maxTilt);
    rx.set((0.5 - py) * 2 * maxTilt);
  }

  function handleLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className={`hover-glow-card relative ${className ?? ""}`}
      style={
        reduced
          ? undefined
          : { rotateX: srx, rotateY: sry, transformPerspective: 900 }
      }
      whileTap={{ scale: 0.985 }}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {children}
      <span
        aria-hidden="true"
        className="hover-glow-card__glow pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
      />
      <span
        aria-hidden="true"
        className="hover-glow-card__edge pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
      />
    </motion.div>
  );
}

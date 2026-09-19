"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { motionAllowed } from "./motion/engine";

/**
 * Hero chamber stage — owns the two things the CSS assembly can't:
 *
 *  1. Off-screen pause. While the hero is out of view the chamber gets
 *     `data-ambient="paused"`, which holds every ambient animation
 *     (halo breathing, core breath, orbit light) still.
 *  2. Pointer parallax on fine-pointer devices only: the chamber drifts at
 *     most 6px toward the pointer and its atmosphere 4px away — depth,
 *     not a cursor effect. The rAF loop runs only while easing toward a
 *     new target and never while the hero is off-screen.
 *
 * Reduced motion / static kill switch: neither behavior is wired (and the
 * CSS assembly never matches), so the chamber is simply at rest.
 * Transforms only — nothing here affects layout or the LCP headline.
 */

const CHAMBER_SHIFT = 6;
const ATMOSPHERE_SHIFT = -4;
const EASE = 0.06;

export function HeroChamberStage({
  atmosphere,
  children,
}: {
  atmosphere: ReactNode;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const chamberRef = useRef<HTMLDivElement>(null);
  const atmosphereRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const chamberLayer = chamberRef.current;
    const atmosphereLayer = atmosphereRef.current;
    if (!root || !chamberLayer || !atmosphereLayer || !motionAllowed()) return;

    const chamber = chamberLayer.querySelector<HTMLElement>("[data-chamber]");
    let visible = true;

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (chamber) chamber.dataset.ambient = visible ? "running" : "paused";
      },
      { threshold: 0 },
    );
    io.observe(root);

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) {
      return () => io.disconnect();
    }

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;

    const render = () => {
      current.x += (target.x - current.x) * EASE;
      current.y += (target.y - current.y) * EASE;
      chamberLayer.style.transform = `translate3d(${(current.x * CHAMBER_SHIFT).toFixed(2)}px, ${(current.y * CHAMBER_SHIFT).toFixed(2)}px, 0)`;
      atmosphereLayer.style.transform = `translate3d(${(current.x * ATMOSPHERE_SHIFT).toFixed(2)}px, ${(current.y * ATMOSPHERE_SHIFT).toFixed(2)}px, 0)`;
      const settled =
        Math.abs(target.x - current.x) < 0.002 && Math.abs(target.y - current.y) < 0.002;
      frame = settled ? 0 : requestAnimationFrame(render);
    };

    const onMove = (e: PointerEvent) => {
      if (!visible || e.pointerType !== "mouse") return;
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
      chamberLayer.style.transform = "";
      atmosphereLayer.style.transform = "";
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <div ref={atmosphereRef} className="absolute inset-0 will-change-transform">
        {atmosphere}
      </div>
      <div ref={chamberRef} className="relative will-change-transform">
        {children}
      </div>
    </div>
  );
}

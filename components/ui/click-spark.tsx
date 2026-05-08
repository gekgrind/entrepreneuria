"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

type Spark = {
  id: number;
  x: number;
  y: number;
  color: string;
  dx: number;
  dy: number;
  size: number;
};

const SPARK_COLORS = ["#ffffff", "#00D4FF", "#ffe521"] as const;
const SPARK_TTL = 520;
const PARTICLES_PER_CLICK = 10;

export function ClickSpark() {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(0);
  const timeoutRefs = useRef<number[]>([]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || prefersReducedMotion.matches) {
        return;
      }

      const clickId = nextIdRef.current;
      const nextSparks = Array.from({ length: PARTICLES_PER_CLICK }, (_, index) => {
        const id = clickId + index;
        const angle = (Math.PI * 2 * index) / PARTICLES_PER_CLICK;
        const distance = 26 + (index % 4) * 8;

        return {
          id,
          x: event.clientX,
          y: event.clientY,
          color: SPARK_COLORS[index % SPARK_COLORS.length],
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          size: 3 + (index % 3),
        };
      });

      nextIdRef.current += PARTICLES_PER_CLICK;
      setSparks((currentSparks) => [...currentSparks, ...nextSparks]);

      const timeoutId = window.setTimeout(() => {
        setSparks((currentSparks) =>
          currentSparks.filter(
            (currentSpark) =>
              currentSpark.id < clickId ||
              currentSpark.id >= clickId + PARTICLES_PER_CLICK,
          ),
        );
      }, SPARK_TTL);

      timeoutRefs.current.push(timeoutId);
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutRefs.current = [];
    };
  }, []);

  return (
    <div ref={rootRef} className="click-spark-layer" aria-hidden="true">
      {sparks.map((spark) => (
        <span
          key={spark.id}
          className="click-spark-particle"
          style={
            {
              "--spark-x": `${spark.x}px`,
              "--spark-y": `${spark.y}px`,
              "--spark-color": spark.color,
              "--spark-dx": `${spark.dx}px`,
              "--spark-dy": `${spark.dy}px`,
              "--spark-size": `${spark.size}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

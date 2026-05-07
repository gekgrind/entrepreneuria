"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

type Spark = {
  id: number;
  x: number;
  y: number;
  color: string;
};

const SPARK_COLORS = ["#ffffff", "#00D4FF", "#ffe521"] as const;
const SPARK_TTL = 520;

export function ClickSpark() {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(0);
  const timeoutRefs = useRef<number[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    const sparkRoot = root?.parentElement;

    if (!root || !sparkRoot) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || prefersReducedMotion.matches) {
        return;
      }

      const rect = sparkRoot.getBoundingClientRect();
      const id = nextIdRef.current;
      nextIdRef.current += 1;

      const spark: Spark = {
        id,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        color: SPARK_COLORS[id % SPARK_COLORS.length],
      };

      setSparks((currentSparks) => [...currentSparks, spark]);

      const timeoutId = window.setTimeout(() => {
        setSparks((currentSparks) =>
          currentSparks.filter((currentSpark) => currentSpark.id !== id),
        );
      }, SPARK_TTL);

      timeoutRefs.current.push(timeoutId);
    };

    sparkRoot.addEventListener("click", handleClick);

    return () => {
      sparkRoot.removeEventListener("click", handleClick);
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
            } as CSSProperties
          }
        >
          <span className="click-spark-particle__core" />
          <span className="click-spark-particle__ray click-spark-particle__ray--1" />
          <span className="click-spark-particle__ray click-spark-particle__ray--2" />
          <span className="click-spark-particle__ray click-spark-particle__ray--3" />
          <span className="click-spark-particle__ray click-spark-particle__ray--4" />
        </span>
      ))}
    </div>
  );
}

"use client";

/**
 * DevHud — development-only performance overlay for the journey POC.
 * Reads the stats singleton written by the StatsProbe inside the Canvas.
 * Renders nothing in production builds.
 */
import { useEffect, useState } from "react";

import { journeyStats, TIMELINE_UNITS } from "./journey-math";

export function DevHud() {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return undefined;
    const id = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, []);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      aria-hidden="true"
      className="absolute bottom-3 left-3 z-50 rounded-md bg-black/60 px-3 py-2 font-mono text-[11px] leading-5 text-emerald-300 backdrop-blur-sm"
    >
      <div>
        fps {journeyStats.fps} · dpr {journeyStats.dpr.toFixed(2)} · calls{" "}
        {journeyStats.calls} · tris {journeyStats.triangles}
      </div>
      <div>
        particles {journeyStats.particles} · tier {journeyStats.tier} · progress{" "}
        {((journeyStats.progress / TIMELINE_UNITS) * 100).toFixed(1)}%
      </div>
    </div>
  );
}

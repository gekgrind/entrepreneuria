"use client";

import { commandCenterApps } from "@/lib/command-center/apps";
import { AppCard } from "./AppCard";

export function AppGrid() {
  const activeAppCount = commandCenterApps.filter(
    (app) => app.status === "available",
  ).length;

  return (
    <section>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Command Center
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-[-0.05em] text-white">
            Your Apps
          </h2>
        </div>

        <p className="text-sm font-medium text-slate-400">
          {activeAppCount} of {commandCenterApps.length} active
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        {commandCenterApps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </section>
  );
}

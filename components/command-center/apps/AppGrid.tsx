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
          <h2 className="mt-3 text-4xl font-bold tracking-normal text-white sm:text-5xl">
            Founder Operating Suite
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            Launch the active products now and see what is next across the
            Entrepreneuria ecosystem.
          </p>
        </div>

        <p className="text-sm font-medium text-slate-400">
          {activeAppCount} of {commandCenterApps.length} active
        </p>
      </div>

      <div className="grid gap-7 lg:grid-cols-2 2xl:grid-cols-3">
        {commandCenterApps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </section>
  );
}

"use client";

import { CascadeGroup } from "@/components/home/motion/CascadeGroup";

const MANIFEST = [
  { name: "Tool library", note: "Templates & planners on Etsy", status: "Live now", live: true },
  { name: "Launch Pad", note: "Free AI founder tools", status: "Live now", live: true },
  { name: "Prospra", note: "AI founder mentor", status: "In private build", live: false },
  { name: "Architecta", note: "Brand & content systems", status: "In design", live: false },
  { name: "Synceri", note: "Ops & admin flow", status: "In design", live: false },
];

function StatusDot({ live }: { live: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        live
          ? "h-1.5 w-1.5 shrink-0 rounded-full bg-[#00d4ff] shadow-[0_0_8px_rgba(0,212,255,0.8)]"
          : "h-1.5 w-1.5 shrink-0 rounded-full border border-white/35"
      }
    />
  );
}

/**
 * The honest status board — relocated from the hero into its own
 * generously-spaced section. Same items, same no-spin framing.
 */
export function EcosystemStatus() {
  return (
    <section aria-label="Ecosystem status" className="relative">
      <div className="mx-auto w-full max-w-6xl px-6 pb-32 sm:px-10 sm:pb-40 xl:px-0">
        <CascadeGroup selector="[data-cascade-item]" stagger={0.08} y={20}>
          <div
            data-cascade-item
            className="flex items-baseline justify-between border-b border-white/10 pb-6"
          >
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45 [font-family:var(--font-label)]">
              Ecosystem status
            </p>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/30 [font-family:var(--font-label)]">
              No spin
            </p>
          </div>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {MANIFEST.map((item) => (
              <li
                key={item.name}
                data-cascade-item
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="flex items-center gap-3">
                  <StatusDot live={item.live} />
                  <p className="text-[15px] font-semibold text-white">
                    {item.name}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/50">
                  {item.note}
                </p>
                <p
                  className={`mt-4 text-[11px] uppercase tracking-[0.18em] [font-family:var(--font-label)] ${
                    item.live ? "text-[#00d4ff]" : "text-white/40"
                  }`}
                >
                  {item.status}
                </p>
              </li>
            ))}
          </ul>

          <p
            data-cascade-item
            className="mt-12 max-w-2xl text-sm leading-6 text-white/45"
          >
            What&apos;s live is live. What isn&apos;t is labeled. The waitlist
            gets first access as each product opens.
          </p>
        </CascadeGroup>
      </div>
    </section>
  );
}

import type { CSSProperties } from "react";

import { ADVISORS } from "@/lib/directorium/advisors";

import { AdvisorGlyph } from "./chamber/AdvisorGlyph";
import { SeatMap } from "./chamber/SeatMap";

/**
 * Meet the board — six advisor entries in board order (I–VI). Each is
 * the chamber seat pulled out for inspection: its signature glyph, its
 * place at the table (mini-map), the role, and the model as a secondary
 * chip. The signature color stays inside the glyph, the seat point, the
 * top catchlight, and the chip.
 *
 * Hover/focus-within brightens the border and halo (CSS). Phase 2 motion
 * (DirectoriumMotion) reveals entries in board order and, on hover, moves
 * only the glyph's internal geometry — the card itself never lifts.
 */
export function BoardGrid() {
  return (
    <ul role="list" data-dm="board" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      {ADVISORS.map((advisor) => (
        <li key={advisor.id} data-dm-entry className="flex">
          <article
            aria-labelledby={`advisor-${advisor.id}`}
            className="group relative isolate flex w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0.012)_60%)] p-7 transition-colors duration-300 focus-within:border-white/20 hover:border-white/20 sm:p-8"
            style={{ "--hue": advisor.color } as CSSProperties}
          >
            {/* signature catchlight + wash, confined to the top edge */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--hue),transparent)] opacity-60"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-16 -top-20 -z-10 h-56 w-56 rounded-full opacity-60 transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background: `radial-gradient(circle, ${advisor.color}24 0%, transparent 68%)`,
              }}
            />

            <div className="flex items-start justify-between">
              <AdvisorGlyph
                id={advisor.id}
                color={advisor.color}
                className="h-16 w-16 shrink-0"
              />
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[11px] uppercase tracking-[0.24em] text-white/55 [font-family:var(--font-label)]">
                  {advisor.numeral}
                </span>
                <SeatMap advisor={advisor} className="h-9 w-9" />
              </div>
            </div>

            <h3
              id={`advisor-${advisor.id}`}
              className="mt-7 text-2xl font-medium tracking-tight text-white"
            >
              {advisor.title}
            </h3>
            <p className="mt-3 flex-1 text-sm leading-6 text-white/60">
              {advisor.description}
            </p>
            <p
              className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.08em]"
              style={{
                borderColor: `${advisor.color}40`,
                color: advisor.color,
                backgroundColor: `${advisor.color}0f`,
              }}
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: advisor.color }}
              />
              <span className="sr-only">Powered by </span>
              {advisor.model}
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}

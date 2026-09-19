import type { CSSProperties } from "react";

import {
  CENTER,
  CORE_R,
  PLINTH_R,
  SEAT_ORBIT,
  VIEW,
  polar,
  seatAngle,
  seatPoint,
} from "./chamber-geometry";

/**
 * The counterfeit board — the chamber's exact geometry with its meaning
 * inverted. One model sits at the centre and broadcasts six identical
 * prompted personas outward: same color, same mark, same reasoning,
 * nothing crossing the table. Deliberately colorless and flat beside
 * the real chamber.
 *
 * Motion hooks (Phase 2): data-e="source" | "broadcast" | "persona" |
 * "mask". The echo sequence moves every persona in unison.
 */

const SLATE = "#8fa3bf";

export function EchoDiagram({ className = "" }: { className?: string }) {
  const seats = [0, 1, 2, 3, 4, 5];
  return (
    <div
      className={`relative aspect-square w-full ${className}`}
      data-echo
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        focusable="false"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={SEAT_ORBIT}
          fill="none"
          stroke={SLATE}
          strokeOpacity={0.14}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />

        {/* broadcast: one source, six outward copies */}
        {seats.map((s) => {
          const from = polar(seatAngle(s), CORE_R + 14);
          const to = polar(seatAngle(s), SEAT_ORBIT - PLINTH_R - 12);
          const head = polar(seatAngle(s), SEAT_ORBIT - PLINTH_R - 12);
          const l = polar(seatAngle(s) + 180 - 28, 9, 0);
          const r = polar(seatAngle(s) + 180 + 28, 9, 0);
          return (
            <g key={`b-${s}`} data-e="broadcast">
              <path
                d={`M${from.x} ${from.y}L${to.x} ${to.y}`}
                stroke={SLATE}
                strokeOpacity={0.4}
                strokeWidth={1}
                strokeDasharray="2 5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={`M${head.x + l.x} ${head.y + l.y}L${head.x} ${head.y}L${head.x + r.x} ${head.y + r.y}`}
                fill="none"
                stroke={SLATE}
                strokeOpacity={0.6}
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}

        {/* the single model */}
        <g data-e="source">
          <circle cx={CENTER} cy={CENTER} r={CORE_R + 8} fill="#060e1a" />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={CORE_R + 8}
            fill="none"
            stroke={SLATE}
            strokeOpacity={0.7}
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={CORE_R - 12}
            fill="none"
            stroke={SLATE}
            strokeOpacity={0.45}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={CENTER} cy={CENTER} r={4} fill={SLATE} />
        </g>

        {/* six identical personas — same mark, a faint offset "mask" */}
        {seats.map((s) => {
          const p = seatPoint(s);
          return (
            <g key={`p-${s}`}>
              <circle
                data-e="mask"
                cx={p.x + 7}
                cy={p.y - 7}
                r={PLINTH_R}
                fill="none"
                stroke={SLATE}
                strokeOpacity={0.14}
                strokeWidth={1}
                strokeDasharray="2 4"
                vectorEffect="non-scaling-stroke"
              />
              <g
                data-e="persona"
                style={{ transformOrigin: `${p.x}px ${p.y}px` } as CSSProperties}
              >
                <circle cx={p.x} cy={p.y} r={PLINTH_R} fill="#060e1a" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={PLINTH_R}
                  fill="none"
                  stroke={SLATE}
                  strokeOpacity={0.42}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={10}
                  fill="none"
                  stroke={SLATE}
                  strokeOpacity={0.6}
                  strokeWidth={1.25}
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={p.x} cy={p.y} r={2.5} fill={SLATE} fillOpacity={0.8} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

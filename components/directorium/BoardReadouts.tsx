import { ADVISORS_BY_SEAT } from "@/lib/directorium/advisors";

import { CENTER, VIEW, polar, seatAngle } from "./chamber/chamber-geometry";

export interface Readout {
  value: string;
  title: string;
  body: string;
}

type Dial = "models" | "personas" | "always";

/**
 * Instrument dials for the board's numbers — each figure sits inside a
 * small readout that shows what it counts: six lit seat points (models),
 * six seats with one mark each (personas), a 24-tick day ring (always).
 */
function ReadoutDial({ kind }: { kind: Dial }) {
  const r = 250;
  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      aria-hidden="true"
      focusable="false"
      className="absolute inset-0 h-full w-full"
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={r}
        fill="none"
        stroke="#cfe6ff"
        strokeOpacity={0.14}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {kind === "always"
        ? Array.from({ length: 24 }, (_, i) => {
            const a = -90 + i * 15;
            const p0 = polar(a, i % 6 === 0 ? r - 44 : r - 24);
            const p1 = polar(a, r);
            return (
              <path
                key={i}
                d={`M${p0.x} ${p0.y}L${p1.x} ${p1.y}`}
                stroke={i % 6 === 0 ? "#00d4ff" : "#cfe6ff"}
                strokeOpacity={i % 6 === 0 ? 0.8 : 0.3}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })
        : ADVISORS_BY_SEAT.map((a) => {
            const p = polar(seatAngle(a.seat), r);
            return kind === "models" ? (
              <circle key={a.id} cx={p.x} cy={p.y} r={30} fill={a.color} />
            ) : (
              <g key={a.id}>
                <circle cx={p.x} cy={p.y} r={40} fill="#081527" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={40}
                  fill="none"
                  stroke={a.color}
                  strokeOpacity={0.85}
                  strokeWidth={1.25}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
    </svg>
  );
}

const DIALS: readonly Dial[] = ["models", "personas", "always"];

export function BoardReadouts({ items }: { items: readonly Readout[] }) {
  return (
    <ul role="list" className="flex flex-col gap-9">
      {items.map((item, i) => (
        <li key={item.title} className="flex items-center gap-6 sm:gap-8">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center sm:h-28 sm:w-28">
            <ReadoutDial kind={DIALS[i] ?? "always"} />
            <p className="relative text-3xl font-medium tracking-tight text-white [font-family:var(--font-heading)] sm:text-4xl">
              {item.value}
            </p>
          </div>
          <div>
            <p className="font-semibold text-white">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-white/60">{item.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

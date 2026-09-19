import { ADVISORS_BY_SEAT, type Advisor } from "@/lib/directorium/advisors";

import { CENTER, SEAT_ORBIT, VIEW, seatPoint } from "./chamber-geometry";

/**
 * Seat mini-map — the chamber reduced to an instrument: orbit, six seat
 * points, the decision core, and one lit seat (this advisor's place at
 * the table). Same geometry as CouncilChamber.
 */
export function SeatMap({
  advisor,
  className = "",
}: {
  advisor: Advisor;
  className?: string;
}) {
  const active = seatPoint(advisor.seat);
  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={SEAT_ORBIT}
        fill="none"
        stroke="#cfe6ff"
        strokeOpacity={0.16}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M${active.x} ${active.y}L${CENTER} ${CENTER}`}
        stroke={advisor.color}
        strokeOpacity={0.55}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {ADVISORS_BY_SEAT.map((a) => {
        const p = seatPoint(a.seat);
        const on = a.id === advisor.id;
        return (
          <circle
            key={a.id}
            cx={p.x}
            cy={p.y}
            r={on ? 62 : 38}
            fill={on ? advisor.color : "#cfe6ff"}
            fillOpacity={on ? 1 : 0.2}
          />
        );
      })}
      <circle
        cx={active.x}
        cy={active.y}
        r={112}
        fill="none"
        stroke={advisor.color}
        strokeOpacity={0.4}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={CENTER} cy={CENTER} r={44} fill="#d27a2c" fillOpacity={0.85} />
    </svg>
  );
}

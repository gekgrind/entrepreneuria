import type { CSSProperties } from "react";

import {
  ADVISORS_BY_SEAT,
  TENSION_PAIRS,
  VERDICT_DISSENT,
  advisorById,
  boardIndex,
  type ChamberState,
} from "@/lib/directorium/advisors";

import { AdvisorGlyphMark } from "./AdvisorGlyph";
import {
  CENTER,
  CORE_R,
  OPEN_SEAT_R,
  PLINTH_R,
  SEAT_ORBIT,
  TICK_INNER,
  TICK_OUTER,
  VERDICT_R,
  VIEW,
  arcPath,
  labelAnchor,
  pct,
  polar,
  seatAngle,
  seatPoint,
  tensionApex,
  tensionHalfPaths,
  tickRingPath,
} from "./chamber-geometry";
import styles from "./chamber.module.css";

/**
 * CouncilChamber — the Directorium motif: a decision core, six advisor
 * seats on a hexagonal orbit, and the relationships between them.
 *
 * Server component, pure SVG + HTML labels. Every state's layers are
 * always rendered; `state` / `core` select which are lit via CSS custom
 * properties (see chamber.module.css), so each state is a finished
 * static composition and state changes need no re-render.
 *
 *   dormant   seats present but unlit; the decision waits (core ember/lit)
 *   convened  seats lit, each advisor connected to the decision
 *   debate    opposite seats in tension across the table; positions taken
 *   verdict   connections converge; confidence ring resolves; one dissent
 *             stays on the record
 *
 * `centre="seat"` replaces the decision core with the founder's open
 * seat (final CTA) — a wide ring an HTML action can sit inside.
 *
 * MOTION HOOKS (Phase 2) — markup only, no behavior here:
 *   data-c="…"        part name, targeted by the hero CSS intro and the
 *                     GSAP chamber timelines (motion/chamber-timeline.ts)
 *   data-advisor="…"  which advisor a part belongs to
 *   --i               board-order index (I = 0) for CSS stagger
 *   transform-origin  per-part origin in viewBox units (seat centre,
 *                     chamber centre) for CSS transforms
 *   intro="hero"      opts this instance into the CSS load assembly
 *   ambient           adds the orbit light mote used by the hero ambient
 */

const CYAN = "#00d4ff";
const CYAN_PALE = "#bdf4ff";
const HUMAN = "#d27a2c";
const TICKS = tickRingPath();

const origin = (x: number, y: number) => `${x}px ${y}px`;

export function CouncilChamber({
  id,
  state,
  core = "lit",
  centre = "core",
  labels = true,
  title,
  intro,
  ambient = false,
  className = "",
}: {
  /** Unique per instance — namespaces SVG gradient ids. */
  id: string;
  state: ChamberState;
  core?: "lit" | "ember";
  centre?: "core" | "seat";
  labels?: boolean;
  /** When set the chamber is announced as an image with this label;
   *  otherwise it is decorative (aria-hidden). */
  title?: string;
  /** CSS load assembly (hero). Omit to render the composition at rest. */
  intro?: "hero";
  /** Ambient orbit light (hero). */
  ambient?: boolean;
  className?: string;
}) {
  const g = (name: string) => `dc-${id}-${name}`;
  const spokeEnd = centre === "seat" ? OPEN_SEAT_R + 10 : 0;
  const centreOrigin = origin(CENTER, CENTER);

  return (
    <div
      className={`${styles.chamber} ${className}`}
      data-chamber
      data-state={state}
      data-core={core}
      data-centre={centre}
      data-intro={intro}
      {...(title
        ? { role: "img", "aria-label": title }
        : { "aria-hidden": true })}
    >
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className={styles.svg}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id={g("core")}>
            <stop offset="0%" stopColor="#ffe2c2" />
            <stop offset="14%" stopColor="#f2a860" stopOpacity="0.95" />
            <stop offset="40%" stopColor={HUMAN} stopOpacity="0.42" />
            <stop offset="100%" stopColor={HUMAN} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={g("bloom")}>
            <stop offset="0%" stopColor={CYAN} stopOpacity="0.16" />
            <stop offset="55%" stopColor={CYAN} stopOpacity="0.04" />
            <stop offset="100%" stopColor={CYAN} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={g("mote")}>
            <stop offset="0%" stopColor="#e8f7ff" stopOpacity="0.9" />
            <stop offset="35%" stopColor={CYAN} stopOpacity="0.28" />
            <stop offset="100%" stopColor={CYAN} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={g("confidence")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={CYAN_PALE} />
            <stop offset="100%" stopColor={CYAN} />
          </linearGradient>
          {ADVISORS_BY_SEAT.map((a) => {
            const p = seatPoint(a.seat);
            const end =
              spokeEnd > 0 ? polar(seatAngle(a.seat), spokeEnd) : { x: CENTER, y: CENTER };
            return (
              <g key={a.id}>
                <radialGradient id={g(`halo-${a.id}`)}>
                  <stop offset="0%" stopColor={a.color} stopOpacity="0.36" />
                  <stop offset="45%" stopColor={a.color} stopOpacity="0.1" />
                  <stop offset="100%" stopColor={a.color} stopOpacity="0" />
                </radialGradient>
                <linearGradient
                  id={g(`spoke-${a.id}`)}
                  gradientUnits="userSpaceOnUse"
                  x1={p.x}
                  y1={p.y}
                  x2={end.x}
                  y2={end.y}
                >
                  <stop offset="0%" stopColor={a.color} stopOpacity="0.9" />
                  <stop offset="65%" stopColor={CYAN} stopOpacity="0.7" />
                  <stop offset="100%" stopColor={CYAN_PALE} stopOpacity="0.9" />
                </linearGradient>
              </g>
            );
          })}
          {TENSION_PAIRS.map((pair) => {
            const a = advisorById(pair.a);
            const b = advisorById(pair.b);
            const pa = seatPoint(a.seat);
            const pb = seatPoint(b.seat);
            return (
              <linearGradient
                key={`${pair.a}-${pair.b}`}
                id={g(`tension-${pair.a}`)}
                gradientUnits="userSpaceOnUse"
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
              >
                <stop offset="0%" stopColor={a.color} />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.7" />
                <stop offset="100%" stopColor={b.color} />
              </linearGradient>
            );
          })}
        </defs>

        {/* ── Architecture: orbit, hexagon guide, instrument ticks ── */}
        <g className={styles.orbit} data-c="orbit" style={{ transformOrigin: centreOrigin }}>
          <circle
            cx={CENTER}
            cy={CENTER}
            r={SEAT_ORBIT}
            fill="none"
            stroke="#cfe6ff"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <polygon
            points={ADVISORS_BY_SEAT.map((a) => {
              const p = seatPoint(a.seat);
              return `${p.x},${p.y}`;
            }).join(" ")}
            fill="none"
            stroke="#cfe6ff"
            strokeWidth={1}
            strokeOpacity={0.45}
            strokeDasharray="2 6"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={128}
            fill="none"
            stroke="#cfe6ff"
            strokeWidth={1}
            strokeOpacity={0.5}
            strokeDasharray="1 5"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={TICKS}
            stroke="#cfe6ff"
            strokeWidth={1}
            strokeOpacity={0.9}
            vectorEffect="non-scaling-stroke"
          />
        </g>
        {ADVISORS_BY_SEAT.map((a) => {
          const i = polar(seatAngle(a.seat), TICK_INNER - 2);
          const o = polar(seatAngle(a.seat), TICK_OUTER + 6);
          return (
            <path
              key={`tick-${a.id}`}
              data-c="seat-tick"
              data-advisor={a.id}
              style={{ "--i": boardIndex(a.id) } as CSSProperties}
              d={`M${i.x} ${i.y}L${o.x} ${o.y}`}
              stroke={a.color}
              strokeOpacity={0.5}
              strokeWidth={1.25}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* ── Ambient orbit light (hero only) — passes beneath the seats ── */}
        {ambient ? (
          <g data-c="mote" style={{ transformOrigin: centreOrigin }}>
            <circle
              cx={CENTER}
              cy={CENTER - SEAT_ORBIT}
              r={14}
              fill={`url(#${g("mote")})`}
            />
          </g>
        ) : null}

        {/* ── Seat halos (lit when convened) ── */}
        <g className={styles.halo}>
          {ADVISORS_BY_SEAT.map((a) => {
            const p = seatPoint(a.seat);
            return (
              <circle
                key={`halo-${a.id}`}
                data-c="halo"
                data-advisor={a.id}
                style={
                  {
                    "--i": boardIndex(a.id),
                    transformOrigin: origin(p.x, p.y),
                  } as CSSProperties
                }
                cx={p.x}
                cy={p.y}
                r={78}
                fill={`url(#${g(`halo-${a.id}`)})`}
              />
            );
          })}
        </g>

        {/* ── Convened: every advisor connected to the decision ── */}
        <g className={styles.spokes}>
          {ADVISORS_BY_SEAT.map((a) => {
            const p = seatPoint(a.seat);
            const end =
              spokeEnd > 0 ? polar(seatAngle(a.seat), spokeEnd) : { x: CENTER, y: CENTER };
            return (
              <path
                key={`spoke-${a.id}`}
                data-c="spoke"
                data-advisor={a.id}
                style={
                  {
                    "--i": boardIndex(a.id),
                    transformOrigin: origin(p.x, p.y),
                  } as CSSProperties
                }
                d={`M${p.x} ${p.y}L${end.x} ${end.y}`}
                stroke={`url(#${g(`spoke-${a.id}`)})`}
                strokeWidth={1.25}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>

        {/* ── Debate: tension across the table. Each curve is two halves,
               one per advisor, meeting at the point of contention. ── */}
        <g className={styles.tension}>
          {TENSION_PAIRS.map((pair) => {
            const a = advisorById(pair.a);
            const b = advisorById(pair.b);
            const apex = tensionApex(a.seat);
            const halves = tensionHalfPaths(a.seat, b.seat);
            return (
              <g key={`t-${pair.a}`} data-c="tension" data-pair={pair.a}>
                {halves.map((d, side) => (
                  <path
                    key={side}
                    data-c="tension-half"
                    data-pair={pair.a}
                    data-advisor={side === 0 ? a.id : b.id}
                    d={d}
                    fill="none"
                    stroke={`url(#${g(`tension-${pair.a}`)})`}
                    strokeWidth={pair.primary ? 1.5 : 1.1}
                    strokeOpacity={pair.primary ? 0.95 : 0.62}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {/* point of contention */}
                <path
                  data-c="contention"
                  data-pair={pair.a}
                  style={{ transformOrigin: origin(apex.x, apex.y) }}
                  d={`M${apex.x} ${apex.y - 5}L${apex.x + 5} ${apex.y}L${apex.x} ${apex.y + 5}L${apex.x - 5} ${apex.y}Z`}
                  fill="#050b14"
                  stroke="#ffffff"
                  strokeOpacity={pair.primary ? 0.9 : 0.45}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </g>

        {/* ── Centre: the decision core, or the founder's open seat ── */}
        {centre === "core" ? (
          <g>
            <g className={styles.verdict}>
              <circle
                data-c="bloom"
                style={{ transformOrigin: centreOrigin }}
                cx={CENTER}
                cy={CENTER}
                r={150}
                fill={`url(#${g("bloom")})`}
              />
            </g>
            <circle cx={CENTER} cy={CENTER} r={CORE_R} fill="#050b14" />
            <g className={styles.core}>
              <circle
                data-c="core-glow"
                style={{ transformOrigin: centreOrigin }}
                cx={CENTER}
                cy={CENTER}
                r={CORE_R + 30}
                fill={`url(#${g("core")})`}
              />
              <circle
                data-c="core-ring"
                cx={CENTER}
                cy={CENTER}
                r={CORE_R}
                fill="none"
                stroke={HUMAN}
                strokeOpacity={0.6}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                data-c="core-dot"
                style={{ transformOrigin: centreOrigin }}
                cx={CENTER}
                cy={CENTER}
                r={4.5}
                fill="#fff1e0"
              />
            </g>
            <g className={styles.verdict}>
              <circle
                data-c="verdict-track"
                cx={CENTER}
                cy={CENTER}
                r={VERDICT_R}
                fill="none"
                stroke="#ffffff"
                strokeOpacity={0.1}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <path
                data-c="verdict-arc"
                d={arcPath(CENTER, CENTER, VERDICT_R, -90, -90 + 0.86 * 360)}
                fill="none"
                stroke={`url(#${g("confidence")})`}
                strokeWidth={2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {(() => {
                const t = polar(-90, VERDICT_R);
                return (
                  <path
                    data-c="verdict-tick"
                    d={`M${t.x} ${t.y - 7}L${t.x} ${t.y + 7}`}
                    stroke={CYAN_PALE}
                    strokeWidth={1.25}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })()}
            </g>
          </g>
        ) : (
          <g className={styles.core}>
            <circle
              data-c="seat-glow"
              style={{ transformOrigin: centreOrigin }}
              cx={CENTER}
              cy={CENTER}
              r={OPEN_SEAT_R + 46}
              fill={`url(#${g("core")})`}
              opacity={0.55}
            />
            <circle cx={CENTER} cy={CENTER} r={OPEN_SEAT_R} fill="#050b14" fillOpacity={0.55} />
            <circle
              data-c="seat-ring"
              style={{ transformOrigin: centreOrigin }}
              cx={CENTER}
              cy={CENTER}
              r={OPEN_SEAT_R}
              fill="none"
              stroke={HUMAN}
              strokeOpacity={0.7}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              data-c="seat-ring-inner"
              cx={CENTER}
              cy={CENTER}
              r={OPEN_SEAT_R - 12}
              fill="none"
              stroke={HUMAN}
              strokeOpacity={0.3}
              strokeWidth={1}
              strokeDasharray="1 5"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}

        {/* ── Seats: plinth, stance, glyph ── */}
        {ADVISORS_BY_SEAT.map((a) => {
          const p = seatPoint(a.seat);
          const facing = seatAngle(a.seat) + 180;
          const stanceArc = arcPath(p.x, p.y, PLINTH_R + 9, facing - 34, facing + 34);
          const dissent = a.id === VERDICT_DISSENT;
          return (
            <g
              key={`seat-${a.id}`}
              data-c="seat"
              data-advisor={a.id}
              style={
                {
                  color: a.color,
                  "--i": boardIndex(a.id),
                  transformOrigin: origin(p.x, p.y),
                } as CSSProperties
              }
            >
              <circle cx={p.x} cy={p.y} r={PLINTH_R} fill="#060e1a" fillOpacity={0.94} />
              <circle
                cx={p.x}
                cy={p.y}
                r={PLINTH_R}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.42}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <g className={dissent ? styles.dissent : styles.stance}>
                <path
                  data-c="stance"
                  data-advisor={a.id}
                  data-dissent={dissent || undefined}
                  d={stanceArc}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
              {!dissent ? (
                <g className={styles.aligned}>
                  <path
                    data-c="aligned"
                    data-advisor={a.id}
                    d={stanceArc}
                    fill="none"
                    stroke={CYAN_PALE}
                    strokeOpacity={0.9}
                    strokeWidth={2}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ) : null}
              <g
                className={styles.glyph}
                data-c="glyph"
                data-advisor={a.id}
                transform={`translate(${p.x} ${p.y})`}
              >
                <AdvisorGlyphMark id={a.id} />
              </g>
            </g>
          );
        })}
      </svg>

      {labels ? (
        <div className={styles.labels} aria-hidden="true">
          {ADVISORS_BY_SEAT.map((a) => {
            const anchor = labelAnchor(a.seat);
            return (
              <span
                key={`label-${a.id}`}
                data-c="label"
                data-advisor={a.id}
                className={styles.label}
                style={
                  {
                    left: pct(anchor.x),
                    top: pct(anchor.y),
                    "--hue": a.color,
                    "--i": boardIndex(a.id),
                  } as CSSProperties
                }
              >
                <span className={styles.labelDot} />
                {a.role}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** CSS stand-in for the chamber atmosphere plate (see chamber.module.css). */
export function ChamberAtmosphere({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`${styles.atmosphere} ${className}`} />;
}

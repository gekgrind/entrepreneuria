import type { AdvisorId } from "@/lib/directorium/advisors";

/**
 * Advisor signature glyphs — six abstract marks built from one grammar:
 * hairline strokes (non-scaling, so they stay 1.25px at any size), a
 * shared ±22-unit footprint, and one idea per advisor. No faces, no
 * brains, no literal icons. Strokes use currentColor; the caller sets
 * the advisor's signature color.
 *
 * `AdvisorGlyphMark` renders bare geometry (for use inside the chamber
 * SVG); `AdvisorGlyph` wraps it in its own <svg> with a seat plinth.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
};

const dot = (cx: number, cy: number, r = 1.9) => (
  <circle cx={cx} cy={cy} r={r} fill="currentColor" />
);

/** Strategist — concentric rings and one long bearing: sees far, sets direction. */
function Strategist() {
  return (
    <g>
      <circle r={7} {...stroke} />
      <g data-g="range">
        <circle r={15} {...stroke} strokeDasharray="1.5 3.5" opacity={0.7} />
      </g>
      <g data-g="bearing">
        <path d="M0 0L17 -17" {...stroke} />
        <path d="M11 -17L17 -17L17 -11" {...stroke} />
      </g>
      {dot(0, 0, 1.6)}
    </g>
  );
}

/** Capitalist — tiered arcs in a compounding ratio. */
function Capitalist() {
  return (
    <g>
      <g data-g="tier-1">
        <path d="M-4.95 4.95A7 7 0 0 1 -4.95 -4.95" {...stroke} opacity={0.55} />
      </g>
      <g data-g="tier-2">
        <path d="M-9.19 9.19A13 13 0 0 1 5.49 -11.78" {...stroke} opacity={0.8} />
      </g>
      <g data-g="tier-3">
        <path d="M-13.44 13.44A19 19 0 1 1 18.36 4.92" {...stroke} />
        {dot(18.36, 4.92)}
      </g>
      {dot(0, 0, 1.6)}
    </g>
  );
}

/** Growth Architect — a stepped lattice branching outward. */
function GrowthArchitect() {
  return (
    <g>
      <g data-g="lattice">
        <path
          d="M0 16L0 5M0 5L-9 -4M0 5L9 -4M-9 -4L-15 -14M-9 -4L-4 -14M9 -4L4 -14M9 -4L15 -14"
          {...stroke}
        />
      </g>
      {dot(0, 16, 1.6)}
      <g data-g="leaf">{dot(-15, -14)}</g>
      <g data-g="leaf">{dot(-4, -14)}</g>
      <g data-g="leaf">{dot(4, -14)}</g>
      <g data-g="leaf">{dot(15, -14)}</g>
    </g>
  );
}

/** Operator — a cadence ring of ticks and one hand: rhythm, execution. */
function Operator() {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = ((-90 + i * 30) * Math.PI) / 180;
    const r0 = i % 3 === 0 ? 11 : 14;
    const r1 = 18;
    return `M${(Math.cos(a) * r0).toFixed(2)} ${(Math.sin(a) * r0).toFixed(2)}L${(
      Math.cos(a) * r1
    ).toFixed(2)} ${(Math.sin(a) * r1).toFixed(2)}`;
  }).join("");
  return (
    <g>
      <path d={ticks} {...stroke} opacity={0.85} />
      <g data-g="dial">
        <circle r={5.5} {...stroke} />
      </g>
      <g data-g="hand">
        <path d="M0 0L7.8 -4.5" {...stroke} />
      </g>
      {dot(0, 0, 1.4)}
    </g>
  );
}

/** Risk Analyst — a triangulated perimeter crossed by one fault line. */
function RiskAnalyst() {
  return (
    <g>
      <path d="M0 -16L13.86 8L-13.86 8Z" {...stroke} opacity={0.85} />
      <g data-g="fault">
        <path d="M-18 -2L-6 0.5L-1 -3.5L5 3L18 1" {...stroke} />
      </g>
      <g data-g="sweep">
        <path d="M-18.19 -10.5A21 21 0 0 1 18.19 -10.5" {...stroke} opacity={0.45} />
      </g>
      {dot(0, -16)}
      {dot(13.86, 8)}
      {dot(-13.86, 8)}
    </g>
  );
}

/** Contrarian — a broken ring and an off-axis centre: breaks the symmetry. */
function Contrarian() {
  return (
    <g>
      <path d="M15.98 5.81A17 17 0 1 1 15.98 -5.81" {...stroke} />
      <g data-g="counter">
        <circle cx={5} cy={-4} r={7} {...stroke} opacity={0.85} />
        {dot(5, -4, 1.6)}
      </g>
      <g data-g="chevron">
        <path d="M23 -4L18.5 0L23 4" {...stroke} />
      </g>
    </g>
  );
}

const MARKS: Record<AdvisorId, () => React.JSX.Element> = {
  strategist: Strategist,
  capitalist: Capitalist,
  "growth-architect": GrowthArchitect,
  operator: Operator,
  "risk-analyst": RiskAnalyst,
  contrarian: Contrarian,
};

export function AdvisorGlyphMark({ id }: { id: AdvisorId }) {
  const Mark = MARKS[id];
  return <Mark />;
}

/** Standalone glyph on its own seat plinth (board entries, captions). */
export function AdvisorGlyph({
  id,
  color,
  className = "",
}: {
  id: AdvisorId;
  color: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="-36 -36 72 72"
      data-glyph={id}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ color }}
    >
      <circle r={30} fill="rgba(5, 11, 20, 0.72)" />
      <circle r={30} {...stroke} opacity={0.32} />
      <circle r={34.5} {...stroke} opacity={0.1} strokeDasharray="1 4" />
      <AdvisorGlyphMark id={id} />
    </svg>
  );
}

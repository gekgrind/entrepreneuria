import type { CSSProperties, ReactNode } from "react";

/**
 * Atmosphere primitives for flow pages — the answer to "why does this
 * page look like stacked rectangles?".
 *
 * The old marketing shell gave every section its own background and a
 * hairline rule on top, so each boundary announced itself twice. Here
 * the PAGE owns one continuous field and sections own nothing but
 * rhythm; light is positioned to straddle the boundaries so there is
 * nothing for the eye to catch on.
 *
 * Server components — no client JS reaches the browser for any of this.
 */

/* ------------------------------------------------------------------ */

/**
 * The page canvas. One vertical gradient across the whole document plus
 * the tiling star field, pulled up under the fixed header so the field
 * runs edge to edge behind it (RootClientLayout pads the route wrapper).
 */
export function FlowCanvas({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flow-field relative -mt-[calc(var(--header-height)+20px)] overflow-x-clip text-white ${className}`}
    >
      <div
        aria-hidden="true"
        className="flow-stars pointer-events-none absolute inset-0 opacity-70"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type GlowTone = "human" | "intelligence" | "atmosphere";

const TONE_CLASS: Record<GlowTone, string> = {
  human: "glow-human-radial",
  intelligence: "glow-intelligence-radial",
  atmosphere: "glow-atmosphere-radial",
};

/**
 * A positioned radial. The semantic grammar from the homepage holds:
 * `human` (orange) is the founder and primary action, `intelligence`
 * (cyan) is the product's own light, `atmosphere` (steel) is depth.
 *
 * Place these so their CENTRE sits on a section boundary — a boundary
 * with light spilling across it stops reading as a boundary.
 */
export function Glow({
  tone = "atmosphere",
  className = "",
  opacity,
}: {
  tone?: GlowTone;
  /** Position + size utilities. Always absolute. */
  className?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={`${TONE_CLASS[tone]} pointer-events-none absolute rounded-full ${className}`}
      style={opacity !== undefined ? { opacity } : undefined}
    />
  );
}

/* ------------------------------------------------------------------ */

/**
 * The transition into and out of the paper interlude.
 *
 * A light section on a dark page is the hardest seam on the site — the
 * old page cut straight from #081527 to #f7fbff and read as two
 * unrelated rectangles. This band spends ~9rem easing one into the
 * other, so the temperature shift becomes a dissolve.
 *
 * `into` sits directly above the paper section; `out of` directly below.
 */
export function PaperBleed({
  direction,
  paper = "#f7f4ee",
}: {
  direction: "into" | "out-of";
  /** Must match the paper section's own background. */
  paper?: string;
}) {
  const gradient =
    direction === "into"
      ? `linear-gradient(180deg, rgba(5, 11, 20, 0) 0%, ${paper}1a 40%, ${paper}80 72%, ${paper} 94%, ${paper} 100%)`
      : `linear-gradient(180deg, ${paper} 0%, ${paper} 6%, ${paper}80 28%, ${paper}1a 60%, rgba(5, 11, 20, 0) 100%)`;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none relative h-24 w-full sm:h-36 ${
        direction === "into" ? "-mb-px" : "-mt-px"
      }`}
      style={{ background: gradient } as CSSProperties}
    />
  );
}

/* ------------------------------------------------------------------ */

/**
 * The guidance thread — Prospra's one page-specific motif, and the
 * bridge that carries the eye across a section boundary.
 *
 * A hairline with a lit segment that draws itself as the reader
 * advances. Scroll-driven in CSS where the browser supports
 * `animation-timeline: view()`; a static hairline everywhere else and
 * for reduced motion. There is no scroll listener anywhere on this page.
 */
export function Thread({
  className = "",
  height = "h-full",
}: {
  className?: string;
  height?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flow-thread pointer-events-none block w-px ${height} ${className}`}
    >
      <span className="flow-thread__trace block h-full w-px" />
    </span>
  );
}

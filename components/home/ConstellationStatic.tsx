import { PRODUCTS, getMaxOrbitalTier } from "@/lib/ecosystem/products";
import {
  computeOrbits,
  CONSTELLATION_CENTER as C,
  CONSTELLATION_VIEWBOX as VB,
} from "@/lib/ecosystem/orbits";
import { GALAXY_TO_VIEWBOX, SPIRAL_ARM } from "@/lib/ecosystem/spiral";

/* Spiral arm path in viewBox space — the SAME geometry the journey's
   interactive particle galaxy sweeps (lib/ecosystem/spiral is the
   shared truth), so the still image and the interactive ecosystem
   read as one illustration. Radii are galaxy units. */
function spiralArmPath(armIndex: number, r0: number, r1: number): string {
  const STEPS = 72;
  let d = "";
  for (let i = 0; i <= STEPS; i += 1) {
    const r = r0 + ((r1 - r0) * i) / STEPS;
    const a =
      armIndex * ((Math.PI * 2) / SPIRAL_ARM.count) - r * SPIRAL_ARM.swirl;
    const x = C + r * GALAXY_TO_VIEWBOX * Math.cos(a);
    const y = C + r * GALAXY_TO_VIEWBOX * Math.sin(a);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/**
 * The guaranteed-baseline constellation: a static SVG generated from the
 * ecosystem registry. This is:
 *   - the reduced-motion state
 *   - the no-WebGL fallback
 *   - the kill-switch (NEXT_PUBLIC_CONSTELLATION_MODE=static) render
 *   - the end-state the interactive scene hands off to
 *   - the motif source for OG key art
 *
 * Decorative only — product information is conveyed by the adjacent
 * semantic list, so this is aria-hidden. Layout is COMPUTED by
 * lib/ecosystem/orbits; adding a product reflows, never redesigns.
 */
export function ConstellationStatic({ className }: { className?: string }) {
  const nodes = computeOrbits(PRODUCTS);
  const maxTier = getMaxOrbitalTier();
  const rings = Array.from({ length: maxTier }, (_, i) => (i + 1) * 150);
  const nameBySlug = new Map(PRODUCTS.map((p) => [p.slug, p.name]));

  /* constellation arcs: connect consecutive nodes sharing a ring */
  const arcs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let tier = 1; tier <= maxTier; tier += 1) {
    const ringNodes = nodes.filter((n) => n.tier === tier);
    for (let i = 0; i < ringNodes.length - 1; i += 1) {
      arcs.push({
        x1: ringNodes[i].x,
        y1: ringNodes[i].y,
        x2: ringNodes[i + 1].x,
        y2: ringNodes[i + 1].y,
      });
    }
  }

  /* the galactic disk: two trailing spiral arms + their warm roots */
  const arms = Array.from({ length: SPIRAL_ARM.count }, (_, i) =>
    spiralArmPath(i, SPIRAL_ARM.rMin, SPIRAL_ARM.rMax),
  );
  const armRoots = Array.from({ length: SPIRAL_ARM.count }, (_, i) =>
    spiralArmPath(
      i,
      SPIRAL_ARM.rMin,
      SPIRAL_ARM.rMin + (SPIRAL_ARM.rMax - SPIRAL_ARM.rMin) * 0.38,
    ),
  );

  /* instrument ticks on the outer ring */
  const outerR = maxTier * 150;
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI) / 12;
    const long = i % 6 === 0;
    const r1 = outerR + (long ? 10 : 16);
    const r2 = outerR + 24;
    return {
      x1: C + r1 * Math.cos(a),
      y1: C + r1 * Math.sin(a),
      x2: C + r2 * Math.cos(a),
      y2: C + r2 * Math.sin(a),
      long,
    };
  });

  return (
    <svg
      viewBox={`-70 -70 ${VB + 140} ${VB + 140}`}
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      {/* the galactic disk — two spiral arms sweeping around the
          founder core, the same arms the interactive ecosystem
          renders. Warm gold at the roots, cooling to intelligence
          cyan along the sweep; layered strokes approximate the glow
          (no filters, so every renderer rasterizes identically), and
          the arms always sit BEHIND the constellation wiring */}
      <g data-c-arms>
        {arms.map((d, i) => (
          <g key={`arm-${i}`}>
            <path d={d} fill="none" stroke="rgba(0,212,255,0.05)" strokeWidth="52" strokeLinecap="round" />
            <path d={d} fill="none" stroke="rgba(0,212,255,0.09)" strokeWidth="30" strokeLinecap="round" />
            <path d={d} fill="none" stroke="rgba(0,212,255,0.14)" strokeWidth="13" strokeLinecap="round" />
          </g>
        ))}
        {armRoots.map((d, i) => (
          <g key={`arm-root-${i}`}>
            <path d={d} fill="none" stroke="rgba(210,122,44,0.06)" strokeWidth="40" strokeLinecap="round" />
            <path d={d} fill="none" stroke="rgba(210,122,44,0.11)" strokeWidth="18" strokeLinecap="round" />
          </g>
        ))}
      </g>

      {/* orbital rings */}
      {rings.map((r) => (
        <circle
          key={r}
          data-c-ring
          cx={C}
          cy={C}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.13)"
          strokeWidth="1"
        />
      ))}

      {/* instrument ticks */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.long ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)"}
          strokeWidth="1"
        />
      ))}

      {/* spokes: center to each node */}
      {nodes.map((n) => (
        <line
          key={`spoke-${n.slug}`}
          data-c-spoke
          x1={C}
          y1={C}
          x2={n.x}
          y2={n.y}
          stroke="rgba(0,212,255,0.13)"
          strokeWidth="1"
        />
      ))}

      {/* constellation arcs between ring-mates */}
      {arcs.map((a, i) => (
        <line
          key={`arc-${i}`}
          data-c-arc
          x1={a.x1}
          y1={a.y1}
          x2={a.x2}
          y2={a.y2}
          stroke="rgba(0,212,255,0.22)"
          strokeWidth="1"
        />
      ))}

      {/* the founder — warm center light */}
      <g data-c-center>
        <circle cx={C} cy={C} r={30} fill="rgba(210,122,44,0.14)" />
        <circle cx={C} cy={C} r={16} fill="rgba(210,122,44,0.22)" />
        <circle cx={C} cy={C} r={8} fill="#d27a2c" />
        <text
          x={C}
          y={C + 52}
          textAnchor="middle"
          fill="rgba(210,122,44,0.75)"
          fontSize="19"
          letterSpacing="5"
          fontFamily="var(--font-label), monospace"
        >
          YOU
        </text>
      </g>

      {/* product nodes */}
      {nodes.map((n) => (
        <g key={n.slug} data-c-node>
          <circle cx={n.x} cy={n.y} r={n.dotRadius * 3} fill="rgba(0,212,255,0.09)" />
          <circle cx={n.x} cy={n.y} r={n.dotRadius * 1.7} fill="rgba(0,212,255,0.2)" />
          <circle cx={n.x} cy={n.y} r={n.dotRadius} fill="#00d4ff" />
          <text
            x={n.x}
            y={n.y + n.dotRadius + 32}
            textAnchor="middle"
            fill="rgba(255,255,255,0.55)"
            fontSize="18"
            letterSpacing="3"
            fontFamily="var(--font-label), monospace"
          >
            {(nameBySlug.get(n.slug) ?? n.slug).toUpperCase()}
          </text>
        </g>
      ))}
    </svg>
  );
}

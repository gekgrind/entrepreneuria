import { PRODUCTS, getMaxOrbitalTier } from "@/lib/ecosystem/products";
import {
  computeOrbits,
  CONSTELLATION_CENTER as C,
} from "@/lib/ecosystem/orbits";

/**
 * ConstellationMiniMap — mobile Scene 3 companion.
 *
 * A compact registry-driven map that stays sticky while product cards
 * scroll beneath it; each card ignites its point (data-mm-node, toggled
 * by HomeMotion scroll triggers). Pure SVG + CSS state — under reduced
 * motion all points render lit (see globals.css).
 */
export function ConstellationMiniMap({ className }: { className?: string }) {
  const nodes = computeOrbits(PRODUCTS);
  const maxTier = getMaxOrbitalTier();
  const rings = Array.from({ length: maxTier }, (_, i) => (i + 1) * 150);

  return (
    <svg
      viewBox="-40 -40 1080 1080"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      {rings.map((r) => (
        <circle
          key={r}
          cx={C}
          cy={C}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="3"
        />
      ))}
      <circle cx={C} cy={C} r={12} fill="#d27a2c" />
      {nodes.map((n) => (
        <g key={n.slug} data-mm-node={n.slug}>
          <circle cx={n.x} cy={n.y} r={n.dotRadius * 2.2} fill="rgba(0,212,255,0.15)" />
          <circle cx={n.x} cy={n.y} r={n.dotRadius} fill="#00d4ff" />
        </g>
      ))}
    </svg>
  );
}

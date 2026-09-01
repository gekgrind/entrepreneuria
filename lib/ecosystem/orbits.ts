import type { Product } from "./schema";

/**
 * Constellation layout algorithm.
 *
 * Positions are COMPUTED from the registry — never hard-coded per product.
 * Adding a future product reflows its ring; nothing is redesigned.
 *
 * Space: a 1000×1000 viewBox, center at (500, 500).
 */

export interface OrbitNode {
  slug: string;
  tier: number;
  /** Center of the node in viewBox units. */
  x: number;
  y: number;
  /** Ring radius this node sits on. */
  ringRadius: number;
  /** Node dot radius (flagship/inner nodes are slightly larger). */
  dotRadius: number;
  /** Angle in radians, useful for the R3F scene to match layout exactly. */
  angle: number;
}

const CENTER = 500;
/** Pixels per ring; ring 1 sits at 1× step, ring 3 at 3× step. */
const RING_STEP = 150;
/**
 * Deterministic phase offset per ring so nodes on different rings don't
 * stack on the same spokes. Golden-angle-derived; stable across reflows.
 */
const TIER_PHASE = [0, -Math.PI / 2, -Math.PI / 2 + 0.9, -Math.PI / 2 + 1.7, -Math.PI / 2 + 2.3];

export function computeOrbits(products: readonly Product[]): OrbitNode[] {
  const tiers = new Map<number, Product[]>();
  for (const p of products) {
    const list = tiers.get(p.orbitalTier) ?? [];
    list.push(p);
    tiers.set(p.orbitalTier, list);
  }

  const nodes: OrbitNode[] = [];
  for (const [tier, members] of [...tiers.entries()].sort((a, b) => a[0] - b[0])) {
    const ringRadius = tier * RING_STEP;
    const phase = TIER_PHASE[tier] ?? TIER_PHASE[TIER_PHASE.length - 1];
    members.forEach((p, i) => {
      const angle = phase + (i * 2 * Math.PI) / members.length;
      nodes.push({
        slug: p.slug,
        tier,
        x: CENTER + ringRadius * Math.cos(angle),
        y: CENTER + ringRadius * Math.sin(angle),
        ringRadius,
        dotRadius: tier === 1 ? 12 : Math.max(7, 10 - tier),
        angle,
      });
    });
  }
  return nodes;
}

export const CONSTELLATION_CENTER = CENTER;
export const CONSTELLATION_VIEWBOX = 1000;

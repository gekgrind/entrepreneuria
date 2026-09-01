import type { Product } from "@/lib/ecosystem/schema";

/**
 * Thin re-export layer so the client scene can pull the pure layout math
 * without dragging the server-oriented registry module (zod parse at
 * module load) into the browser chunk.
 */
export { computeOrbits, type OrbitNode } from "@/lib/ecosystem/orbits";

export function getMaxOrbitalTierFromProducts(
  products: readonly Product[],
): number {
  return Math.max(...products.map((p) => p.orbitalTier));
}

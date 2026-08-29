/**
 * ecosystem-shapes — the galaxy homes for the persistent particle field.
 *
 * Positions are COMPUTED from the ecosystem registry orbit layout
 * (lib/ecosystem/orbits — the same math as the static SVG and the
 * production R3F constellation), mapped into a tilted 3D plane so the
 * ecosystem lives in real depth, not on a flat diagram.
 *
 * Local galaxy space: the group's / shader's transform places it in the
 * world (see getGalaxyTransform in journey-math). Center is (0,0,0) —
 * the founder core sits there.
 */
import { computeOrbits, type OrbitNode } from "@/lib/ecosystem/orbits";
import type { Product } from "@/lib/ecosystem/schema";

/** World half-extent of the constellation in local galaxy units. */
export const GALAXY_WORLD = 2.6;
/** Tilt of the galaxy plane (rad around X) — dimensionality, not flatness. */
export const GALAXY_TILT = -0.3;

export interface GalaxyNode {
  slug: string;
  tier: number;
  /** local galaxy-space position (tilt baked in) */
  position: [number, number, number];
  ringRadius: number;
  dotRadius: number;
}

export function computeGalaxyNodes(
  products: readonly Product[],
): GalaxyNode[] {
  const nodes: OrbitNode[] = computeOrbits(products);
  const cosT = Math.cos(GALAXY_TILT);
  const sinT = Math.sin(GALAXY_TILT);
  return nodes.map((n) => {
    const x = ((n.x - 500) / 500) * GALAXY_WORLD;
    const py = ((500 - n.y) / 500) * GALAXY_WORLD;
    const y = py * cosT;
    const z = py * sinT;
    return {
      slug: n.slug,
      tier: n.tier,
      position: [x, y, z] as [number, number, number],
      ringRadius: (n.ringRadius / 500) * GALAXY_WORLD,
      dotRadius: n.dotRadius,
    };
  });
}

/** Particle roles inside the galaxy — encoded in aGalaxyKind. */
export const GALAXY_KIND = {
  ringDust: 0,
  nodeCluster: 1,
  core: 2,
  haze: 3,
  farField: 4,
} as const;

export interface GalaxyHomes {
  /** final galaxy home per particle (local galaxy space) */
  positions: Float32Array;
  /** GALAXY_KIND per particle */
  kinds: Float32Array;
  /** orbital spin direction/speed factor per particle (0 = static) */
  orbit: Float32Array;
}

/**
 * Assign every particle of the master field a galaxy home: orbital ring
 * dust, product-node clusters, warm core density, nebula haze, or a
 * far-field position that keeps layered depth behind the ecosystem.
 */
export function buildGalaxyHomes(
  count: number,
  products: readonly Product[],
  starPositions: Float32Array,
): GalaxyHomes {
  const nodes = computeGalaxyNodes(products);
  const positions = new Float32Array(count * 3);
  const kinds = new Float32Array(count);
  const orbit = new Float32Array(count);
  const cosT = Math.cos(GALAXY_TILT);
  const sinT = Math.sin(GALAXY_TILT);

  /** gaussian-ish offset (sum of two randoms centered) */
  const gauss = () => Math.random() + Math.random() - 1;

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const role = Math.random();
    let x = 0;
    let y = 0;
    let z = 0;
    let kind: number = GALAXY_KIND.ringDust;

    if (role < 0.27) {
      /* orbital ring dust — the visible streams/paths of the ecosystem */
      kind = GALAXY_KIND.ringDust;
      const tierPick = Math.random();
      const tier = tierPick < 0.3 ? 1 : tierPick < 0.78 ? 2 : 3;
      const ringR = ((tier * 150) / 500) * GALAXY_WORLD;
      const a = Math.random() * Math.PI * 2;
      const rr = ringR * (1 + gauss() * 0.055);
      x = Math.cos(a) * rr + gauss() * 0.05;
      y = Math.sin(a) * rr + gauss() * 0.05;
      z = gauss() * 0.14;
      orbit[i] = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.65);
    } else if (role < 0.325 && nodes.length > 0) {
      /* product-node clusters — a tight knot of sparks at each light */
      kind = GALAXY_KIND.nodeCluster;
      const totalDots = nodes.reduce((s, n) => s + n.dotRadius, 0);
      let pick = Math.random() * totalDots;
      let node = nodes[0];
      for (const n of nodes) {
        pick -= n.dotRadius;
        if (pick <= 0) {
          node = n;
          break;
        }
      }
      const spread = 0.04 + node.dotRadius * 0.005;
      x = node.position[0] + gauss() * spread;
      y = node.position[1] + gauss() * spread;
      z = node.position[2] + gauss() * spread * 0.8;
    } else if (role < 0.4) {
      /* warm core density — the founder's gravity well */
      kind = GALAXY_KIND.core;
      x = gauss() * 0.3;
      y = gauss() * 0.3;
      z = gauss() * 0.22;
    } else if (role < 0.68) {
      /* nebula haze — diffuse atmosphere with real z-depth */
      kind = GALAXY_KIND.haze;
      const a = Math.random() * Math.PI * 2;
      const rr = 0.7 + Math.pow(Math.random(), 0.6) * 3.4;
      x = Math.cos(a) * rr + gauss() * 0.35;
      y = Math.sin(a) * rr * 0.82 + gauss() * 0.3;
      z = gauss() * 0.55 - 0.25;
      orbit[i] = (Math.random() < 0.5 ? -1 : 1) * 0.12;
    } else {
      /* far field — the star dome pulled gently toward the plane so the
         galaxy keeps layered depth behind it */
      kind = GALAXY_KIND.farField;
      x = starPositions[i3] * 0.55;
      y = starPositions[i3 + 1] * 0.55;
      z = Math.min(starPositions[i3 + 2] * 0.55, -2.5);
    }

    /* bake the plane tilt (far field keeps its own depth) */
    if (kind !== GALAXY_KIND.farField) {
      const ty = y * cosT - z * sinT;
      const tz = y * sinT + z * cosT;
      y = ty;
      z = tz;
    }

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    kinds[i] = kind;
  }

  return { positions, kinds, orbit };
}

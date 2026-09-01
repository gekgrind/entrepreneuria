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
import { GALAXY_WORLD, SPIRAL_ARM } from "@/lib/ecosystem/spiral";

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
  armDust: 0,
  nodeCluster: 1,
  core: 2,
  haze: 3,
  farField: 4,
  linkPath: 5,
} as const;

export interface GalaxyHomes {
  /** final galaxy home per particle (local galaxy space) */
  positions: Float32Array;
  /** GALAXY_KIND per particle */
  kinds: Float32Array;
  /** orbital spin direction/speed factor per particle (0 = static) */
  orbit: Float32Array;
  /** link-path flow per particle: (unit dir xyz, path length) — zero for
   *  every other role, so the shader can stream link particles along
   *  their connection without any CPU work */
  flows: Float32Array;
}

/** The connection topology of the ecosystem: hub→product SPOKES ONLY.
 *  One clean connection from the Entrepreneuria core to each product —
 *  no arbitrary node-to-node arcs, no crossings. The SAME paths feed the
 *  thin line scaffold (EcosystemGalaxy) and the flowing link particles
 *  below, so the two always coincide. */
function buildLinkPaths(
  nodes: GalaxyNode[],
): Array<{ a: [number, number, number]; b: [number, number, number] }> {
  return nodes.map((n) => ({ a: [0, 0, 0] as [number, number, number], b: n.position }));
}

/**
 * Assign every particle of the master field a galaxy home. The budget is
 * deliberately architectural and HEAVILY biased toward legibility: the
 * ecosystem itself (node clusters, core, link paths, spiral arms, haze)
 * claims only ~25% of the field — down from 60% — so the hub, the nodes
 * and the connections always read above the atmosphere. Everything else
 * stays in the far field: a restrained ambient starfield that keeps the
 * cinematic depth of the page without crowding the system.
 *
 * Density is spent where meaning lives — the founder core and the product
 * nodes get the tightest knots, the link paths trace the wiring, and the
 * haze falls off quickly outward. Around it all, the spiral arm dust
 * draws the galactic disk of the illustration: two trailing arms,
 * atmospheric and always behind the wiring, rotating as ONE solid body
 * so the spiral never shears. There are no orbit rings or node-to-node
 * arcs: the hub-and-spoke structure must read even with motion paused —
 * one platform connecting products, carried on the disk of a galaxy.
 */
export function buildGalaxyHomes(
  count: number,
  products: readonly Product[],
  starPositions: Float32Array,
  seeds?: Float32Array,
): GalaxyHomes {
  const nodes = computeGalaxyNodes(products);
  const linkPaths = buildLinkPaths(nodes);
  const positions = new Float32Array(count * 3);
  const kinds = new Float32Array(count);
  const orbit = new Float32Array(count);
  const flows = new Float32Array(count * 4);
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
    let kind: number = GALAXY_KIND.armDust;

    if (role < 0.042 && nodes.length > 0) {
      /* product-node clusters — a tight knot of sparks at each light.
         Budget cut ~45% and the spread tightened: crisp concentrated
         cores with small controlled halos, never comet-like trails */
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
      const spread = 0.019 + node.dotRadius * 0.0018;
      x = node.position[0] + gauss() * spread;
      y = node.position[1] + gauss() * spread;
      z = node.position[2] + gauss() * spread * 0.6;
    } else if (role < 0.078) {
      /* warm core density — the founder's gravity well; the tightest
         cluster in the system so the hub reads first. Tightened into a
         controlled particle halo around the defined gold core */
      kind = GALAXY_KIND.core;
      x = gauss() * 0.095;
      y = gauss() * 0.095;
      z = gauss() * 0.08;
    } else if (role < 0.148 && linkPaths.length > 0) {
      /* link paths — particles that LIVE on the connections, so the
         ecosystem's wiring reads as traced light, not implied lines.
         The shader streams them along (dir, len); they are seeded AT
         their flow phase (aSeed.x) so the stream wraps hub→node and
         never overshoots past a product into a comet tail. */
      kind = GALAXY_KIND.linkPath;
      const path = linkPaths[Math.floor(Math.random() * linkPaths.length)];
      const t = seeds ? seeds[i * 4] : Math.random();
      const dx = path.b[0] - path.a[0];
      const dy = path.b[1] - path.a[1];
      const dz = path.b[2] - path.a[2];
      const len = Math.max(Math.hypot(dx, dy, dz), 0.0001);
      x = path.a[0] + dx * t + gauss() * 0.022;
      y = path.a[1] + dy * t + gauss() * 0.022;
      z = path.a[2] + dz * t + gauss() * 0.018;
      flows[i * 4] = dx / len;
      flows[i * 4 + 1] = dy / len;
      flows[i * 4 + 2] = dz / len;
      flows[i * 4 + 3] = len;
    } else if (role < 0.238) {
      /* spiral arm dust — the galactic disk of the ecosystem
         illustration: two trailing arms sweeping around the founder
         core. Arms fan out with radius (tight near the hub, feathered
         at the rim) and the disk stays thin so the plane tilt reads as
         depth. Density peaks at mid-radius so the arms read as ARMS,
         not a uniform sheet. */
      kind = GALAXY_KIND.armDust;
      const arm = Math.floor(Math.random() * SPIRAL_ARM.count);
      const rr =
        SPIRAL_ARM.rMin +
        Math.pow(Math.random(), 0.62) * (SPIRAL_ARM.rMax - SPIRAL_ARM.rMin);
      const spread = 0.055 + rr * 0.085;
      const a =
        arm * ((Math.PI * 2) / SPIRAL_ARM.count) -
        rr * SPIRAL_ARM.swirl +
        gauss() * (spread / rr) * 1.9;
      const rad = rr + gauss() * spread * 0.45;
      x = Math.cos(a) * rad;
      y = Math.sin(a) * rad;
      z = gauss() * (0.04 + rr * 0.02);
      /* slow solid-body sweep — one constant factor for the whole disk,
         so the spiral pattern is preserved forever (no shear) */
      orbit[i] = 0.07;
    } else if (role < 0.248) {
      /* nebula haze — a breath of atmosphere hugging the plane, fading
         quickly outward; it supports the architecture, never fogs it.
         Halved: negative space lets the system breathe */
      kind = GALAXY_KIND.haze;
      const a = Math.random() * Math.PI * 2;
      const rr = 0.9 + Math.pow(Math.random(), 0.55) * 2.5;
      x = Math.cos(a) * rr + gauss() * 0.3;
      y = Math.sin(a) * rr * 0.8 + gauss() * 0.26;
      z = gauss() * 0.45 - 0.25;
      orbit[i] = (Math.random() < 0.5 ? -1 : 1) * 0.03;
    } else {
      /* far field — the restrained ambient starfield of the wider page:
         the deep dome, kept at full depth behind the system so thousands
         of points never sit directly behind the nodes and connections */
      kind = GALAXY_KIND.farField;
      x = starPositions[i3] * 0.85;
      y = starPositions[i3 + 1] * 0.85;
      z = Math.min(starPositions[i3 + 2] * 0.85, -4.5);
    }

    /* bake the plane tilt (far field keeps its own depth; node clusters
       and link paths derive from already-tilted node positions, so they
       must NOT be tilted twice — the knots stay glued to the node cores) */
    if (
      kind !== GALAXY_KIND.farField &&
      kind !== GALAXY_KIND.nodeCluster &&
      kind !== GALAXY_KIND.linkPath
    ) {
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

  return { positions, kinds, orbit, flows };
}

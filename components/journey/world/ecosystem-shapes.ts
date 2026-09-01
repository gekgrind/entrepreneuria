/**
 * ecosystem-shapes — the galaxy homes for the persistent particle field.
 *
 * Local galaxy space: the group's / shader's transform places it in the
 * world (see getGalaxyTransform in journey-math). Center is (0,0,0) —
 * the Entrepreneuria core sits there.
 *
 * LAYOUT. The homepage SVG constellation uses concentric orbit rings
 * (lib/ecosystem/orbits). That reads well as a diagram but fails as a
 * cinematic composition: ring-mates share spokes, the flagship lands
 * almost on top of the hub, and the whole system collapses toward the
 * centre. The journey therefore computes its OWN layout from the same
 * registry — still derived, never hard-coded per product:
 *
 *   · every product gets its own bearing (index-distributed around the
 *     full circle, phase-offset so no spoke is axis-aligned), so no two
 *     nodes ever share a direction from the core
 *   · orbital tier sets DISTANCE only, and the innermost distance is
 *     large enough that the flagship is unmistakably its own node
 *
 * Adding a product reflows the constellation; nothing is redesigned.
 */
import { computeOrbits, type OrbitNode } from "@/lib/ecosystem/orbits";
import type { Product } from "@/lib/ecosystem/schema";
import { SPIRAL_ARM } from "@/lib/ecosystem/spiral";

/** Tilt of the galaxy plane (rad around X) — dimensionality, not flatness. */
export const GALAXY_TILT = -0.3;

/** Distance from the core by orbital tier. Generous: the constellation
 *  must occupy its frame, and every node needs negative space around it
 *  for its label. */
const TIER_RADIUS = [0, 1.72, 2.75, 3.45];
/** Bearing of the first product; the rest divide the circle from here.
 *  Deliberately off-axis so the spokes never read as a compass rose. */
const BEARING_PHASE = -1.22;

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
  /* orbits.ts stays the source of truth for TIER and ordering; only the
     placement is the journey's own */
  const orbits: OrbitNode[] = computeOrbits(products);
  const n = Math.max(orbits.length, 1);
  const cosT = Math.cos(GALAXY_TILT);
  const sinT = Math.sin(GALAXY_TILT);
  return orbits.map((o, i) => {
    const radius =
      TIER_RADIUS[o.tier] ?? TIER_RADIUS[TIER_RADIUS.length - 1] + (o.tier - 3) * 0.6;
    const angle = BEARING_PHASE + (i * Math.PI * 2) / n;
    const x = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    return {
      slug: o.slug,
      tier: o.tier,
      position: [x, py * cosT, py * sinT] as [number, number, number],
      ringRadius: radius,
      dotRadius: o.dotRadius,
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
 * Assign every particle of the master field a galaxy home.
 *
 * THE BUDGET IS THE HIERARCHY. The previous split spent 7% of the field
 * (~3,000 points at high tier) streaming along five short hub→product
 * connections and another 4% knotted at the nodes; additively blended,
 * those two roles WERE the picture — glowing caterpillar spokes ending
 * in white blobs, with the actual node cores and connection lines buried
 * underneath. Particles cannot be the primary read for a topology.
 *
 * So the ecosystem plane now claims ~7% of the field in total, and every
 * structural role is a garnish on real geometry that lives in
 * EcosystemGalaxy:
 *
 *   layer 3 (dominant)  node cores + labels — drawn geometry
 *   layer 2             connection lines — drawn geometry, particles
 *                       only as a sparse travelling current
 *   layer 1             atmosphere: spiral-arm dust, haze, far field
 *
 * Density is spent where meaning lives, and the far field keeps its full
 * depth so thousands of points never sit directly behind a node.
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

    if (role < 0.006 && nodes.length > 0) {
      /* node sparks — a thin scatter of embers around each product's
         core. The CORE (a drawn point in EcosystemGalaxy) establishes
         the position; these only give it atmosphere, so the budget is
         small and the spread is tight. */
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
      const spread = 0.02 + node.dotRadius * 0.0015;
      x = node.position[0] + gauss() * spread;
      y = node.position[1] + gauss() * spread;
      z = node.position[2] + gauss() * spread * 0.6;
    } else if (role < 0.024) {
      /* the Entrepreneuria core's particle halo — the tightest cluster in
         the system, so the hub reads first without blowing out */
      kind = GALAXY_KIND.core;
      x = gauss() * 0.1;
      y = gauss() * 0.1;
      z = gauss() * 0.08;
    } else if (role < 0.036 && linkPaths.length > 0) {
      /* a sparse CURRENT along the connections: a few points travelling
         hub → product, riding on top of the drawn line rather than
         standing in for it */
      kind = GALAXY_KIND.linkPath;
      const path = linkPaths[Math.floor(Math.random() * linkPaths.length)];
      const t = seeds ? seeds[i * 4] : Math.random();
      const dx = path.b[0] - path.a[0];
      const dy = path.b[1] - path.a[1];
      const dz = path.b[2] - path.a[2];
      const len = Math.max(Math.hypot(dx, dy, dz), 0.0001);
      x = path.a[0] + dx * t + gauss() * 0.012;
      y = path.a[1] + dy * t + gauss() * 0.012;
      z = path.a[2] + dz * t + gauss() * 0.01;
      flows[i * 4] = dx / len;
      flows[i * 4 + 1] = dy / len;
      flows[i * 4 + 2] = dz / len;
      flows[i * 4 + 3] = len;
    } else if (role < 0.052) {
      /* spiral arm dust — the galactic disk the constellation sits on.
         Atmosphere only: enough to say "galaxy", never enough to compete
         with the wiring, and feathered outward so the densest sweep sits
         BEYOND the product ring instead of behind it. */
      kind = GALAXY_KIND.armDust;
      const arm = Math.floor(Math.random() * SPIRAL_ARM.count);
      const rr =
        SPIRAL_ARM.rMin +
        Math.pow(Math.random(), 0.42) * (SPIRAL_ARM.rMax - SPIRAL_ARM.rMin);
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
    } else if (role < 0.058) {
      /* nebula haze — a breath of atmosphere, pushed well outside the
         node ring so it never fogs a label */
      kind = GALAXY_KIND.haze;
      const a = Math.random() * Math.PI * 2;
      const rr = 2.9 + Math.pow(Math.random(), 0.55) * 2.4;
      x = Math.cos(a) * rr + gauss() * 0.3;
      y = Math.sin(a) * rr * 0.8 + gauss() * 0.26;
      z = gauss() * 0.45 - 0.25;
      orbit[i] = (Math.random() < 0.5 ? -1 : 1) * 0.03;
    } else {
      /* far field — the deep ambient dome of the wider page, held at full
         depth behind the system */
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

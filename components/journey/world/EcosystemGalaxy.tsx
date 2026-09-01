"use client";

/**
 * EcosystemGalaxy — the scene-graph layer of Scene 4/5: the structure the
 * particles assemble around.
 *
 * Everything derives from the ecosystem registry orbit layout (same math
 * as the static SVG constellation) and lives in LOCAL galaxy space inside
 * a group that receives the exact transform the particle shader uses
 * (getGalaxyTransform), so the bright particle knots, the node cores, the
 * hub connections and the DOM hotspots always coincide.
 *
 * The structure is a HUB-AND-PRODUCT NETWORK, not an orrery: there are
 * no orbit rings and no node-to-node arcs — one clean spoke from the
 * Entrepreneuria core to each product. Each spoke is a shader line that
 * draws itself outward from the hub during the formation, carries a
 * slow refined current, and ignites with a travelling pulse when its
 * product is active.
 *
 * Interaction reuses the production constellation's model — but instead
 * of canvas raycasting, the nodes' screen positions are projected every
 * frame onto real DOM buttons and product-identifier labels
 * (JourneyExperience renders them). Keyboard and touch users get native
 * focus/click; the canvas stays pointer-events: none and the semantic
 * product cards remain the truth.
 *
 * Draw calls: one Points for node cores, one for node aureoles, one
 * lineSegments for the hub spokes, three halo sprites.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { Product } from "@/lib/ecosystem/schema";

import {
  SCENE,
  getFinalGalaxyTransform,
  getGalaxyTransform,
  lerp,
  seg,
  smooth,
  type JourneyRefs,
} from "../journey-math";
import { computeGalaxyNodes, type GalaxyNode } from "./ecosystem-shapes";
import { createGlowTexture } from "./textures";

/* ------------------------------------------------------------------ */
/* geometry builders (local galaxy space)                              */
/* ------------------------------------------------------------------ */

/** Hub→product spokes ONLY — one clean connection per product, never
 *  node-to-node arcs. Per-vertex aIndex (owning node) and aT (0 at the
 *  hub, 1 at the node) feed the line shader: draw-on, dimming, pulse. */
function buildSpokeSegments(nodes: GalaxyNode[]): {
  positions: Float32Array;
  indices: Float32Array;
  ts: Float32Array;
} {
  const SEGMENTS = 24;
  const positions: number[] = [];
  const indices: number[] = [];
  const ts: number[] = [];
  nodes.forEach((n, i) => {
    for (let s = 0; s < SEGMENTS; s += 1) {
      const t0 = s / SEGMENTS;
      const t1 = (s + 1) / SEGMENTS;
      positions.push(
        n.position[0] * t0, n.position[1] * t0, n.position[2] * t0,
        n.position[0] * t1, n.position[1] * t1, n.position[2] * t1,
      );
      indices.push(i, i);
      ts.push(t0, t1);
    }
  });
  return {
    positions: new Float32Array(positions),
    indices: new Float32Array(indices),
    ts: new Float32Array(ts),
  };
}

/* ------------------------------------------------------------------ */
/* node core points (bright knots with per-node highlight)             */
/* ------------------------------------------------------------------ */

const nodeVertex = /* glsl */ `
  attribute float aSize;
  attribute float aIndex;
  uniform float uDpr;
  uniform float uNodeT;
  uniform float uActive;
  uniform float uActiveSet;
  uniform float uTime;
  varying float vBoost;
  varying float vDim;
  varying float vT;
  varying float vAct;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float act = 1.0 - abs(aIndex - uActive);
    float actK = smoothstep(0.5, 1.0, act);
    vAct = actK;
    /* the active node is unmistakable but controlled: a little larger and
       clearly brighter; every other node steps back but stays a node */
    vBoost = 1.0 + actK * 0.5;
    vDim = mix(1.0, 0.62, uActiveSet * (1.0 - actK));
    vT = uNodeT;
    /* barely-there breathing: the user must not have to chase the nodes */
    float breathe = 1.0 + sin(uTime * 0.9 + aIndex * 2.1) * 0.025;
    float size = aSize * (1.0 + actK * 0.22) * breathe * (0.45 + 0.55 * uNodeT);
    gl_PointSize = clamp(size * uDpr * (100.0 / max(1.0, -mv.z)), 2.0, 120.0);
  }
`;

const nodeFragment = /* glsl */ `
  varying float vBoost;
  varying float vDim;
  varying float vT;
  varying float vAct;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    /* A NUCLEUS, not a blob: a hard little disc for the product's exact
       position, a thin orbital ring that says "this is a body, not dust",
       and a tight halo for the cosmic register. The active state adds
       ring definition and light — it never inflates into white. */
    float core = smoothstep(0.075, 0.028, d);
    float ring = smoothstep(0.30, 0.265, d) * smoothstep(0.215, 0.25, d);
    float halo = smoothstep(0.46, 0.06, d) * 0.11;
    vec3 shell = vec3(0.30, 0.80, 1.12);
    vec3 hot = vec3(0.86, 0.98, 1.20);
    vec3 col = mix(shell, hot, core * (0.6 + 0.4 * vAct));
    float alpha = (core + ring * (0.55 + 0.45 * vAct) + halo)
      * vT * vDim * min(vBoost, 1.5);
    gl_FragColor = vec4(col, alpha);
  }
`;

/* per-node glow: a restrained luminous aureole per product so each
   node's LOCATION reads instantly; the active node's aureole becomes
   more defined (tighter, brighter) instead of blooming wider */
const haloVertex = /* glsl */ `
  attribute float aSize;
  attribute float aIndex;
  uniform float uDpr;
  uniform float uNodeT;
  uniform float uActive;
  uniform float uActiveSet;
  uniform float uTime;
  varying float vGlow;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float act = 1.0 - abs(aIndex - uActive);
    float actK = smoothstep(0.5, 1.0, act);
    float breathe = 1.0 + sin(uTime * 0.8 + aIndex * 1.7) * 0.035;
    float size = aSize * (1.05 + actK * 0.3) * breathe * (0.45 + 0.55 * uNodeT);
    gl_PointSize = clamp(size * uDpr * (100.0 / max(1.0, -mv.z)), 1.0, 170.0);
    vGlow = (0.1 + actK * 0.26) * mix(1.0, 0.55, uActiveSet * (1.0 - actK)) * uNodeT;
  }
`;

const haloFragment = /* glsl */ `
  varying float vGlow;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    float falloff = max(0.0, 1.0 - d);
    falloff = falloff * falloff * falloff;
    gl_FragColor = vec4(vec3(0.22, 0.72, 1.08), falloff * vGlow * 0.55);
  }
`;

/* hub→product spokes: consistent, clearly visible wiring against the
   starfield. During the formation each line DRAWS itself outward from
   the hub (uDraw); in the steady state a slow refined current travels
   toward the product; the active product's connection brightens and
   carries a soft travelling pulse */
const linkVertex = /* glsl */ `
  attribute float aIndex;
  attribute float aT;
  uniform float uActive;
  uniform float uActiveSet;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uDraw;
  varying float vAlpha;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    float act = 1.0 - abs(aIndex - uActive);
    float actK = smoothstep(0.5, 1.0, act);
    /* inactive connections step back but stay clearly readable */
    float dim = mix(1.0, 0.62, uActiveSet * (1.0 - actK));
    /* formation draw-on: the line grows from the hub toward the node */
    float drawn = smoothstep(aT, aT + 0.08, uDraw * 1.08);
    /* slow energy flow hub → product + a gentle pulse on the active link */
    float flow = 0.08 * (0.5 + 0.5 * sin(aT * 12.0 - uTime * 0.9));
    float pulse = actK * 0.55 * pow(0.5 + 0.5 * sin(aT * 6.0 - uTime * 1.6), 3.0);
    /* the connection fades slightly INTO the core so the hub stays a
       point of light rather than a starburst of line ends */
    float root = smoothstep(0.0, 0.18, aT);
    vAlpha = (0.95 + flow + pulse) * dim * drawn * uOpacity * mix(0.35, 1.0, root);
  }
`;

const linkFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vec3(0.36, 0.86, 1.1), vAlpha);
  }
`;

/* ------------------------------------------------------------------ */

export function EcosystemGalaxy({
  refs,
  products,
}: {
  refs: JourneyRefs;
  products: readonly Product[];
}) {
  const group = useRef<THREE.Group>(null);

  const nodes = useMemo(() => computeGalaxyNodes(products), [products]);
  const indexBySlug = useMemo(
    () => new Map(nodes.map((n, i) => [n.slug, i])),
    [nodes],
  );

  const built = useMemo(() => {
    const spokes = buildSpokeSegments(nodes);
    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(spokes.positions, 3),
    );
    linkGeo.setAttribute("aIndex", new THREE.BufferAttribute(spokes.indices, 1));
    linkGeo.setAttribute("aT", new THREE.BufferAttribute(spokes.ts, 1));
    const linkMat = new THREE.ShaderMaterial({
      vertexShader: linkVertex,
      fragmentShader: linkFragment,
      uniforms: {
        uActive: { value: -1 },
        uActiveSet: { value: 0 },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uDraw: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    /* node cores */
    const nodeGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(nodes.length * 3);
    const sizes = new Float32Array(nodes.length);
    const idx = new Float32Array(nodes.length);
    nodes.forEach((n, i) => {
      pos.set(n.position, i * 3);
      sizes[i] = 4.4 + n.dotRadius * 0.1;
      idx[i] = i;
    });
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    nodeGeo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    nodeGeo.setAttribute("aIndex", new THREE.BufferAttribute(idx, 1));
    const nodeMat = new THREE.ShaderMaterial({
      vertexShader: nodeVertex,
      fragmentShader: nodeFragment,
      uniforms: {
        uDpr: { value: 1 },
        uNodeT: { value: 0 },
        uActive: { value: -1 },
        uActiveSet: { value: 0 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    /* per-node aureoles — same geometry, softer and larger */
    const haloMat = new THREE.ShaderMaterial({
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      uniforms: {
        uDpr: { value: 1 },
        uNodeT: { value: 0 },
        uActive: { value: -1 },
        uActiveSet: { value: 0 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    /* nebula halos — a whisper of atmosphere, never the subject */
    const glowTex = createGlowTexture();
    const haloSpecs = [
      { scale: 5.0, color: new THREE.Color(0.05, 0.35, 0.6), z: -0.7, o: 0.055 },
      { scale: 7.2, color: new THREE.Color(0.1, 0.16, 0.42), z: -1.3, o: 0.045 },
      { scale: 2.6, color: new THREE.Color(0.55, 0.3, 0.1), z: 0.15, o: 0.06 },
    ];
    const halos = haloSpecs.map((h) => {
      const m = new THREE.SpriteMaterial({
        map: glowTex,
        color: h.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      return { mat: m, ...h };
    });

    return { linkGeo, linkMat, nodeGeo, nodeMat, haloMat, glowTex, halos };
  }, [nodes]);

  /* scratch objects for the per-frame hotspot projection */
  const scratch = useMemo(
    () => ({ v: new THREE.Vector3(), world: new THREE.Vector3() }),
    [],
  );

  /* per-frame mutations go through a ref (R3F convention — never React
     state at 60fps); kept in sync outside render */
  const mats = useRef(built);
  useEffect(() => {
    mats.current = built;
  }, [built]);

  useEffect(
    () => () => {
      built.linkGeo.dispose();
      built.linkMat.dispose();
      built.nodeGeo.dispose();
      built.nodeMat.dispose();
      built.haloMat.dispose();
      built.glowTex.dispose();
      built.halos.forEach((h) => h.mat.dispose());
    },
    [built],
  );

  useFrame((state) => {
    const p = refs.overall.current;
    const g = group.current;
    if (!g) return;

    /* Scene 9: the SAME structure returns — gliding from its Scene 4
       discovery frame to the resolved final composition above the close */
    const t = getGalaxyTransform(refs.stacked.current);
    const ft = getFinalGalaxyTransform(refs.stacked.current);
    const reformMove = smooth(seg(p, SCENE.reformStart, SCENE.reformStart + 15));
    g.position.set(
      lerp(t.offset[0], ft.offset[0], reformMove),
      lerp(t.offset[1], ft.offset[1], reformMove),
      lerp(t.offset[2], ft.offset[2], reformMove),
    );
    g.scale.setScalar(lerp(t.scale, ft.scale, reformMove));
    g.visible = p > SCENE.ecoStart - 4;

    const b = mats.current;
    const assemble = smooth(seg(p, SCENE.ecoStart + 6, 124));
    const links = smooth(seg(p, SCENE.ecoStart + 12, 128));
    const nodesT = smooth(seg(p, SCENE.ecoStart + 8, 126));
    const halosT = smooth(seg(p, SCENE.ecoStart + 16, 132));
    /* departure: structure loosens and recedes but never fully dies —
       the galaxy stays as the deep backdrop of Scene 6 */
    const depart = smooth(seg(p, SCENE.exploreEnd, SCENE.departEnd));
    const keep = 1 - depart * 0.94;
    /* reform: the ecosystem resolves — slightly MORE luminous than its
       first appearance (the journey began in chaos; it ends in order) */
    const reformT = smooth(seg(p, SCENE.reformStart + 3, SCENE.reformAssembled));
    const finale = reformT * 1.18;

    const activeSlug = refs.hoverProduct.current ?? refs.activeProduct.current;
    const activeIndex = activeSlug != null ? (indexBySlug.get(activeSlug) ?? -1) : -1;

    /* the hierarchy in line light: the hub→product spokes stay clearly
       above the background particles — brighter and more consistent than
       any atmosphere — and each spoke draws itself outward from the hub
       as the system assembles (fully drawn for the reformed finale).
       There are no orbit rings and no node-to-node arcs: the network IS
       the structure */
    const draw = smooth(seg(p, SCENE.ecoStart + 12, SCENE.ecoStart + 26));
    b.linkMat.uniforms.uOpacity.value = Math.max(links * 0.9 * keep, finale * 0.82);
    b.linkMat.uniforms.uDraw.value = Math.max(draw, reformT);
    b.linkMat.uniforms.uTime.value = state.clock.elapsedTime;
    b.linkMat.uniforms.uActive.value = activeIndex;
    b.linkMat.uniforms.uActiveSet.value = activeIndex >= 0 ? 1 : 0;
    const nodePresence = Math.max(nodesT * (1 - depart * 0.92), reformT);
    b.nodeMat.uniforms.uNodeT.value = nodePresence;
    b.nodeMat.uniforms.uDpr.value = state.gl.getPixelRatio();
    b.nodeMat.uniforms.uTime.value = state.clock.elapsedTime;

    b.nodeMat.uniforms.uActive.value = activeIndex;
    b.nodeMat.uniforms.uActiveSet.value = activeIndex >= 0 ? 1 : 0;
    b.haloMat.uniforms.uNodeT.value = nodePresence;
    b.haloMat.uniforms.uDpr.value = state.gl.getPixelRatio();
    b.haloMat.uniforms.uTime.value = state.clock.elapsedTime;
    b.haloMat.uniforms.uActive.value = activeIndex;
    b.haloMat.uniforms.uActiveSet.value = activeIndex >= 0 ? 1 : 0;

    b.halos.forEach((h) => {
      h.mat.opacity = Math.max(halosT * h.o * keep, finale * h.o * 1.25);
    });

    /* gentle counter-parallax: the galaxy breathes against the camera —
       and settles into near-stillness for the finale (calm, resolved) */
    g.rotation.z =
      Math.sin(state.clock.elapsedTime * 0.05) *
      0.02 *
      Math.max(assemble, reformT * (1 - reformT * 0.55));

    /* project the nodes onto their DOM hotspots (exploration only) and
       their product identifiers (from the moment the system assembles
       until it departs) */
    const buttons = refs.nodeButtons.current;
    const labels = refs.nodeLabels.current;
    if (buttons.length > 0 || labels.length > 0) {
      const exploring =
        p > SCENE.exploreStart - 6 && p < SCENE.exploreEnd - 1 && depart < 0.05;
      const labeling =
        p > SCENE.ecoStart + 20 && p < SCENE.exploreEnd - 1 && depart < 0.05;
      const w = state.size.width;
      const h = state.size.height;
      const isStacked = refs.stacked.current;
      /* the hub's screen position — identifiers sit radially OUTSIDE
         their node so they never cover a connection line */
      scratch.world.set(0, 0, 0);
      g.localToWorld(scratch.world);
      scratch.world.project(state.camera);
      const hx = (scratch.world.x * 0.5 + 0.5) * w;
      const hy = (-scratch.world.y * 0.5 + 0.5) * h;
      nodes.forEach((n, i) => {
        scratch.v.set(...n.position);
        g.localToWorld(scratch.v);
        scratch.v.project(state.camera);
        const x = (scratch.v.x * 0.5 + 0.5) * w;
        const y = (-scratch.v.y * 0.5 + 0.5) * h;

        const btn = buttons[i];
        if (btn) {
          if (!exploring) {
            if (btn.dataset.on === "true") {
              btn.dataset.on = "false";
              btn.style.opacity = "0";
              btn.style.pointerEvents = "none";
              btn.tabIndex = -1;
            }
          } else {
            if (btn.dataset.on !== "true") {
              btn.dataset.on = "true";
              btn.style.opacity = "1";
              btn.style.pointerEvents = "auto";
              btn.tabIndex = 0;
            }
            btn.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
          }
        }

        const el = labels[i];
        if (el) {
          /* stacked compositions stay calm: only the current product is
             identified; wide screens identify every product quietly */
          const show = labeling && (!isStacked || n.slug === activeSlug);
          if (!show) {
            if (el.dataset.on === "true") el.dataset.on = "false";
          } else {
            if (el.dataset.on !== "true") el.dataset.on = "true";
            let dx = x - hx;
            let dy = y - hy;
            const len = Math.max(Math.hypot(dx, dy), 0.001);
            dx /= len;
            dy /= len;
            const lx = x + dx * 58;
            const ly = y + dy * 58;
            el.style.transform = `translate(-50%, -50%) translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;
          }
        }
      });
    }
  });

  return (
    <group ref={group} visible={false}>
      <lineSegments geometry={built.linkGeo} material={built.linkMat} />
      <points geometry={built.nodeGeo} material={built.haloMat} frustumCulled={false} />
      <points geometry={built.nodeGeo} material={built.nodeMat} frustumCulled={false} />
      {built.halos.map((h, i) => (
        <sprite
          key={i}
          material={h.mat}
          position={[0, 0, h.z]}
          scale={[h.scale, h.scale, 1]}
        />
      ))}
    </group>
  );
}

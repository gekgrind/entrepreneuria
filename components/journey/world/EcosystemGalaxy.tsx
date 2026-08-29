"use client";

/**
 * EcosystemGalaxy — the scene-graph layer of Scene 4/5: the structure the
 * particles assemble around.
 *
 * Everything derives from the ecosystem registry orbit layout (same math
 * as the static SVG constellation) and lives in LOCAL galaxy space inside
 * a group that receives the exact transform the particle shader uses
 * (getGalaxyTransform), so the bright particle knots, the node cores, the
 * rings and the DOM hotspots always coincide.
 *
 * Interaction reuses the production constellation's model — but instead
 * of canvas raycasting, the nodes' screen positions are projected every
 * frame onto real DOM buttons (JourneyExperience renders them). Keyboard
 * and touch users get native focus/click; the canvas stays
 * pointer-events: none and the semantic product cards remain the truth.
 *
 * Draw calls: one Points for node cores, one lineSegments for rings, one
 * for spokes/arcs, three halo sprites.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { Product } from "@/lib/ecosystem/schema";

import {
  SCENE,
  getGalaxyTransform,
  seg,
  smooth,
  type JourneyRefs,
} from "../journey-math";
import { computeGalaxyNodes, type GalaxyNode } from "./ecosystem-shapes";
import { createGlowTexture } from "./textures";

/* ------------------------------------------------------------------ */
/* geometry builders (local galaxy space)                              */
/* ------------------------------------------------------------------ */

function buildRingSegments(tiers: number[]): Float32Array {
  const pts: number[] = [];
  const SEGS = 96;
  for (const tier of tiers) {
    const R = ((tier * 150) / 500) * 2.6;
    for (let i = 0; i < SEGS; i += 1) {
      const a1 = (i / SEGS) * Math.PI * 2;
      const a2 = ((i + 1) / SEGS) * Math.PI * 2;
      pts.push(Math.cos(a1) * R, Math.sin(a1) * R, 0);
      pts.push(Math.cos(a2) * R, Math.sin(a2) * R, 0);
    }
  }
  return new Float32Array(pts);
}

function buildSpokeArcSegments(nodes: GalaxyNode[]): Float32Array {
  const pts: number[] = [];
  /* spokes: center → node */
  for (const n of nodes) {
    pts.push(0, 0, 0, n.position[0], n.position[1], n.position[2]);
  }
  /* arcs: consecutive nodes on the same ring */
  const tiers = [...new Set(nodes.map((n) => n.tier))];
  for (const tier of tiers) {
    const ring = nodes.filter((n) => n.tier === tier);
    for (let i = 0; i < ring.length - 1; i += 1) {
      pts.push(...ring[i].position, ...ring[i + 1].position);
    }
  }
  return new Float32Array(pts);
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
  uniform float uTime;
  varying float vBoost;
  varying float vT;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float act = 1.0 - abs(aIndex - uActive);
    vBoost = 1.0 + smoothstep(0.5, 1.0, act) * 1.1;
    vT = uNodeT;
    float breathe = 1.0 + sin(uTime * 1.3 + aIndex * 2.1) * 0.07;
    float size = aSize * vBoost * breathe * (0.35 + 0.65 * uNodeT);
    gl_PointSize = clamp(size * uDpr * (100.0 / max(1.0, -mv.z)), 1.0, 64.0);
  }
`;

const nodeFragment = /* glsl */ `
  varying float vBoost;
  varying float vT;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.16, 0.03, d);
    float halo = smoothstep(0.5, 0.05, d) * 0.32;
    vec3 col = mix(vec3(0.35, 0.85, 1.15), vec3(0.75, 0.97, 1.25), core);
    float alpha = (core + halo) * vT * min(vBoost, 1.3) * 0.85;
    gl_FragColor = vec4(col, alpha);
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
    const tiers = [...new Set(nodes.map((n) => n.tier))].sort((a, b) => a - b);

    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(buildRingSegments(tiers), 3),
    );
    const ringMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.62, 0.78, 1.0),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(buildSpokeArcSegments(nodes), 3),
    );
    const linkMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.0, 0.83, 1.0),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    /* node cores */
    const nodeGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(nodes.length * 3);
    const sizes = new Float32Array(nodes.length);
    const idx = new Float32Array(nodes.length);
    nodes.forEach((n, i) => {
      pos.set(n.position, i * 3);
      sizes[i] = 0.55 + n.dotRadius * 0.07;
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
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    /* nebula halos — atmosphere, not structure */
    const glowTex = createGlowTexture();
    const haloSpecs = [
      { scale: 5.2, color: new THREE.Color(0.05, 0.35, 0.6), z: -0.7, o: 0.1 },
      { scale: 7.4, color: new THREE.Color(0.1, 0.16, 0.42), z: -1.3, o: 0.085 },
      { scale: 2.6, color: new THREE.Color(0.55, 0.3, 0.1), z: 0.15, o: 0.1 },
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

    return { ringGeo, ringMat, linkGeo, linkMat, nodeGeo, nodeMat, glowTex, halos };
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
      built.ringGeo.dispose();
      built.ringMat.dispose();
      built.linkGeo.dispose();
      built.linkMat.dispose();
      built.nodeGeo.dispose();
      built.nodeMat.dispose();
      built.glowTex.dispose();
      built.halos.forEach((h) => h.mat.dispose());
    },
    [built],
  );

  useFrame((state) => {
    const p = refs.overall.current;
    const g = group.current;
    if (!g) return;

    const t = getGalaxyTransform(refs.stacked.current);
    g.position.set(...t.offset);
    g.scale.setScalar(t.scale);
    g.visible = p > SCENE.ecoStart - 4;

    const b = mats.current;
    const assemble = smooth(seg(p, SCENE.ecoStart + 6, 124));
    const links = smooth(seg(p, SCENE.ecoStart + 12, 128));
    const nodesT = smooth(seg(p, SCENE.ecoStart + 8, 126));
    const halosT = smooth(seg(p, SCENE.ecoStart + 16, 132));
    /* departure: structure loosens and recedes but never fully dies —
       the galaxy stays as the deep backdrop of Scene 6 */
    const depart = smooth(seg(p, SCENE.exploreEnd, SCENE.departEnd));
    const keep = 1 - depart * 0.6;

    b.ringMat.opacity = assemble * 0.12 * keep;
    b.linkMat.opacity = links * 0.26 * keep;
    b.nodeMat.uniforms.uNodeT.value = nodesT * (1 - depart * 0.5);
    b.nodeMat.uniforms.uDpr.value = state.gl.getPixelRatio();
    b.nodeMat.uniforms.uTime.value = state.clock.elapsedTime;

    const activeSlug = refs.hoverProduct.current ?? refs.activeProduct.current;
    b.nodeMat.uniforms.uActive.value =
      activeSlug != null ? (indexBySlug.get(activeSlug) ?? -1) : -1;

    b.halos.forEach((h) => {
      h.mat.opacity = halosT * h.o * keep;
    });

    /* gentle counter-parallax: the galaxy breathes against the camera */
    g.rotation.z = Math.sin(state.clock.elapsedTime * 0.05) * 0.02 * assemble;

    /* project the nodes onto their DOM hotspots (exploration only) */
    const buttons = refs.nodeButtons.current;
    if (buttons.length > 0) {
      const exploring =
        p > SCENE.exploreStart - 6 && p < SCENE.exploreEnd - 1 && depart < 0.05;
      const w = state.size.width;
      const h = state.size.height;
      nodes.forEach((n, i) => {
        const btn = buttons[i];
        if (!btn) return;
        if (!exploring) {
          if (btn.dataset.on === "true") {
            btn.dataset.on = "false";
            btn.style.opacity = "0";
            btn.style.pointerEvents = "none";
            btn.tabIndex = -1;
          }
          return;
        }
        scratch.v.set(...n.position);
        g.localToWorld(scratch.v);
        scratch.v.project(state.camera);
        const x = (scratch.v.x * 0.5 + 0.5) * w;
        const y = (-scratch.v.y * 0.5 + 0.5) * h;
        if (btn.dataset.on !== "true") {
          btn.dataset.on = "true";
          btn.style.opacity = "1";
          btn.style.pointerEvents = "auto";
          btn.tabIndex = 0;
        }
        btn.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
    }
  });

  return (
    <group ref={group} visible={false}>
      <lineSegments geometry={built.ringGeo} material={built.ringMat} />
      <lineSegments geometry={built.linkGeo} material={built.linkMat} />
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

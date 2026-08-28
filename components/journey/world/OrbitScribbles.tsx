"use client";

/**
 * OrbitScribbles — the tangled orbit lines of Scene 1.
 *
 * All rings are merged into a single BufferGeometry (one draw call).
 * Each ring spins on its own messy axis while the scene is chaotic;
 * as scroll drives the vortex, their rotations converge on one shared
 * funnel rotation — the lines visually "find" the underlying structure.
 * During the collapse they compress into the core and hand the stage
 * to the particle tunnel.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { SCENE, seg, smooth, type JourneyRefs, type QualitySpec } from "../journey-math";

const vertexShader = /* glsl */ `
  attribute float aRand;

  uniform float uTime;
  uniform float uVortexT;
  uniform float uSwirl;
  uniform float uCollapseT;

  varying float vAlpha;

  void main() {
    vec3 pos = position;

    /* messy individual spin → one uniform funnel rotation */
    float ang = uSwirl * mix(aRand * 1.6 - 0.3, 1.0, uVortexT);
    float cs = cos(ang);
    float sn = sin(ang);
    pos.xy = mat2(cs, -sn, sn, cs) * pos.xy;

    /* chaotic wobble, tamed as the vortex forms */
    float wob = 0.15 * (1.0 - uVortexT);
    pos.x += sin(uTime * (0.3 + aRand) + aRand * 20.0) * wob;
    pos.y += cos(uTime * (0.25 + aRand * 0.7) + aRand * 13.0) * wob;

    /* collapse — compress toward the core and fade */
    float c = smoothstep(aRand * 0.3, 1.0, uCollapseT * 1.15);
    float len = max(length(pos), 0.001);
    pos = mix(pos, (pos / len) * 0.3 + vec3(0.0, 0.0, -3.0), c);

    vAlpha = (0.05 + aRand * 0.12) * (0.45 + 0.55 * uVortexT) * (1.0 - c);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(uColor, vAlpha);
  }
`;

const SEGMENTS = 72;

function buildRings(rings: number) {
  const positions: number[] = [];
  const rands: number[] = [];
  const euler = new THREE.Euler();
  const v = new THREE.Vector3();

  for (let k = 0; k < rings; k += 1) {
    const radius = 2.0 + (k / rings) * 5 + Math.random() * 0.8;
    euler.set(
      (Math.random() - 0.5) * 1.4,
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 1.2,
    );
    const rand = Math.random();
    const cx = (Math.random() - 0.5) * 0.8;
    const cy = (Math.random() - 0.5) * 0.6;

    const pts: THREE.Vector3[] = [];
    for (let s = 0; s < SEGMENTS; s += 1) {
      const a = (s / SEGMENTS) * Math.PI * 2;
      v.set(Math.cos(a) * radius, Math.sin(a) * radius * (0.55 + rand * 0.35), 0);
      v.applyEuler(euler);
      v.x += cx;
      v.y += cy;
      v.z += -1 - rand * 4;
      pts.push(v.clone());
    }
    for (let s = 0; s < SEGMENTS; s += 1) {
      const a = pts[s];
      const b = pts[(s + 1) % SEGMENTS];
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      rands.push(rand, rand);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute("aRand", new THREE.BufferAttribute(new Float32Array(rands), 1));
  return geometry;
}

export function OrbitScribbles({
  refs,
  quality,
}: {
  refs: JourneyRefs;
  quality: QualitySpec;
}) {
  const { geometry, material } = useMemo(() => {
    const geo = buildRings(quality.rings);
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uVortexT: { value: 0 },
        uSwirl: { value: 0 },
        uCollapseT: { value: 0 },
        uColor: { value: new THREE.Color(0.92, 0.78, 0.55) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: geo, material: mat };
  }, [quality.rings]);
  const materialRef = useRef(material);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    const p = refs.overall.current;
    const c = seg(p, 0, SCENE.chaosEnd);
    const u = materialRef.current.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uVortexT.value = smooth(seg(c, 0.3, 0.62));
    u.uSwirl.value = smooth(seg(c, 0.3, 0.85)) * 5.2;
    u.uCollapseT.value = smooth(seg(c, 0.85, 1.0));
  });

  return (
    <lineSegments geometry={geometry} material={material} frustumCulled={false} />
  );
}

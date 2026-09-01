"use client";

/**
 * TunnelRibbons — the light-ribbon streams of Scene 2.
 *
 * A handful of helical lines winding down the tunnel wall, merged into
 * one geometry (one draw call). They share the particle field's wrapped
 * travel uniform, so scroll moves ribbons and particles identically —
 * this is what makes the wall structure (not just the dust) read as
 * "I am moving through a tube". Fades in/out with the tunnel phase;
 * fully reversible.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { SCENE, TUNNEL_LEN, seg, smooth, type JourneyRefs } from "../journey-math";

const vertexShader = /* glsl */ `
  attribute float aFade;

  uniform float uTravel;
  uniform float uTunnelVis;

  varying float vAlpha;

  #define TUNNEL_LEN ${TUNNEL_LEN.toFixed(1)}

  void main() {
    vec3 pos = position;
    pos.z = mod(position.z + uTravel, TUNNEL_LEN + 12.0) - TUNNEL_LEN;

    vAlpha = aFade * uTunnelVis * smoothstep(-TUNNEL_LEN, -TUNNEL_LEN * 0.55, pos.z);
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

const RIBBONS = 5;
const POINTS = 160;

function buildRibbons() {
  const positions: number[] = [];
  const fades: number[] = [];

  for (let k = 0; k < RIBBONS; k += 1) {
    const radius = 3.5 + k * 0.45;
    const phase = (k / RIBBONS) * Math.PI * 2;
    const wind = 0.55 + k * 0.08; /* radians of twist per unit of z */
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s < POINTS; s += 1) {
      const z = -(s / (POINTS - 1)) * TUNNEL_LEN;
      const a = phase + z * -wind;
      pts.push(
        new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, z),
      );
    }
    for (let s = 0; s < POINTS - 1; s += 1) {
      const a = pts[s];
      const b = pts[s + 1];
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const f = 0.10 + 0.10 * Math.sin((s / POINTS) * Math.PI);
      fades.push(f, f);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute("aFade", new THREE.BufferAttribute(new Float32Array(fades), 1));
  return geometry;
}

export function TunnelRibbons({ refs }: { refs: JourneyRefs }) {
  const { geometry, material } = useMemo(() => {
    const geo = buildRibbons();
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTravel: { value: 0 },
        uTunnelVis: { value: 0 },
        uColor: { value: new THREE.Color(0.45, 0.78, 1.0) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: geo, material: mat };
  }, []);
  const materialRef = useRef(material);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    const p = refs.overall.current;
    const t = seg(p, SCENE.chaosEnd, SCENE.tunnelEnd);
    const u = materialRef.current.uniforms;
    u.uTravel.value = t * (TUNNEL_LEN + 12) * 1.15;
    u.uTunnelVis.value = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.8, 1)));
  });

  return (
    <lineSegments geometry={geometry} material={material} frustumCulled={false} />
  );
}

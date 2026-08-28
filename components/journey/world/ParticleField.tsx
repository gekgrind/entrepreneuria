"use client";

/**
 * ParticleField — the ONE persistent particle material of the journey.
 *
 * A single THREE.Points whose every particle carries four precomputed
 * homes: chaos scatter → vortex funnel → tunnel helix → star dome.
 * The vertex shader mixes between them from uniform progress values
 * (derived each frame from the scrubbed scroll ref), so the same
 * "material" visibly becomes chaos, collapse, tunnel and stars — and
 * reverse scrolling always reconstructs the exact state. No CPU
 * per-particle work, no per-frame allocation.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import {
  SCENE,
  TUNNEL_LEN,
  lerp,
  seg,
  smooth,
  type JourneyRefs,
  type QualitySpec,
} from "../journey-math";

const vertexShader = /* glsl */ `
  attribute vec3 aVortex;
  attribute vec3 aTunnel;
  attribute vec3 aStar;
  attribute vec4 aSeed;
  attribute float aSize;
  attribute float aKind;
  attribute float aTint;

  uniform float uTime;
  uniform float uDpr;
  uniform float uVortexT;
  uniform float uSwirl;
  uniform float uCollapseT;
  uniform float uTravel;
  uniform float uStarT;
  uniform float uDrift;
  uniform float uTunnelVis;
  uniform float uVis;
  uniform vec2 uPointer;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vStreak;
  varying float vAngle;

  #define TUNNEL_LEN ${TUNNEL_LEN.toFixed(1)}

  void main() {
    /* 1 — chaos scatter → vortex funnel, with radius-dependent swirl */
    vec3 chaos = mix(position, aVortex, uVortexT);
    float r = max(length(chaos.xy), 0.001);
    float sw = uSwirl * (2.4 / (r + 0.7));
    float cs = cos(sw);
    float sn = sin(sw);
    chaos.xy = mat2(cs, -sn, sn, cs) * chaos.xy;

    /* 2 — collapse into the tunnel mouth; tunnel z travels (wrapped) */
    vec3 tunnelPos = aTunnel;
    tunnelPos.z = mod(aTunnel.z + uTravel, TUNNEL_LEN + 12.0) - TUNNEL_LEN;
    vec3 pos = mix(chaos, tunnelPos, uCollapseT);

    /* 3 — tunnel exit → star dome */
    pos = mix(pos, aStar, uStarT);

    /* 4 — ambient drift (the "alive" star motion; tiny otherwise) */
    float d = uDrift * (0.35 + 0.65 * aSeed.w);
    pos.x += d * sin(uTime * (0.30 + aSeed.x * 0.45) + aSeed.y * 6.2831);
    pos.y += d * cos(uTime * (0.26 + aSeed.y * 0.38) + aSeed.z * 6.2831);
    pos.z += d * sin(uTime * (0.22 + aSeed.z * 0.34) + aSeed.x * 6.2831);

    /* 5 — slow star-dome rotation once in space */
    float domeRot = uTime * 0.035 * uStarT;
    float dcs = cos(domeRot);
    float dsn = sin(domeRot);
    pos.xz = mat2(dcs, -dsn, dsn, dcs) * pos.xz;

    /* 6 — pointer parallax, depth-scaled */
    float depthScale = 1.0 / (1.0 + max(0.0, -pos.z) * 0.05);
    pos.xy += uPointer * (0.30 + 0.35 * aSeed.z) * depthScale;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float shardBoost = step(0.5, aKind) * (1.0 - step(1.5, aKind));
    float streakBoost = step(1.5, aKind);
    float size = aSize * (1.0 + shardBoost * 0.8 + streakBoost * 1.4);
    gl_PointSize = clamp(
      size * uDpr * (100.0 / max(1.0, -mv.z)),
      1.0,
      42.0
    );

    float nearFade = smoothstep(0.6, 2.6, -mv.z);
    vAlpha = nearFade * mix(1.0, 0.0, streakBoost * (1.0 - uTunnelVis));
    /* visibility is a story beat: dust is nearly invisible in raw chaos,
       materializes as the vortex organizes, full in tunnel + stars */
    vAlpha *= uVis;
    /* gentle star twinkle once in space */
    vAlpha *= mix(1.0, 0.72 + 0.28 * sin(uTime * (1.4 + aSeed.z * 2.2) + aSeed.x * 40.0), uStarT);

    vStreak = streakBoost * uTunnelVis;
    vAngle = aSeed.x * 6.2831 + uSwirl * 0.6;

    vec3 chaosCol = mix(vec3(0.82, 0.62, 0.40), vec3(0.55, 0.70, 0.95), aTint);
    vec3 starCol = mix(vec3(0.62, 0.76, 1.00), vec3(0.92, 0.96, 1.00), aTint);
    if (aSeed.x > 0.93) starCol = vec3(0.20, 0.85, 1.00);
    if (aSeed.x < 0.05) starCol = vec3(1.00, 0.80, 0.55);
    if (shardBoost > 0.5) {
      chaosCol = vec3(0.88, 0.68, 0.44);
      starCol = vec3(0.80, 0.76, 0.70);
    }
    if (streakBoost > 0.5) {
      chaosCol = vec3(0.60, 0.90, 1.20);
      starCol = vec3(0.66, 1.00, 1.20);
    }
    /* chaos dust stays DIM — the void must win over the wash; stars earn
       their full brightness only once the tunnel opens into space */
    vColor = mix(chaosCol * 0.42, starCol * 0.85, uStarT) * (0.55 + 0.45 * aSeed.y);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vStreak;
  varying float vAngle;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float alpha;
    if (vStreak > 0.01) {
      /* elongated soft streak, rotated toward its travel direction */
      float c = cos(vAngle);
      float s = sin(vAngle);
      vec2 ruv = mat2(c, s, -s, c) * uv;
      float d = length(vec2(ruv.x * 3.4, ruv.y * 1.15));
      alpha = smoothstep(0.5, 0.03, d) * vStreak;
    } else {
      float d = length(uv);
      alpha = smoothstep(0.5, 0.04, d);
    }
    gl_FragColor = vec4(vColor, alpha * vAlpha);
  }
`;

function buildField(count: number) {
  const scatter = new Float32Array(count * 3);
  const vortex = new Float32Array(count * 3);
  const tunnel = new Float32Array(count * 3);
  const star = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  const size = new Float32Array(count);
  const kind = new Float32Array(count);
  const tint = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const i4 = i * 4;
    const r1 = Math.random();
    const r2 = Math.random();
    const r3 = Math.random();
    const r4 = Math.random();
    seed[i4] = r1;
    seed[i4 + 1] = r2;
    seed[i4 + 2] = r3;
    seed[i4 + 3] = r4;

    /* chaos scatter — a messy debris DISC in clumps around the founder
       core. A ball of particles always fogs; a sheet leaves void in
       the middle and structure at the rim (and morphs cleanly into
       the funnel as the vortex organizes). */
    {
      const cluster = Math.floor(r1 * 5) * 1.2566; /* 5 loose clumps */
      const a = cluster + (r2 - 0.5) * 1.5 + r1 * 0.35;
      const rad = 2.2 + Math.pow(r3, 0.7) * 3.0;
      scatter[i3] = Math.cos(a) * rad + (r4 - 0.5) * 1.1;
      scatter[i3 + 1] = Math.sin(a) * rad * 0.72 + (r2 - 0.5) * 0.9;
      scatter[i3 + 2] = -1 - r4 * 3.5 + (r1 - 0.5) * 1.2;
    }

    /* vortex funnel — wide rim near z≈0 narrowing deep along -z */
    {
      const a = r2 * Math.PI * 2;
      const rad = 0.7 + Math.pow(r3, 0.75) * 5.0;
      const depth = -Math.pow((5.7 - rad) / 5.7, 1.6) * 9 - r1 * 0.5;
      vortex[i3] = Math.cos(a) * rad;
      vortex[i3 + 1] = Math.sin(a) * rad * 0.85;
      vortex[i3 + 2] = depth;
    }

    /* tunnel helix — tube wall with a z-dependent twist; density is
       biased toward the near field so the walls read as passing depth
       (a uniform tube collapses into a distant blob in perspective) */
    {
      const rad = 3.1 + r3 * 2.4;
      const z = -Math.pow(r4, 1.7) * TUNNEL_LEN;
      const a = r1 * Math.PI * 2 + z * -0.32;
      tunnel[i3] = Math.cos(a) * rad;
      tunnel[i3 + 1] = Math.sin(a) * rad;
      tunnel[i3 + 2] = z;
    }

    /* star dome — thick shell centered just behind the camera axis */
    {
      const theta = r1 * Math.PI * 2;
      const phi = Math.acos(2 * r2 - 1);
      const rad = 12 + r3 * 17;
      star[i3] = Math.sin(phi) * Math.cos(theta) * rad;
      star[i3 + 1] = Math.sin(phi) * Math.sin(theta) * rad;
      star[i3 + 2] = Math.cos(phi) * rad - 12;
    }

    const k = Math.random();
    kind[i] = k < 0.86 ? 0 : k < 0.93 ? 1 : 2;
    size[i] = 0.3 + Math.random() * 0.6;
    tint[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(scatter, 3));
  geometry.setAttribute("aVortex", new THREE.BufferAttribute(vortex, 3));
  geometry.setAttribute("aTunnel", new THREE.BufferAttribute(tunnel, 3));
  geometry.setAttribute("aStar", new THREE.BufferAttribute(star, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geometry.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
  geometry.setAttribute("aTint", new THREE.BufferAttribute(tint, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uDpr: { value: 1 },
      uVortexT: { value: 0 },
      uSwirl: { value: 0 },
      uCollapseT: { value: 0 },
      uTravel: { value: 0 },
      uStarT: { value: 0 },
      uDrift: { value: 0.05 },
      uTunnelVis: { value: 0 },
      uVis: { value: 0.25 },
      uPointer: { value: new THREE.Vector2(0, 0) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return { geometry, material };
}

export function ParticleField({
  refs,
  quality,
}: {
  refs: JourneyRefs;
  quality: QualitySpec;
}) {
  const { geometry, material } = useMemo(
    () => buildField(quality.particles),
    [quality.particles],
  );
  /* R3F convention: per-frame uniform writes go through a ref, never
     through React state (same pattern as ConstellationScene). */
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
    const t = seg(p, SCENE.chaosEnd, SCENE.tunnelEnd);
    const u = materialRef.current.uniforms;

    u.uTime.value = state.clock.elapsedTime;
    u.uDpr.value = state.gl.getPixelRatio();
    u.uVortexT.value = smooth(seg(c, 0.3, 0.62));
    u.uSwirl.value = smooth(seg(c, 0.3, 0.85)) * 5.2;
    u.uCollapseT.value = smooth(seg(c, 0.85, 1.0));
    u.uTravel.value = t * (TUNNEL_LEN + 12) * 1.15;
    u.uStarT.value = smooth(seg(p, SCENE.tunnelEnd - 0.045, SCENE.tunnelEnd + 0.1));
    u.uDrift.value = lerp(0.05, 0.34, smooth(seg(p, SCENE.tunnelEnd - 0.05, 0.8)));
    u.uTunnelVis.value = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.8, 1)));
    u.uVis.value = Math.max(
      0.18 + 0.52 * u.uVortexT.value,
      u.uCollapseT.value,
      u.uStarT.value,
    );
    u.uPointer.value.set(refs.pointer.current.x, refs.pointer.current.y);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

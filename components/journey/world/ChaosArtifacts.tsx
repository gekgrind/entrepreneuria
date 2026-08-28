"use client";

/**
 * ChaosArtifacts — the business-artifact cards of Scene 1.
 *
 * Every card is an instance of one plane sampling a shared procedural
 * atlas (spreadsheet, charts, invoice, calendar, kanban, inbox, palette),
 * so all artifacts render in ONE draw call. Instance motion (drift →
 * funnel → collapse) is computed entirely in the vertex shader from the
 * same scrubbed progress uniforms as the particle field, keeping the
 * transformation reversible.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import {
  SCENE,
  seg,
  smooth,
  type JourneyRefs,
  type QualitySpec,
} from "../journey-math";
import { ATLAS_COUNT, createArtifactAtlas } from "./textures";

const vertexShader = /* glsl */ `
  attribute vec3 iBase;
  attribute vec3 iVortex;
  attribute vec4 iSeed;
  attribute float iAtlas;
  attribute float iScale;

  uniform float uTime;
  uniform float uVortexT;
  uniform float uSwirl;
  uniform float uCollapseT;
  uniform float uEnergy;
  uniform vec2 uPointer;

  varying vec2 vUv;
  varying float vFade;

  void main() {
    /* idle drift — amplitude grows as scroll pours energy into the scene */
    vec3 pos = iBase;
    float t = uTime;
    pos.x += sin(t * (0.22 + iSeed.y * 0.25) + iSeed.x * 6.2831) * (0.25 + uEnergy * 0.55);
    pos.y += cos(t * (0.19 + iSeed.z * 0.22) + iSeed.y * 6.2831) * (0.22 + uEnergy * 0.45);
    pos.z += sin(t * (0.16 + iSeed.w * 0.20) + iSeed.z * 6.2831) * (0.30 + uEnergy * 0.60);

    /* organize into the funnel (same swirl field as the particles) */
    vec3 vpos = iVortex;
    float r = max(length(vpos.xy), 0.001);
    float sw = uSwirl * (2.0 / (r + 0.7));
    float cs = cos(sw);
    float sn = sin(sw);
    vpos.xy = mat2(cs, -sn, sn, cs) * vpos.xy;
    pos = mix(pos, vpos, uVortexT);

    /* collapse — spiral into the core, staggered per card */
    float c = smoothstep(iSeed.w * 0.4, 1.0, uCollapseT * 1.18);
    pos = mix(pos, vec3(0.0, 0.0, -3.0), c * c);
    float scale = iScale * (1.0 - c);

    /* pointer parallax — nearer cards move more */
    float depthScale = 1.0 / (1.0 + max(0.0, -pos.z) * 0.08);
    pos.xy += uPointer * 0.5 * depthScale;

    /* camera-facing billboard with a slow individual tumble */
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float rot = (iSeed.y - 0.5) * 0.9 + t * 0.08 * (iSeed.z - 0.5) + uSwirl * 0.25 * (iSeed.x - 0.5);
    vec2 rp = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy;
    vec3 world = pos + (right * rp.x + up * rp.y) * scale;

    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);

    float row = floor(iAtlas / 4.0);
    vUv = uv * vec2(0.25, 0.5) + vec2(mod(iAtlas, 4.0) * 0.25, (1.0 - row) * 0.5);
    vFade = 1.0 - c;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  varying float vFade;

  void main() {
    vec4 tex = texture2D(uAtlas, vUv);
    if (tex.a * vFade < 0.35) discard;
    gl_FragColor = vec4(tex.rgb * (0.72 + 0.28 * vFade), 1.0);
  }
`;

function buildInstances(count: number) {
  const base = new Float32Array(count * 3);
  const vortex = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  const atlas = new Float32Array(count);
  const scale = new Float32Array(count);

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

    /* scatter — kept off dead center so the founder core stays visible */
    {
      const a = r1 * Math.PI * 2;
      const rad = 2.6 + Math.pow(r2, 0.65) * 5.4;
      base[i3] = Math.cos(a) * rad * 1.2;
      base[i3 + 1] = Math.sin(a) * rad * 0.75 + (r3 - 0.5) * 1.4;
      base[i3 + 2] = -5 + r4 * 7.5;
    }

    /* funnel target */
    {
      const a = r2 * Math.PI * 2;
      const rad = 1.1 + Math.pow(r3, 0.8) * 4.1;
      const depth = -Math.pow((5.3 - rad) / 5.3, 1.5) * 8 - r1 * 0.6;
      vortex[i3] = Math.cos(a) * rad;
      vortex[i3 + 1] = Math.sin(a) * rad * 0.85;
      vortex[i3 + 2] = depth;
    }

    atlas[i] = i % ATLAS_COUNT;
    scale[i] = 0.55 + r4 * 0.6;
  }
  return { base, vortex, seed, atlas, scale };
}

export function ChaosArtifacts({
  refs,
  quality,
}: {
  refs: JourneyRefs;
  quality: QualitySpec;
}) {
  const { geometry, material } = useMemo(() => {
    const count = quality.artifacts;
    const plane = new THREE.PlaneGeometry(1.35, 0.9);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setIndex(plane.getIndex());
    geo.setAttribute("position", plane.getAttribute("position"));
    geo.setAttribute("uv", plane.getAttribute("uv"));
    const inst = buildInstances(count);
    geo.setAttribute("iBase", new THREE.InstancedBufferAttribute(inst.base, 3));
    geo.setAttribute("iVortex", new THREE.InstancedBufferAttribute(inst.vortex, 3));
    geo.setAttribute("iSeed", new THREE.InstancedBufferAttribute(inst.seed, 4));
    geo.setAttribute("iAtlas", new THREE.InstancedBufferAttribute(inst.atlas, 1));
    geo.setAttribute("iScale", new THREE.InstancedBufferAttribute(inst.scale, 1));
    geo.instanceCount = count;

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uAtlas: { value: createArtifactAtlas() },
        uTime: { value: 0 },
        uVortexT: { value: 0 },
        uSwirl: { value: 0 },
        uCollapseT: { value: 0 },
        uEnergy: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, 0) },
      },
      side: THREE.FrontSide,
    });
    return { geometry: geo, material: mat };
  }, [quality.artifacts]);
  const materialRef = useRef(material);

  useEffect(
    () => () => {
      (material.uniforms.uAtlas.value as THREE.Texture).dispose();
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
    u.uEnergy.value = smooth(seg(c, 0.12, 0.3));
    u.uPointer.value.set(refs.pointer.current.x, refs.pointer.current.y);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

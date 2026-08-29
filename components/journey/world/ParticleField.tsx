"use client";

/**
 * ParticleField — the ONE persistent particle material of the journey.
 *
 * A single THREE.Points whose every particle carries precomputed homes for
 * every chapter: chaos scatter → vortex funnel → tunnel helix → star dome
 * → ecosystem galaxy → Prospra brain. The vertex shader mixes between them
 * from uniform progress values (derived each frame from the scrubbed
 * scroll ref), so the same "material" visibly becomes chaos, collapse,
 * tunnel, stars, galaxy and brain — and reverse scrolling always
 * reconstructs the exact state. No CPU per-particle work, no per-frame
 * allocation.
 *
 * Scene 4–6 staging (all scrubbed, all reversible):
 *   uGalaxyT  stars organize into the ecosystem (spiral streams → orbits)
 *   uDepart   the galaxy loosens and recedes; brain material trails off
 *   uBrainT   the retained particles gather into the Prospra brain
 *
 * Scenes 7–9 continue the SAME material (no new particle systems):
 *   uProofT     brain particles stream onto the proof-frame perimeter
 *               (intelligence becomes the product experience)
 *   uStarReturn departed material drifts back to the star dome
 *   uProofDrift the frame trace relaxes into ambient dust around the cards
 *   uProofOut   evidence recedes as belief begins (7 → 8)
 *   uBurst      the belief cards "release" the dust (disintegration)
 *   uReformT    released material streams home — the ecosystem reforms
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { Product } from "@/lib/ecosystem/schema";

import {
  PROOF_FRAME,
  SCENE,
  TUNNEL_LEN,
  getBrainTransform,
  getFinalGalaxyTransform,
  getGalaxyTransform,
  lerp,
  seg,
  smooth,
  type JourneyRefs,
  type QualitySpec,
} from "../journey-math";
import { buildGalaxyHomes } from "./ecosystem-shapes";
import { getBrainPositions } from "./brain-shape";
import { getProofFramePositions } from "./proof-shapes";

const vertexShader = /* glsl */ `
  attribute vec3 aVortex;
  attribute vec3 aTunnel;
  attribute vec3 aStar;
  attribute vec4 aSeed;
  attribute float aSize;
  attribute float aKind;
  attribute float aTint;
  attribute vec3 aGalaxy;
  attribute float aGalaxyKind;
  attribute float aOrbit;
  attribute vec3 aBrain;
  attribute float aBrainRole;
  attribute vec3 aProof;

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
  uniform float uGalaxyT;
  uniform float uDepart;
  uniform float uBrainT;
  uniform float uPulse;
  uniform float uGalaxyScale;
  uniform vec3 uGalaxyOffset;
  uniform float uBrainScale;
  uniform vec3 uBrainOffset;
  uniform float uStarReturn;
  uniform float uProofT;
  uniform float uProofDrift;
  uniform float uProofOut;
  uniform float uBurst;
  uniform float uReformT;
  uniform vec2 uProofXY;
  uniform vec3 uProofCenter;
  uniform float uGalaxyScale2;
  uniform vec3 uGalaxyOffset2;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vStreak;
  varying float vAngle;

  #define TUNNEL_LEN ${TUNNEL_LEN.toFixed(1)}

  void main() {
    /* per-chapter progress, staggered across the population */
    float gk = smoothstep(aSeed.w * 0.6, aSeed.w * 0.6 + 0.4, uGalaxyT);
    float dk = smoothstep(aSeed.x * 0.5, aSeed.x * 0.5 + 0.5, uDepart);
    float bk = smoothstep(aSeed.y * 0.55, aSeed.y * 0.55 + 0.45, uBrainT) * aBrainRole;
    float nodeFlag = step(0.5, aGalaxyKind) * (1.0 - step(1.5, aGalaxyKind));
    float farFlag = step(3.5, aGalaxyKind);

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

    /* 4 — stars organize into the ecosystem.
       Each particle leaves its star home along a curved spiral stream and
       settles into its galaxy home (ring dust / node cluster / core /
       haze / far field). The arc vanishes at both ends of the mix, so the
       motion is continuous — attraction → streams → orbital structure. */
    vec3 gLocal = aGalaxy;
    float spin = uTime * 0.05 * aOrbit * gk * (1.0 - dk);
    float ocs = cos(spin);
    float osn = sin(spin);
    gLocal.xy = mat2(ocs, -osn, osn, ocs) * gLocal.xy;
    vec3 gWorld = gLocal * uGalaxyScale + uGalaxyOffset;
    vec3 gp = mix(pos, gWorld, gk);
    float gArc = sin(gk * 3.14159);
    float gRad = min(length(aGalaxy.xy), 1.0);
    vec2 gTang = normalize(vec2(-aGalaxy.y, aGalaxy.x) + vec2(0.0001, 0.0));
    gp.xy += gTang * gArc * gRad * (0.45 + aSeed.x * 1.7);
    gp.z += gArc * (aSeed.z - 0.5) * 2.0 * gRad;
    pos = gp;

    /* 5 — the ecosystem departs: orbital material loosens, swings outward
       and recedes into depth. The brain-bound subset instead trails
       toward the Prospra side as a loose gathering cloud. */
    vec3 escDir = pos - uGalaxyOffset;
    float escLen = max(length(escDir), 0.001);
    escDir /= escLen;
    vec3 outward = pos + escDir * (3.5 + aSeed.y * 6.0)
      + vec3(0.0, (aSeed.x - 0.5) * 3.0, -2.0 - aSeed.z * 5.0);
    vec3 looseBrain = (aBrain * 1.9 + (aSeed.xyz - 0.5) * 2.2) * uBrainScale + uBrainOffset;
    vec3 escape = mix(outward, looseBrain, aBrainRole);
    float dArc = sin(dk * 3.14159);
    vec3 dp = mix(pos, escape, dk);
    dp.xy += vec2(-escDir.y, escDir.x) * dArc * (0.3 + aSeed.y * 0.9) * (1.0 - aBrainRole);
    pos = dp;

    /* 6 — the retained material gathers into the Prospra brain */
    vec3 brainWorld = aBrain * uBrainScale + uBrainOffset;
    vec3 bp = mix(pos, brainWorld, bk);
    bp.z += sin(bk * 3.14159) * (aSeed.w - 0.5) * 1.4;
    pos = bp;

    /* 6b — Scene 7 opens: the departed (non-brain) material drifts back
       to the star dome. The deep field never left; it simply returns. */
    float sk = smoothstep(aSeed.z * 0.5, aSeed.z * 0.5 + 0.5, uStarReturn)
      * (1.0 - aBrainRole);
    pos = mix(pos, aStar * 0.92, sk);

    /* 6c — intelligence becomes product experience: the brain particles
       loosen, STRETCH into directional streams, and trace the perimeter
       of the first product frame. */
    float pk = smoothstep(aSeed.y * 0.55, aSeed.y * 0.55 + 0.45, uProofT)
      * aBrainRole;
    vec3 proofPos = aProof;
    proofPos.xy = uProofCenter.xy + (proofPos.xy - uProofCenter.xy) * uProofXY;
    vec3 toProof = proofPos - pos;
    float pStream = sin(pk * 3.14159);
    pos = mix(pos, proofPos, pk);
    pos += normalize(toProof + vec3(0.0001, 0.0, 0.0))
      * pStream * (0.18 + aSeed.x * 0.5);

    /* 6d — the trace relaxes into ambient dust around the frame stack */
    float pd = uProofDrift * aBrainRole;
    vec3 fromProofCenter = pos - uProofCenter;
    pos += fromProofCenter * pd * (0.10 + aSeed.z * 0.22);

    /* 6e — 7 → 8: evidence recedes (partial). Scene 8 disintegration:
       the belief cards release the dust — it flares outward and sinks
       into depth, where gravity will find it again. */
    float po = uProofOut * aBrainRole;
    vec3 outDir = normalize(fromProofCenter + vec3(0.0001, 0.0, 0.0));
    pos += outDir * po * (1.2 + aSeed.y * 2.4);
    float bu = uBurst * aBrainRole;
    pos += outDir * bu * (2.0 + aSeed.x * 4.0);
    pos.z -= bu * (1.0 + aSeed.z * 2.0);

    /* 6f — RESOLUTION: the released material streams home. Same galaxy
       homes as Scene 4 — the same system, returning with understanding.
       Orbital spin resumes; the arc vanishes at both ends of the mix. */
    float rk = smoothstep(aSeed.w * 0.6, aSeed.w * 0.6 + 0.4, uReformT);
    vec3 g2Local = aGalaxy;
    float spin2 = uTime * 0.05 * aOrbit * rk;
    float rcs = cos(spin2);
    float rsn = sin(spin2);
    g2Local.xy = mat2(rcs, -rsn, rsn, rcs) * g2Local.xy;
    vec3 g2World = g2Local * uGalaxyScale2 + uGalaxyOffset2;
    float rArc = sin(rk * 3.14159);
    vec2 rTang = normalize(vec2(-aGalaxy.y, aGalaxy.x) + vec2(0.0001, 0.0));
    float rRad = min(length(aGalaxy.xy), 1.0);
    vec3 rp = mix(pos, g2World, rk);
    rp.xy += rTang * rArc * rRad * (0.5 + aSeed.z * 1.6);
    rp.z += rArc * (aSeed.x - 0.5) * 1.8 * rRad;
    pos = rp;

    /* 7 — ambient drift (the "alive" motion; tightened where structure
       must stay readable: node clusters, the core, the brain) */
    float tighten = max(max(gk * nodeFlag, bk * (1.0 - pk)), rk * nodeFlag);
    float d = uDrift * (0.35 + 0.65 * aSeed.w) * (1.0 - 0.62 * tighten);
    pos.x += d * sin(uTime * (0.30 + aSeed.x * 0.45) + aSeed.y * 6.2831);
    pos.y += d * cos(uTime * (0.26 + aSeed.y * 0.38) + aSeed.z * 6.2831);
    pos.z += d * sin(uTime * (0.22 + aSeed.z * 0.34) + aSeed.x * 6.2831);

    /* 8 — slow star-dome rotation while in space (hands off to the galaxy;
       the returned dome keeps its drift until the reform captures it) */
    float domeRot = uTime * 0.035 * max(uStarT * (1.0 - gk), sk * (1.0 - rk));
    float dcs = cos(domeRot);
    float dsn = sin(domeRot);
    pos.xz = mat2(dcs, -dsn, dsn, dcs) * pos.xz;

    /* 9 — pointer parallax, depth-scaled */
    float depthScale = 1.0 / (1.0 + max(0.0, -pos.z) * 0.05);
    pos.xy += uPointer * (0.30 + 0.35 * aSeed.z) * depthScale;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float shardBoost = step(0.5, aKind) * (1.0 - step(1.5, aKind));
    float streakBoost = step(1.5, aKind);
    float size = aSize * (1.0 + shardBoost * 0.8 + streakBoost * 1.4);
    size *= 1.0 + 0.15 * gk * nodeFlag;  /* node clusters pop */
    size *= 1.0 + 0.3 * bk;              /* brain points read as tissue */
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
    vAlpha *= mix(1.0, 0.72 + 0.28 * sin(uTime * (1.4 + aSeed.z * 2.2) + aSeed.x * 40.0), uStarT * (1.0 - bk));
    /* node clusters brighten as the ecosystem resolves (kept subtle —
       the node core point carries the bright-knot read) */
    vAlpha *= 1.0 - 0.42 * gk * nodeFlag;
    /* departing non-brain material fades into the deep — and is restored
       as it drifts back to the star dome in Scene 7. The returned dome
       stays CALMER than Scene 3's full dome: the later acts are more
       intimate; the reform restores full presence. */
    float departFade = dk * 0.55 * (1.0 - aBrainRole) * (1.0 - 0.5 * farFlag);
    vAlpha *= 1.0 - departFade * (1.0 - sk);
    vAlpha *= 1.0 - 0.42 * sk * (1.0 - rk);
    /* brain tissue brightens as it resolves */
    vAlpha *= 0.8 + 0.35 * bk;
    /* the proof trace calms into dust, recedes for belief, FLARES as the
       cards release it, then settles into the reformed galaxy */
    vAlpha *= 1.0 - 0.25 * pk;
    vAlpha *= 1.0 - 0.35 * uProofDrift * aBrainRole;
    vAlpha *= 1.0 - 0.5 * po;
    vAlpha *= 1.0 + 1.6 * bu * (1.0 - rk);
    vAlpha *= mix(1.0, 0.92 + 0.3 * nodeFlag, rk);

    /* proof particles render as directional streaks mid-flight */
    float pStreak = pStream * aBrainRole * (1.0 - rk) * 0.85;
    vStreak = max(streakBoost * uTunnelVis, pStreak);
    if (pStreak > streakBoost * uTunnelVis) {
      vAngle = atan(toProof.y, toProof.x);
    } else {
      vAngle = aSeed.x * 6.2831 + uSwirl * 0.6;
    }

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
    vec3 col = mix(chaosCol * 0.42, starCol * 0.85, uStarT) * (0.55 + 0.45 * aSeed.y);

    /* galaxy palette — the products' light (cyan) over layered depth */
    vec3 gcol = col;
    if (aGalaxyKind < 0.5) {
      gcol = mix(vec3(0.45, 0.72, 1.05), vec3(0.72, 0.90, 1.08), aTint);
    } else if (aGalaxyKind < 1.5) {
      gcol = vec3(0.30, 0.82, 1.10) * (0.34 + 0.28 * aSeed.y);
    } else if (aGalaxyKind < 2.5) {
      gcol = vec3(1.05, 0.68, 0.38) * (0.70 + 0.5 * aSeed.y);
    } else if (aGalaxyKind < 3.5) {
      gcol = vec3(0.26, 0.33, 0.68) * (0.40 + 0.35 * aSeed.y);
    }
    col = mix(col, gcol * 0.75, gk);

    /* brain palette — intelligence cyan with a slow travelling pulse.
       The trace + dust + burst inherit it (bk stays 1 for that subset). */
    float pulse = sin(uTime * 2.1 - brainWorld.x * 1.9 + aSeed.y * 3.0) * 0.5 + 0.5;
    vec3 bcol = mix(vec3(0.24, 0.72, 1.05), vec3(0.55, 0.95, 1.22), aSeed.x)
      * (0.50 + 0.35 * aSeed.y);
    bcol *= 1.0 + pulse * 0.4 * uPulse;
    col = mix(col, bcol, bk);

    /* the reform hands every particle back to the galaxy palette — the
       same system, slightly more luminous than its first appearance */
    col = mix(col, gcol * 0.9, rk);

    vColor = col;
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

function buildField(count: number, brainCount: number, products: readonly Product[]) {
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

  /* galaxy homes computed from the ecosystem registry orbit layout */
  const galaxy = buildGalaxyHomes(count, products, star);

  /* the brain subset: the first brainCount particles retarget onto the
     deterministic Prospra brain point cloud; the rest never move on the
     brain leg (aBrainRole = 0 gates the shader mix). The SAME subset
     later traces the proof frame and releases into the finale reform. */
  const brain = new Float32Array(count * 3);
  const brainRole = new Float32Array(count);
  const proof = new Float32Array(count * 3);
  const brainPositions = getBrainPositions(Math.min(brainCount, count));
  const proofPositions = getProofFramePositions(Math.min(brainCount, count));
  for (let i = 0; i < Math.min(brainCount, count); i += 1) {
    brain[i * 3] = brainPositions[i * 3];
    brain[i * 3 + 1] = brainPositions[i * 3 + 1];
    brain[i * 3 + 2] = brainPositions[i * 3 + 2];
    brainRole[i] = 1;
    proof[i * 3] = proofPositions[i * 3];
    proof[i * 3 + 1] = proofPositions[i * 3 + 1];
    proof[i * 3 + 2] = proofPositions[i * 3 + 2];
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
  geometry.setAttribute("aGalaxy", new THREE.BufferAttribute(galaxy.positions, 3));
  geometry.setAttribute("aGalaxyKind", new THREE.BufferAttribute(galaxy.kinds, 1));
  geometry.setAttribute("aOrbit", new THREE.BufferAttribute(galaxy.orbit, 1));
  geometry.setAttribute("aBrain", new THREE.BufferAttribute(brain, 3));
  geometry.setAttribute("aBrainRole", new THREE.BufferAttribute(brainRole, 1));
  geometry.setAttribute("aProof", new THREE.BufferAttribute(proof, 3));

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
      uGalaxyT: { value: 0 },
      uDepart: { value: 0 },
      uBrainT: { value: 0 },
      uPulse: { value: 0 },
      uGalaxyScale: { value: 1 },
      uGalaxyOffset: { value: new THREE.Vector3(-1.55, 0, -1.9) },
      uBrainScale: { value: 1 },
      uBrainOffset: { value: new THREE.Vector3(2.05, -0.05, -2.1) },
      uStarReturn: { value: 0 },
      uProofT: { value: 0 },
      uProofDrift: { value: 0 },
      uProofOut: { value: 0 },
      uBurst: { value: 0 },
      uReformT: { value: 0 },
      uProofXY: { value: new THREE.Vector2(1, 1) },
      uProofCenter: { value: new THREE.Vector3(...PROOF_FRAME.center) },
      uGalaxyScale2: { value: 1 },
      uGalaxyOffset2: { value: new THREE.Vector3(0, 0.9, -3.6) },
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
  products,
}: {
  refs: JourneyRefs;
  quality: QualitySpec;
  products: readonly Product[];
}) {
  const { geometry, material } = useMemo(
    () => buildField(quality.particles, quality.brain, products),
    [quality.particles, quality.brain, products],
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
    u.uStarT.value = smooth(seg(p, SCENE.tunnelEnd - 4.5, SCENE.tunnelEnd + 10));
    u.uDrift.value = lerp(0.05, 0.34, smooth(seg(p, SCENE.tunnelEnd - 5, 80)));
    u.uTunnelVis.value = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.8, 1)));
    u.uVis.value = Math.max(
      0.18 + 0.52 * u.uVortexT.value,
      u.uCollapseT.value,
      u.uStarT.value,
    );
    u.uPointer.value.set(refs.pointer.current.x, refs.pointer.current.y);

    /* Scenes 4–6: assembly → exploration hold → departure → brain */
    u.uGalaxyT.value = smooth(seg(p, SCENE.ecoStart + 2, 124));
    u.uDepart.value = smooth(seg(p, SCENE.exploreEnd, SCENE.departEnd));
    u.uBrainT.value = smooth(seg(p, SCENE.exploreEnd + 7, 240));
    /* neural pulses resolve, then slow to silence as the brain becomes
       the product frame (Scene 6 → 7) */
    u.uPulse.value =
      smooth(seg(p, 238, 246)) * (1 - smooth(seg(p, SCENE.proofStart, 256)));

    /* Scenes 7–9: trace → dust → recede → release → reform */
    u.uStarReturn.value = smooth(seg(p, 256, 268));
    u.uProofT.value = smooth(seg(p, SCENE.proofStart, SCENE.proofTraceDone));
    u.uProofDrift.value = smooth(seg(p, 266, 274));
    u.uProofOut.value = smooth(seg(p, 318, 327));
    u.uBurst.value = smooth(seg(p, SCENE.disintegrateStart, 387));
    u.uReformT.value = smooth(seg(p, SCENE.reformStart, SCENE.reformAssembled));

    const gt = getGalaxyTransform(refs.stacked.current);
    u.uGalaxyScale.value = gt.scale;
    u.uGalaxyOffset.value.set(...gt.offset);
    const bt = getBrainTransform(refs.stacked.current);
    u.uBrainScale.value = bt.scale;
    u.uBrainOffset.value.set(...bt.offset);

    /* Scene 9 final composition + stacked proof-frame fit (portrait
       viewports see a narrower world — the frame must shrink, not grow) */
    const ft = getFinalGalaxyTransform(refs.stacked.current);
    u.uGalaxyScale2.value = ft.scale;
    u.uGalaxyOffset2.value.set(...ft.offset);
    const st = refs.stacked.current;
    u.uProofXY.value.set(st ? 0.5 : 1, st ? 0.62 : 1);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

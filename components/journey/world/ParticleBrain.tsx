"use client";

/**
 * ParticleBrain — the neural-filament layer of Scene 6.
 *
 * The brain ITSELF is the master particle field retargeted onto the
 * deterministic anatomical brain curves (see ParticleField + brain-shape:
 * silhouette contours, gyri, fissures, cerebellum, brainstem, pathways —
 * with the three-quarter right-facing pose baked into the geometry, so
 * this layer and the particles always coincide).
 *
 * This component adds, in the same local brain space:
 *   · axon lines along the SAME neural pathways (one lineSegments call)
 *   · a small number of bright signal pulses travelling those pathways
 *     (one points call, preallocated — no per-frame allocation)
 *   · a heavily restrained intelligence glow (two sprites)
 *
 * Live motion is deliberately minimal — a breath of sway and pointer
 * parallax that never carries the right-facing profile out of read.
 * Everything is driven by the scrubbed progress ref.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import {
  SCENE,
  getBrainTransform,
  seg,
  smooth,
  type JourneyRefs,
  type QualitySpec,
} from "../journey-math";
import { getBrainAxons, getBrainPathways } from "./brain-shape";
import { createGlowTexture } from "./textures";

/** A handful of simultaneous signal impulses — suggestion, not show. */
const PULSE_COUNT = 6;

export function ParticleBrain({
  refs,
  quality,
}: {
  refs: JourneyRefs;
  quality: QualitySpec;
}) {
  const group = useRef<THREE.Group>(null);

  const built = useMemo(() => {
    const axonGeo = new THREE.BufferGeometry();
    axonGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(
        getBrainAxons(quality.brain, quality.tier === "high" ? 260 : quality.tier === "mid" ? 180 : 100),
        3,
      ),
    );
    const axonMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.3, 0.78, 1.06),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const glowTex = createGlowTexture();
    const inner = new THREE.SpriteMaterial({
      map: glowTex,
      color: new THREE.Color(0.06, 0.4, 0.62),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const outer = new THREE.SpriteMaterial({
      map: glowTex,
      color: new THREE.Color(0.05, 0.2, 0.45),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    /* signal pulses — bright impulses riding the neural pathways;
       geometry preallocated, positions written in place per frame */
    const pulseGeo = new THREE.BufferGeometry();
    const pulsePos = new Float32Array(PULSE_COUNT * 3);
    pulseGeo.setAttribute("position", new THREE.BufferAttribute(pulsePos, 3));
    const pulseMat = new THREE.PointsMaterial({
      color: new THREE.Color(0.82, 0.98, 1.3),
      size: 0.14,
      sizeAttenuation: true,
      map: glowTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    /* arc-length tables so the pulses interpolate by distance, not by
       parameter — constant, calm speed along every pathway */
    const paths = getBrainPathways().map((pts) => {
      const n = pts.length / 3;
      const cum = new Float32Array(n);
      for (let i = 1; i < n; i += 1) {
        const dx = pts[i * 3] - pts[(i - 1) * 3];
        const dy = pts[i * 3 + 1] - pts[(i - 1) * 3 + 1];
        const dz = pts[i * 3 + 2] - pts[(i - 1) * 3 + 2];
        cum[i] = cum[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      return { pts, cum, total: cum[n - 1] };
    });

    return { axonGeo, axonMat, glowTex, inner, outer, pulseGeo, pulseMat, pulsePos, paths };
  }, [quality]);

  /* per-frame mutations go through a ref (R3F convention) */
  const mats = useRef(built);
  useEffect(() => {
    mats.current = built;
  }, [built]);

  useEffect(
    () => () => {
      built.axonGeo.dispose();
      built.axonMat.dispose();
      built.glowTex.dispose();
      built.inner.dispose();
      built.outer.dispose();
      built.pulseGeo.dispose();
      built.pulseMat.dispose();
    },
    [built],
  );

  useFrame((state) => {
    const p = refs.overall.current;
    const g = group.current;
    if (!g) return;

    const t = getBrainTransform(refs.stacked.current);
    g.position.set(...t.offset);
    /* Scene 6 → 7: the brain's particles stream onto the proof frame;
       the axon/glow/pulse layer dissolves with them, then unmounts
       visually */
    const fadeOut = smooth(seg(p, SCENE.proofStart, 256));
    g.visible = p > SCENE.exploreEnd && fadeOut < 1;

    const assemble = smooth(seg(p, SCENE.exploreEnd + 7, 240));
    const nerves = smooth(seg(p, 228, SCENE.brainAssembled)) * (1 - fadeOut);
    const glow = smooth(seg(p, 218, SCENE.brainAssembled + 2)) * (1 - fadeOut);

    /* restrained neural life: a slow shimmer, never a light show */
    const b = mats.current;
    const shimmer = 0.82 + 0.18 * Math.sin(state.clock.elapsedTime * 1.6);
    b.axonMat.opacity = nerves * 0.085 * shimmer;
    b.inner.opacity = glow * 0.075 * (0.9 + 0.1 * Math.sin(state.clock.elapsedTime * 0.9));
    b.outer.opacity = glow * 0.05;

    /* barely-there breathing + sway — the baked three-quarter pose keeps
       the right-facing profile; this is life, not rotation */
    const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.55) * 0.016 * assemble;
    g.scale.setScalar(t.scale * breathe);
    g.rotation.y =
      Math.sin(state.clock.elapsedTime * 0.11) * 0.05 * assemble +
      refs.pointer.current.x * 0.04;
    g.rotation.x = refs.pointer.current.y * -0.03;

    /* signal pulses — a few bright impulses travelling the pathways */
    const pulseT = smooth(seg(p, 236, 244)) * (1 - fadeOut);
    b.pulseMat.opacity = pulseT * 0.85;
    if (pulseT > 0.001) {
      const time = state.clock.elapsedTime;
      for (let i = 0; i < PULSE_COUNT; i += 1) {
        const path = b.paths[i % b.paths.length];
        const speed = 0.055 + (i % 3) * 0.02;
        const phase = (time * speed + i * 0.618) % 1;
        const d = phase * path.total;
        /* binary search the arc-length table */
        let lo = 0;
        let hi = path.cum.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (path.cum[mid] < d) lo = mid + 1;
          else hi = mid;
        }
        const i1 = Math.max(1, lo);
        const d0 = path.cum[i1 - 1];
        const d1 = path.cum[i1];
        const k = d1 > d0 ? (d - d0) / (d1 - d0) : 0;
        const a = (i1 - 1) * 3;
        const c = i1 * 3;
        b.pulsePos[i * 3] = path.pts[a] + (path.pts[c] - path.pts[a]) * k;
        b.pulsePos[i * 3 + 1] = path.pts[a + 1] + (path.pts[c + 1] - path.pts[a + 1]) * k;
        b.pulsePos[i * 3 + 2] = path.pts[a + 2] + (path.pts[c + 2] - path.pts[a + 2]) * k;
      }
      (b.pulseGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <group ref={group} visible={false}>
      <lineSegments geometry={built.axonGeo} material={built.axonMat} />
      <points geometry={built.pulseGeo} material={built.pulseMat} frustumCulled={false} />
      <sprite material={built.inner} scale={[3.4, 2.9, 1]} position={[0.05, 0.02, -0.4]} />
      <sprite material={built.outer} scale={[5.6, 4.8, 1]} position={[0.05, 0.05, -1.3]} />
    </group>
  );
}

"use client";

/**
 * ParticleBrain — the neural-filament layer of Scene 6.
 *
 * The brain ITSELF is the master particle field retargeted onto the
 * deterministic brain point cloud (see ParticleField + brain-shape).
 * This component adds the restrained axon connections between those same
 * points (one lineSegments draw call) plus a soft intelligence glow
 * (two sprites). It lives in local brain space inside a group receiving
 * the same getBrainTransform the shader uses, so lines always join real
 * particles. Everything is driven by the scrubbed progress ref.
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
import { getBrainAxons } from "./brain-shape";
import { createGlowTexture } from "./textures";

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
      color: new THREE.Color(0.25, 0.75, 1.05),
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
    return { axonGeo, axonMat, glowTex, inner, outer };
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
    },
    [built],
  );

  useFrame((state) => {
    const p = refs.overall.current;
    const g = group.current;
    if (!g) return;

    const t = getBrainTransform(refs.stacked.current);
    g.position.set(...t.offset);
    g.scale.setScalar(t.scale);
    g.visible = p > SCENE.exploreEnd;

    const assemble = smooth(seg(p, SCENE.exploreEnd + 7, 240));
    const nerves = smooth(seg(p, 228, SCENE.brainAssembled));
    const glow = smooth(seg(p, 218, SCENE.brainAssembled + 2));

    /* restrained neural life: a slow shimmer, never a light show */
    const b = mats.current;
    const shimmer = 0.82 + 0.18 * Math.sin(state.clock.elapsedTime * 1.6);
    b.axonMat.opacity = nerves * 0.17 * shimmer;
    b.inner.opacity = glow * 0.15 * (0.9 + 0.1 * Math.sin(state.clock.elapsedTime * 0.9));
    b.outer.opacity = glow * 0.11;

    /* barely-there breathing — thoughtful, not a spinning product model */
    const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.55) * 0.016 * assemble;
    g.scale.setScalar(t.scale * breathe);
    g.rotation.y = Math.sin(state.clock.elapsedTime * 0.11) * 0.1 * assemble
      + refs.pointer.current.x * 0.06;
    g.rotation.x = refs.pointer.current.y * -0.04;
  });

  return (
    <group ref={group} visible={false}>
      <lineSegments geometry={built.axonGeo} material={built.axonMat} />
      <sprite material={built.inner} scale={[3.4, 3.0, 1]} position={[0, 0, -0.3]} />
      <sprite material={built.outer} scale={[5.6, 5.0, 1]} position={[0, 0, -1.2]} />
    </group>
  );
}

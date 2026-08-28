"use client";

/**
 * FounderCore — the one warm orange light that is the founder.
 *
 * Scene 1: surrounded at the center of the chaos. Collapse: the
 * gravitational point everything falls into. Scene 3: it re-emerges as
 * the distant orange planet right of center, with a restrained tilted
 * halo ring — the same light, transformed. Two additive sprites (bright
 * core + soft halo) and one ring mesh; three cheap draw calls.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { SCENE, lerp, seg, smooth, type JourneyRefs } from "../journey-math";
import { createGlowTexture } from "./textures";

export function FounderCore({ refs }: { refs: JourneyRefs }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  const { coreMat, haloMat, ringMat, glow } = useMemo(() => {
    const tex = createGlowTexture();
    const core = new THREE.SpriteMaterial({
      map: tex,
      color: new THREE.Color(1.0, 0.88, 0.68),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    const halo = new THREE.SpriteMaterial({
      map: tex,
      color: new THREE.Color(0.82, 0.48, 0.17),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.62,
    });
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.9, 0.7, 0.42),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    return { coreMat: core, haloMat: halo, ringMat: ringMaterial, glow: tex };
  }, []);
  const mats = useRef({ coreMat, haloMat, ringMat });

  useEffect(
    () => () => {
      glow.dispose();
      coreMat.dispose();
      haloMat.dispose();
      ringMat.dispose();
    },
    [glow, coreMat, haloMat, ringMat],
  );

  useFrame((state) => {
    const p = refs.overall.current;
    const g = group.current;
    if (!g) return;

    const c = seg(p, 0, SCENE.chaosEnd);
    const t = seg(p, SCENE.chaosEnd, SCENE.tunnelEnd);
    const collapse = smooth(seg(c, 0.85, 1.0));
    const emerge = smooth(seg(p, SCENE.tunnelEnd + 0.02, 0.86));
    /* tunnel beacon — the founder's light becomes the distant orange
       point at the end of the tunnel (the vanishing point we fly toward) */
    const beacon = smooth(seg(t, 0.05, 0.3)) * (1 - smooth(seg(t, 0.85, 1)));

    /* position: chaos center → deep tunnel beacon → planet right of center */
    const zTransit = lerp(0, -26, beacon);
    const x = lerp(0, 2.3, emerge);
    const y = lerp(0, 0.15, emerge);
    const z = lerp(zTransit, -1.5, emerge);
    g.position.set(x, y, z);

    /* scale: pressured-but-present → swallowed → far beacon → planet */
    const transitScale = lerp(lerp(1, 0.45, collapse), 1.1, beacon);
    const scale = lerp(transitScale, 1.7, emerge);
    /* tiny ambient pulse — ambient motion, not story motion */
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.8) * 0.045;
    g.scale.setScalar(scale * pulse);

    /* the founder light never disappears — it guides */
    mats.current.coreMat.opacity = lerp(1, 0.95, beacon * (1 - emerge));
    mats.current.haloMat.opacity = lerp(0.62, 0.7, beacon * (1 - emerge));

    /* halo ring — arrives with the planet, slow ambient rotation */
    if (ring.current) {
      mats.current.ringMat.opacity = smooth(seg(p, 0.78, 0.88)) * 0.7;
      ring.current.rotation.z = state.clock.elapsedTime * 0.06;
    }
  });

  return (
    <group ref={group}>
      <sprite material={haloMat} scale={[3.2, 3.2, 1]} />
      <sprite material={coreMat} scale={[0.85, 0.85, 1]} />
      <mesh ref={ring} material={ringMat} rotation={[1.25, 0.35, 0]}>
        <ringGeometry args={[1.35, 1.41, 96]} />
      </mesh>
    </group>
  );
}

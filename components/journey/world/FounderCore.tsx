"use client";

/**
 * FounderCore — the one warm orange light that is the founder.
 *
 * Scene 1: surrounded at the center of the chaos. Collapse: the
 * gravitational point everything falls into. Scene 3: it re-emerges as
 * the distant orange planet right of center, with a restrained tilted
 * halo ring — the same light, transformed. Scene 4: that SAME light
 * glides to the center of the forming ecosystem and becomes its
 * gravitational heart; the halo ring reads as the inner orbit. Scene 6:
 * it stays lit at the heart of the receded galaxy — the founder remains
 * the center of the system. Two additive sprites (bright core + soft
 * halo) and one ring mesh; three cheap draw calls.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import {
  SCENE,
  getFinalGalaxyTransform,
  getGalaxyTransform,
  lerp,
  seg,
  smooth,
  type JourneyRefs,
} from "../journey-math";
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
    const emerge = smooth(seg(p, SCENE.tunnelEnd + 2, 86));
    /* tunnel beacon — the founder's light becomes the distant orange
       point at the end of the tunnel (the vanishing point we fly toward) */
    const beacon = smooth(seg(t, 0.05, 0.3)) * (1 - smooth(seg(t, 0.85, 1)));

    /* Scene 4: the planet glides to the galaxy's center and becomes its
       organizing heart; Scene 6: it stays lit inside the receded galaxy;
       Scene 7: it dims to a quiet ember while the product takes the stage;
       Scene 9: it returns to the heart of the reformed ecosystem. */
    const toCenter = smooth(seg(p, SCENE.ecoStart + 2, SCENE.ecoStart + 16));
    const depart = smooth(seg(p, SCENE.exploreEnd, SCENE.departEnd));
    const proofDim = smooth(seg(p, SCENE.proofStart, SCENE.proofTraceDone));
    const reformMove = smooth(seg(p, SCENE.reformStart, SCENE.reformStart + 15));
    const reformT = smooth(seg(p, SCENE.reformStart + 3, SCENE.reformAssembled));
    const gt = getGalaxyTransform(refs.stacked.current);
    const ft = getFinalGalaxyTransform(refs.stacked.current);
    const gx = lerp(gt.offset[0], ft.offset[0], reformMove);
    const gy = lerp(gt.offset[1], ft.offset[1], reformMove);
    const gz = lerp(gt.offset[2], ft.offset[2], reformMove);

    /* position: chaos center → deep tunnel beacon → planet right of
       center → galaxy center (the same light, becoming the system's sun) */
    const zTransit = lerp(0, -26, beacon);
    const px = lerp(0, 2.3, emerge);
    const py = lerp(0, 0.15, emerge);
    const pz = lerp(zTransit, -1.5, emerge);
    const x = lerp(px, gx, toCenter);
    const y = lerp(py, gy, toCenter);
    const z = lerp(pz, gz, toCenter) - depart * 0.6 * (1 - reformMove);
    g.position.set(x, y, z);

    /* scale: pressured-but-present → swallowed → far beacon → planet →
       the compact heart of the ecosystem */
    const transitScale = lerp(lerp(1, 0.45, collapse), 1.1, beacon);
    const planetScale = lerp(transitScale, 1.7, emerge);
    const scale = lerp(planetScale, 1.02 * lerp(gt.scale, ft.scale, reformMove), toCenter);
    /* tiny ambient pulse — ambient motion, not story motion */
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.8) * 0.045;
    g.scale.setScalar(scale * pulse);

    /* the founder light never disappears — it guides */
    const baseDim = (1 - depart * 0.35) * (1 - proofDim * 0.55);
    const dim = lerp(baseDim, 1.05, reformT);
    mats.current.coreMat.opacity = lerp(1, 0.95, beacon * (1 - emerge)) * dim;
    mats.current.haloMat.opacity = lerp(0.62, 0.7, beacon * (1 - emerge)) * dim;

    /* halo ring — arrives with the planet, becomes the inner orbit of
       the ecosystem, recedes with the galaxy in Scene 6, resolves in 9 */
    if (ring.current) {
      const ringIn = smooth(seg(p, 78, 88));
      mats.current.ringMat.opacity =
        ringIn * lerp(0.7, 0.34, toCenter) * lerp(1 - depart * 0.45, 0.9, reformT);
      ring.current.rotation.z = state.clock.elapsedTime * 0.06;
      /* settle from the planet's tilt toward the galaxy plane */
      ring.current.rotation.x = lerp(1.25, 1.32, toCenter);
      ring.current.rotation.y = lerp(0.35, 0.12, toCenter);
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

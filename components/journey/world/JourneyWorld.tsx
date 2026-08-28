"use client";

/**
 * JourneyWorld — the single persistent WebGL world of the POC.
 *
 * One canvas, one camera, six draw calls. The camera path, like every
 * object in the world, is a pure function of the scrubbed master
 * progress ref — scroll position fully determines the frame, so the
 * whole journey is reversible by construction.
 *
 * Loaded via dynamic import (ssr: false) from JourneyExperience —
 * never in first-load JS.
 */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import {
  SCENE,
  journeyStats,
  lerp,
  seg,
  smooth,
  type JourneyRefs,
  type QualitySpec,
} from "../journey-math";
import { ParticleField } from "./ParticleField";
import { ChaosArtifacts } from "./ChaosArtifacts";
import { OrbitScribbles } from "./OrbitScribbles";
import { TunnelRibbons } from "./TunnelRibbons";
import { FounderCore } from "./FounderCore";

function CameraRig({ refs }: { refs: JourneyRefs }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  /* per-frame camera writes go through a ref (R3F convention, same as
     ConstellationScene's material refs — no React state at 60fps) */
  const cameraRef = useRef(camera);
  const look = useMemo(() => new THREE.Vector3(), []);
  const damped = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const p = refs.overall.current;
    const c = seg(p, 0, SCENE.chaosEnd);
    const t = seg(p, SCENE.chaosEnd, SCENE.tunnelEnd);
    const r = seg(p, SCENE.tunnelEnd, 1);

    /* dolly: push toward the vortex, hold through the tunnel, ease back
       into the spacious reveal */
    const zIn = lerp(9.6, 6.6, smooth(seg(c, 0.3, 0.85)));
    const zOut = lerp(6.6, 7.6, smooth(seg(r, 0, 0.3)));
    const z = p < SCENE.chaosEnd ? zIn : p < SCENE.tunnelEnd ? 6.6 : zOut;

    /* restrained FOV breathe through the tunnel only */
    const fov = 42 + Math.sin(t * Math.PI) * 3.5;

    /* gentle lateral sway while travelling */
    const swayAmp = smooth(seg(t, 0, 0.15)) * (1 - smooth(seg(t, 0.85, 1)));
    const sx = Math.sin(state.clock.elapsedTime * 0.5) * 0.08 * swayAmp;
    const sy = Math.cos(state.clock.elapsedTime * 0.42) * 0.06 * swayAmp;

    /* pointer parallax, frame-rate-independent damping */
    const d = damped.current;
    const k = 1 - Math.pow(0.001, delta);
    d.x = lerp(d.x, refs.pointer.current.x, k);
    d.y = lerp(d.y, refs.pointer.current.y, k);

    const cam = cameraRef.current;
    cam.position.set(
      sx + d.x * 0.18,
      sy + d.y * 0.12 + lerp(0.25, 0, smooth(seg(c, 0, 0.3))),
      z,
    );

    /* gaze: center → down the tunnel → biased toward the planet */
    const emerge = smooth(seg(p, SCENE.tunnelEnd + 0.02, 0.86));
    const tunnelGaze = smooth(seg(t, 0, 0.2)) * (1 - smooth(seg(t, 0.8, 1)));
    look.set(lerp(0, 0.75, emerge), 0, lerp(0, -8, tunnelGaze));
    cam.lookAt(look);

    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

/** Dev-only probe: writes FPS/DPR/draw-call stats for the HUD overlay. */
function StatsProbe({ refs, quality }: { refs: JourneyRefs; quality: QualitySpec }) {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ frames: 0, last: 0 });

  useEffect(() => {
    journeyStats.particles = quality.particles;
    journeyStats.tier = quality.tier;
    journeyStats.ready = true;
    return () => {
      journeyStats.ready = false;
    };
  }, [quality]);

  useFrame(() => {
    acc.current.frames += 1;
    const now = performance.now();
    if (acc.current.last === 0) acc.current.last = now;
    if (now - acc.current.last >= 500) {
      journeyStats.fps = Math.round((acc.current.frames * 1000) / (now - acc.current.last));
      acc.current.frames = 0;
      acc.current.last = now;
      journeyStats.dpr = gl.getPixelRatio();
      journeyStats.calls = gl.info.render.calls;
      journeyStats.triangles = gl.info.render.triangles;
      journeyStats.progress = refs.overall.current;
    }
  });

  return null;
}

export default function JourneyWorld({
  refs,
  quality,
  onCreated,
}: {
  refs: JourneyRefs;
  quality: QualitySpec;
  onCreated: () => void;
}) {
  return (
    <Canvas
      dpr={[1, quality.dprMax]}
      camera={{ position: [0, 0, 9.6], fov: 42, near: 0.1, far: 90 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop="always"
      onCreated={onCreated}
      style={{ pointerEvents: "none" }}
    >
      <CameraRig refs={refs} />
      <ParticleField refs={refs} quality={quality} />
      <ChaosArtifacts refs={refs} quality={quality} />
      <OrbitScribbles refs={refs} quality={quality} />
      <TunnelRibbons refs={refs} />
      <FounderCore refs={refs} />
      <StatsProbe refs={refs} quality={quality} />
    </Canvas>
  );
}

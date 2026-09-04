"use client";

/**
 * JourneyWorld — the single persistent WebGL world of the POC.
 *
 * One canvas, one camera, a handful of draw calls. The camera path, like
 * every object in the world, is a pure function of the scrubbed master
 * progress ref — scroll position fully determines the frame, so the
 * whole journey is reversible by construction.
 *
 * Scenes 4–6 extend the same world: the star material assembles into the
 * ecosystem galaxy around the founder's light, the galaxy hosts product
 * exploration, then loosens and its retained material gathers into the
 * Prospra brain. No second context, no cut.
 *
 * Loaded via dynamic import (ssr: false) from JourneyExperience —
 * never in first-load JS.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { loadMotionEngine } from "@/components/home/motion/gsap-setup";
import type { Product } from "@/lib/ecosystem/schema";

import {
  SCENE,
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
import { EcosystemGalaxy } from "./EcosystemGalaxy";
import { ParticleBrain } from "./ParticleBrain";

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
    const r = seg(p, SCENE.tunnelEnd, 100);
    const stacked = refs.stacked.current;

    /* Scene 4: drift toward the galaxy (left); Scene 5: a slow push in;
       Scene 6: swing toward the brain (right) as the ecosystem recedes */
    const eco = smooth(seg(p, SCENE.ecoStart + 2, SCENE.ecoStart + 24));
    const explore = smooth(seg(p, SCENE.exploreStart, SCENE.exploreStart + 26));
    const prospra = smooth(seg(p, SCENE.exploreEnd, SCENE.departEnd + 6));
    /* Scene 7: return to the centered presentation plane for the product
       proof; Scene 8: an intimate push for the belief cards;
       Scene 9: pull back wide — the resolved ecosystem above the close */
    const proof = smooth(seg(p, SCENE.proofStart, SCENE.proofTraceDone));
    const belief = smooth(seg(p, SCENE.beliefStart + 2, 336));
    const finale = smooth(seg(p, SCENE.reformStart, 408));

    /* dolly: push toward the vortex, hold through the tunnel, ease back
       into the spacious reveal, then breathe with the new chapters */
    const zIn = lerp(9.6, 6.6, smooth(seg(c, 0.3, 0.85)));
    const zOut = lerp(6.6, 7.6, smooth(seg(r, 0, 0.3)));
    let z = p < SCENE.chaosEnd ? zIn : p < SCENE.tunnelEnd ? 6.6 : zOut;
    z = lerp(z, stacked ? 8.2 : 7.05, eco);
    z = lerp(z, stacked ? 7.9 : 6.75, explore);
    z = lerp(z, stacked ? 8.3 : 7.35, prospra);
    z = lerp(z, stacked ? 8.0 : 7.0, proof);
    z = lerp(z, stacked ? 7.8 : 6.85, belief);
    z = lerp(z, stacked ? 8.8 : 8.4, finale);

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

    /* lateral drift: galaxy side during the ecosystem chapters, brain
       side for Prospra, dead center for the proof/belief/finale acts;
       stacked layouts stay centered */
    const ecoX = stacked ? 0 : -0.5;
    const brainX = stacked ? 0 : 0.3;
    const cx = lerp(
      lerp(lerp(0, ecoX, Math.max(eco, explore)), brainX, prospra),
      0,
      proof,
    );
    const cy = stacked ? lerp(0.25, 0.05, prospra) * Math.max(eco, explore) : 0;

    const cam = cameraRef.current;
    cam.position.set(
      sx + d.x * 0.18 + cx,
      sy + d.y * 0.12 + lerp(0.25, 0, smooth(seg(c, 0, 0.3))) + cy,
      z,
    );

    /* gaze: center → down the tunnel → biased toward the planet →
       toward the galaxy heart → toward the brain → centered for the
       proof → lifted toward the reformed ecosystem for the finale */
    const emerge = smooth(seg(p, SCENE.tunnelEnd + 2, 86));
    const tunnelGaze = smooth(seg(t, 0, 0.2)) * (1 - smooth(seg(t, 0.8, 1)));
    const gazeX = lerp(
      lerp(0, 0.75, emerge),
      stacked ? 0 : -0.55,
      Math.max(eco, explore) * (1 - prospra),
    );
    const gazeX2 = lerp(lerp(gazeX, stacked ? 0.1 : 0.5, prospra), 0, proof);
    const gazeY0 = stacked
      ? lerp(0, 0.55, Math.max(eco, explore) * (1 - prospra)) + prospra * 0.35
      : 0;
    const gazeY = lerp(gazeY0, stacked ? 0.85 : 0.55, finale);
    look.set(gazeX2, gazeY, lerp(0, -8, tunnelGaze));
    cam.lookAt(look);

    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

/**
 * ONE CLOCK. R3F's own render loop re-registers its rAF as its first
 * statement, so it always ran at callback position 0 — ahead of GSAP's
 * ticker at position 2, which is where the scrubbed timeline advances and
 * writes `refs.overall.current`. The world therefore painted the PREVIOUS
 * frame's scroll progress while the DOM text layer painted the current
 * one: a permanent one-frame desync between the two halves of the same
 * composition, on every device regardless of GPU speed, and visible while
 * scrolling as the world sliding against the copy sitting on it.
 *
 * Driving `advance()` from a gsap.ticker callback puts the render after
 * the timeline update in the same frame, and removes an entire rAF loop.
 * The canvas stays on R3F's own loop until the ticker is actually
 * attached, so a motion engine that never arrives degrades to today's
 * behaviour rather than to a blank canvas.
 */
function GsapSyncedLoop({
  active,
  onTickerAttached,
}: {
  active: boolean;
  onTickerAttached: (attached: boolean) => void;
}) {
  const advance = useThree((s) => s.advance);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let detach: (() => void) | undefined;

    loadMotionEngine().then(({ gsap }) => {
      if (cancelled) return;
      /* gsap.ticker invokes listeners after its core update, so the
         timeline (and every scrubbed tween) has already written this
         frame's values by the time this runs. */
      const render = () => advance(performance.now());
      gsap.ticker.add(render);
      onTickerAttached(true);
      detach = () => {
        gsap.ticker.remove(render);
        onTickerAttached(false);
      };
    });

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [active, advance, onTickerAttached]);

  return null;
}

export default function JourneyWorld({
  refs,
  quality,
  products,
  onCreated,
  active = true,
}: {
  refs: JourneyRefs;
  quality: QualitySpec;
  products: readonly Product[];
  onCreated: () => void;
  /** False once the sticky stage has left the viewport (the visitor is
   *  reading the footer). The world keeps rendering every frame otherwise —
   *  measured at ~350 draw calls/second with the canvas fully offscreen —
   *  which is pure GPU cost competing with the scroll that carried them
   *  there. Resumes before the stage is back in view (see the observer's
   *  rootMargin), so the buffer is never blank on screen. */
  active?: boolean;
}) {
  const [tickerDriven, setTickerDriven] = useState(false);
  const onTickerAttached = useCallback(
    (attached: boolean) => setTickerDriven(attached),
    [],
  );

  return (
    <Canvas
      dpr={[1, quality.dprMax]}
      camera={{ position: [0, 0, 9.6], fov: 42, near: 0.1, far: 90 }}
      gl={{
        /* MSAA costs bandwidth and tile memory on mobile GPUs and buys
           almost nothing here: the field is additively blended soft points,
           and the phone tier already renders at dpr 1.15 and is upscaled to
           the device's ~3x screen, which resamples edges anyway. */
        antialias: quality.tier !== "low",
        alpha: true,
        powerPreference: "high-performance",
      }}
      /* parked offscreen, or driven by gsap.ticker once attached (see
         GsapSyncedLoop); R3F's own loop only covers the gap before then */
      frameloop={active && !tickerDriven ? "always" : "never"}
      onCreated={onCreated}
      style={{ pointerEvents: "none" }}
    >
      <GsapSyncedLoop active={active} onTickerAttached={onTickerAttached} />
      <CameraRig refs={refs} />
      <ParticleField refs={refs} quality={quality} products={products} />
      <ChaosArtifacts refs={refs} quality={quality} />
      <OrbitScribbles refs={refs} quality={quality} />
      <TunnelRibbons refs={refs} />
      <FounderCore refs={refs} />
      <EcosystemGalaxy refs={refs} products={products} />
      <ParticleBrain refs={refs} quality={quality} />
    </Canvas>
  );
}

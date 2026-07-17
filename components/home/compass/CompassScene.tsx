"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";

import {
  isHighTierDevice,
  loadMotionEngine,
  prefersReducedMotion,
} from "@/components/home/motion/gsap-setup";
import { createCompassFace } from "./compass-face";
import { COMPASS_VERTEX, COMPASS_FRAGMENT } from "./shaders";

/**
 * The hero compass — a raymarched, procedurally-shaded instrument in the
 * brand palette (navy body, cyan needle and blueprint dial, gold destination
 * beam). Single fullscreen pass in ogl, zero assets beyond a one-time canvas
 * dial texture.
 *
 * Cinematic mode: when mounted inside a `[data-hero-track]` scroll track,
 * a ScrollTrigger (from the deferred motion engine) feeds scroll progress
 * into a deterministic choreography — every stage value is a pure function
 * of progress, so scrubbing in either direction is frame-accurate:
 *
 *   0.00–0.35  chaos      needle spins erratically (3+ turns), grid strong
 *   0.35–0.65  lock       decelerates into the heading, overshoot-settle
 *   0.65–0.85  beam fire  gold beam ramps and holds, glow/scale pulse
 *   0.85–1.00  reveal     (copy layer — see HeroReveal; scene holds)
 *
 * Budget rules unchanged from the field it replaced: init deferred past
 * load + idle, adaptive DPR/step quality ladder, rAF paused offscreen or on
 * hidden tabs, reduced motion renders one static locked frame, no WebGL2 →
 * nothing mounts (static CSS gradients remain).
 */

const TILT = -0.72; // rad — bottom edge toward camera: body band shows lower-left like the refs
const ROLL = -0.2; // rad — slight counter-clockwise cant
const LOCKED_HEADING = 0.46; // rad — projects the north blade right + slightly up

/* Three full turns plus an offset so the resting (p=0) needle pose is
 * visibly different from the locked heading. */
const TOTAL_ROT = Math.PI * 2 * 3 + 0.9;

/* Adaptive quality: device heuristics can't spot a weak desktop GPU, so we
 * start mid-ladder, measure real frame times, and step down (or up once)
 * until the scene holds budget. Steps are a uniform, so tier changes cost
 * nothing (no recompiles). */
const TIERS = [
  { dpr: 1.75, steps: 64 },
  { dpr: 1.25, steps: 52 },
  { dpr: 0.95, steps: 40 },
  { dpr: 0.7, steps: 32 },
] as const;

/* ------------------- choreography (pure functions of p) ----------------- */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOutCubic = (v: number) => 1 - Math.pow(1 - v, 3);

/* fraction of the total wind-down completed at progress p */
function rotDone(p: number) {
  if (p < 0.35) {
    const u = p / 0.35;
    /* erratic pace; the wobble term fades out so rotDone(0.35) === 0.62
       exactly and the lock stage picks up without a snap */
    const wobble = (0.05 * Math.sin(u * 9.4) + 0.025 * Math.sin(u * 23)) * (1 - u);
    return 0.62 * (u + wobble);
  }
  if (p < 0.65) {
    const v = (p - 0.35) / 0.3;
    return 0.62 + 0.38 * easeOutCubic(v);
  }
  return 1;
}

/* damped mechanical settle around the lock moment — sweeps a few degrees
 * past the heading and oscillates back */
function settleOsc(p: number) {
  const x = Math.max(0, (p - 0.55) * 5);
  if (x === 0) return 0;
  return 0.2 * Math.exp(-3 * x) * Math.sin(x * 10);
}

export function CompassScene({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let teardown: (() => void) | undefined;

    whenSettled().then(() => {
      if (cancelled || !container.isConnected) return;
      teardown = initCompass(container);
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none overflow-hidden ${className ?? ""}`}
    />
  );
}

/* Wait for window load + an idle slot so shader compile never competes
 * with hydration. Unlike the old field we do NOT wait for first
 * interaction — the compass IS the hero image. */
async function whenSettled() {
  if (typeof document === "undefined") return;
  if (document.readyState !== "complete") {
    await new Promise((resolve) =>
      window.addEventListener("load", resolve, { once: true }),
    );
  }
  await new Promise((resolve) =>
    "requestIdleCallback" in window
      ? requestIdleCallback(() => resolve(undefined), { timeout: 800 })
      : setTimeout(resolve, 120),
  );
}

/* world = Rz(roll) · Rx(tilt), column-major */
function modelMatrix(roll: number, tilt: number, out: Float32Array) {
  const cz = Math.cos(roll);
  const sz = Math.sin(roll);
  const cx = Math.cos(tilt);
  const sx = Math.sin(tilt);
  out[0] = cz;
  out[1] = sz;
  out[2] = 0;
  out[3] = -sz * cx;
  out[4] = cz * cx;
  out[5] = sx;
  out[6] = sz * sx;
  out[7] = -cz * sx;
  out[8] = cx;
}

function transpose3(m: Float32Array, out: Float32Array) {
  out[0] = m[0];
  out[1] = m[3];
  out[2] = m[6];
  out[3] = m[1];
  out[4] = m[4];
  out[5] = m[7];
  out[6] = m[2];
  out[7] = m[5];
  out[8] = m[8];
}

function mulMat3Vec3(m: Float32Array, v: [number, number, number]) {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ] as [number, number, number];
}

function initCompass(container: HTMLDivElement): (() => void) | undefined {
  const reduced = prefersReducedMotion();
  const fine = isHighTierDevice();

  let tier = fine ? 1 : 2;

  let renderer: Renderer;
  try {
    renderer = new Renderer({
      alpha: false,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr),
    });
  } catch {
    return;
  }
  const gl = renderer.gl;
  /* the shader is GLSL ES 3.00 (see shaders.ts for why) — WebGL1 devices
     keep the static CSS hero instead */
  if (!gl || !renderer.isWebgl2) return;

  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  container.appendChild(canvas);

  const faceTexture = new Texture(gl, {
    image: createCompassFace(1024),
    generateMipmaps: true,
  });

  const model = new Float32Array(9);
  const modelT = new Float32Array(9);
  modelMatrix(ROLL, TILT, model);
  transpose3(model, modelT);

  const uniforms = {
    uTime: { value: 12 },
    uRes: { value: [1, 1] as [number, number] },
    uSteps: { value: TIERS[tier].steps },
    uTex: { value: faceTexture },
    uCenter: { value: [0, 0] as [number, number] },
    uRadius: { value: 100 },
    uModel: { value: model },
    uModelT: { value: modelT },
    uNeedle: { value: LOCKED_HEADING },
    uTrail: { value: 0 },
    uBeam: { value: 0 },
    uGrid: { value: 0.6 },
    uGlow: { value: 1 },
    uBeamO: { value: [0, 0, 0] as [number, number, number] },
    uBeamD: { value: [1, 0, 0] as [number, number, number] },
  };

  const program = new Program(gl, {
    vertex: COMPASS_VERTEX,
    fragment: COMPASS_FRAGMENT,
    uniforms,
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  /* tier changes are uniform + buffer-size only — nothing recompiles */
  function applyTier(next: number) {
    tier = next;
    uniforms.uSteps.value = TIERS[tier].steps;
    renderer.dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    layout();
  }

  /* base framing; pose() layers drift + pulse on top of these each frame */
  const frame = { w: 0, h: 0, cx: 0, cy: 0, r: 100, desktop: true };

  function layout() {
    const { width: w, height: h } = container.getBoundingClientRect();
    renderer.setSize(w, h);
    uniforms.uRes.value = [w, h];
    frame.w = w;
    frame.h = h;
    frame.desktop = w >= 1024;
    if (frame.desktop) {
      /* full-bleed cinema: monumental, right of center so the reveal copy
         owns the left half at the end of the sequence */
      frame.cx = w * 0.6;
      frame.cy = h * 0.52;
      frame.r = Math.min(h * 0.42, w * 0.22);
    } else {
      frame.cx = w * 0.5;
      frame.cy = h * 0.56;
      frame.r = Math.min(w * 0.42, h * 0.28);
    }
  }
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(container);

  /* scroll progress: raw from ScrollTrigger, smoothed in the rAF loop.
     Without a track (standalone use) the scene rests in the locked pose. */
  const track = container.closest("[data-hero-track]");
  const prog = { raw: track ? 0 : 1, val: track ? 0 : 1 };
  let st: { kill: () => void } | null = null;
  if (track && !reduced) {
    loadMotionEngine().then(({ ScrollTrigger }) => {
      if (disposed) return;
      st = ScrollTrigger.create({
        trigger: track as Element,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          prog.raw = self.progress;
        },
      });
    });
  }

  const mouseTarget = [0, 0];
  const mouse = [0, 0];

  function pose(t: number, p: number) {
    const chaosAmt = 1 - smooth(0.3, 0.6, p);
    const lockedAmt = 1 - chaosAmt;

    /* body attitude: idle wobble + mouse parallax + a whisper of scroll
       drift for depth (never an orbit) */
    const wobT = Math.sin(t * 0.4) * 0.02 + mouse[1] * 0.05 + p * 0.04;
    const wobR = Math.sin(t * 0.31 + 1.0) * 0.015 + mouse[0] * 0.045;
    modelMatrix(ROLL + wobR, TILT + wobT, model);
    transpose3(model, modelT);

    /* needle: wound up at rest, unwinds through chaos, settles mechanically */
    const rd = rotDone(p);
    const sway =
      (Math.sin(t * 1.1) * 0.05 + Math.sin(t * 2.7) * 0.02) * chaosAmt;
    const tremor = Math.sin(t * 0.8) * 0.012 * lockedAmt;
    const needle =
      LOCKED_HEADING + (1 - rd) * TOTAL_ROT + settleOsc(p) + sway + tremor;
    uniforms.uNeedle.value = needle;

    uniforms.uTrail.value = clamp01(
      3.2 * (1 - Math.min(rd, 1)) + Math.abs(settleOsc(p)) * 3,
    );

    /* blueprint grid: strong while searching, recedes once locked */
    uniforms.uGrid.value = 0.6 - 0.46 * smooth(0.35, 0.62, p);

    /* the payoff: beam ramps 0.66→0.80 and holds, with a breath after */
    const beam = easeOutCubic(smooth(0.66, 0.8, p));
    uniforms.uBeam.value = beam * (1 + 0.04 * Math.sin(t * 2.4) * smooth(0.8, 0.9, p));

    /* glow + scale pulse on fire, relaxing into a lit hold */
    const firePulse =
      0.5 * smooth(0.66, 0.74, p) - 0.3 * smooth(0.8, 0.98, p);
    uniforms.uGlow.value = 1 + 0.06 * Math.sin(t * 1.7) * lockedAmt + firePulse;
    const scalePulse = 1 + 0.04 * smooth(0.66, 0.78, p) - 0.02 * smooth(0.8, 0.98, p);
    uniforms.uRadius.value = frame.r * scalePulse;

    /* camera drift: slides right as the lock lands, ceding the left half
       to the headline */
    const slide = frame.desktop ? frame.w * 0.12 * smooth(0.5, 0.9, p) : 0;
    uniforms.uCenter.value = [
      frame.cx + slide + mouse[0] * 8,
      frame.cy + frame.h * 0.02 * p + mouse[1] * 6,
    ];

    /* beam anchors to the needle tip */
    const c = Math.cos(needle);
    const s = Math.sin(needle);
    uniforms.uBeamO.value = mulMat3Vec3(model, [c * 0.68, s * 0.68, 0.1]);
    const len = Math.hypot(c, s, 0.1);
    uniforms.uBeamD.value = mulMat3Vec3(model, [c / len, s / len, 0.1 / len]);
  }

  function renderFrame() {
    renderer.render({ scene: mesh });
  }

  let disposed = false;

  /* ---- Reduced motion: one static locked frame, no loop ---- */
  if (reduced) {
    pose(12, 1);
    renderFrame();
    return () => {
      disposed = true;
      ro.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }

  /* ---------------------- animated path --------------------- */
  let raf = 0;
  let running = false;
  let last = performance.now();
  let elapsed = 3;
  let contextLost = false;

  /* quality ladder state */
  let frames = 0;
  let accum = 0;
  let downs = 0;
  let ups = 0;

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    elapsed += Math.min(dt, 0.05);

    /* measure real frame cost (12-frame warmup absorbs compile hitches) */
    frames++;
    if (frames > 12) accum += dt;
    /* emergency brake: a catastrophic frame drops a tier immediately */
    if (frames > 2 && dt > 0.15 && tier < TIERS.length - 1 && downs < 2) {
      downs++;
      applyTier(tier + 1);
      frames = 0;
      accum = 0;
    }
    if (frames === 42) {
      const avg = accum / 30;
      if (avg > 0.024 && tier < TIERS.length - 1 && downs < 2) {
        downs++;
        applyTier(tier + 1);
        frames = 0;
        accum = 0;
      } else if (avg < 0.009 && tier > 0 && ups < 1 && downs === 0) {
        ups++;
        applyTier(tier - 1);
        frames = 0;
        accum = 0;
      }
    }

    mouse[0] += (mouseTarget[0] - mouse[0]) * 0.05;
    mouse[1] += (mouseTarget[1] - mouse[1]) * 0.05;
    prog.val += (prog.raw - prog.val) * Math.min(1, dt * 9);

    uniforms.uTime.value = elapsed;
    pose(elapsed, prog.val);
    renderFrame();
  }

  function start() {
    if (running || contextLost) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }

  let inView = false;
  const io = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView && !document.hidden) start();
      else stop();
    },
    { rootMargin: "80px" },
  );
  io.observe(container);

  const onVisibility = () => {
    if (document.hidden) stop();
    else if (inView) start();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    mouseTarget[0] = event.clientX / window.innerWidth - 0.5;
    mouseTarget[1] = 0.5 - event.clientY / window.innerHeight;
  };
  if (fine) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
  }

  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    stop();
    canvas.style.display = "none";
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  /* Dev-only escape hatch: drive frames synchronously (rAF is suspended in
   * hidden/headless panes) and capture downscaled JPEG stills. */
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as Record<string, unknown>).__compassDebug = {
      setProgress: (p: number) => {
        prog.raw = p;
        prog.val = p;
      },
      setTier: (i: number) => applyTier(i),
      tier: () => tier,
      relayout: () => layout(),
      frame: (t: number) => {
        uniforms.uTime.value = t;
        pose(t, prog.val);
        renderFrame();
      },
      time: (n: number) => {
        const t0 = performance.now();
        for (let i = 0; i < n; i++) {
          uniforms.uTime.value = 12 + i * 0.016;
          pose(12 + i * 0.016, prog.val);
          renderFrame();
        }
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        return (performance.now() - t0) / n;
      },
      shot: (t: number, width = 900, quality = 0.8) => {
        uniforms.uTime.value = t;
        pose(t, prog.val);
        renderFrame();
        const scale = width / canvas.width;
        const out = document.createElement("canvas");
        out.width = Math.round(canvas.width * scale);
        out.height = Math.round(canvas.height * scale);
        const ctx = out.getContext("2d")!;
        ctx.drawImage(canvas, 0, 0, out.width, out.height);
        return out.toDataURL("image/jpeg", quality);
      },
    };
  }

  return () => {
    disposed = true;
    delete (window as unknown as Record<string, unknown>).__compassDebug;
    stop();
    io.disconnect();
    ro.disconnect();
    st?.kill();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  };
}

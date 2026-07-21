"use client";

import { useEffect, useRef } from "react";
import { Geometry, Mesh, Program, Renderer, Transform, Triangle } from "ogl";

import {
  loadMotionEngine,
  isHighTierDevice,
  prefersReducedMotion,
  type MotionEngine,
} from "@/components/home/motion/gsap-setup";

/**
 * The "leverage field" — a procedural WebGL scene in the existing brand
 * palette. A domain-warped flow of brand blue and orange currents over deep
 * navy (the old animated gradient reborn as a living, scroll-reactive field)
 * plus a sparse particle drift rising up and to the right.
 *
 * variant="hero": full flow field + particles, mouse parallax, dissolves as
 *   the user scrolls out of the hero.
 * variant="close": particles only — a quiet closing echo behind the final CTA.
 *
 * Budget & fallbacks: procedural only (no assets), DPR capped, octave count
 * reduced on touch devices, rAF paused when offscreen or the tab is hidden.
 * Reduced motion renders a single static frame. No WebGL → nothing mounts
 * and the static CSS gradients behind remain.
 */

const FLOW_FRAGMENT = (octaves: number) => `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uScroll;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(in vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < ${octaves}; i++) {
    v += a * noise(p);
    p = rot * p * 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);

  float t = uTime * 0.055 + uScroll * 0.6;
  p.y -= uScroll * 0.85;
  vec2 m = uMouse * 0.18;

  vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t * 0.7 + 4.7));
  vec2 r = vec2(
    fbm(p * 1.9 + q * 1.6 + m + t * 0.55),
    fbm(p * 1.9 + q * 1.6 - t * 0.35 + 8.3)
  );
  float f = fbm(p * 1.6 + r * 1.8);

  vec3 navy   = vec3(0.031, 0.082, 0.153); /* #081527 */
  vec3 blue   = vec3(0.310, 0.486, 0.655); /* #4f7ca7 */
  vec3 orange = vec3(0.824, 0.478, 0.173); /* #d27a2c */
  vec3 cyan   = vec3(0.0, 0.831, 1.0);     /* #00d4ff */

  vec3 col = navy;
  col = mix(col, blue, smoothstep(0.32, 0.92, f) * 0.50);
  col = mix(col, orange, smoothstep(0.50, 0.94, r.y * f) * 0.30);
  col += cyan * pow(clamp(q.x * f, 0.0, 1.0), 6.0) * 0.34;

  /* keep edges calm */
  float vig = smoothstep(1.35, 0.35, length(p));
  col = mix(navy, col, vig);

  /* darken behind the headline block for text contrast */
  float protect = smoothstep(0.95, 0.15, distance(uv, vec2(0.30, 0.52)));
  col = mix(col, navy, protect * 0.45);

  /* dither to prevent banding on the dark gradient */
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.016;

  float alpha = 1.0 - smoothstep(0.30, 0.92, uScroll);
  gl_FragColor = vec4(col, alpha);
}
`;

const PARTICLE_VERTEX = `
attribute vec2 aBase;
attribute float aSeed;
uniform float uTime;
uniform float uScroll;
uniform float uFade;
uniform float uDpr;
varying float vAlpha;
varying vec3 vColor;

void main() {
  float speed = 0.02 + aSeed * 0.03;
  float t = uTime * speed * (1.0 + uScroll * 1.2);

  vec2 pos = aBase;
  pos.x = mod(pos.x + t * 0.9 + aSeed * 3.7 + 1.2, 2.4) - 1.2;
  pos.y = mod(pos.y + t * 0.55 + aSeed * 7.3 + 1.1, 2.2) - 1.1;
  pos.y += sin(uTime * (0.3 + aSeed * 0.6) + aSeed * 40.0) * 0.012;

  float tw = 0.55 + 0.45 * sin(uTime * (0.7 + aSeed * 1.8) + aSeed * 21.0);
  vAlpha = (0.25 + 0.75 * fract(aSeed * 91.7)) * tw * uFade * (1.0 - uScroll);

  float cs = fract(aSeed * 13.7);
  if (cs > 0.90) {
    vColor = vec3(0.0, 0.831, 1.0);
  } else if (cs > 0.80) {
    vColor = vec3(0.824, 0.478, 0.173);
  } else {
    vColor = vec3(0.62, 0.74, 0.88);
  }

  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = (1.4 + aSeed * 2.6) * uDpr;
}
`;

const PARTICLE_FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying float vAlpha;
varying vec3 vColor;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.06, length(c)) * vAlpha;
  gl_FragColor = vec4(vColor, a * 0.55);
}
`;

type HeroFieldProps = {
  variant?: "hero" | "close";
  className?: string;
};

export function HeroField({ variant = "hero", className }: HeroFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let teardown: (() => void) | undefined;

    // WebGL spins up with the deferred motion engine — after load + idle —
    // so shader compilation stays off the hydration critical path.
    loadMotionEngine().then((engine) => {
      if (cancelled || !container.isConnected) return;
      teardown = initField(engine, container, variant);
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [variant]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none overflow-hidden ${className ?? ""}`}
    />
  );
}

function initField(
  { ScrollTrigger }: MotionEngine,
  container: HTMLDivElement,
  variant: "hero" | "close",
): (() => void) | undefined {
    const reduced = prefersReducedMotion();
    const fine = isHighTierDevice();

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
        dpr: Math.min(window.devicePixelRatio || 1, fine ? 1.75 : 1.25),
      });
    } catch {
      return;
    }
    const gl = renderer.gl;
    if (!gl) return;

    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const scene = new Transform();
    const isHero = variant === "hero";

    const flowUniforms = {
      uTime: { value: 0 },
      uRes: { value: [1, 1] },
      uMouse: { value: [0, 0] },
      uScroll: { value: 0 },
    };

    if (isHero) {
      const flowProgram = new Program(gl, {
        vertex: `
          attribute vec2 position;
          attribute vec2 uv;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position, 0.0, 1.0);
          }
        `,
        fragment: FLOW_FRAGMENT(fine ? 4 : 3),
        uniforms: flowUniforms,
        transparent: true,
      });
      const flowMesh = new Mesh(gl, {
        geometry: new Triangle(gl),
        program: flowProgram,
      });
      flowMesh.setParent(scene);
    }

    const particleCount = isHero ? (fine ? 200 : 80) : fine ? 90 : 45;
    const base = new Float32Array(particleCount * 2);
    const seed = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      base[i * 2] = Math.random() * 2.4 - 1.2;
      base[i * 2 + 1] = Math.random() * 2.2 - 1.1;
      seed[i] = Math.random();
    }
    const particleUniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uFade: { value: isHero ? 1 : 0 },
      uDpr: { value: renderer.dpr },
    };
    const particleProgram = new Program(gl, {
      vertex: PARTICLE_VERTEX,
      fragment: PARTICLE_FRAGMENT,
      uniforms: particleUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    particleProgram.setBlendFunc(gl.SRC_ALPHA, gl.ONE);
    const particles = new Mesh(gl, {
      geometry: new Geometry(gl, {
        aBase: { size: 2, data: base },
        aSeed: { size: 1, data: seed },
      }),
      program: particleProgram,
      mode: gl.POINTS,
    });
    particles.setParent(scene);

    function resize() {
      if (!container) return;
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(width, height);
      flowUniforms.uRes.value = [width, height];
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    function renderFrame() {
      renderer.render({ scene });
    }

    // ------- Reduced motion: one static frame, no loop, no listeners -------
    if (reduced) {
      flowUniforms.uTime.value = 12;
      particleUniforms.uTime.value = 12;
      particleUniforms.uFade.value = isHero ? 1 : 0.5;
      renderFrame();
      return () => {
        ro.disconnect();
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.remove();
      };
    }

    // ------------------------- Animated path ------------------------------
    let raf = 0;
    let running = false;
    let last = performance.now();
    let elapsed = Math.random() * 20;
    let contextLost = false;

    const mouseTarget = [0, 0];
    const mouse = [0, 0];

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;

      mouse[0] += (mouseTarget[0] - mouse[0]) * 0.05;
      mouse[1] += (mouseTarget[1] - mouse[1]) * 0.05;

      flowUniforms.uTime.value = elapsed;
      flowUniforms.uMouse.value = mouse;
      particleUniforms.uTime.value = elapsed;

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

    // Pause when offscreen and when the tab is hidden.
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

    // Mouse parallax (hero, fine pointers only).
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      mouseTarget[0] = event.clientX / window.innerWidth - 0.5;
      mouseTarget[1] = 0.5 - event.clientY / window.innerHeight;
    };
    if (isHero && fine) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
    }

    // Scroll scrub: hero dissolves on exit; close fades in/out across travel.
    const section = container.closest("section") ?? container.parentElement;
    const st = section
      ? ScrollTrigger.create({
          trigger: section,
          start: isHero ? "top top" : "top bottom",
          end: "bottom top",
          scrub: true,
          onUpdate: (self) => {
            if (isHero) {
              flowUniforms.uScroll.value = self.progress;
              particleUniforms.uScroll.value = self.progress;
            } else {
              const p = self.progress;
              const inRamp = Math.min(p / 0.3, 1);
              const outRamp = 1 - Math.max((p - 0.7) / 0.3, 0);
              particleUniforms.uFade.value = Math.min(inRamp, outRamp);
            }
          },
        })
      : null;

    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      stop();
      canvas.style.display = "none";
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    return () => {
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

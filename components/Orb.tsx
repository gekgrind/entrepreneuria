"use client";

import { Mesh, Program, Renderer, Triangle, Vec3 } from "ogl";
import { useEffect, useRef } from "react";

interface OrbProps {
  backgroundColor?: string;
}

export default function Orb({
  backgroundColor = "#00D4FF",
}: OrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const vert = `
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const frag = `
    precision highp float;

    uniform float iTime;
    uniform vec3 iResolution;
    uniform vec3 backgroundColor;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv * 2.0 - 1.0;
      uv.x *= iResolution.x / iResolution.y;

      float dist = length(uv);

      float glow = smoothstep(1.1, 0.15, dist);
      float core = smoothstep(0.45, 0.0, dist);

      float pulse = 0.08 * sin(iTime * 1.2) + 0.92;

      float alpha = glow * 0.75 + core * 0.35;
      alpha *= pulse;
      alpha = clamp(alpha, 0.0, 1.0);

      vec3 color = backgroundColor * (0.85 + core * 0.45);

      gl_FragColor = vec4(color, alpha);
    }
  `;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const renderer = new Renderer({
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    gl.canvas.style.display = "block";
    gl.canvas.style.position = "absolute";
    gl.canvas.style.inset = "0";

    el.appendChild(gl.canvas);

    const geometry = new Triangle(gl);

    const program = new Program(gl, {
      vertex: vert,
      fragment: frag,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Vec3(1, 1, 1) },
        backgroundColor: { value: hexToVec3(backgroundColor) },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
        const rect = el!.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        renderer.setSize(
            Math.max(1, Math.floor(rect.width * dpr)),
            Math.max(1, Math.floor(rect.height * dpr))
        );

        program.uniforms.iResolution.value.set(
            gl.canvas.width,
            gl.canvas.height,
            1
        );
    }

    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const update = (t: number) => {
      raf = requestAnimationFrame(update);
      program.uniforms.iTime.value = t * 0.001;
      renderer.render({ scene: mesh });
    };

    raf = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);

      if (gl.canvas.parentNode === el) {
        el.removeChild(gl.canvas);
      }
    };
  }, [backgroundColor]);

  return <div ref={containerRef} className="orb-container" aria-hidden="true" />;
}

function hexToVec3(hex: string) {
  const normalized = hex.trim();

  if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
    return new Vec3(0, 212 / 255, 1);
  }

  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;

  return new Vec3(r, g, b);
}
"use client";

import { useEffect, useRef } from "react";

const WORD = "ENTREPRENEURIA";

/** rear → front. The front layer is the brand cyan; the echoes get lighter/softer. */
const LAYERS = [
  { color: "184, 242, 255", alpha: 0.22, offset: -1, dot: 0.78, drift: 0.34 },
  { color: "111, 228, 255", alpha: 0.45, offset: -0.5, dot: 0.88, drift: 0.24 },
  { color: "0, 212, 255", alpha: 1, offset: 0, dot: 1, drift: 0.16 },
] as const;

/**
 * Oversized particle ENTREPRENEURIA signature at the very bottom of the footer.
 * Canvas 2D: letterforms are sampled from rendered text, then every dot is a
 * spring anchored to its home pixel and pushed by a soft radial cursor field.
 */
export default function FooterWordmark() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;
    let visible = true;
    let disposed = false;

    // particle state (flat typed arrays; layer l owns [l*count, (l+1)*count))
    let count = 0;
    let hx = new Float32Array(0);
    let hy = new Float32Array(0);
    let px = new Float32Array(0);
    let py = new Float32Array(0);
    let vx = new Float32Array(0);
    let vy = new Float32Array(0);
    let phase = new Float32Array(0);
    let dot = 2;
    let radius = 90;
    let width = 0;
    let height = 0;

    const pointer = { x: -9999, y: -9999, active: false };

    const fontFamily = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-body")
        .trim();
      return v ? `${v}, sans-serif` : "sans-serif";
    };

    function build() {
      const rect = canvas!.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // fit the word to the full width
      const family = fontFamily();
      const probe = 100;
      ctx!.font = `800 ${probe}px ${family}`;
      const measured = ctx!.measureText(WORD).width || 1;
      let size = (width / measured) * probe;

      const capRatio = 0.72;
      const stack = 1.42; // cap height + the two echo offsets
      // keep all three stacked layers inside the reserved box
      const needed = size * capRatio * stack + 6;
      if (needed > height) size *= height / needed;

      const cap = size * capRatio;
      const sep = cap * 0.42;
      const step = Math.max(2, Math.min(7, size / 26));
      dot = Math.max(1.3, step * 0.58);
      radius = Math.max(56, size * 0.7);

      // sample the letterforms off-screen at CSS resolution
      const off = document.createElement("canvas");
      off.width = width;
      off.height = Math.ceil(cap) + 4;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      octx.font = `800 ${size}px ${family}`;
      octx.textAlign = "center";
      octx.textBaseline = "alphabetic";
      octx.fillStyle = "#fff";
      octx.fillText(WORD, width / 2, cap + 1);

      const data = octx.getImageData(0, 0, off.width, off.height).data;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let y = 0; y < off.height; y += step) {
        const row = Math.floor(y) * off.width;
        for (let x = 0; x < width; x += step) {
          if (data[(row + Math.floor(x)) * 4 + 3] > 128) {
            xs.push(x);
            ys.push(y);
          }
        }
      }

      // bottom layer sits on the box baseline, echoes stack upward
      const baseTop = height - off.height - 2;
      count = xs.length;
      const total = count * LAYERS.length;
      hx = new Float32Array(total);
      hy = new Float32Array(total);
      px = new Float32Array(total);
      py = new Float32Array(total);
      vx = new Float32Array(total);
      vy = new Float32Array(total);
      phase = new Float32Array(total);

      for (let l = 0; l < LAYERS.length; l++) {
        const dy = baseTop + LAYERS[l].offset * sep;
        for (let i = 0; i < count; i++) {
          const k = l * count + i;
          hx[k] = xs[i];
          hy[k] = ys[i] + dy;
          px[k] = hx[k];
          py[k] = hy[k];
          phase[k] = (i * 12.9898 + l * 78.233) % 6.283;
        }
      }
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, width, height);
      const shimmer = reduced.matches ? 0 : 1;

      for (let l = 0; l < LAYERS.length; l++) {
        const layer = LAYERS[l];
        ctx!.fillStyle = `rgba(${layer.color}, ${layer.alpha})`;
        ctx!.beginPath();
        const base = l * count;
        const size = Math.max(1, dot * layer.dot);
        for (let i = 0; i < count; i++) {
          const k = base + i;
          const ph = phase[k];
          const wob = shimmer * layer.drift;
          const ox = Math.sin(t * 0.00042 + ph) * wob;
          const oy = Math.cos(t * 0.00031 + ph * 1.7) * wob;
          ctx!.rect(px[k] + ox - size / 2, py[k] + oy - size / 2, size, size);
        }
        ctx!.fill();
      }
    }

    function physics() {
      const r2 = radius * radius;
      const mx = pointer.x;
      const my = pointer.y;
      const on = pointer.active;

      for (let k = 0; k < px.length; k++) {
        let ax = (hx[k] - px[k]) * 0.055;
        let ay = (hy[k] - py[k]) * 0.055;

        if (on) {
          const dx = px[k] - mx;
          const dy = py[k] - my;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2) {
            const d = Math.sqrt(d2) || 0.0001;
            // soft radial falloff — strongest at the cursor, zero at the rim
            const f = (1 - d / radius) ** 2 * 3;
            ax += (dx / d) * f;
            ay += (dy / d) * f;
          }
        }

        vx[k] = (vx[k] + ax) * 0.86;
        vy[k] = (vy[k] + ay) * 0.86;
        px[k] += vx[k];
        py[k] += vy[k];
      }
    }

    function loop(t: number) {
      if (disposed) return;
      physics();
      draw(t);
      frame = requestAnimationFrame(loop);
    }

    function start() {
      if (disposed || frame) return;
      frame = requestAnimationFrame(loop);
    }

    function stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    function restart() {
      stop();
      build();
      if (reduced.matches) draw(0);
      else if (visible) start();
    }

    const onPointerMove = (e: PointerEvent) => {
      // mouse only — touch devices keep the resting composition
      if (e.pointerType !== "mouse" || reduced.matches) return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active =
        pointer.x > -radius &&
        pointer.x < width + radius &&
        pointer.y > -radius &&
        pointer.y < height + radius;
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    let lastWidth = 0;
    const ro = new ResizeObserver(() => {
      const w = Math.round(canvas.getBoundingClientRect().width);
      if (w === lastWidth) return;
      lastWidth = w;
      restart();
    });

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (reduced.matches) return;
        if (visible) start();
        else stop();
      },
      { rootMargin: "120px" },
    );

    const onMotionChange = () => restart();

    restart();
    void document.fonts?.ready.then(() => {
      if (!disposed) restart();
    });

    ro.observe(canvas);
    io.observe(wrap);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);
    reduced.addEventListener("change", onMotionChange);

    return () => {
      disposed = true;
      stop();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      reduced.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="pointer-events-none relative w-full select-none px-2 pb-5 sm:px-4"
    >
      <canvas
        ref={canvasRef}
        className="block h-auto w-full"
        style={{ aspectRatio: "7.4 / 1" }}
      />
    </div>
  );
}

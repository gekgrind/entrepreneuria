"use client";

import { useEffect, useRef } from "react";

/**
 * Site-wide custom cursor for the marketing shell — a cyan core dot with a
 * trailing ring. The ring eases behind the pointer; over interactive
 * elements it morphs (grows, brightens) and is magnetically pulled toward
 * the center of small targets like buttons and links. Over text fields the
 * custom cursor fades out and the native caret cursor returns (usability
 * beats theater there).
 *
 * Mounted only for fine pointers without prefers-reduced-motion; the
 * `custom-cursor` class on <html> gates the `cursor: none` rules in
 * globals.css, so touch devices and reduced-motion users never lose the
 * native cursor.
 */

const INTERACTIVE_SELECTOR =
  "a, button, [role='button'], label, select, summary, [data-cursor='interactive']";
const TEXT_SELECTOR = "input, textarea, [contenteditable='true']";
/* only pull toward compact targets — snapping to a card's center feels wrong */
const MAGNET_MAX_W = 240;
const MAGNET_MAX_H = 120;
const MAGNET_PULL = 0.34;

type Mode = "default" | "hover" | "text";

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /* any-pointer, not pointer: hybrid Windows touchscreens report a coarse
       primary pointer but still have a mouse. Visibility is further gated to
       pointerType === "mouse" events, so touch never shows the cursor. */
    const finePointer =
      window.matchMedia("(pointer: fine)").matches ||
      window.matchMedia("(any-pointer: fine)").matches;
    const force =
      process.env.NODE_ENV !== "production" &&
      window.location.search.includes("cursor=force");
    if (
      !force &&
      (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !finePointer)
    ) {
      return;
    }
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.documentElement.classList.add("custom-cursor");

    const mouse = { x: -100, y: -100 };
    const dotPos = { x: -100, y: -100 };
    const ringPos = { x: -100, y: -100 };
    let mode: Mode = "default";
    let magnetEl: Element | null = null;
    let visible = false;
    let pressed = false;
    let raf = 0;
    let running = false;
    let last = performance.now();

    const applyMode = () => {
      const hidden = !visible || mode === "text";
      dot.style.opacity = hidden ? "0" : "1";
      ring.style.opacity = hidden ? "0" : "1";
      if (mode === "hover") {
        ring.style.width = "56px";
        ring.style.height = "56px";
        ring.style.borderColor = "rgba(0, 212, 255, 0.8)";
        ring.style.backgroundColor = "rgba(0, 212, 255, 0.08)";
        dot.style.width = "4px";
        dot.style.height = "4px";
      } else {
        ring.style.width = "36px";
        ring.style.height = "36px";
        ring.style.borderColor = "rgba(0, 212, 255, 0.45)";
        ring.style.backgroundColor = "transparent";
        dot.style.width = "6px";
        dot.style.height = "6px";
      }
    };

    function update(dt: number) {
      /* magnetic pull: ring gravitates toward the hovered control's center */
      let tx = mouse.x;
      let ty = mouse.y;
      if (mode === "hover" && magnetEl && magnetEl.isConnected) {
        const r = (magnetEl as HTMLElement).getBoundingClientRect();
        if (r.width < MAGNET_MAX_W && r.height < MAGNET_MAX_H) {
          tx += (r.left + r.width / 2 - mouse.x) * MAGNET_PULL;
          ty += (r.top + r.height / 2 - mouse.y) * MAGNET_PULL;
        }
      }

      const kDot = 1 - Math.exp(-dt * 34);
      const kRing = 1 - Math.exp(-dt * 13);
      dotPos.x += (mouse.x - dotPos.x) * kDot;
      dotPos.y += (mouse.y - dotPos.y) * kDot;
      ringPos.x += (tx - ringPos.x) * kRing;
      ringPos.y += (ty - ringPos.y) * kRing;

      const scale = pressed ? 0.88 : 1;
      dot!.style.transform = `translate3d(${dotPos.x}px, ${dotPos.y}px, 0) translate(-50%, -50%)`;
      ring!.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) translate(-50%, -50%) scale(${scale})`;
    }

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      update(dt);
    }
    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!visible) {
        visible = true;
        /* first appearance: snap into place instead of flying in */
        dotPos.x = ringPos.x = mouse.x;
        dotPos.y = ringPos.y = mouse.y;
        applyMode();
      }
      const el = e.target instanceof Element ? e.target : null;
      const nextMode: Mode = el?.closest(TEXT_SELECTOR)
        ? "text"
        : el?.closest(INTERACTIVE_SELECTOR)
          ? "hover"
          : "default";
      const nextMagnet =
        nextMode === "hover" ? el!.closest(INTERACTIVE_SELECTOR) : null;
      if (nextMode !== mode || nextMagnet !== magnetEl) {
        mode = nextMode;
        magnetEl = nextMagnet;
        applyMode();
      }
      start();
    };
    const onPointerDown = () => {
      pressed = true;
    };
    const onPointerUp = () => {
      pressed = false;
    };
    const onLeaveDoc = () => {
      visible = false;
      applyMode();
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeaveDoc);
    document.addEventListener("visibilitychange", onVisibility);

    applyMode();

    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__cursorDebug = {
        step: (frames = 1) => {
          for (let i = 0; i < frames; i++) update(1 / 60);
        },
        state: () => ({ mode, visible, pressed, ring: { ...ringPos } }),
      };
    }

    return () => {
      stop();
      delete (window as unknown as Record<string, unknown>).__cursorDebug;
      document.documentElement.classList.remove("custom-cursor");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.documentElement.removeEventListener("mouseleave", onLeaveDoc);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[120]">
      <div
        ref={ringRef}
        className="absolute left-0 top-0 rounded-full border opacity-0 transition-[width,height,background-color,border-color,opacity] duration-300 ease-out"
        style={{ width: 36, height: 36, borderColor: "rgba(0,212,255,0.45)" }}
      />
      <div
        ref={dotRef}
        className="absolute left-0 top-0 rounded-full bg-[#00d4ff] opacity-0 shadow-[0_0_10px_rgba(0,212,255,0.65)] transition-[width,height,opacity] duration-200"
        style={{ width: 6, height: 6 }}
      />
    </div>
  );
}

"use client";

import { useEffect } from "react";

/** Maximum travel of the constellation, in px, at the edge of the viewport. */
const RANGE = 18;
/** Per-frame approach toward the target. Lower = longer, softer drift. */
const EASE = 0.075;
/** Below this, the remaining travel is invisible — park and stop the loop. */
const EPSILON = 0.05;

/**
 * Pointer parallax for the constellation stage.
 *
 * Renders nothing and touches nothing but two custom properties, which
 * feed a transform-only rule — no layout, no paint, no layout shift.
 *
 * The easing is done here rather than with a CSS transition on purpose:
 * a transition on a `transform` built from unregistered custom
 * properties does not interpolate, and the effect ends up frozen at its
 * starting value. Lerping in the rAF loop sidesteps that entirely and
 * needs no @property support.
 *
 * The loop is not continuous: it starts on pointer movement and parks
 * itself once the stage has caught up, so an idle page costs nothing.
 * Coarse pointers (every phone and tablet) and reduced-motion users
 * never attach a listener at all.
 */
export function AuthParallax() {
  useEffect(() => {
    const stage = document.querySelector<HTMLElement>("[data-auth-parallax]");
    if (!stage) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(pointer: fine)");

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let frame = 0;
    let attached = false;

    /** One easing step toward the target. Returns true if still moving. */
    function advance() {
      const dx = targetX - currentX;
      const dy = targetY - currentY;

      if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
        currentX = targetX;
        currentY = targetY;
        write();
        return false;
      }

      currentX += dx * EASE;
      currentY += dy * EASE;
      write();
      return true;
    }

    function step() {
      frame = advance() ? window.requestAnimationFrame(step) : 0;
    }

    function write() {
      stage?.style.setProperty("--auth-px", `${currentX.toFixed(2)}px`);
      stage?.style.setProperty("--auth-py", `${currentY.toFixed(2)}px`);
    }

    function onPointerMove(event: PointerEvent) {
      targetX = (event.clientX / window.innerWidth - 0.5) * -2 * RANGE;
      targetY = (event.clientY / window.innerHeight - 0.5) * -2 * RANGE;

      /* Ease on the move event itself, not only inside the frame loop:
         pointermove already fires at display rate while the cursor is
         travelling, so the motion is smooth on its own and the effect
         never depends on rAF being serviced. The loop below exists only
         to carry the stage the rest of the way after the pointer stops. */
      advance();
      if (!frame) frame = window.requestAnimationFrame(step);
    }

    function sync() {
      const allowed = fine.matches && !reduced.matches;

      if (allowed && !attached) {
        window.addEventListener("pointermove", onPointerMove, {
          passive: true,
        });
        attached = true;
        return;
      }

      if (!allowed && attached) {
        window.removeEventListener("pointermove", onPointerMove);
        attached = false;
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        stage?.style.removeProperty("--auth-px");
        stage?.style.removeProperty("--auth-py");
      }
    }

    sync();
    reduced.addEventListener("change", sync);
    fine.addEventListener("change", sync);

    return () => {
      reduced.removeEventListener("change", sync);
      fine.removeEventListener("change", sync);
      if (attached) window.removeEventListener("pointermove", onPointerMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}

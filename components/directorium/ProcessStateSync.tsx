"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * ProcessStateSync — the minimal client island behind the process
 * sequence. It does not animate anything: it observes which step sits
 * in the reading band and writes that step's chamber state onto the
 * sticky chamber (`data-state` / `data-core`) plus an `data-active`
 * marker on the step. The chamber's CSS does the rest.
 *
 * Native scroll only — no pinning, no scroll hijacking. Without JS the
 * server-rendered chamber shows its complete (verdict) composition and
 * every step reads at full strength. Reduced motion keeps the same state
 * logic; the chamber's opacity transitions are disabled in CSS.
 */
export function ProcessStateSync({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const steps = Array.from(
      root.querySelectorAll<HTMLElement>("[data-process-step]"),
    );
    const chamber = root.querySelector<HTMLElement>(
      "[data-process-chamber] [data-chamber]",
    );
    const caption = root.querySelector<HTMLElement>("[data-process-caption]");
    if (!steps.length || !chamber) return;

    const activate = (step: HTMLElement) => {
      steps.forEach((s) => s.toggleAttribute("data-active", s === step));
      chamber.dataset.state = step.dataset.state ?? "verdict";
      chamber.dataset.core = step.dataset.core ?? "lit";
      if (caption && step.dataset.caption) {
        caption.textContent = step.dataset.caption;
      }
      // Phase 2: the motion orchestrator (DirectoriumMotion) listens and
      // plays the chamber timeline to this step. Without it, the CSS
      // state above is the whole experience.
      root.dispatchEvent(
        new CustomEvent("directorium:process-step", {
          detail: { index: steps.indexOf(step), state: chamber.dataset.state },
        }),
      );
    };

    root.dataset.enhanced = "true";
    activate(steps[0]);

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) activate(hit.target as HTMLElement);
      },
      // a narrow reading band just above the middle of the viewport
      { rootMargin: "-40% 0px -50% 0px" },
    );
    steps.forEach((s) => observer.observe(s));

    return () => {
      observer.disconnect();
      delete root.dataset.enhanced;
    };
  }, []);

  return (
    <div ref={ref} className={className} data-dm="process">
      {children}
    </div>
  );
}

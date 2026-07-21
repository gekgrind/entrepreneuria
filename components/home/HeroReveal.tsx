"use client";

import { useEffect, useRef } from "react";

import {
  loadMotionEngine,
  prefersReducedMotion,
} from "@/components/home/motion/gsap-setup";

/**
 * The payoff copy — "Find your true north." — absolutely positioned over
 * the cinematic hero, transparent until the gold beam has fired.
 *
 * Timing contract: the compass beam ramps over progress 0.66–0.80 of the
 * `[data-hero-track]` scroll track (see CompassScene). This layer's timeline
 * scrubs the same track and starts the headline at 0.82 — right as the beam
 * finishes firing — so the copy reads as a consequence of the lock, not a
 * timer. Both are driven by the same scroll position, which keeps them in
 * sync at any scrub speed, in either direction.
 *
 * Paint rules: the copy ships in the DOM (crawlable, readable by SR) but
 * visually hidden via CSS; reduced-motion users get it visible immediately.
 */
export function HeroReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    if (prefersReducedMotion()) {
      root.style.opacity = "1";
      return;
    }

    const track = root.closest("[data-hero-track]");
    if (!track) {
      root.style.opacity = "1";
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    Promise.all([loadMotionEngine(), document.fonts.ready]).then(
      ([{ gsap, SplitText }]) => {
        if (cancelled || !root.isConnected) return;

        const heading = root.querySelector("h1");
        const sub = root.querySelector("p");
        if (!heading || !sub) return;

        let split: InstanceType<typeof SplitText> | null = null;
        try {
          split = new SplitText(heading, {
            type: "lines",
            mask: "lines",
            linesClass: "split-line",
          });
        } catch {
          /* fall back to whole-heading tween below */
        }

        const lines: Element[] = split?.lines?.length ? split.lines : [heading];

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: track as Element,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.35,
          },
        });

        /* timeline positions are fractions of the track (duration = 1) */
        tl.set(root, { autoAlpha: 1 }, 0.82);
        tl.fromTo(
          lines,
          { yPercent: 118 },
          { yPercent: 0, duration: 0.1, stagger: 0.025, ease: "power3.out" },
          0.82,
        );
        tl.fromTo(
          sub,
          { autoAlpha: 0, y: 26 },
          { autoAlpha: 1, y: 0, duration: 0.09, ease: "power2.out" },
          0.885,
        );
        /* pad the timeline to exactly the track length */
        tl.to({}, { duration: 0.001 }, 0.999);

        cleanup = () => {
          tl.scrollTrigger?.kill();
          tl.kill();
          split?.revert();
        };
      },
    );

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 z-10 opacity-0"
    >
      <div className="mx-auto flex h-full w-full max-w-7xl items-end justify-center px-6 pb-32 sm:px-10 lg:items-center lg:justify-start lg:pb-0">
        <div className="max-w-xl text-center lg:text-left">
          <h1 className="text-balance text-5xl font-medium leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Find your <em className="italic">true north</em>.
          </h1>
          <p className="mt-8 text-lg leading-8 text-white/70 sm:text-xl sm:leading-9">
            The AI-powered OS built for founders navigating it alone.
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * JourneyExperience — the client island of the /journey-preview POC.
 *
 * Progressive enhancement: the server-rendered narrative (children) is
 * the complete experience with zero JS. When the gates pass (no reduced
 * motion, kill switch off, WebGL available), this island hides the
 * narrative and mounts the 500vh sticky stage: one persistent WebGL
 * world behind accessible DOM text layers, all driven by one scrubbed
 * GSAP timeline.
 */
import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { CONSTELLATION_MODE } from "@/lib/constellation";
import {
  loadMotionEngine,
  prefersReducedMotion,
} from "@/components/home/motion/gsap-setup";
import { SmoothScroll } from "@/components/home/motion/SmoothScroll";
import { PrimaryCtaLink } from "@/components/home/scenes/shared";

import { buildJourneyTimeline } from "./JourneyTimeline";
import { DevHud } from "./DevHud";
import {
  QUALITY,
  createJourneyRefs,
  detectQuality,
  type QualityTier,
} from "./journey-math";

const JourneyWorld = dynamic(() => import("./world/JourneyWorld"), {
  ssr: false,
});

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
  } catch {
    return false;
  }
}

export function JourneyExperience({
  children,
  cta,
}: {
  children: ReactNode;
  cta: { label: string; href: string };
}) {
  const [enhanced, setEnhanced] = useState(false);
  const [tier, setTier] = useState<QualityTier | null>(null);
  const [worldReady, setWorldReady] = useState(false);
  const refs = useMemo(() => createJourneyRefs(), []);
  const stageRef = useRef<HTMLElement>(null);

  /* enhancement gates — fail any and the static narrative remains */
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (CONSTELLATION_MODE === "static") return;
    if (!webglAvailable()) return;
    setTier(detectQuality());
    setEnhanced(true);
  }, []);

  /* master scrubbed timeline (GSAP engine arrives deferred) */
  useEffect(() => {
    const stage = stageRef.current;
    if (!enhanced || !stage) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const engine = await loadMotionEngine();
      await document.fonts.ready;
      if (cancelled) return;
      cleanup = buildJourneyTimeline(engine, stage, refs);
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [enhanced, refs]);

  /* pointer parallax — fine pointers only, never on touch */
  useEffect(() => {
    if (!enhanced || !window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      refs.pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      refs.pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enhanced, refs]);

  return (
    <div data-journey-wrapper data-enhanced={enhanced || undefined}>
      {/* scoped styles — keeps the POC fully isolated from globals.css */}
      <style>{`
        [data-journey-stage] .preserve-3d,
        [data-journey-stage] .preserve-3d * {
          transform-style: preserve-3d;
        }
      `}</style>

      {/* the server narrative is the whole experience until the gates
          pass; then the enhanced stage replaces it entirely */}
      {!enhanced && children}

      {enhanced && tier && (
        <>
          <SmoothScroll />
          <section
            ref={stageRef}
            data-journey-stage
            aria-label="A cinematic journey from chaos to clarity"
            className="relative text-white"
            style={{ height: "500vh", backgroundColor: "#081527" }}
          >
            <div
              className="preserve-3d sticky top-0 h-screen overflow-hidden"
              style={{ perspective: "1200px" }}
            >
              {/* the one persistent world */}
              <div
                aria-hidden="true"
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  worldReady ? "opacity-100" : "opacity-0"
                }`}
              >
                <JourneyWorld
                  refs={refs}
                  quality={QUALITY[tier]}
                  onCreated={() => setWorldReady(true)}
                />
              </div>

              {/* Scene 1 — hero copy (DOM truth, recedes early) */}
              <div data-j-hero className="absolute inset-0 flex items-center">
                <div className="mx-auto w-full max-w-6xl px-6 pt-[calc(var(--header-height)+20px)] sm:px-10 lg:px-16">
                  <p className="type-kicker mb-5 text-white/60">
                    Entrepreneuria — Everything Entrepreneur
                  </p>
                  <h1 className="type-display-xl max-w-[12ch]">
                    No founder should have to build{" "}
                    <em className="text-white/90">alone</em>.
                  </h1>
                  <p className="type-lede mt-8 max-w-xl text-white/70">
                    An ecosystem of AI-powered mentorship, strategy, and tools
                    that surrounds one person with everything a business needs.
                  </p>
                  <div className="mt-12 flex flex-wrap items-center gap-3">
                    <PrimaryCtaLink label={cta.label} href={cta.href} />
                  </div>
                  <p className="type-label mt-14 text-white/35">
                    Scroll — this is what building alone feels like
                  </p>
                </div>
              </div>

              {/* Scene 1 — interior questions at different depths */}
              <p
                data-j-q1
                className="type-kinetic-interior absolute left-[8%] top-[22%] max-w-[16ch] text-white/55 opacity-0"
              >
                Is this even worth building?
              </p>
              <p
                data-j-q2
                className="type-kinetic-interior absolute right-[6%] top-[44%] max-w-[16ch] text-right text-white/55 opacity-0"
              >
                Am I pricing this right?
              </p>
              <p
                data-j-q3
                className="type-kinetic-interior absolute left-[14%] top-[64%] max-w-[16ch] text-white/55 opacity-0"
              >
                What do I actually do next?
              </p>

              {/* Scene 3 — the turn (left of the planet) */}
              <div className="absolute left-[6%] top-1/2 max-w-xl -translate-y-1/2 sm:left-[8%]">
                <p
                  data-j-turn-kicker
                  className="type-kicker mb-5 text-white/60 opacity-0"
                >
                  The turn
                </p>
                <h2
                  data-j-turn-primary
                  className="type-display-md preserve-3d opacity-0"
                >
                  The best founders were never{" "}
                  <em className="text-white/90">alone</em>. Now neither are
                  you.
                </h2>
                <p
                  data-j-turn-support
                  className="type-lede preserve-3d mt-8 max-w-lg text-white/70 opacity-0"
                >
                  Behind nearly every great entrepreneur was someone to call.
                  Entrepreneuria makes that someone — and that something —
                  available to anyone building a business of their own.
                </p>
              </div>

              <DevHud />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

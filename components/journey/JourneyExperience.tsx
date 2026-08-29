"use client";

/**
 * JourneyExperience — the client island of the /journey-preview POC.
 *
 * Progressive enhancement: the server-rendered narrative (children) is
 * the complete experience with zero JS. When the gates pass (no reduced
 * motion, kill switch off, WebGL available), this island hides the
 * narrative and mounts the 1100vh sticky stage: one persistent WebGL
 * world behind accessible DOM text layers, all driven by one scrubbed
 * GSAP timeline.
 *
 * Scenes 4–6 continue the same world: the star material organizes into
 * the ecosystem around the founder's light (Scene 4), products are
 * explored inside the living galaxy (Scene 5), and the departing galaxy's
 * retained material gathers into the Prospra brain (Scene 6).
 *
 * Scene 5 interaction: the galaxy nodes project onto real DOM hotspot
 * buttons every frame (keyboard/touch accessible, no canvas raycasting);
 * the product cards remain the semantic truth and carry the real links.
 */
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { CONSTELLATION_MODE } from "@/lib/constellation";
import type { Product } from "@/lib/ecosystem/schema";
import { computeOrbits } from "@/lib/ecosystem/orbits";
import {
  loadMotionEngine,
  prefersReducedMotion,
} from "@/components/home/motion/gsap-setup";
import { SmoothScroll } from "@/components/home/motion/SmoothScroll";
import { Badge, PrimaryCtaLink, StatusChip } from "@/components/home/scenes/shared";

import { buildJourneyTimeline, cardWindowFor } from "./JourneyTimeline";
import { DevHud } from "./DevHud";
import {
  QUALITY,
  TIMELINE_UNITS,
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

/** Exploration order: the peripheral products first, the flagship last —
 *  Scene 5 ends on Prospra so the galaxy can hand off to the brain. */
function getExplorationOrder(products: readonly Product[]): Product[] {
  const flagship = products.filter((p) => p.badge === "FLAGSHIP");
  const rest = products
    .filter((p) => p.badge !== "FLAGSHIP")
    .sort(
      (a, b) =>
        a.orbitalTier - b.orbitalTier || a.name.localeCompare(b.name),
    );
  return [...rest, ...flagship];
}

export function JourneyExperience({
  children,
  cta,
  products,
}: {
  children: ReactNode;
  cta: { label: string; href: string };
  products: readonly Product[];
}) {
  const [enhanced, setEnhanced] = useState(false);
  const [tier, setTier] = useState<QualityTier | null>(null);
  const [worldReady, setWorldReady] = useState(false);
  const [hoverSlug, setHoverSlug] = useState<string | null>(null);
  /* shared mutable channels — read/written at 60fps, never React state */
  const overall = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const activeProduct = useRef<string | null>(null);
  const hoverProduct = useRef<string | null>(null);
  const stacked = useRef(false);
  const nodeButtons = useRef<Array<HTMLElement | null>>([]);
  const refs = useMemo(
    () => ({ overall, pointer, activeProduct, hoverProduct, stacked, nodeButtons }),
    [overall, pointer, activeProduct, hoverProduct, stacked, nodeButtons],
  );
  const stageRef = useRef<HTMLElement>(null);

  const bySlug = useMemo(
    () => new Map(products.map((p) => [p.slug, p])),
    [products],
  );
  const flagship = useMemo(
    () => products.find((p) => p.badge === "FLAGSHIP") ?? products[0],
    [products],
  );
  const exploreProducts = useMemo(() => getExplorationOrder(products), [products]);
  const exploreSlugs = useMemo(
    () => exploreProducts.map((p) => p.slug),
    [exploreProducts],
  );
  /* hotspot buttons must match the galaxy node order (orbit layout) */
  const galaxyOrder = useMemo(
    () => computeOrbits(products).map((n) => n.slug),
    [products],
  );

  const setHover = (slug: string | null) => {
    hoverProduct.current = slug;
    setHoverSlug(slug);
  };

  /* clicking / activating a node hotspot scrolls its card into the
     reading plane of the scrubbed journey */
  const scrollToProduct = (slug: string) => {
    const stage = stageRef.current;
    const i = exploreSlugs.indexOf(slug);
    if (!stage || i < 0) return;
    const max = stage.offsetHeight - window.innerHeight;
    const stageTop = stage.getBoundingClientRect().top + window.scrollY;
    const units = cardWindowFor(i).enter + 5.5;
    window.scrollTo({
      top: stageTop + max * (units / TIMELINE_UNITS),
      behavior: "smooth",
    });
  };

  /* enhancement gates — fail any and the static narrative remains */
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (CONSTELLATION_MODE === "static") return;
    if (!webglAvailable()) return;
    const q = detectQuality();
    stacked.current = q === "low";
    setTier(q);
    setEnhanced(true);
  }, [stacked]);

  /* stacked composition follows viewport changes */
  useEffect(() => {
    if (!enhanced) return;
    const update = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      stacked.current =
        window.innerWidth < 768 || (coarse && window.innerWidth < 1024);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [enhanced, stacked]);

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
      cleanup = buildJourneyTimeline(engine, stage, refs, exploreSlugs);
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [enhanced, refs, exploreSlugs]);

  /* pointer parallax — fine pointers only, never on touch */
  useEffect(() => {
    if (!enhanced || !window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enhanced, pointer]);

  return (
    <div data-journey-wrapper data-enhanced={enhanced || undefined}>
      {/* scoped styles — keeps the POC fully isolated from globals.css */}
      <style>{`
        [data-journey-stage] .preserve-3d,
        [data-journey-stage] .preserve-3d * {
          transform-style: preserve-3d;
        }
        [data-j-card][data-active] {
          border-color: rgba(0, 212, 255, 0.45);
          box-shadow: 0 0 32px rgba(0, 212, 255, 0.12);
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
            style={{ height: "1100vh", backgroundColor: "#081527" }}
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
                  products={products}
                  onCreated={() => setWorldReady(true)}
                />
              </div>

              {/* Scene 1 — hero copy (DOM truth, recedes early) */}
              <div data-j-hero className="pointer-events-none absolute inset-0 flex items-center">
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
                  <div className="pointer-events-auto mt-12 flex flex-wrap items-center gap-3">
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
              <div className="pointer-events-none absolute left-[6%] top-1/2 max-w-xl -translate-y-1/2 sm:left-[8%]">
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

              {/* Scene 4 — the ecosystem forms (copy right, galaxy left) */}
              <div className="pointer-events-none absolute inset-x-6 bottom-[13vh] sm:inset-x-auto sm:bottom-auto sm:right-[6%] sm:top-[27%] sm:max-w-xl lg:right-[8%]">
                <p
                  data-j-eco-kicker
                  className="type-kicker mb-5 text-white/60 opacity-0"
                >
                  The ecosystem
                </p>
                <h2
                  data-j-eco-heading
                  className="type-display-md preserve-3d opacity-0"
                >
                  Everything Entrepreneur.
                </h2>
                <p
                  data-j-eco-lede
                  className="type-lede preserve-3d mt-8 max-w-lg text-white/70 opacity-0"
                >
                  Each light is a different kind of intelligence, built for a
                  different part of the journey. Together, they&apos;re a
                  system.
                </p>
              </div>

              {/* Scene 5 — product exploration. The cards are the semantic
                  truth; each cycles through the reading plane on scroll. */}
              <div className="pointer-events-none absolute inset-0">
                {exploreProducts.map((p) => (
                  <div
                    key={p.slug}
                    className="absolute inset-x-4 bottom-[5.5vh] sm:inset-x-8 md:bottom-auto md:left-auto md:right-[5.5%] md:top-[22%] md:w-[400px]"
                  >
                    <article
                      data-j-card={p.slug}
                      data-active={hoverSlug === p.slug || undefined}
                      className="pointer-events-auto rounded-2xl border border-white/10 bg-void-800/80 p-6 opacity-0 shadow-[0_18px_60px_rgba(2,6,18,0.55)] backdrop-blur-md"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        {p.logo ? (
                          <Image
                            src={p.logo}
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-md object-cover"
                          />
                        ) : null}
                        <h3 className="type-display-xs">{p.name}</h3>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-intelligence [font-family:var(--font-label)]">
                          {p.role}
                        </span>
                        {p.badge ? <Badge>{p.badge}</Badge> : null}
                        <span className="ml-auto">
                          <StatusChip status={p.status} />
                        </span>
                      </div>
                      <p className="mt-3 leading-7 text-white/70">{p.tagline}</p>
                      <p className="mt-4">
                        {p.link.kind === "internal" ? (
                          <a
                            href={p.link.href}
                            className="text-sm font-medium text-white/85 underline decoration-intelligence/40 underline-offset-4 transition hover:text-intelligence"
                          >
                            Learn more
                          </a>
                        ) : (
                          <a
                            href={p.link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-white/85 underline decoration-intelligence/40 underline-offset-4 transition hover:text-intelligence"
                          >
                            Visit {p.name}
                          </a>
                        )}
                      </p>
                    </article>
                  </div>
                ))}
              </div>

              {/* Scene 5 — galaxy node hotspots: real buttons projected
                  from the world every frame (keyboard + touch accessible) */}
              <div
                className="absolute inset-0"
                role="group"
                aria-label="Constellation product hotspots"
              >
                {galaxyOrder.map((slug, i) => {
                  const prod = bySlug.get(slug);
                  if (!prod) return null;
                  return (
                    <button
                      key={slug}
                      ref={(el) => {
                        nodeButtons.current[i] = el;
                      }}
                      type="button"
                      tabIndex={-1}
                      aria-label={`Explore ${prod.name}`}
                      onMouseEnter={() => setHover(slug)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(slug)}
                      onBlur={() => setHover(null)}
                      onClick={() => scrollToProduct(slug)}
                      className="absolute left-0 top-0 h-12 w-12 rounded-full opacity-0 outline-none focus:shadow-[0_0_0_3px_rgba(0,212,255,0.55)]"
                      style={{ pointerEvents: "none" }}
                    />
                  );
                })}
              </div>

              {/* Scene 6 — meet Prospra (copy left, particle brain right) */}
              <div className="pointer-events-none absolute inset-x-6 bottom-[7vh] max-w-xl sm:inset-x-auto sm:bottom-auto sm:left-[8%] sm:top-1/2 sm:-translate-y-1/2">
                <p
                  data-j-pro-kicker
                  className="type-kicker mb-5 text-white/60 opacity-0"
                >
                  The flagship
                </p>
                <h2
                  data-j-pro-heading
                  className="type-display-md preserve-3d opacity-0"
                >
                  Meet {flagship.name}. The mentor in your corner.
                </h2>
                <p
                  data-j-pro-lede
                  className="type-lede preserve-3d mt-8 max-w-lg text-white/70 opacity-0"
                >
                  Bring a real decision — pricing your first offer, planning a
                  launch week, deciding what to do next — and work it through
                  with a mentor that knows your business and answers at 2 a.m.
                </p>
                <ul className="mt-8 flex flex-col gap-3 text-white/80">
                  {[
                    "Works your actual business, not generic advice",
                    "Remembers your context across sessions",
                    "Built by a founder who needed it first",
                  ].map((line, i) => (
                    <li
                      key={line}
                      data-j-pro-bullet={i}
                      className="flex gap-3 opacity-0"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-intelligence"
                      />
                      {line}
                    </li>
                  ))}
                </ul>
                <div
                  data-j-pro-cta
                  className="pointer-events-auto mt-10 inline-block opacity-0"
                >
                  <PrimaryCtaLink label={cta.label} href={cta.href} />
                </div>
              </div>

              <DevHud />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

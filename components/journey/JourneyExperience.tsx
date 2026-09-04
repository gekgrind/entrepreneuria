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
 * Scenes 7–9 complete the journey in the SAME world: the brain streams
 * onto the proof-frame perimeter as real product screenshots rise
 * through it (Scene 7), evidence becomes conviction on glass value
 * cards that disintegrate into the persistent material (Scene 8), and
 * the released particles reform the ecosystem — resolved — above the
 * closing statement and CTA (Scene 9).
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
  type CSSProperties,
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
import { scrollLenisTo } from "@/components/transition/lenis-handle";
import {
  Badge,
  GhostLink,
  PrimaryCtaLink,
  StatusChip,
} from "@/components/home/scenes/shared";

import { buildJourneyTimeline, cardWindowFor } from "./JourneyTimeline";
import { PROOF_CARDS, PROOF_SIZES } from "./proof-cards";
import { BELIEF_CARDS } from "./belief-cards";
import {
  QUALITY,
  TIMELINE_UNITS,
  VH_PER_UNIT,
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

/** Deterministic shard positions along a card's border (Scene 8
 *  disintegration — the luminous edge breaking into points). No
 *  Math.random at render: same layout every mount. */
function shardPositions(
  seed: number,
  count: number,
): CSSProperties[] {
  const rand = (n: number) => {
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return Array.from({ length: count }, (_, i) => {
    const edge = i % 4;
    const t = rand(i) * 100;
    if (edge === 0) return { left: `${t}%`, top: -2 };
    if (edge === 1) return { left: `${t}%`, bottom: -2 };
    if (edge === 2) return { top: `${t}%`, left: -2 };
    return { top: `${t}%`, right: -2 };
  });
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
  /* false once the stage is offscreen — parks the WebGL render loop */
  const [worldActive, setWorldActive] = useState(true);
  const [hoverSlug, setHoverSlug] = useState<string | null>(null);
  /* scroll-driven active product — mirrored from the timeline so the
     card ↔ node relationship is visible in the DOM, not just the world */
  const [scrollSlug, setScrollSlug] = useState<string | null>(null);
  /* shared mutable channels — read/written at 60fps, never React state */
  const overall = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const activeProduct = useRef<string | null>(null);
  const hoverProduct = useRef<string | null>(null);
  const stacked = useRef(false);
  const nodeButtons = useRef<Array<HTMLElement | null>>([]);
  const nodeLabels = useRef<Array<HTMLElement | null>>([]);
  const refs = useMemo(
    () => ({ overall, pointer, activeProduct, hoverProduct, stacked, nodeButtons, nodeLabels }),
    [overall, pointer, activeProduct, hoverProduct, stacked, nodeButtons, nodeLabels],
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
     reading plane of the scrubbed journey — through Lenis when it owns
     the page's motion, so the glide and the scrubbed world stay in sync */
  const scrollToProduct = (slug: string) => {
    const stage = stageRef.current;
    const i = exploreSlugs.indexOf(slug);
    if (!stage || i < 0) return;
    const max = stage.offsetHeight - window.innerHeight;
    const stageTop = stage.getBoundingClientRect().top + window.scrollY;
    const units = cardWindowFor(i).enter + 5.5;
    const top = stageTop + max * (units / TIMELINE_UNITS);
    if (!scrollLenisTo(top)) {
      window.scrollTo({ top, behavior: "smooth" });
    }
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
      cleanup = buildJourneyTimeline(engine, stage, refs, exploreSlugs, setScrollSlug);
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [enhanced, refs, exploreSlugs]);

  /* The world renders every frame for as long as it is mounted. Once the
     stage has scrolled past (the visitor is reading the footer) that work
     is invisible, so the render loop parks until the stage approaches
     again. The margin is the resume runway — it must stay under the
     smallest real clearance so the park actually happens: at the page
     bottom the stage sits 307px above the viewport on a 390x844 phone and
     224px on a 430x932 one. Desktop footers are shorter than the viewport,
     so there the stage is still on screen at the bottom and the world
     correctly keeps rendering. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!enhanced || !stage) return;
    const observer = new IntersectionObserver(
      ([entry]) => setWorldActive(entry.isIntersecting),
      { rootMargin: "150px 0px" },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, [enhanced]);

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
        /* Scene 4/5 — product identifiers: restrained instrument labels
           projected from the world. Quiet at rest, fully lit for the
           current product; positioned radially outside their node so
           they never sit over a connection line. */
        [data-j-nodelabel] {
          font-family: var(--font-label);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          white-space: nowrap;
          color: rgba(214, 236, 255, 0.9);
          /* the label owns its own negative space: a dark, barely-there
             plate keeps the product name legible while the constellation
             animates behind it, without reading as a UI chip */
          padding: 3px 9px;
          border-radius: 9999px;
          background: rgba(4, 10, 22, 0.62);
          box-shadow: 0 0 0 1px rgba(140, 200, 240, 0.08);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
          opacity: 0;
          transition: opacity 0.6s ease, color 0.35s ease,
            background-color 0.35s ease, box-shadow 0.35s ease;
          will-change: transform;
        }
        [data-j-nodelabel][data-on="true"] {
          opacity: 0.9;
        }
        [data-j-nodelabel][data-on="true"][data-active] {
          opacity: 1;
          color: #ffffff;
          background: rgba(6, 20, 38, 0.78);
          box-shadow: 0 0 0 1px rgba(0, 212, 255, 0.42),
            0 0 22px rgba(0, 212, 255, 0.16);
        }
        /* Scene 8 — the belief glass: dark, restrained, dimensional.
           --focus (0..1, scrubbed) is the cyan attention state. */
        [data-j-bsurface] {
          background: linear-gradient(158deg, rgba(13, 32, 56, 0.66), rgba(4, 8, 16, 0.82));
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-color: color-mix(
            in srgb,
            #00d4ff calc(var(--focus, 0) * 38% + 9%),
            rgba(255, 255, 255, 0.1)
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            inset 0 0 28px rgba(0, 212, 255, calc(var(--focus, 0) * 0.05)),
            0 34px 90px -28px rgba(2, 6, 18, 0.9),
            0 0 calc(var(--focus, 0) * 64px) rgba(0, 212, 255, calc(var(--focus, 0) * 0.16));
        }
        [data-j-bshard] {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 9999px;
          background: #00d4ff;
          box-shadow: 0 0 8px rgba(0, 212, 255, 0.85);
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
            style={{
              height: `${TIMELINE_UNITS * VH_PER_UNIT}vh`,
              backgroundColor: "#081527",
            }}
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
                  active={worldActive}
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
                      data-active={
                        hoverSlug === p.slug || scrollSlug === p.slug || undefined
                      }
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
                      className="absolute left-0 top-0 h-12 w-12 cursor-pointer rounded-full opacity-0 outline-none transition-shadow duration-300 hover:shadow-[0_0_0_2px_rgba(0,212,255,0.4)] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.55)]"
                      style={{ pointerEvents: "none" }}
                    />
                  );
                })}
              </div>

              {/* Scene 4/5 — product identifiers: restrained labels
                  projected from the world every frame alongside the
                  hotspots (aria-hidden — the buttons carry the
                  semantics). Quiet at rest; the current product's
                  identifier lights fully. */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                {galaxyOrder.map((slug, i) => {
                  const prod = bySlug.get(slug);
                  if (!prod) return null;
                  return (
                    <span
                      key={`label-${slug}`}
                      ref={(el) => {
                        nodeLabels.current[i] = el;
                      }}
                      data-j-nodelabel
                      data-active={
                        hoverSlug === slug || scrollSlug === slug || undefined
                      }
                      className="absolute left-0 top-0"
                    >
                      {prod.name}
                    </span>
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

              {/* Scene 7 — PROOF: why the visitor is seeing the product.
                  Brief, then it gets out of the way of the evidence. */}
              <div className="pointer-events-none absolute inset-x-6 top-[12%] max-w-md sm:left-[8%] sm:right-auto sm:top-[15%]">
                <p
                  data-j-proof-kicker
                  className="type-kicker mb-5 text-white/60 opacity-0"
                >
                  The proof
                </p>
                <p
                  data-j-proof-line
                  className="type-lede text-white/75 opacity-0"
                >
                  Not a pitch. Not a mockup. The real product.
                </p>
              </div>

              {/* Scene 7 — the screenshot stack: real product UI rising
                  through the particle trace, stacking as evidence. Cards
                  are inert figures — scroll owns every state. */}
              <div className="pointer-events-none absolute inset-0">
                {PROOF_CARDS.map((card, i) => (
                  <figure
                    key={card.key}
                    data-j-shot={i}
                    className="absolute left-1/2 top-[47%] w-[min(92vw,880px)] overflow-hidden rounded-2xl border border-white/10 bg-[#04070d]/95 opacity-0 shadow-[0_40px_120px_-24px_rgba(0,0,0,0.85)] sm:w-[min(58vw,980px)]"
                  >
                    <figcaption className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-3">
                      {card.logo ? (
                        <Image
                          src={card.logo}
                          alt=""
                          width={24}
                          height={24}
                          className="h-6 w-6 rounded-md object-cover"
                        />
                      ) : null}
                      <span className="type-display-xs">{card.name}</span>
                      <span className="text-[11px] uppercase tracking-[0.2em] text-intelligence [font-family:var(--font-label)]">
                        {card.role}
                      </span>
                      <span className="ml-auto">
                        {card.status ? <StatusChip status={card.status} /> : null}
                      </span>
                    </figcaption>
                    {/* top-edge catchlight — same artifact-frame language
                        as ProductShot */}
                    <div className="relative">
                      <div
                        aria-hidden="true"
                        className="absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      />
                      <img
                        src={card.src}
                        srcSet={card.srcSet}
                        sizes={PROOF_SIZES}
                        alt={card.alt}
                        width={card.width}
                        height={card.height}
                        decoding="async"
                        className="h-auto w-full object-contain"
                      />
                    </div>
                    <p className="type-caption border-t border-white/[0.06] px-5 py-2.5 text-white/45">
                      {card.caption}
                    </p>
                  </figure>
                ))}
              </div>

              {/* Scene 8 — BELIEF: the value cards. Glass that belongs to
                  the cinematic universe; the focused card carries the
                  cyan emphasis. */}
              <div className="pointer-events-none absolute inset-x-0 top-[11%] flex justify-center">
                <p
                  data-j-bel-kicker
                  className="type-kicker text-white/60 opacity-0"
                >
                  Why it matters
                </p>
              </div>
              <div className="pointer-events-none absolute inset-0">
                {BELIEF_CARDS.map((c, i) => (
                  <article
                    key={c.index}
                    data-j-bcard={i}
                    className="absolute left-1/2 top-1/2 w-[min(90vw,440px)] opacity-0"
                  >
                    <div
                      data-j-bsurface={i}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-2xl"
                    />
                    <div className="relative p-8 sm:p-10">
                      <span className="type-label text-intelligence/80">
                        {c.index}
                      </span>
                      <h3 data-j-btitle={i} className="type-display-sm mt-4">
                        {c.title}
                      </h3>
                      <p
                        data-j-bbody={i}
                        className="mt-4 leading-7 text-white/70"
                      >
                        {c.body}
                      </p>
                    </div>
                    {shardPositions(i + 1, 14).map((pos, s) => (
                      <span
                        key={s}
                        data-j-bshard
                        aria-hidden="true"
                        style={pos}
                      />
                    ))}
                  </article>
                ))}
              </div>

              {/* Scene 9 — RESOLUTION: the reformed ecosystem hangs above;
                  the statement lands, then the CTA. Canonical SceneClose
                  copy; launch-state drives the primary action. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-[7vh] flex flex-col items-center px-6 text-center">
                <p
                  data-j-fin-kicker
                  className="type-kicker mb-5 text-white/60 opacity-0"
                >
                  Begin
                </p>
                <h2
                  data-j-fin-h2
                  className="type-display-lg max-w-[16ch] opacity-0"
                >
                  You&apos;ve carried this far enough{" "}
                  <em className="text-white/90">alone</em>.
                </h2>
                <p
                  data-j-fin-lede
                  className="type-lede mt-7 max-w-xl text-white/70 opacity-0"
                >
                  Begin with {flagship.name}. The rest of the ecosystem
                  lights up as it ships.
                </p>
                <div
                  data-j-fin-cta
                  className="pointer-events-auto mt-10 flex flex-wrap items-center justify-center gap-3 opacity-0"
                >
                  <PrimaryCtaLink label={cta.label} href={cta.href} />
                  <GhostLink href="#ecosystem">Explore the ecosystem</GhostLink>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

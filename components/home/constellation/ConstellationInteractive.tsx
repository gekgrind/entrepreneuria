"use client";

/**
 * ConstellationInteractive — lifecycle wrapper for the R3F layer.
 *
 * Mounts the interactive scene ONLY when every condition holds:
 *   - NEXT_PUBLIC_CONSTELLATION_MODE !== "static"   (kill switch)
 *   - no prefers-reduced-motion
 *   - desktop-class device (fine pointer or ≥1024px) — mobile keeps the
 *     choreographed static constellation until Stage 10's mini-map
 *   - WebGL available
 *   - the stage is near the viewport (IntersectionObserver)
 *
 * Once created, the canvas stays mounted; the render loop SUSPENDS when
 * the stage leaves the viewport and resumes on re-entry. Scene state is
 * a pure function of scroll progress, so re-entry is always consistent.
 *
 * The whole overlay is aria-hidden: the adjacent semantic product list
 * remains the DOM truth for keyboard and screen-reader users.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { CONSTELLATION_MODE } from "@/lib/constellation";
import {
  loadMotionEngine,
  prefersReducedMotion,
  isHighTierDevice,
} from "@/components/home/motion/gsap-setup";
import { PRODUCT_STATUS_LABELS } from "@/lib/ecosystem/products";
import type { Product } from "@/lib/ecosystem/schema";

const ConstellationScene = dynamic(() => import("./ConstellationScene"), {
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

function DetailPanel({
  product,
}: {
  product: Product | null;
}) {
  if (!product) return null;
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl border border-white/10 bg-void-800/85 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="type-display-xs">{product.name}</span>
        <span className="type-label text-intelligence">{product.role}</span>
        <span className="type-caption ml-auto text-white/50">
          {PRODUCT_STATUS_LABELS[product.status]}
        </span>
      </div>
      <p className="type-caption mt-1.5 text-white/65">{product.tagline}</p>
    </div>
  );
}

export function ConstellationInteractive({
  products,
}: {
  products: readonly Product[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const dolly = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    if (CONSTELLATION_MODE === "static") return;
    if (prefersReducedMotion() || !isHighTierDevice() || !webglAvailable())
      return;
    const host = hostRef.current;
    const stage = host?.closest("[data-constellation-stage]");
    if (!host || !stage) return;

    /* mount near viewport; suspend (render loop) when far outside */
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          setActive(true);
        } else {
          setActive(false);
        }
      },
      { rootMargin: "240px" },
    );
    io.observe(stage);

    /* scroll progress — the single source of truth for scene state */
    let dead = false;
    const triggers: Array<{ kill: () => void }> = [];
    loadMotionEngine().then(({ ScrollTrigger }) => {
      if (dead) return;
      triggers.push(
        ScrollTrigger.create({
          trigger: "#ecosystem",
          start: "top 78%",
          end: "center 42%",
          onUpdate: (self) => {
            progress.current = self.progress;
          },
        }),
        ScrollTrigger.create({
          trigger: "#ecosystem",
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            dolly.current = self.progress;
          },
        }),
      );
    });

    return () => {
      dead = true;
      io.disconnect();
      triggers.forEach((t) => t.kill());
    };
  }, []);

  const showScene = mounted;
  const activeProduct =
    products.find((p) => p.slug === activeSlug) ??
    products.find((p) => p.badge === "FLAGSHIP") ??
    null;

  return (
    <div ref={hostRef} aria-hidden="true" className="absolute inset-0">
      {showScene ? (
        <>
          <ConstellationScene
            products={products}
            progress={progress}
            dolly={dolly}
            active={active}
            onReady={() => {
              hostRef.current
                ?.closest("[data-constellation-stage]")
                ?.setAttribute("data-interactive-ready", "true");
            }}
            onActiveProduct={setActiveSlug}
          />
          <DetailPanel product={activeProduct} />
        </>
      ) : null}
    </div>
  );
}

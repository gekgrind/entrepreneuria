import Image from "next/image";
import { PRODUCTS } from "@/lib/ecosystem/products";
import { ConstellationStatic } from "@/components/home/ConstellationStatic";
import { ConstellationMiniMap } from "@/components/home/ConstellationMiniMap";
import { ConstellationInteractive } from "@/components/home/constellation/ConstellationInteractive";
import { Kicker, StatusChip, Badge } from "./shared";

/**
 * SCENE 3 — "The Constellation" (signature scene)
 * The ecosystem made visible. STATIC BASELINE: registry-generated SVG +
 * a fully semantic product list. The interactive R3F layer (Stage 7)
 * progressively enhances this exact content; the list remains the DOM
 * truth for keyboard, screen readers, and no-WebGL devices.
 */
export function SceneConstellation() {
  return (
    <section
      id="ecosystem"
      aria-labelledby="ecosystem-heading"
      className="relative scroll-mt-24 px-6 py-32 sm:px-10 sm:py-44 lg:px-16"
    >
      <div className="mx-auto max-w-6xl">
        <div data-ignite className="mx-auto max-w-3xl text-center">
          <Kicker>The ecosystem</Kicker>
          <h2
            id="ecosystem-heading"
            className="type-display-lg"
          >
            Everything Entrepreneur.
          </h2>
          <p className="type-lede mx-auto mt-6 max-w-xl text-white/70">
            Each light is a different kind of intelligence, built for a
            different part of the journey. Together, they&apos;re a system.
          </p>
        </div>

        <div className="mt-16 grid items-center gap-12 lg:mt-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
          {/* static constellation — the interactive R3F layer mounts over
              it (Stage 7) and fades it out once ready */}
          <div data-constellation-stage className="relative mx-auto w-full max-w-[600px]">
            <div data-static-constellation className="relative">
              <div
                aria-hidden="true"
                className="glow-atmosphere-radial pointer-events-none absolute inset-[-15%] rounded-full opacity-70"
              />
              <ConstellationStatic className="relative h-auto w-full drop-shadow-[0_0_28px_rgba(0,212,255,0.10)]" />
            </div>
            <ConstellationInteractive products={PRODUCTS} />
          </div>

          {/* semantic product list — the DOM truth */}
          <div className="relative">
            {/* mobile: sticky mini-map — each card ignites its point */}
            <div className="pointer-events-none sticky top-[calc(var(--header-height)+76px)] z-20 -mb-[4.5rem] ml-auto mr-1 h-16 w-16 rounded-full border border-white/10 bg-void-800/85 p-1.5 backdrop-blur-sm lg:hidden">
              <ConstellationMiniMap className="h-full w-full drop-shadow-[0_0_12px_rgba(0,212,255,0.15)]" />
            </div>
            <ul className="flex flex-col gap-4">
            {PRODUCTS.map((p) => (
              <li
                key={p.slug}
                data-ignite
                data-product-card={p.slug}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
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
              </li>
            ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

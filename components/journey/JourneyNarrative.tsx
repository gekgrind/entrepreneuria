import Image from "next/image";

import type { Product } from "@/lib/ecosystem/schema";
import { ConstellationStatic } from "@/components/home/ConstellationStatic";
import { Badge, Kicker, PrimaryCtaLink, StatusChip } from "@/components/home/scenes/shared";

/**
 * JourneyNarrative — the zero-JS / reduced-motion / no-WebGL experience.
 *
 * This is the complete story of Scenes 1–6 as readable, semantic,
 * static content. It is always server-rendered; the enhanced island
 * hides it (display:none) only when every enhancement gate passes.
 *
 * Scenes 4–5 reuse the approved static constellation (registry-generated
 * SVG) and the semantic product list; Scene 6 gets a calm static Prospra
 * treatment. No assembly, no camera travel — the same story, at rest.
 */
export function JourneyNarrative({
  cta,
  products,
}: {
  cta: { label: string; href: string };
  products: readonly Product[];
}) {
  const flagship = products.find((p) => p.badge === "FLAGSHIP") ?? products[0];

  return (
    <div data-journey-narrative className="bg-void-950 text-white">
      {/* scoped styles — keeps the POC fully isolated from globals.css.
          Static star specks: no animation, reduced-motion safe. */}
      <style>{`
        .journey-static-stars {
          background-image:
            radial-gradient(1px 1px at 12% 24%, rgba(255, 255, 255, 0.5) 50%, transparent 52%),
            radial-gradient(1px 1px at 28% 68%, rgba(255, 255, 255, 0.35) 50%, transparent 52%),
            radial-gradient(1.5px 1.5px at 44% 12%, rgba(255, 255, 255, 0.45) 50%, transparent 52%),
            radial-gradient(1px 1px at 61% 38%, rgba(255, 255, 255, 0.3) 50%, transparent 52%),
            radial-gradient(1px 1px at 74% 82%, rgba(255, 255, 255, 0.45) 50%, transparent 52%),
            radial-gradient(1.5px 1.5px at 86% 18%, rgba(255, 255, 255, 0.35) 50%, transparent 52%),
            radial-gradient(1px 1px at 91% 56%, rgba(255, 255, 255, 0.5) 50%, transparent 52%),
            radial-gradient(1px 1px at 37% 88%, rgba(255, 255, 255, 0.3) 50%, transparent 52%);
        }
      `}</style>
      {/* Scene 1 — the chaos, stated plainly */}
      <section
        aria-labelledby="journey-hero-heading"
        className="journey-static-stars relative flex min-h-[100dvh] items-center overflow-clip bg-void-900"
      >
        <div
          aria-hidden="true"
          className="glow-human-radial pointer-events-none absolute left-[12%] top-[55%] h-[420px] w-[420px] rounded-full opacity-70"
        />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-24 sm:px-10 lg:px-16">
          <Kicker>Entrepreneuria — Everything Entrepreneur</Kicker>
          <h1 id="journey-hero-heading" className="type-display-xl max-w-[12ch]">
            No founder should have to build{" "}
            <em className="text-white/90">alone</em>.
          </h1>
          <p className="type-lede mt-8 max-w-xl text-white/70">
            An ecosystem of AI-powered mentorship, strategy, and tools that
            surrounds one person with everything a business needs.
          </p>
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <PrimaryCtaLink label={cta.label} href={cta.href} />
          </div>
        </div>
      </section>

      {/* Scene 1 — what the chaos is made of */}
      <section
        aria-labelledby="journey-chaos-heading"
        className="relative px-6 py-32 sm:px-10 sm:py-44 lg:px-16"
      >
        <h2
          id="journey-chaos-heading"
          className="type-display-md mx-auto max-w-3xl text-center"
        >
          The idea was the easy part.
        </h2>
        <div className="mx-auto mt-16 flex max-w-4xl flex-col items-center gap-14 text-center">
          <p className="type-kinetic">
            Then come the questions nobody warns you about.
          </p>
          <div className="flex flex-col items-center gap-5">
            <p className="type-kinetic-interior text-white/55">
              Is this even worth building?
            </p>
            <p className="type-kinetic-interior text-white/55">
              Am I pricing this right?
            </p>
            <p className="type-kinetic-interior text-white/55">
              What do I actually do next?
            </p>
          </div>
          <p className="type-kinetic">
            No cofounder. No board. No mentor on speed dial.
          </p>
        </div>
      </section>

      {/* Scene 3 — the turn */}
      <section
        aria-labelledby="journey-turn-heading"
        className="journey-static-stars relative px-6 py-32 sm:px-10 sm:py-44 lg:px-16"
      >
        <div
          aria-hidden="true"
          className="glow-human-radial pointer-events-none absolute right-[10%] top-1/2 h-[360px] w-[360px] -translate-y-1/2 rounded-full opacity-80"
        />
        <div className="relative mx-auto max-w-3xl">
          <Kicker>The turn</Kicker>
          <h2 id="journey-turn-heading" className="type-display-md">
            The best founders were never{" "}
            <em className="text-white/90">alone</em>. Now neither are you.
          </h2>
          <p className="type-lede mt-8 max-w-xl text-white/70">
            Behind nearly every great entrepreneur was someone to call.
            Entrepreneuria makes that someone — and that something — available
            to anyone building a business of their own.
          </p>
        </div>
      </section>

      {/* Scenes 4–5 — the ecosystem, at rest: the approved static
          constellation plus the semantic product list (DOM truth) */}
      <section
        aria-labelledby="journey-ecosystem-heading"
        className="journey-static-stars relative px-6 py-32 sm:px-10 sm:py-44 lg:px-16"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <Kicker>The ecosystem</Kicker>
            <h2 id="journey-ecosystem-heading" className="type-display-lg">
              Everything Entrepreneur.
            </h2>
            <p className="type-lede mx-auto mt-6 max-w-xl text-white/70">
              Each light is a different kind of intelligence, built for a
              different part of the journey. Together, they&apos;re a system.
            </p>
          </div>

          <div className="mt-16 grid items-center gap-12 lg:mt-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
            <div className="relative mx-auto w-full max-w-[600px]">
              <div
                aria-hidden="true"
                className="glow-atmosphere-radial pointer-events-none absolute inset-[-15%] rounded-full opacity-70"
              />
              <ConstellationStatic className="relative h-auto w-full drop-shadow-[0_0_28px_rgba(0,212,255,0.10)]" />
            </div>
            <ul className="relative flex flex-col gap-4">
              {products.map((p) => (
                <li
                  key={p.slug}
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
      </section>

      {/* Scene 6 — the flagship, at rest: canonical Prospra copy and CTA
          with a calm static treatment instead of the particle brain */}
      <section
        aria-labelledby="journey-prospra-heading"
        className="journey-static-stars relative px-6 py-32 sm:px-10 sm:py-44 lg:px-16"
      >
        <div
          aria-hidden="true"
          className="glow-atmosphere-radial pointer-events-none absolute right-[8%] top-1/2 h-[460px] w-[460px] -translate-y-1/2 rounded-full opacity-70"
        />
        <div className="relative mx-auto max-w-3xl">
          <Kicker>The flagship</Kicker>
          <h2 id="journey-prospra-heading" className="type-display-md">
            Meet {flagship.name}. The mentor in your corner.
          </h2>
          <p className="type-lede mt-8 max-w-xl text-white/70">
            Bring a real decision — pricing your first offer, planning a
            launch week, deciding what to do next — and work it through with a
            mentor that knows your business and answers at 2 a.m.
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-white/80">
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-intelligence" />
              Works your actual business, not generic advice
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-intelligence" />
              Remembers your context across sessions
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-intelligence" />
              Built by a founder who needed it first
            </li>
          </ul>
          <div className="mt-10">
            <PrimaryCtaLink label={cta.label} href={cta.href} />
          </div>
        </div>
      </section>
    </div>
  );
}

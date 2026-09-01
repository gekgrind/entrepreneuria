import { getPrimaryCta } from "@/lib/launch";
import { Kicker, PrimaryCtaLink, GhostLink } from "./shared";

/**
 * SCENE 0 — "The Dark"
 * Immediate comprehension: brand, thesis, quiet CTA from second zero.
 * The warm point of light (the founder) drifts in the void; the wandering
 * needle reborn. Motion layers arrive in Stages 5–7.
 */
export function SceneHero() {
  const cta = getPrimaryCta();

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative -mt-[calc(var(--header-height)+20px)] flex min-h-[100dvh] items-center overflow-clip"
    >
      {/* the founder's light — warm point in the void; the outer wrapper
          receives cursor parallax (Stage 9), the inner keeps ambient drift */}
      <div
        aria-hidden="true"
        data-hero-light
        className="pointer-events-none absolute left-[82%] top-[22%] sm:left-[12%] sm:top-[58%]"
      >
        <div className="glow-human-radial absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70" />
        <div className="hero-light-drift absolute left-1/2 top-1/2">
          <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" />
          <div className="h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-human shadow-[0_0_24px_8px_rgba(210,122,44,0.55)]" />
        </div>
      </div>
      {/* faint atmospheric blue counterweight */}
      <div
        aria-hidden="true"
        className="glow-atmosphere-radial pointer-events-none absolute right-[-10%] top-[-20%] h-[720px] w-[720px] rounded-full opacity-60"
      />

      <div className="intro-seq relative mx-auto w-full max-w-6xl px-6 pb-24 pt-[calc(var(--header-height)+96px)] sm:px-10 lg:px-16">
        <Kicker>Entrepreneuria — Everything Entrepreneur</Kicker>
        <h1
          id="hero-heading"
          className="type-display-xl max-w-[12ch]"
        >
          No founder should have to build{" "}
          <em className="text-white/90">alone</em>.
        </h1>
        <p className="type-lede mt-8 max-w-xl text-white/70">
          An ecosystem of AI-powered mentorship, strategy, and tools that
          surrounds one person with everything a business needs.
        </p>
        <div className="mt-12 flex flex-wrap items-center gap-3">
          <PrimaryCtaLink label={cta.label} href={cta.href} />
          <GhostLink href="#ecosystem">Explore the ecosystem</GhostLink>
        </div>
      </div>

      {/* scroll cue */}
      <div
        aria-hidden="true"
        className="absolute bottom-8 left-1/2 h-16 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/30 to-transparent"
      />
    </section>
  );
}

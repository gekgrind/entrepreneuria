import { Kicker, PrimaryCtaLink } from "@/components/home/scenes/shared";

/**
 * JourneyNarrative — the zero-JS / reduced-motion / no-WebGL experience.
 *
 * This is the complete story of Scenes 1–3 as readable, semantic,
 * static content. It is always server-rendered; the enhanced island
 * hides it (display:none) only when every enhancement gate passes.
 */
export function JourneyNarrative({
  cta,
}: {
  cta: { label: string; href: string };
}) {
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
    </div>
  );
}

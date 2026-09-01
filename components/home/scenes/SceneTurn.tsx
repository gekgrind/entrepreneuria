import { Kicker } from "./shared";

/**
 * SCENE 2 — "The Turn"
 * Pain → possibility. The wandering light locks into place and ignites
 * here (choreography in Stage 5); the thesis lands in stillness first.
 */
export function SceneTurn() {
  return (
    <section
      aria-labelledby="turn-heading"
      data-scene-turn
      className="relative px-6 py-32 sm:px-10 sm:py-44 lg:px-16"
    >
      {/* the lock: the wandering light settles into place and ignites */}
      <div
        aria-hidden="true"
        data-lock-ignite
        className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2"
      >
        <div className="glow-human-radial absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-human shadow-[0_0_20px_6px_rgba(210,122,44,0.55)]" />
      </div>
      <div data-ignite className="relative mx-auto max-w-3xl text-center">
        <Kicker>The turn</Kicker>
        <h2
          id="turn-heading"
          className="type-display-md"
        >
          The best founders were never{" "}
          <em className="text-white/90">alone</em>. Now neither are you.
        </h2>
        <p className="type-lede mx-auto mt-8 max-w-xl text-white/70">
          Behind nearly every great entrepreneur was someone to call.
          Entrepreneuria makes that someone — and that something — available
          to anyone building a business of their own.
        </p>
      </div>
    </section>
  );
}

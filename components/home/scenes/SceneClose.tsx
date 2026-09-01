import { getPrimaryCta } from "@/lib/launch";
import { ConstellationStatic } from "@/components/home/ConstellationStatic";
import { Kicker, PrimaryCtaLink, GhostLink } from "./shared";

/**
 * SCENE 7 — "The Decision"
 * Return to the void. The constellation hangs fully formed above the
 * final CTA; the H2 resolves the page's opening promise ("No founder
 * should have to build alone") as emotional payoff.
 */
export function SceneClose() {
  const cta = getPrimaryCta();

  return (
    <section
      aria-labelledby="close-heading"
      className="relative overflow-clip px-6 py-32 sm:px-10 sm:py-44 lg:px-16"
    >
      <div
        aria-hidden="true"
        data-close-constellation
        className="pointer-events-none absolute left-1/2 top-0 w-[min(92vw,720px)] -translate-x-1/2 opacity-75"
      >
        <ConstellationStatic className="h-auto w-full drop-shadow-[0_0_28px_rgba(0,212,255,0.10)]" />
      </div>

      <div data-ignite className="relative mx-auto max-w-3xl pt-[min(56vw,460px)] text-center">
        <Kicker>Begin</Kicker>
        <h2
          id="close-heading"
          className="type-display-lg"
        >
          You&apos;ve carried this far enough <em className="text-white/90">alone</em>.
        </h2>
        <p className="type-lede mx-auto mt-6 max-w-xl text-white/70">
          Begin with Prospra. The rest of the ecosystem lights up as it
          ships.
        </p>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <PrimaryCtaLink label={cta.label} href={cta.href} />
          <GhostLink href="#ecosystem">Explore the ecosystem</GhostLink>
        </div>
        <p className="mt-6">
          <a
            href="/launch-pad"
            className="text-sm text-white/50 underline decoration-white/20 underline-offset-4 transition hover:text-intelligence"
          >
            Or start free in the Launch Pad
          </a>
        </p>
      </div>
    </section>
  );
}

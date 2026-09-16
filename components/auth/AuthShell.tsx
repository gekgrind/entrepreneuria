import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { ConstellationStatic } from "@/components/home/ConstellationStatic";

import { AuthParallax } from "./AuthParallax";

/**
 * THE THRESHOLD — the shared environment for every auth route.
 *
 * The homepage journey closes on "You've carried this far enough alone",
 * with the founder's warm light at the center of the constellation
 * labelled YOU. Authentication is the very next beat: the moment the
 * visitor becomes that center. So the page is not a card on a
 * background — it is the same constellation, cropped as architecture,
 * with a full-height lane of focused void cut into it for the form.
 * The constellation continues dimly BEHIND that lane rather than
 * stopping at its edge, which is what makes the panel read as embedded
 * in the environment instead of floating over it.
 *
 * Server component by design: the constellation is server-rendered SVG,
 * so first paint carries the whole environment and the form island is
 * the only thing that hydrates. Nothing decorative gates interaction.
 */
export function AuthShell({
  kicker,
  title,
  lede,
  children,
}: {
  /** Instrument-layer label (DM Mono). One or two words. */
  kicker: string;
  title: ReactNode;
  lede: string;
  /** The form island. Owns the lane's full content. */
  children: ReactNode;
}) {
  return (
    <main className="auth-surface auth-starfield relative flex min-h-[100dvh] flex-col overflow-clip bg-void-950 text-white">
      {/* ---- the environment: decorative, aria-hidden, never focusable ---- */}
      {/* The edge mask is on the environment layer, in viewport space, so
          a product label that reaches the side of the screen dissolves
          into the void instead of being guillotined by it. Layout is
          computed from the ecosystem registry, so which label lands at
          the edge changes with the viewport — and with the next product
          added. On desktop the right-hand band falls inside the form
          lane, where it costs nothing. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_right,transparent_0%,#000_9%,#000_91%,transparent_100%)] lg:[mask-image:linear-gradient(to_right,transparent_0%,#000_4%,#000_96%,transparent_100%)]"
      >
        <div className="auth-stage auth-parallax" data-auth-parallax>
          <ConstellationStatic className="h-full w-full" />
        </div>

        {/* the founder's warm light, behind the core. It drifts, never
            spins — the homepage's rule for this light. */}
        <div className="glow-human-radial hero-light-drift absolute left-[var(--auth-stage-x)] top-[var(--auth-stage-y)] h-[min(70vh,560px)] w-[min(70vh,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70" />

        {/* legibility veil: a guaranteed contrast floor under the type,
            kept light enough that the constellation still reads as
            structure rather than texture. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,11,20,0.62)_0%,rgba(5,11,20,0.12)_38%,rgba(5,11,20,0.55)_100%)] lg:bg-[linear-gradient(100deg,rgba(5,11,20,0.62)_0%,rgba(5,11,20,0.18)_38%,rgba(5,11,20,0.4)_100%)]" />

        {/* The type block's own pool of darkness. The constellation is
            laid out from the product registry, so a label WILL sometimes
            fall where the headline sits at some viewport width; pushing
            it deep into the background is art direction, whereas nudging
            percentages per breakpoint is a game you lose on the next
            product added to the registry. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_82%_48%_at_28%_92%,rgb(5,11,20)_0%,rgba(5,11,20,0.97)_32%,rgba(5,11,20,0.72)_58%,transparent_84%)] lg:bg-[radial-gradient(ellipse_54%_58%_at_16%_88%,rgb(5,11,20)_0%,rgba(5,11,20,0.97)_30%,rgba(5,11,20,0.74)_56%,transparent_84%)]" />
      </div>

      <AuthParallax />

      {/* ---- chrome: branding + a way home. No marketing nav — it would
              compete with the form and add exit paths to the one page
              that exists to be completed. ---- */}
      <header className="relative z-20 border-b border-white/[0.07]">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-4 px-5 sm:h-20 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="group -ml-1 flex items-center gap-2.5 rounded-full px-1 py-1 no-accent-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intelligence/70 focus-visible:ring-offset-4 focus-visible:ring-offset-void-950"
          >
            <Image
              src="/logos/entrepreneuria-logo-nav.png"
              alt=""
              width={40}
              height={40}
              priority
              className="h-8 w-10 shrink-0 object-contain"
            />
            <span className="type-label text-white/70 transition-colors group-hover:text-white">
              Entrepreneuria
            </span>
          </Link>

          <Link
            href="/"
            className="type-label group inline-flex items-center gap-2 rounded-full px-3 py-2 text-white/50 no-accent-link transition-colors hover:text-intelligence focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intelligence/70 focus-visible:ring-offset-4 focus-visible:ring-offset-void-950"
          >
            <span
              aria-hidden="true"
              className="transition-transform group-hover:-translate-x-0.5"
            >
              &#8592;
            </span>
            <span className="hidden sm:inline">Return to site</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </header>

      {/* ---- composition ---- */}
      <div className="relative z-10 flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(420px,34vw,540px)]">
        {/* Narrative — three beats, then silence; the constellation does
            the storytelling. On desktop the type anchors to the BOTTOM
            of the column so it and the constellation each own a corner
            of the diagonal instead of fighting for the middle: labels
            like PROSPRA and YOU would otherwise land straight on top of
            the headline. */}
        <section className="flex flex-col justify-center px-5 pb-7 pt-8 sm:px-8 sm:pb-14 sm:pt-16 lg:justify-end lg:px-10 lg:pb-[12vh] lg:pt-16 xl:px-16">
          <div className="auth-enter mx-auto w-full max-w-[34rem] lg:mx-0 lg:max-w-[30rem] xl:max-w-[34rem]">
            <p className="type-kicker mb-4 text-intelligence/70 sm:mb-5">{kicker}</p>
            <h1 className="type-display-md text-balance">{title}</h1>
            <p className="type-lede mt-5 max-w-md text-white/60 sm:mt-6">{lede}</p>
          </div>
        </section>

        {/* the lane — a full-height shaft of focused void. No radius, no
            shadow, no card: it is cut out of the environment, and the
            constellation stays faintly visible through it. */}
        <div className="relative flex flex-col border-t border-white/[0.07] bg-void-950/70 shadow-[inset_0_1px_0_var(--intelligence-soft)] backdrop-blur-md lg:border-l lg:border-t-0 lg:shadow-[inset_1px_0_0_var(--intelligence-soft)]">
          <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 sm:py-14 lg:px-10 lg:py-12">
            <div className="auth-enter w-full max-w-[25rem]">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

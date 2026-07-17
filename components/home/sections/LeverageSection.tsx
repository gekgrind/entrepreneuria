"use client";

import { ArrowUpRight } from "lucide-react";

import { HomeWaitlistForm } from "@/components/home/HomeWaitlistForm";
import { CascadeGroup } from "@/components/home/motion/CascadeGroup";
import { SplitReveal } from "@/components/home/motion/SplitReveal";

export const ETSY_SHOP_URL =
  "https://www.etsy.com/shop/Entrepreneuria?utm_source=entrepreneuria.io&utm_medium=referral&utm_campaign=homepage";

/**
 * The original hero copy, relocated below the cinematic compass sequence —
 * headline, subhead, waitlist capture, and the Etsy link, verbatim, with
 * room to breathe. Reveals on scroll (it now lives below the fold).
 */
export function LeverageSection() {
  return (
    <section className="relative border-t border-white/[0.07]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.22),transparent_65%)]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-6 py-32 sm:px-10 sm:py-40 lg:py-48 xl:px-0">
        <div className="max-w-3xl">
          <CascadeGroup selector="[data-cascade-item]" stagger={0.14} y={22}>
            <div data-cascade-item>
              <p className="mb-6 text-[11px] uppercase tracking-[0.28em] text-white/45 [font-family:var(--font-label)] sm:text-xs">
                Founder tools · Built by a solo founder
              </p>
            </div>

            <SplitReveal>
              <h2 className="text-balance text-5xl font-medium leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-[4.4rem]">
                You don&apos;t need a team.
                <br />
                You need <em className="italic">leverage</em>.
              </h2>
            </SplitReveal>

            <p
              data-cascade-item
              className="mt-10 max-w-xl text-lg leading-8 text-white/70"
            >
              Entrepreneuria gives solo founders launch planners, pitch decks,
              and business templates you can use today — plus first access to{" "}
              <strong className="font-semibold text-white">Prospra</strong>, an
              AI founder mentor now in private build.
            </p>

            <div data-cascade-item className="mt-14 max-w-xl">
              <HomeWaitlistForm source="homepage-hero" />
              <p className="mt-4 text-sm leading-6 text-white/50">
                Free tier at launch. Updates when something ships — no filler.
              </p>
            </div>

            <a
              data-cascade-item
              href={ETSY_SHOP_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-12 inline-flex items-center gap-1.5 text-sm font-medium text-white/60 transition hover:text-white"
            >
              Or shop the tool library on Etsy
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </CascadeGroup>
        </div>
      </div>
    </section>
  );
}

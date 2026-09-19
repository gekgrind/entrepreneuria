import type { ReactNode } from "react";

import { SplitReveal } from "@/components/home/motion/SplitReveal";
import {
  GhostButton,
  Kicker,
  PillButton,
  StatusDot,
} from "@/components/marketing/primitives";

import { ChamberAtmosphere, CouncilChamber } from "./chamber/CouncilChamber";
import { Reveal } from "./Reveal";

/**
 * The final CTA as the end of the boardroom: the board is convened and
 * every connection runs to the founder's open seat at the centre — and
 * the primary action sits in that seat. No container box.
 *
 * ≥768px the action is placed inside the open seat. Below that the
 * chamber is too small to hold it, so the action follows the chamber
 * in normal flow (same element, same DOM order — no duplicate links).
 *
 * Motion (DirectoriumMotion, once): seats activate in board order,
 * connections resolve inward, and the open seat — then the action inside
 * it — receives the light. Then it holds.
 */
export function ConveneCta({
  id,
  kicker,
  status,
  title,
  lede,
}: {
  id?: string;
  kicker: ReactNode;
  status: ReactNode;
  title: ReactNode;
  lede: ReactNode;
}) {
  return (
    <section id={id} data-dm="cta" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(79,124,167,0.16),transparent_70%)]"
      />
      <div className="relative mx-auto w-full max-w-6xl px-6 pb-28 pt-24 text-center sm:px-10 lg:pb-36 lg:pt-32 xl:px-0">
        <Reveal>
          <Kicker className="mb-5">{kicker}</Kicker>
          <p className="mx-auto mb-7 flex w-fit items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-white/55 [font-family:var(--font-label)]">
            <StatusDot live={false} /> {status}
          </p>
        </Reveal>

        <SplitReveal>
          <h2 className="mx-auto max-w-3xl text-balance text-4xl font-medium leading-[1.1] tracking-tight text-white sm:text-5xl">
            {title}
          </h2>
        </SplitReveal>

        <Reveal>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-white/70">
            {lede}
          </p>
        </Reveal>

        <div className="relative mx-auto mt-14 w-full max-w-[640px]">
          <ChamberAtmosphere className="inset-[-20%]" />
          <CouncilChamber id="cta" state="convened" centre="seat" />
          <div className="relative mt-6 flex justify-center md:absolute md:inset-0 md:mt-0 md:items-center">
            <div className="relative">
              {/* the founder's light arriving at the action (Phase 2 motion
                  resolves it; at rest it is a quiet, constant glow) */}
              <div
                aria-hidden="true"
                data-cta-glow
                className="pointer-events-none absolute -inset-x-10 -inset-y-8 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(210,122,44,0.28),transparent_70%)] opacity-60"
              />
              <PillButton href="/waitlist">Join the waitlist</PillButton>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center md:mt-8">
          <GhostButton href="/about">Learn about Entrepreneuria</GhostButton>
        </div>
      </div>
    </section>
  );
}

"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { SplitReveal } from "@/components/home/motion/SplitReveal";
import { Kicker, fadeUpLoad } from "@/components/marketing/primitives";

/**
 * Directorium hero — PageHero's opening beat (same kicker, masked
 * Playfair headline, lede, and entrance presets) recomposed as two
 * columns so the Council Chamber owns the space the copy leaves.
 *
 * The chamber (`visual`) is server-rendered and NOT wrapped in an
 * entrance animation: it paints in its finished state with the page.
 * Phase 2 adds the assembly choreography on top.
 */
export function ChamberHero({
  kicker,
  title,
  lede,
  children,
  visual,
}: {
  kicker: ReactNode;
  title: ReactNode;
  lede: ReactNode;
  children?: ReactNode;
  visual: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-[28%] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.24),transparent_65%)]"
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-4 px-6 pb-20 pt-[calc(var(--header-height)+96px)] sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6 lg:pb-24 lg:pt-[calc(var(--header-height)+104px)] xl:px-0">
        <div className="relative z-10">
          <motion.div {...fadeUpLoad(0)}>
            <Kicker className="mb-6">{kicker}</Kicker>
          </motion.div>

          <SplitReveal trigger="load" delay={0.1}>
            <h1 className="max-w-xl text-balance text-5xl font-medium leading-[1.05] tracking-tight text-white sm:text-6xl">
              {title}
            </h1>
          </SplitReveal>

          <motion.p
            {...fadeUpLoad(0.25)}
            className="mt-7 max-w-lg text-lg leading-8 text-white/70"
          >
            {lede}
          </motion.p>

          {children ? (
            <motion.div {...fadeUpLoad(0.4)} className="mt-10">
              {children}
            </motion.div>
          ) : null}
        </div>

        <div className="relative mx-auto mt-10 w-full max-w-[420px] sm:max-w-[500px] lg:mt-0 lg:max-w-none lg:translate-x-[4%]">
          {visual}
        </div>
      </div>
    </section>
  );
}

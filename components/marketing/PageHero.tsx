"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { SplitReveal } from "@/components/home/motion/SplitReveal";
import { Kicker, fadeUpLoad } from "./primitives";

/**
 * Subpage hero — the homepage's opening beat at page scale: atmosphere
 * radials, DM Mono kicker, a Playfair headline that rises out of a line
 * mask, and a measured lede. No video, no badges, no noise.
 */
export function PageHero({
  kicker,
  title,
  lede,
  children,
  align = "left",
}: {
  kicker: ReactNode;
  /** Pass an <em>accent</em> inside for the italic beat. */
  title: ReactNode;
  lede?: ReactNode;
  /** CTA row or any extra content below the lede. */
  children?: ReactNode;
  align?: "left" | "center";
}) {
  const centered = align === "center";
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.28),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-52 right-[-220px] h-[420px] w-[640px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(210,122,44,0.09),transparent_70%)]"
      />

      <div
        className={`relative mx-auto w-full max-w-6xl px-6 pb-16 pt-[calc(var(--header-height)+96px)] sm:px-10 sm:pb-20 lg:pt-[calc(var(--header-height)+136px)] xl:px-0 ${
          centered ? "text-center" : ""
        }`}
      >
        <motion.div {...fadeUpLoad(0)}>
          <Kicker className={`mb-6 ${centered ? "text-center" : ""}`}>
            {kicker}
          </Kicker>
        </motion.div>

        <SplitReveal trigger="load" delay={0.1}>
          <h1
            className={`text-balance text-5xl font-medium leading-[1.05] tracking-tight text-white sm:text-6xl ${
              centered ? "mx-auto max-w-3xl" : "max-w-3xl"
            }`}
          >
            {title}
          </h1>
        </SplitReveal>

        {lede ? (
          <motion.p
            {...fadeUpLoad(0.25)}
            className={`mt-7 max-w-2xl text-lg leading-8 text-white/70 ${
              centered ? "mx-auto" : ""
            }`}
          >
            {lede}
          </motion.p>
        ) : null}

        {children ? (
          <motion.div {...fadeUpLoad(0.4)} className="mt-10">
            {children}
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}

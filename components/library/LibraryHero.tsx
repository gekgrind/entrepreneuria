"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { SplitReveal } from "@/components/home/motion/SplitReveal";
import { Kicker, fadeUpLoad } from "@/components/marketing/primitives";

import styles from "./library.module.css";

/**
 * The Library's masthead — PageHero's opening beat (kicker, masked
 * Playfair headline, lede, same entrance presets) set beside a contents
 * page: every shelf, its numeral, and how many titles it holds. The
 * contents are plain anchors, so they work before hydration.
 */
export function LibraryHero({
  kicker,
  title,
  lede,
  contents,
  footnote,
}: {
  kicker: ReactNode;
  title: ReactNode;
  lede: ReactNode;
  contents: { key: string; numeral: string; title: string; count: number }[];
  footnote?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-[30%] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(210,122,44,0.11),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 right-[-160px] h-[420px] w-[620px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.16),transparent_70%)]"
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-6 pb-20 pt-[calc(var(--header-height)+96px)] sm:px-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-20 lg:pb-28 lg:pt-[calc(var(--header-height)+136px)] xl:px-0">
        <div>
          <motion.div {...fadeUpLoad(0)}>
            <Kicker className="mb-6">{kicker}</Kicker>
          </motion.div>

          <SplitReveal trigger="load" delay={0.1}>
            <h1 className="max-w-2xl text-balance text-5xl font-medium leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]">
              {title}
            </h1>
          </SplitReveal>

          <motion.p
            {...fadeUpLoad(0.25)}
            className="mt-8 max-w-xl text-lg leading-8 text-white/70"
          >
            {lede}
          </motion.p>
        </div>

        <motion.nav
          {...fadeUpLoad(0.35)}
          aria-label="Library contents"
          className="self-end"
        >
          <p className="mb-2 flex items-baseline justify-between text-[11px] uppercase tracking-[0.28em] text-white/40 [font-family:var(--font-label)]">
            <span>Contents</span>
            <span>Titles</span>
          </p>
          <ol role="list" className="border-b border-white/[0.08]">
            {contents.map((shelf) => (
              <li key={shelf.key}>
                <a href={`#${shelf.key}`} className={`${styles.contentsLink} no-accent-link`}>
                  <span className="text-sm text-[#d27a2c] [font-family:var(--font-label)]">
                    {shelf.numeral}
                  </span>
                  <span className={styles.leader}>
                    <span className="truncate text-xl leading-7 [font-family:var(--font-heading)]">
                      {shelf.title}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums text-white/50 [font-family:var(--font-label)]">
                    {String(shelf.count).padStart(2, "0")}
                  </span>
                </a>
              </li>
            ))}
          </ol>
          {footnote ? (
            <p className="mt-4 text-xs leading-5 text-white/40">{footnote}</p>
          ) : null}
        </motion.nav>
      </div>
    </section>
  );
}

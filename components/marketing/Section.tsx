"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { SplitReveal } from "@/components/home/motion/SplitReveal";
import { Kicker, fadeUp } from "./primitives";

/**
 * Numbered content section on the navy canvas — hairline top border,
 * generous vertical rhythm, kicker + masked heading + optional lede,
 * matching the homepage's section grammar.
 */
export function Section({
  id,
  kicker,
  title,
  lede,
  children,
  bordered = true,
  wide = false,
  className = "",
}: {
  id?: string;
  kicker?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  bordered?: boolean;
  /** max-w-7xl instead of 6xl, for tables/grids that need room. */
  wide?: boolean;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative ${bordered ? "border-t border-white/[0.07]" : ""} ${className}`}
    >
      <div
        className={`mx-auto w-full ${wide ? "max-w-7xl" : "max-w-6xl"} px-6 py-24 sm:px-10 lg:py-32 xl:px-0`}
      >
        {kicker ? (
          <motion.div {...fadeUp}>
            <Kicker className="mb-5">{kicker}</Kicker>
          </motion.div>
        ) : null}

        {title ? (
          <SplitReveal>
            <h2 className="max-w-2xl text-balance text-4xl font-medium leading-[1.1] tracking-tight text-white sm:text-5xl">
              {title}
            </h2>
          </SplitReveal>
        ) : null}

        {lede ? (
          <motion.p
            {...fadeUp}
            className="mt-7 max-w-xl text-lg leading-8 text-white/70"
          >
            {lede}
          </motion.p>
        ) : null}

        {title || lede || kicker ? (
          <div className="mt-14">{children}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/**
 * The light interlude — the homepage's "paper" beat for trust-heavy
 * content (founder letter, legal summaries, plain-terms sections).
 */
export function PaperSection({
  id,
  kicker,
  title,
  lede,
  children,
  className = "",
}: {
  id?: string;
  kicker?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`bg-[#f7fbff] text-[#1a2942] ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:px-10 lg:py-28 xl:px-0">
        {kicker ? (
          <motion.div {...fadeUp}>
            <Kicker tone="paper" className="mb-5">
              {kicker}
            </Kicker>
          </motion.div>
        ) : null}

        {title ? (
          <SplitReveal>
            <h2 className="max-w-2xl text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl">
              {title}
            </h2>
          </SplitReveal>
        ) : null}

        {lede ? (
          <motion.p
            {...fadeUp}
            className="mt-7 max-w-xl text-lg leading-8 text-[#41567a]"
          >
            {lede}
          </motion.p>
        ) : null}

        {title || lede || kicker ? (
          <div className="mt-12">{children}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

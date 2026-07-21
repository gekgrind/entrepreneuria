"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { PageShell } from "./PageShell";
import { Kicker, fadeUpLoad } from "./primitives";
import { SplitReveal } from "@/components/home/motion/SplitReveal";

/**
 * Shell for legal / policy / trust documents: navy hero in the homepage's
 * voice, then the document body on the light "paper" surface (the same
 * beat the homepage uses for its founder letter). Typography inside the
 * body is normalized by the `legal-prose` class in globals.css, so pages
 * keep their content markup untouched.
 */
export function LegalShell({
  kicker = "The fine print",
  title,
  date,
  lede,
  children,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  /** e.g. "Effective June 24, 2026" */
  date?: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageShell>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.28),transparent_65%)]"
        />

        <div className="relative mx-auto w-full max-w-4xl px-6 pb-16 pt-[calc(var(--header-height)+88px)] sm:px-10 sm:pb-20 lg:pt-[calc(var(--header-height)+120px)]">
          <motion.div {...fadeUpLoad(0)}>
            <Kicker className="mb-6">{kicker}</Kicker>
          </motion.div>

          <SplitReveal trigger="load" delay={0.1}>
            <h1 className="text-balance text-4xl font-medium leading-[1.08] tracking-tight text-white sm:text-5xl">
              {title}
            </h1>
          </SplitReveal>

          {date ? (
            <motion.p
              {...fadeUpLoad(0.22)}
              className="mt-6 text-[11px] uppercase tracking-[0.24em] text-white/40 [font-family:var(--font-label)]"
            >
              {date}
            </motion.p>
          ) : null}

          {lede ? (
            <motion.p
              {...fadeUpLoad(0.3)}
              className="mt-7 max-w-2xl text-lg leading-8 text-white/70"
            >
              {lede}
            </motion.p>
          ) : null}
        </div>
      </section>

      <section className="bg-[#f7fbff] text-[#1a2942]">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 sm:px-10 lg:py-24">
          <div className="legal-prose">{children}</div>
        </div>
      </section>
    </PageShell>
  );
}

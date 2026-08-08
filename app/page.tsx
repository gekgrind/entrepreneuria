"use client";

import type { ReactNode } from "react";
import Link from "@/components/transition/TransitionLink";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, MotionConfig } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { HomeWaitlistForm } from "@/components/home/HomeWaitlistForm";
import { HeroReveal } from "@/components/home/HeroReveal";
import { ScrollCue } from "@/components/home/ScrollCue";
import {
  LeverageSection,
  ETSY_SHOP_URL,
} from "@/components/home/sections/LeverageSection";
import { EcosystemStatus } from "@/components/home/sections/EcosystemStatus";
import { SmoothScroll } from "@/components/home/motion/SmoothScroll";
import { SplitReveal } from "@/components/home/motion/SplitReveal";
import { CascadeGroup } from "@/components/home/motion/CascadeGroup";
import { QuoteScrub } from "@/components/home/motion/QuoteScrub";
import { ParallaxDrift } from "@/components/home/motion/ParallaxDrift";
import { SignatureReveal } from "@/components/home/motion/SignatureReveal";
import { TermsMotion } from "@/components/home/motion/TermsMotion";
import { TiltCard } from "@/components/home/motion/TiltCard";

// WebGL scenes load off the critical path — the hero paints text first.
const HeroField = dynamic(
  () => import("@/components/home/HeroField").then((m) => m.HeroField),
  { ssr: false },
);
const CompassScene = dynamic(
  () =>
    import("@/components/home/compass/CompassScene").then(
      (m) => m.CompassScene,
    ),
  { ssr: false },
);

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
} as const;

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-5 text-[11px] uppercase tracking-[0.28em] text-white/45 [font-family:var(--font-label)] sm:text-xs">
      {children}
    </p>
  );
}

function StatusDot({ live }: { live: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        live
          ? "h-1.5 w-1.5 shrink-0 rounded-full bg-[#00d4ff] shadow-[0_0_8px_rgba(0,212,255,0.8)]"
          : "h-1.5 w-1.5 shrink-0 rounded-full border border-white/35"
      }
    />
  );
}

/* ------------------------------------------------------------------- */
/* 1. Hero — full-bleed cinema: chaos → lock → beam → "Find your true   */
/*    north." No copy competes with the sequence; everything the old    */
/*    hero said now lives in LeverageSection + EcosystemStatus below.   */
/* ------------------------------------------------------------------- */

function Hero() {
  return (
    <section
      data-hero-track
      className="relative -mt-[calc(var(--header-height)+20px)] h-[260vh] lg:h-[320vh]"
    >
      <div className="sticky top-0 h-[100dvh] overflow-hidden">
        {/* Static atmosphere — remains as the no-WebGL / reduced-motion base */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.28),transparent_65%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-[-200px] h-[420px] w-[640px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(210,122,44,0.1),transparent_70%)]"
        />

        {/* The compass — full-bleed, scroll-choreographed */}
        <CompassScene className="absolute inset-0 edge-fade-bottom" />

        {/* Payoff copy — resolves as the beam fires */}
        <HeroReveal />

        <ScrollCue />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- */
/* 2. Now / Next — one honest products section, no repeated pitch */
/* ------------------------------------------------------------- */

function NowNext() {
  const now = [
    {
      title: "The founder tool library",
      body: "Launch planners, pitch deck systems, business model worksheets, and operating templates — bought and used by founders today.",
      cta: "Shop the library",
      href: ETSY_SHOP_URL,
      external: true,
    },
    {
      title: "Free AI tools in the Launch Pad",
      body: "A business model generator, financial projector, market analysis, persona builder, and more — live on this site, free while in beta.",
      cta: "Open the free tools",
      href: "/launch-pad/tools",
      external: false,
    },
  ];

  const next = [
    {
      title: "Prospra",
      role: "AI founder mentor",
      body: "Works a real decision with you — pricing your first offer, planning a launch week — instead of handing you another dashboard.",
    },
    {
      title: "Architecta",
      role: "Brand & content systems",
      body: "Turns your positioning into a brand and content system you can actually keep up with as one person.",
    },
    {
      title: "Synceri",
      role: "Ops & admin flow",
      body: "Keeps the business behind the business — follow-ups, routines, admin load — moving when your attention is split.",
    },
  ];

  return (
    <section className="relative border-t border-white/[0.07]">
      <div className="mx-auto max-w-6xl px-6 py-28 sm:px-10 lg:py-40 xl:px-0">
        <div>
          <motion.div {...fadeUp}>
            <Kicker>01 — The product line</Kicker>
          </motion.div>
          <SplitReveal>
            <h2
              className="max-w-2xl text-balance text-4xl font-medium leading-[1.1] tracking-tight text-white sm:text-5xl"
            >
              What you can use today.
              <br />
              What&apos;s coming next.
            </h2>
          </SplitReveal>
        </div>

        <div className="mt-20">
          <motion.p
            {...fadeUp}
            className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-[#00d4ff] [font-family:var(--font-label)]"
          >
            <StatusDot live /> Available now
          </motion.p>
          <CascadeGroup className="grid gap-5 md:grid-cols-2" stagger={0.12}>
            {now.map((item) => (
              <TiltCard key={item.title} className="rounded-2xl">
                <article className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25 sm:p-8">
                  <h3 className="text-2xl font-medium tracking-tight text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 flex-1 leading-7 text-white/60">
                    {item.body}
                  </p>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white"
                    >
                      {item.cta}
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white"
                    >
                      {item.cta}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  )}
                </article>
              </TiltCard>
            ))}
          </CascadeGroup>
        </div>

        <div className="mt-20">
          <motion.p
            {...fadeUp}
            className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-white/45 [font-family:var(--font-label)]"
          >
            <StatusDot live={false} /> In development — waitlist open
          </motion.p>
          <CascadeGroup className="grid gap-5 md:grid-cols-3" stagger={0.12}>
            {next.map((item) => (
              <article
                key={item.title}
                className="flex flex-col rounded-2xl border border-white/10 p-7 sm:p-8"
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 [font-family:var(--font-label)]">
                  {item.role}
                </p>
                <h3 className="mt-2 text-2xl font-medium tracking-tight text-white">
                  {item.title}
                </h3>
                <p className="mt-3 flex-1 leading-7 text-white/60">
                  {item.body}
                </p>
                <a
                  href="#waitlist"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 transition hover:text-white"
                >
                  Get early access <ArrowRight className="h-4 w-4" />
                </a>
              </article>
            ))}
          </CascadeGroup>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- */
/* 3. Founder letter + what's real — the trust beat, on light paper */
/* --------------------------------------------------------------- */

function FounderLetter() {
  const proof = [
    {
      text: "A live tool shop founders buy from today",
      href: ETSY_SHOP_URL,
      external: true,
    },
    {
      text: "Free AI tools already running in the Launch Pad",
      href: "/launch-pad/tools",
      external: false,
    },
    {
      text: "A design studio shipping real client sites for salons",
      href: "https://design-studio.entrepreneuria.io",
      external: true,
    },
  ];

  return (
    <section className="bg-[#f7fbff] text-[#1a2942]">
      <div className="mx-auto grid max-w-6xl gap-16 px-6 py-28 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:py-28 xl:px-0">
        <div>
          <motion.p
            {...fadeUp}
            className="mb-5 text-[11px] uppercase tracking-[0.28em] text-[#4f7ca7] [font-family:var(--font-label)] sm:text-xs"
          >
            02 — Who&apos;s behind it
          </motion.p>
          <SplitReveal>
            <h2
              className="text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl"
            >
              Built by one founder who needed it first.
            </h2>
          </SplitReveal>

          <motion.p
            {...fadeUp}
            className="mt-7 max-w-xl text-lg leading-8 text-[#41567a]"
          >
            Entrepreneuria started where most solo founders quietly hit the
            wall: too many decisions, no team to share them with, and advice
            written for companies with a safety net. So I started building the
            system I couldn&apos;t find.
          </motion.p>

          <QuoteScrub>
            <blockquote className="mt-9 border-l-2 border-[#d27a2c] pl-6 text-2xl font-medium italic leading-snug text-[#1a2942] sm:text-[1.7rem]">
              “I built the tool I desperately needed when everything felt heavy,
              unclear, and urgent at the same time.”
            </blockquote>
          </QuoteScrub>

          <motion.div {...fadeUp} className="mt-7 flex items-center gap-4">
            <SignatureReveal>
              <Image
                src="/entrepreneuria-logo-signature.png"
                alt="Misti's signature"
                width={150}
                height={56}
                className="h-12 w-auto object-contain"
              />
            </SignatureReveal>
            <div>
              <p className="font-semibold">Misti</p>
              <p className="text-sm text-[#41567a]">
                Founder, Entrepreneuria ·{" "}
                <Link
                  href="/about"
                  className="text-[#1a2942] underline decoration-[#1a2942]/25 underline-offset-4 transition hover:decoration-[#1a2942]"
                >
                  the full story
                </Link>
              </p>
            </div>
          </motion.div>
        </div>

        <ParallaxDrift className="h-fit lg:mt-16" travel={44}>
          <motion.aside
            {...fadeUp}
            className="rounded-2xl border border-[#1a2942]/10 bg-white p-7 shadow-[0_16px_50px_rgba(26,41,66,0.08)] sm:p-8"
          >
            <p className="border-b border-[#1a2942]/10 pb-4 text-[11px] uppercase tracking-[0.24em] text-[#4f7ca7] [font-family:var(--font-label)]">
              What&apos;s real today
            </p>
            <CascadeGroup selector="li" stagger={0.1} y={16}>
              <ul className="divide-y divide-[#1a2942]/[0.07]">
                {proof.map((item) => (
                  <li key={item.text}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center justify-between gap-4 py-4 text-[#1a2942]"
                      >
                        <span className="leading-6">{item.text}</span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-[#4f7ca7] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className="group flex items-center justify-between gap-4 py-4 text-[#1a2942]"
                      >
                        <span className="leading-6">{item.text}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[#4f7ca7] transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </CascadeGroup>
            <p className="border-t border-[#1a2942]/10 pt-4 text-sm leading-6 text-[#41567a]">
              No invented numbers, no stock testimonials. Just what already
              ships — while the AI products are built in the open.
            </p>
          </motion.aside>
        </ParallaxDrift>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. The close — plain terms on the left, the form itself on the right */
/* ------------------------------------------------------------------ */

function WaitlistClose() {
  const terms = [
    {
      n: "01",
      title: "First invites",
      body: "When Prospra's private beta opens, the waitlist is the door. No public signup first.",
    },
    {
      n: "02",
      title: "Founding pricing",
      body: "Free tier at launch, paid plans from $29/mo — waitlist members lock in first access before prices settle.",
    },
    {
      n: "03",
      title: "No filler",
      body: "You hear from me when something ships or opens. That's the entire email policy.",
    },
  ];

  return (
    <section id="waitlist" className="relative border-t border-white/[0.07]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.22),transparent_65%)]"
      />

      {/* Closing echo of the hero field — particles only, low density */}
      <HeroField variant="close" className="absolute inset-0" />

      <div className="relative mx-auto grid max-w-6xl gap-16 px-6 py-28 sm:px-10 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20 lg:py-28 xl:px-0">
        <div>
          <motion.div {...fadeUp}>
            <Kicker>03 — The waitlist</Kicker>
          </motion.div>
          <SplitReveal>
            <h2
              className="text-balance text-4xl font-medium leading-[1.1] tracking-tight text-white sm:text-5xl"
            >
              Early access, in <em className="italic">plain</em> terms.
            </h2>
          </SplitReveal>

          <TermsMotion>
            <ul className="mt-10 space-y-7">
              {terms.map((term) => (
                <li key={term.n} className="flex gap-5">
                  <span className="pt-1 text-[11px] tracking-[0.2em] text-white/35 [font-family:var(--font-label)]">
                    {term.n}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{term.title}</p>
                    <p className="mt-1 leading-7 text-white/60">{term.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </TermsMotion>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.965 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-9"
        >
          <h3 className="text-3xl font-medium leading-tight tracking-tight text-white">
            Be first in when <em className="italic">Prospra</em> opens.
          </h3>
          <p className="mt-3 leading-7 text-white/60">
            One email. First access to Prospra, Architecta, and Synceri as
            each one ships.
          </p>
          <div className="mt-7">
            <HomeWaitlistForm source="homepage-footer" />
          </div>
          <p className="mt-4 text-sm leading-6 text-white/45">
            You&apos;ll hear from me when your spot is ready. — Misti
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <main className="overflow-x-clip bg-[#081527] text-white">
        <SmoothScroll />
        <Hero />
        <LeverageSection />
        <EcosystemStatus />
        <NowNext />
        <FounderLetter />
        <WaitlistClose />
      </main>
    </MotionConfig>
  );
}

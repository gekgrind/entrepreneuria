"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const fadeInUp = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.65 },
};

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#00D4FF] sm:text-sm">
      {children}
    </p>
  );
}

function Accent({ children }: { children: ReactNode }) {
  return <em className="italic text-[#00D4FF]">{children}</em>;
}

function Hero() {
  return (
    <section className="relative isolate min-h-[78vh] overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      >
        <source src="/videos/home-header.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(26,41,66,0.72)_0%,rgba(26,41,66,0.48)_45%,rgba(26,41,66,0.82)_100%)]" />

      <div className="mx-auto flex min-h-[78vh] w-full max-w-6xl items-center px-6 pb-16 pt-36 sm:px-10 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-3xl text-white"
        >
          <p className="mb-4 text-xs uppercase tracking-[0.22em] text-[#00D4FF] sm:text-sm">
            Build. Launch. Grow.
          </p>

          <h1 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">
            You don&apos;t need a team.
            <br />
            You need <em className="italic text-[#00D4FF]">leverage</em>.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-white/90 sm:text-lg">
            Entrepreneuria is the operating system for solo founders. Practical
            tools you can use today, and AI-powered systems that think with you
            tomorrow.
            <br />
            <br />
            Build faster. Make smarter decisions. Stop figuring everything out
            alone.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/waitlist"
              className="rounded-full bg-[var(--brand-orange)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#c16f26]"
            >
              Join the Waitlist
            </Link>

            <a
              href="https://entrepreneuriatools.etsy.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Shop Founder Tools
            </a>

            <Link
              href="/waitlist"
              className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Contact
            </Link>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-4 text-sm text-white/80 sm:text-base"
          >
            Shop digital products today and get early access to upcoming AI
            tools.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

function Intro() {
  return (
    <section className="bg-[#f7fbff] px-6 py-16 text-[#1a2942] sm:px-10 sm:py-20 lg:px-16">
      <motion.div
        {...fadeInUp}
        className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14"
      >
        <div>
          <Eyebrow>What is Entrepreneuria</Eyebrow>
          <h2 className="text-balance text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            The platform that was <Accent>missing</Accent> when you needed it
            most.
          </h2>

          <div className="mt-6 space-y-5 text-lg leading-relaxed text-[#2f4466]">
            <p>
              Entrepreneuria exists for founders building under pressure,
              without a giant team, and without the safety net most startup
              advice assumes you have.
            </p>
            <p>
              This is where strategy meets execution. You get direction when you
              feel stuck, practical assets when you need momentum, and a
              founder-first ecosystem built for the realities you actually face.
            </p>
            <p>
              It is not a content dump. It is not vague inspiration. It is a
              real operating environment designed to help you move with clarity.
            </p>
          </div>
        </div>

        <aside className="rounded-3xl border border-[#1a2942]/15 bg-white p-7 shadow-[0_24px_56px_rgba(26,41,66,0.12)] sm:p-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#4f7ca7]">
            Founder reality
          </p>
          <p className="mb-6 text-lg leading-relaxed text-[#1a2942]">
            Most founders are expected to make high-stakes decisions with
            fragmented advice, limited context, and zero margin for error.
          </p>
          <p className="text-lg leading-relaxed text-[#1a2942]">
            Entrepreneuria closes that gap with guided systems, deployable
            tools, and decision support that stays grounded in your stage, your
            constraints, and your goals.
          </p>
        </aside>
      </motion.div>
    </section>
  );
}

function Ecosystem() {
  const items = [
    {
      label: "Available now",
      title: "Founder tool library",
      body: "Digital products, worksheets, launch systems, and operational templates you can deploy immediately through the Entrepreneuria shop.",
      cta: "Shop founder tools",
      href: "https://www.etsy.com/shop/Entrepreneuria",
      external: true,
    },
    {
      label: "Core intelligence",
      title: "Prospra",
      body: "An AI-guided founder mentor designed to support decision-making, planning, and momentum from ideation through growth.",
      cta: "Explore Prospra",
      href: "/prospra",
      external: false,
    },
    {
      label: "Execution systems",
      title: "Architecta + Synceri",
      body: "Operational AI tools for content, execution flow, and founder life administration so strategy actually becomes output.",
      cta: "See what is coming",
      href: "/synceri",
      external: false,
    },
    {
      label: "Strategic depth",
      title: "Launch resources",
      body: "Playbooks, guides, and implementation resources that turn overwhelming founder decisions into structured next actions.",
      cta: "Explore resources",
      href: "/launch-pad",
      external: false,
    },
    {
      label: "Brand and visuals",
      title: "The Design Studio",
      body: "A creative workspace for founders to shape brand identity, marketing visuals, and on-brand assets without the overhead of a full design team. Open the Studio to generate logos, social graphics, and launch-ready creative in minutes.",
      cta: "Enter the Design Studio",
      href: "https://design-studio.entrepreneuria.io",
      external: true,
    },
  ];

  return (
    <section className="bg-white/5 px-6 py-16 backdrop-blur-[2px] sm:px-10 sm:py-20 lg:px-16">
      <motion.div {...fadeInUp} className="mx-auto max-w-6xl">
        <Eyebrow>The Entrepreneuria ecosystem</Eyebrow>
        <h2 className="mb-6 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
          Every tool you need. <Accent>One system</Accent>.
        </h2>
        <p className="mb-12 max-w-3xl text-lg leading-relaxed text-white/85">
          Entrepreneuria is structured as a connected founder ecosystem:
          immediate execution tools, advanced product guidance, and AI-native
          support layers designed to grow with you.
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
          {items.map((item) =>
            item.external ? (
              <article
                key={item.title}
                className="rounded-3xl border border-white/25 bg-white/10 p-6 shadow-[0_18px_44px_rgba(0,0,0,0.2)] backdrop-blur-md sm:p-8"
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#00D4FF]">
                  {item.label}
                </p>
                <h3 className="mb-3 text-2xl font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mb-6 leading-relaxed text-white/85">{item.body}</p>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 font-semibold text-[#00D4FF] transition-colors hover:text-white"
                >
                  {item.cta} <ArrowRight className="h-4 w-4" />
                </a>
              </article>
            ) : (
              <article
                key={item.title}
                className="rounded-3xl border border-white/25 bg-white/10 p-6 shadow-[0_18px_44px_rgba(0,0,0,0.2)] backdrop-blur-md sm:p-8"
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#00D4FF]">
                  {item.label}
                </p>
                <h3 className="mb-3 text-2xl font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mb-6 leading-relaxed text-white/85">{item.body}</p>
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-2 font-semibold text-[#00D4FF] transition-colors hover:text-white"
                >
                  {item.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            )
          )}
        </div>
      </motion.div>
    </section>
  );
}

function FounderStory() {
  return (
    <section className="bg-[#f7fbff] px-6 py-16 text-[#1a2942] sm:px-10 sm:py-20 lg:px-16">
      <motion.div
        {...fadeInUp}
        className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14"
      >
        <aside className="rounded-3xl border border-[#1a2942]/10 bg-white p-7 shadow-[0_20px_48px_rgba(26,41,66,0.12)] sm:p-9">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#4f7ca7]">
            Founder note
          </p>
          <blockquote className="mb-5 text-xl font-medium leading-relaxed text-[#1a2942] sm:text-2xl">
            “I built the tool I <Accent>desperately needed</Accent> when
            everything felt heavy, unclear, and urgent at the same time.”
          </blockquote>
          <p className="text-[#41567a]">— Misti, Founder of Entrepreneuria</p>
        </aside>

        <div>
          <Eyebrow>Built from the inside out</Eyebrow>
          <h2 className="text-balance text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            This was built from lived founder pressure, not theory.
          </h2>

          <div className="mt-6 space-y-5 text-lg leading-relaxed text-[#2f4466]">
            <p>
              Entrepreneuria started in the moments where most founders quietly
              hit the wall: too many decisions, too little support, and no
              practical system that understood both strategy and emotional load.
            </p>
            <p>
              The ecosystem was built to carry that weight differently, with
              tools that remove friction, guidance that is context-aware, and
              workflows that keep you moving even when you are stretched thin.
            </p>
            <p>
              This is founder support designed from the inside, for people who
              are still in the arena while they build the business they believe
              in.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function DesignStudio() {
  return (
    <section className="px-6 py-16 sm:px-10 sm:py-20 lg:px-16">
      <motion.div {...fadeInUp} className="mx-auto max-w-6xl">
        <Eyebrow>The Design Studio</Eyebrow>
        <h2 className="mb-6 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
          Where founder-built <Accent>meets</Accent> beautifully made.
        </h2>

        <div className="max-w-3xl space-y-5 text-lg leading-relaxed text-white/85">
          <p>
            Not every founder needs a SaaS product. Some need a presence that
            earns trust before a word is spoken.
          </p>
          <p>
            Entrepreneuria Design Studio is a boutique web design agency built
            inside this ecosystem — offering high-craft digital experiences for
            businesses that know their brand should do the heavy lifting.
            Focused on the salon and beauty industry, the Studio brings the
            same strategic clarity that drives this platform to client work
            that is intentional, refined, and built to convert.
          </p>
          <p>
            This is not template drag-and-drop. This is bespoke design from a
            founder who has been in the build, launched something real, and
            knows the difference between a site that exists and a site that
            works.
          </p>
        </div>

        <a
          href="https://design-studio.entrepreneuria.io"
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex items-center gap-2 font-semibold text-[#00D4FF] transition-colors hover:text-white"
        >
          Explore the Design Studio <ArrowRight className="h-4 w-4" />
        </a>
      </motion.div>
    </section>
  );
}

function AIHorizon() {
  const items = [
    "Prospra evolves into an always-available founder mentor with deeper strategic memory and sharper recommendation logic.",
    "Architecta helps founders turn ideas into coherent brand and content systems without losing voice or quality.",
    "Synceri supports execution rhythms, administrative load, and personal operating flow so progress stays sustainable.",
  ];

  return (
    <section className="px-6 py-16 sm:px-10 sm:py-20 lg:px-16">
      <motion.div {...fadeInUp} className="mx-auto max-w-6xl">
        <Eyebrow>What&apos;s on the horizon</Eyebrow>
        <h2 className="mb-6 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
          The <Accent>AI-powered</Accent> future is personal, practical, and
          founder-native.
        </h2>
        <p className="mb-10 max-w-3xl text-lg leading-relaxed text-white/85">
          The next wave of Entrepreneuria expands from static resources into
          active, adaptive systems that coach, generate, audit, and guide in
          real time.
        </p>

        <div className="space-y-5">
          {items.map((line, index) => (
            <div
              key={line}
              className="grid items-start gap-4 rounded-2xl border border-white/25 bg-white/10 p-5 backdrop-blur-md sm:grid-cols-[56px_1fr] sm:p-6"
            >
              <p className="text-3xl font-bold leading-none text-[#00D4FF]">
                0{index + 1}
              </p>
              <p className="text-lg leading-relaxed text-white/90">{line}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function Tools() {
  const bullets = [
    "Founder-focused templates and business operating tools",
    "Launch and growth resources with practical implementation steps",
    "A direct pathway into upcoming AI products and ecosystem updates",
  ];

  return (
    <section className="bg-[#f7fbff] px-6 py-16 text-[#1a2942] sm:px-10 sm:py-20 lg:px-16">
      <motion.div
        {...fadeInUp}
        className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14"
      >
        <div>
          <Eyebrow>Available right now</Eyebrow>
          <h2 className="text-balance text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Start building with <Accent>real tools</Accent> today.
          </h2>
          <p className="mb-8 mt-6 max-w-2xl text-lg leading-relaxed text-[#2f4466]">
            You do not have to wait for the future vision to get momentum.
            Entrepreneuria already gives you practical systems built for founder
            execution right now.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-[#1a2942] text-white hover:bg-[#24385a]"
            >
              <a
                href="https://www.etsy.com/shop/Entrepreneuria"
                target="_blank"
                rel="noreferrer"
              >
                Shop founder tools <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-[#1a2942]/30 text-[#1a2942] hover:bg-[#1a2942]/5"
            >
              <Link href="/launch-pad">
                Explore resources <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-[#1a2942]/12 bg-white p-7 shadow-[0_20px_52px_rgba(26,41,66,0.14)] sm:p-8">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#4f7ca7]">
            Included now
          </p>
          <ul className="space-y-4">
            {bullets.map((item) => (
              <li
                key={item}
                className="flex gap-3 leading-relaxed text-[#2f4466]"
              >
                <span
                  className="mt-2 h-2.5 w-2.5 rounded-full bg-[#00D4FF]"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </section>
  );
}

function Waitlist() {
  return (
    <section className="px-6 py-16 sm:px-10 sm:py-20 lg:px-16">
      <motion.div
        {...fadeInUp}
        className="mx-auto max-w-5xl rounded-[2rem] border border-white/30 bg-white/10 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-md sm:p-10 lg:p-14"
      >
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#00D4FF] sm:text-sm">
          Waitlist
        </p>
        <h2 className="text-balance text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
          The waitlist is where <Accent>early access</Accent> happens.
        </h2>
        <p className="mx-auto mb-9 mt-6 max-w-3xl text-lg leading-relaxed text-white/88">
          Join now to get first access to Prospra, Architecta, Synceri, and new
          founder systems as they launch. This is where product drops, private
          invites, and first-wave rollout updates are delivered.
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="bg-[#00D4FF] font-semibold text-[#0c1e35] hover:bg-[#1ddcff]"
          >
            <Link href="/waitlist">
              Join the waitlist <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/45 text-white hover:bg-white/10"
          >
            <a
              href="https://www.etsy.com/shop/Entrepreneuria"
              target="_blank"
              rel="noreferrer"
            >
              Browse live tools <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="overflow-x-clip bg-gradient-entrepreneuria text-white">
      <Hero />
      <Intro />
      <Ecosystem />
      <FounderStory />
      <DesignStudio />
      <AIHorizon />
      <Tools />
      <Waitlist />
    </main>
  );
}
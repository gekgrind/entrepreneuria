"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Playfair_Display } from "next/font/google";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

const boardMembers = [
  {
    codename: "Axiom",
    title: "The Strategist",
    description:
      "Frames the long game, pressure-tests positioning, and keeps your decisions aligned to durable advantage.",
    model: "Anthropic Claude",
    color: "#c9784a",
  },
  {
    codename: "Ledger",
    title: "The Capitalist",
    description:
      "Interrogates economics, capital allocation, and downside scenarios so every move earns its right to exist.",
    model: "Google Gemini",
    color: "#7C9BFF",
  },
  {
    codename: "Velocity",
    title: "The Growth Architect",
    description:
      "Finds the lever that compounds growth and translates ambition into clear acquisition and retention plays.",
    model: "Perplexity",
    color: "#20b8cd",
  },
  {
    codename: "Forge",
    title: "The Operator",
    description:
      "Converts strategy into execution with practical systems, sequencing, and operational clarity.",
    model: "OpenAI GPT-4",
    color: "#74aa9c",
  },
  {
    codename: "Sentinel",
    title: "The Risk Analyst",
    description:
      "Surfaces hidden risks early, helping you move fast without blind spots that can stall momentum.",
    model: "Mistral",
    color: "#f6501c",
  },
  {
    codename: "Paradox",
    title: "The Contrarian",
    description:
      "Challenges consensus and assumptions so your final call is stronger, sharper, and more resilient.",
    model: "xAI Grok",
    color: "#e94560",
  },
];

const modelPills = [
  { label: "GPT-5", color: "#74aa9c" },
  { label: "Claude", color: "#c9784a" },
  { label: "Gemini", color: "#7C9BFF" },
  { label: "Grok", color: "#e94560" },
  { label: "Perplexity", color: "#20b8cd" },
  { label: "Mistral", color: "#f6501c" },
];

export default function DirectoriumPage() {
  return (
    <main className="min-h-screen overflow-hidden text-white">
<section className="relative -mt-[calc(var(--header-height)+1rem)] flex h-[60vh] min-h-[680px] items-center justify-center overflow-hidden md:h-[70vh]">
  <PageHeader
    title=""
    subtitle=""
    videoSrc="/videos/directorium-header.mp4"
    imageSrc="/images/home-fallback.jpg"
  />

  <div className="absolute inset-0 z-20 flex items-center justify-center px-4 pb-8 pt-24 sm:px-6 sm:pb-10 sm:pt-28">
    <div className="mx-auto max-w-5xl text-center">
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="text-4xl font-bold leading-[0.95] drop-shadow-lg sm:text-6xl md:text-7xl"
      >
        <span className="block font-heading">Your Board of Directors.</span>
        <span
          className={`mt-2 block ${playfairDisplay.className} italic text-[#00D4FF] sm:mt-3`}
        >
          On Demand.
        </span>
      </motion.h1>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="mt-4 px-2 font-heading text-lg italic font-semibold leading-snug text-white/85 sm:mt-5 sm:text-2xl md:text-3xl"
      >
        You bring the vision. They bring the firepower.
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.18 }}
        className="mx-auto mt-5 max-w-4xl sm:mt-8"
      >
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/60 sm:text-sm sm:tracking-[0.24em]">
          Powered by a Multi-Model Board
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:mt-5 sm:gap-3">
          {modelPills.map((model, index) => (
            <motion.div
              key={model.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.22 + index * 0.06 }}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.65rem] font-medium tracking-[0.06em] backdrop-blur-md transition-all duration-300 hover:-translate-y-[1px] sm:px-3.5 sm:py-1.5 sm:text-[0.7rem] sm:tracking-[0.08em]"
              style={{
                borderColor: `${model.color}66`,
                color: model.color,
                backgroundColor: `${model.color}14`,
                boxShadow: `0 0 18px ${model.color}22`,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: model.color }}
              />
              {model.label}
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.28 }}
        className="mt-6 flex flex-col justify-center gap-3 sm:mt-8 sm:flex-row sm:gap-4"
      >
        <Button
          asChild
          className="h-12 bg-[#00D4FF] px-6 text-base text-[#0b1730] hover:bg-[#5be6ff] sm:h-auto sm:px-8 sm:py-6"
        >
          <Link href="/waitlist">
            Enter the Boardroom <ArrowRight />
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          className="h-11 border-white/40 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white sm:h-auto sm:px-8 sm:py-6"
        >
          <Link href="#how-it-works">See How It Works</Link>
        </Button>
      </motion.div>
    </div>
  </div>
</section>

      <section className="border-y border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 items-center gap-16 md:grid-cols-2">
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
                THE SOLO FOUNDER REALITY
              </p>

              <h3 className="mt-6 max-w-xl text-2xl font-medium italic leading-snug text-white/90 md:text-3xl lg:text-4xl">
                “Most founders don’t fail from lack of effort. They fail from making decisions alone.”
              </h3>
            </div>

            <ul className="space-y-5 text-sm text-white/70 md:text-base">
              {[
                "You’re facing a pivotal decision with no senior team to pressure-test it with",
                "One advisor gives you one perspective — often their own biases included",
                "You find yourself searching for an answer at midnight hoping something fits",
                "You make the call. You live with it. You wonder what you missed.",
                "The founders who win aren’t smarter — they’re just better informed",
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="mt-[2px] text-[#00D4FF]">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
            Six Models. Six Perspectives. One Boardroom.
          </p>

          <h2 className="mt-6 text-3xl font-semibold leading-tight text-white md:text-4xl lg:text-5xl">
            This Isn’t One AI
            <br />
            <span
              className={`${playfairDisplay.className} italic text-[#00D4FF]`}
            >
              Wearing Six Hats.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
            Every other AI tool gives you one model&apos;s answer — one worldview, one
            set of training data, one perspective filtered through one architecture.
            Directorium is architecturally different. Each board member is powered by
            a <span className="italic">distinct</span> AI model from a distinct
            organization. That means genuinely different reasoning, different
            strengths, different blind spots — and real disagreement by design.
          </p>

          <div className="mt-12 flex items-start gap-4 rounded-xl border border-white/10 bg-gradient-to-b from-[#1a2942]/90 to-[#0b1730]/90 p-6 text-left backdrop-blur-sm md:gap-6 md:p-10">
            <div className="mt-1 text-xl text-[#00D4FF] md:text-2xl">⚡</div>

            <div>
              <h3 className="text-lg font-semibold text-white/90 md:text-xl">
                Why Different Models — Not Just Different Prompts — Actually Matters
              </h3>

              <p className="mt-4 text-sm leading-relaxed text-white/70 md:text-base">
                Claude reasons with nuance and ethical depth. Gemini brings
                Google-scale research synthesis. Perplexity grounds answers in
                real-time sourced data. OpenAI&apos;s GPT-4 delivers razor-sharp
                analytical logic. Mistral offers European-trained multilingual
                precision. Grok cuts through consensus with unfiltered contrarian
                challenge. When six genuinely different intelligences examine the same
                decision, you don&apos;t get an echo chamber. You get a real debate —
                the kind that actually stress-tests your thinking before you commit.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
                Meet the Board
              </p>

              <h2 className="mt-6 text-3xl font-semibold leading-tight text-white md:text-4xl lg:text-5xl">
                Six Advisors.
                <br />
                <span
                  className={`${playfairDisplay.className} italic text-[#00D4FF]`}
                >
                  Six Distinct Minds.
                </span>
              </h2>
            </div>

            <p className="max-w-sm text-sm leading-relaxed text-white/70 md:text-right md:text-base">
              Each advisor is a specialist persona powered by a purpose-matched AI
              model — chosen because their architecture fits the role. This isn&apos;t
              decoration. It&apos;s deliberate.
            </p>
          </div>

          <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:grid-cols-2 lg:grid-cols-3">
            {boardMembers.map((member, index) => (
              <motion.div
                key={member.codename}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                whileHover={{ y: -6, scale: 1.01 }}
                className="group relative overflow-hidden border-b border-r border-white/10 bg-[#1a2942]/55 p-8 transition-all duration-300 hover:bg-[#22385c]/85"
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(to bottom, ${member.color}22 0%, transparent 55%)`,
                  }}
                />

                <div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-[3px] origin-left scale-x-0 opacity-100 transition-transform duration-300 group-hover:scale-x-100"
                  style={{ backgroundColor: member.color }}
                />

                <div className="relative z-20">
                  <p className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/45">
                    <span className="inline-block h-px w-4 bg-[#00D4FF]/70" />
                    {member.codename}
                  </p>

                  <h3 className="mt-4 text-2xl font-medium text-white/92">
                    {member.title}
                  </h3>

                  <p className="mt-4 text-sm leading-relaxed text-white/68">
                    {member.description}
                  </p>

                  <div
                    className="mt-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.65rem] font-medium tracking-[0.08em]"
                    style={{
                      borderColor: `${member.color}66`,
                      color: member.color,
                      backgroundColor: `${member.color}14`,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: member.color }}
                    />
                    {member.model}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              The Process
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white md:text-4xl lg:text-5xl">
              A Structured Boardroom,
              <br />
              <span
                className={`${playfairDisplay.className} italic text-[#00D4FF]`}
              >
                Every Single Time.
              </span>
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
              Every decision runs through the same rigorous sequence — built for speed
              without sacrificing depth.
            </p>
          </motion.div>

          <div className="relative mt-16">
            <div className="absolute left-[12.5%] right-[12.5%] top-6 hidden h-px bg-gradient-to-r from-transparent via-[#00D4FF]/40 to-transparent lg:block" />

            <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
              {[
                {
                  roman: "I",
                  title: "Bring a Decision",
                  description:
                    "Describe what you're facing — a pricing call, a hire, a pivot, a partnership, a product bet. No format required. Just tell the board what's on the table.",
                },
                {
                  roman: "II",
                  title: "The Board Convenes",
                  description:
                    "All six advisors — each running on their own distinct AI model — analyze your situation simultaneously through their specialized lens.",
                },
                {
                  roman: "III",
                  title: "The Debate Begins",
                  description:
                    "Six perspectives collide. Conflicting viewpoints surface. Assumptions get tested. Blind spots get named. Real disagreement, by design.",
                },
                {
                  roman: "IV",
                  title: "You Get a Verdict",
                  description:
                    "A clear synthesis — not just data, but a decision-ready perspective built from every angle the board raised. You decide. Better informed than you've ever been.",
                },
              ].map((step, index) => (
                <motion.div
                  key={step.roman}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="group relative px-4 text-center lg:px-6"
                >
                  <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-[#00D4FF] bg-[#0b1730] text-base font-semibold text-[#00D4FF] transition-all duration-300 ease-out group-hover:scale-105 group-hover:bg-[#00D4FF] group-hover:text-[#0b1730]">
                    <span className={`${playfairDisplay.className} text-lg`}>
                      {step.roman}
                    </span>
                  </div>

                  <h3
                    className={`${playfairDisplay.className} text-2xl font-semibold text-white/90`}
                  >
                    {step.title}
                  </h3>

                  <p className="mt-3 text-sm leading-relaxed text-white/68">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#22314a] py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
          <div>
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#00D4FF]">
              Built for Solo Founders
            </div>

            <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
              You Shouldn&apos;t Have
              <br />
              to Decide{" "}
              <span
                className={`${playfairDisplay.className} italic font-normal text-[#00D4FF]`}
              >
                Alone.
              </span>
            </h2>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/75 sm:text-lg">
              The most expensive decisions most founders make aren&apos;t the ones they
              got wrong, they&apos;re the ones they made without enough perspective to
              know any better. Directorium doesn&apos;t replace your judgment. It
              sharpens it. Six genuine intelligences, each with their own architecture
              and worldview, are at the table every time you need to make a call,
              whether it&apos;s Tuesday at 2pm or Thursday at 2am.
            </p>

            <p className="mt-4 max-w-2xl text-base leading-8 text-white/75 sm:text-lg">
              No scheduling. No retainers. No waiting for someone to get back to you.
              The boardroom is open whenever you need it.
            </p>
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex items-start gap-6 border-b border-white/10 pb-8">
              <div
                className={`w-[100px] shrink-0 text-right text-5xl leading-none text-[#00D4FF] sm:w-[110px] sm:text-6xl ${playfairDisplay.className}`}
              >
                6
              </div>
              <div className="pt-1 text-white/70">
                <div className="mb-1 text-base font-semibold text-white">
                  Distinct AI Models
                </div>
                <p className="text-sm leading-7 sm:text-[15px]">
                  Claude, Gemini, Perplexity, OpenAI, Mistral, and Grok, six
                  separate architectures, six genuine worldviews, one coordinated
                  boardroom.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6 border-b border-white/10 pb-8">
              <div
                className={`w-[100px] shrink-0 text-right text-5xl leading-none text-[#00D4FF] sm:w-[110px] sm:text-6xl ${playfairDisplay.className}`}
              >
                6
              </div>
              <div className="pt-1 text-white/70">
                <div className="mb-1 text-base font-semibold text-white">
                  Specialist Personas
                </div>
                <p className="text-sm leading-7 sm:text-[15px]">
                  Strategy, finance, growth, operations, risk, and contrarian
                  challenge, each role filled by the model best architected for that
                  kind of thinking.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-8">
              <div
                className={`w-[110px] shrink-0 text-right text-5xl leading-none tracking-tight text-[#00D4FF] sm:w-[130px] sm:text-6xl ${playfairDisplay.className}`}
              >
                24/7
              </div>
              <div className="pt-2 text-white/70">
                <div className="mb-2 text-base font-semibold leading-snug text-white">
                  On Demand, Always
                </div>
                <p className="text-sm leading-7 sm:text-[15px]">
                  Your board doesn&apos;t have a calendar. Bring any decision, any
                  time, the full boardroom is there in seconds, every single time you
                  need it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="waitlist"
        className="relative overflow-hidden px-4 py-32 text-center sm:px-6"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute bottom-0 left-1/2 h-[60%] w-[80%] -translate-x-1/2 rounded-full bg-[#00D4FF]/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-4 py-1 text-xs font-medium uppercase tracking-wider text-[#00D4FF]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#00D4FF]" />
            Now in Development — Early Access Available
          </div>

          <div className="mb-6 text-xs font-semibold uppercase tracking-[0.3em] text-[#00D4FF]/70">
            Directorium is Coming
          </div>

          <h2
            className={`${playfairDisplay.className} text-4xl font-light leading-tight tracking-tight text-white sm:text-5xl md:text-6xl`}
          >
            The Best Decision You&apos;ll Make
            <br />
            Today Is{" "}
            <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
              Getting Access.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/70 sm:text-lg">
            Join the waitlist and be first in the boardroom when Directorium launches.
            Early access members get priority entry, founder pricing, and direct
            input into what the board focuses on first.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/waitlist"
              className="rounded-full bg-[#00D4FF] px-8 py-3 text-sm font-semibold text-black transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(0,212,255,0.5)]"
            >
              Join the Waitlist
            </a>

            <a
              href="/"
              className="rounded-full border border-white/20 px-8 py-3 text-sm font-semibold text-white/80 transition-all duration-300 hover:border-white/40 hover:text-white"
            >
              Learn About Entrepreneuria
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Playfair_Display } from "next/font/google";
import { MODEL_COLORS } from "@/lib/model-colors";
import AccentItalic from "@/components/ui/AccentItalic";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

const boardMembers = [
  {
    codename: "I",
    title: "The Strategist",
    model: "Claude",
    color: MODEL_COLORS.claude,
    description:
      "Sees the big picture, identifies leverage points, and helps shape direction with structured strategic thinking.",
  },
  {
    codename: "II",
    title: "The Capitalist",
    model: "Gemini",
    color: MODEL_COLORS.gemini,
    description:
      "Evaluates business viability, monetization, and economic logic with a measured, analytical lens.",
  },
  {
    codename: "III",
    title: "The Growth Architect",
    model: "Perplexity",
    color: MODEL_COLORS.perplexity,
    description:
      "Builds scalable growth pathways, messaging angles, and expansion opportunities across channels.",
  },
  {
    codename: "IV",
    title: "The Operator",
    model: "OpenAI",
    color: MODEL_COLORS.chatgpt,
    description:
      "Pushes for execution, velocity, and operational clarity when ideas need to become action.",
  },
  {
    codename: "V",
    title: "The Risk Analyst",
    model: "Mistral",
    color: MODEL_COLORS.mistral,
    description:
      "Flags weaknesses, validates assumptions, and pressure-tests decisions with evidence-driven scrutiny.",
  },
  {
    codename: "VI",
    title: "The Contrarian",
    model: "Grok",
    color: MODEL_COLORS.grok,
    description:
      "Challenges consensus, surfaces blind spots, and introduces alternative angles the room may miss.",
  },
];

const models = [
  { name: "OpenAI", color: MODEL_COLORS.chatgpt },
  { name: "Claude", color: MODEL_COLORS.claude },
  { name: "Gemini", color: MODEL_COLORS.gemini },
  { name: "Grok", color: MODEL_COLORS.grok },
  { name: "Perplexity", color: MODEL_COLORS.perplexity },
  { name: "Mistral", color: MODEL_COLORS.mistral },
];

export default function DirectoriumPage() {
  return (
    <main className="min-h-screen overflow-hidden text-white">
      <section className="relative -mt-[calc(var(--header-height)+1rem)] flex min-h-[70vh] sm:min-h-[75vh] items-center justify-center overflow-hidden">
        <PageHeader
          title=""
          subtitle=""
          videoSrc="/videos/directorium-header.mp4"
          imageSrc="/images/home-fallback.jpg"
        />

        <div className="absolute inset-0 z-20 flex items-center justify-center px-4 sm:px-6">
          <div className="mx-auto max-w-5xl text-center">
            {/* H1 */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-4xl font-bold leading-tight drop-shadow-lg sm:text-5xl md:text-6xl"
            >
              Your Board of Directors.
              <br />
              <AccentItalic>On Demand.</AccentItalic>
            </motion.h1>

            {/* H2 */}
            <motion.h2
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mt-3 text-lg italic text-white/85 sm:text-xl md:text-2xl"
            >
              You bring the vision. They bring the firepower.
            </motion.h2>

            {/* MODEL PILLS */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.3 }}
              className="mt-5 flex flex-wrap justify-center gap-2 sm:gap-3"
            >
              {models.map((model) => (
                <span
                  key={model.name}
                  className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-md sm:px-4 sm:text-sm"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: model.color,
                      boxShadow: `0 0 10px ${model.color}88`,
                    }}
                  />
                  {model.name}
                </span>
              ))}
            </motion.div>

            {/* CTA BUTTONS */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
            >
              <button className="rounded-xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-[#061426] transition hover:shadow-[0_0_25px_rgba(103,232,249,0.4)]">
                Start Board Session
              </button>

              <button className="rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                Join Waitlist
              </button>
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
                “Most founders don’t fail from lack of effort. They fail from
                making decisions alone.”
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
            Every other AI tool gives you one model&apos;s answer — one
            worldview, one set of training data, one perspective filtered
            through one architecture. Directorium is architecturally different.
            Each board member is powered by a{" "}
            <span className="italic">distinct</span> AI model from a distinct
            organization. That means genuinely different reasoning, different
            strengths, different blind spots — and real disagreement by design.
          </p>

          <div className="mt-12 flex items-start gap-4 rounded-xl border border-white/10 bg-gradient-to-b from-[#1a2942]/90 to-[#0b1730]/90 p-6 text-left backdrop-blur-sm md:gap-6 md:p-10">
            <div className="mt-1 text-xl text-[#00D4FF] md:text-2xl">⚡</div>

            <div>
              <h3 className="text-lg font-semibold text-white/90 md:text-xl">
                Why Different Models — Not Just Different Prompts — Actually
                Matters
              </h3>

              <p className="mt-4 text-sm leading-relaxed text-white/70 md:text-base">
                Claude reasons with nuance and ethical depth. Gemini brings
                Google-scale research synthesis. Perplexity grounds answers in
                real-time sourced data. OpenAI&apos;s GPT-4 delivers razor-sharp
                analytical logic. Mistral offers European-trained multilingual
                precision. Grok cuts through consensus with unfiltered
                contrarian challenge. When six genuinely different intelligences
                examine the same decision, you don&apos;t get an echo chamber.
                You get a real debate — the kind that actually stress-tests your
                thinking before you commit.
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
              Each advisor is a specialist persona powered by a purpose-matched
              AI model — chosen because their architecture fits the role. This
              isn&apos;t decoration. It&apos;s deliberate.
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
              Every decision runs through the same rigorous sequence — built for
              speed without sacrificing depth.
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
              The most expensive decisions most founders make aren&apos;t the
              ones they got wrong, they&apos;re the ones they made without
              enough perspective to know any better. Directorium doesn&apos;t
              replace your judgment. It sharpens it. Six genuine intelligences,
              each with their own architecture and worldview, are at the table
              every time you need to make a call, whether it&apos;s Tuesday at
              2pm or Thursday at 2am.
            </p>

            <p className="mt-4 max-w-2xl text-base leading-8 text-white/75 sm:text-lg">
              No scheduling. No retainers. No waiting for someone to get back to
              you. The boardroom is open whenever you need it.
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
                  separate architectures, six genuine worldviews, one
                  coordinated boardroom.
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
                  challenge, each role filled by the model best architected for
                  that kind of thinking.
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
                  Your board doesn&apos;t have a calendar. Bring any decision,
                  any time, the full boardroom is there in seconds, every single
                  time you need it.
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
            <span
              className={`${playfairDisplay.className} italic text-[#00D4FF]`}
            >
              Getting Access.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/70 sm:text-lg">
            Join the waitlist and be first in the boardroom when Directorium
            launches. Early access members get priority entry, founder pricing,
            and direct input into what the board focuses on first.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/waitlist"
              className="rounded-full bg-[#00D4FF] px-8 py-3 text-sm font-semibold text-black transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(0,212,255,0.5)]"
            >
              Join the Waitlist
            </a>

            <Link
              href="/"
              className="rounded-full border border-white/20 px-8 py-3 text-sm font-semibold text-white/80 transition-all duration-300 hover:border-white/40 hover:text-white"
            >
              Learn About Entrepreneuria
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

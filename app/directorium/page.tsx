"use client";

import { motion } from "framer-motion";

import { MODEL_COLORS } from "@/lib/model-colors";
import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import {
  PillButton,
  GhostButton,
  StatusDot,
  fadeUp,
} from "@/components/marketing/primitives";

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

const reality = [
  "You're facing a pivotal decision with no senior team to pressure-test it with",
  "One advisor gives you one perspective — often their own biases included",
  "You find yourself searching for an answer at midnight hoping something fits",
  "You make the call. You live with it. You wonder what you missed.",
  "The founders who win aren't smarter — they're just better informed",
];

const processSteps = [
  {
    roman: "I",
    title: "Bring a decision",
    description:
      "Describe what you're facing — a pricing call, a hire, a pivot, a partnership, a product bet. No format required. Just tell the board what's on the table.",
  },
  {
    roman: "II",
    title: "The board convenes",
    description:
      "All six advisors — each running on their own distinct AI model — analyze your situation simultaneously through their specialized lens.",
  },
  {
    roman: "III",
    title: "The debate begins",
    description:
      "Six perspectives collide. Conflicting viewpoints surface. Assumptions get tested. Blind spots get named. Real disagreement, by design.",
  },
  {
    roman: "IV",
    title: "You get a verdict",
    description:
      "A clear synthesis — not just data, but a decision-ready perspective built from every angle the board raised. You decide. Better informed than you've ever been.",
  },
];

const numbers = [
  {
    value: "6",
    title: "Distinct AI models",
    body: "Claude, Gemini, Perplexity, OpenAI, Mistral, and Grok, six separate architectures, six genuine worldviews, one coordinated boardroom.",
  },
  {
    value: "6",
    title: "Specialist personas",
    body: "Strategy, finance, growth, operations, risk, and contrarian challenge, each role filled by the model best architected for that kind of thinking.",
  },
  {
    value: "24/7",
    title: "On demand, always",
    body: "Your board doesn't have a calendar. Bring any decision, any time, the full boardroom is there in seconds, every single time you need it.",
  },
];

export default function DirectoriumPage() {
  return (
    <PageShell>
      <PageHero
        kicker={
          <span className="inline-flex items-center gap-3">
            <StatusDot live={false} />
            Directorium · AI board of directors — in development
          </span>
        }
        title={
          <>
            Your board of directors. <em className="italic">On demand</em>.
          </>
        }
        lede="You bring the vision. They bring the firepower. Six distinct AI models around one table, pressure-testing every decision before you commit."
      >
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {models.map((model) => (
            <span
              key={model.name}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/80"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: model.color,
                  boxShadow: `0 0 8px ${model.color}88`,
                }}
              />
              {model.name}
            </span>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-4">
          <PillButton href="/waitlist">Join the waitlist</PillButton>
          <GhostButton href="#how-it-works">See how it works</GhostButton>
        </div>
      </PageHero>

      <Section kicker="01 — The solo founder reality">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <motion.blockquote
            {...fadeUp}
            className="border-l-2 border-[#d27a2c] pl-6 text-2xl font-medium italic leading-snug text-white sm:text-3xl"
          >
            “Most founders don't fail from lack of effort. They fail from
            making decisions alone.”
          </motion.blockquote>

          <ul className="space-y-5">
            {reality.map((item) => (
              <li key={item} className="flex gap-3 leading-7 text-white/60">
                <span aria-hidden="true" className="text-white/30">
                  —
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        kicker="02 — Six models. Six perspectives. One boardroom."
        title={
          <>
            This isn&apos;t one AI wearing{" "}
            <em className="italic">six hats</em>.
          </>
        }
        lede={
          <>
            Every other AI tool gives you one model&apos;s answer — one
            worldview, one set of training data, one perspective filtered
            through one architecture. Directorium is architecturally different.
            Each board member is powered by a{" "}
            <em className="italic">distinct</em> AI model from a distinct
            organization. That means genuinely different reasoning, different
            strengths, different blind spots — and real disagreement by design.
          </>
        }
      >
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-9">
          <h3 className="text-xl font-semibold text-white">
            Why different models — not just different prompts — actually
            matters
          </h3>
          <p className="mt-4 leading-7 text-white/60">
            Claude reasons with nuance and ethical depth. Gemini brings
            Google-scale research synthesis. Perplexity grounds answers in
            real-time sourced data. OpenAI&apos;s GPT-4 delivers razor-sharp
            analytical logic. Mistral offers European-trained multilingual
            precision. Grok cuts through consensus with unfiltered contrarian
            challenge. When six genuinely different intelligences examine the
            same decision, you don&apos;t get an echo chamber. You get a real
            debate — the kind that actually stress-tests your thinking before
            you commit.
          </p>
        </div>
      </Section>

      <Section
        kicker="03 — Meet the board"
        title={
          <>
            Six advisors. Six <em className="italic">distinct</em> minds.
          </>
        }
        lede="Each advisor is a specialist persona powered by a purpose-matched AI model — chosen because their architecture fits the role. This isn't decoration. It's deliberate."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {boardMembers.map((member) => (
            <motion.article
              key={member.codename}
              whileHover={{ y: -4 }}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25 sm:p-8"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                style={{ backgroundColor: member.color }}
              />
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/40 [font-family:var(--font-label)]">
                {member.codename}
              </p>
              <h3 className="mt-3 text-2xl font-medium tracking-tight text-white">
                {member.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/60">
                {member.description}
              </p>
              <p
                className="mt-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.08em]"
                style={{
                  borderColor: `${member.color}55`,
                  color: member.color,
                  backgroundColor: `${member.color}12`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: member.color }}
                />
                {member.model}
              </p>
            </motion.article>
          ))}
        </div>
      </Section>

      <Section
        id="how-it-works"
        kicker="04 — The process"
        title={
          <>
            A structured boardroom, <em className="italic">every</em> single
            time.
          </>
        }
        lede="Every decision runs through the same rigorous sequence — built for speed without sacrificing depth."
      >
        <ul className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step) => (
            <li key={step.roman} className="flex gap-5">
              <span className="pt-1 text-[11px] tracking-[0.2em] text-white/35 [font-family:var(--font-label)]">
                {step.roman}
              </span>
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        kicker="05 — Built for solo founders"
        title={
          <>
            You shouldn&apos;t have to decide{" "}
            <em className="italic">alone</em>.
          </>
        }
      >
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div className="max-w-2xl space-y-5 leading-8 text-white/60">
            <p>
              The most expensive decisions most founders make aren&apos;t the
              ones they got wrong, they&apos;re the ones they made without
              enough perspective to know any better. Directorium doesn&apos;t
              replace your judgment. It sharpens it. Six genuine
              intelligences, each with their own architecture and worldview,
              are at the table every time you need to make a call, whether
              it&apos;s Tuesday at 2pm or Thursday at 2am.
            </p>
            <p>
              No scheduling. No retainers. No waiting for someone to get back
              to you. The boardroom is open whenever you need it.
            </p>
          </div>

          <div className="flex flex-col divide-y divide-white/10">
            {numbers.map((item) => (
              <div key={item.title} className="flex items-start gap-6 py-6 first:pt-0 last:pb-0">
                <p className="w-[90px] shrink-0 text-right text-5xl font-medium tracking-tight text-white">
                  {item.value}
                </p>
                <div>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/60">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section id="waitlist" kicker="06 — Early access">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-14 text-center sm:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.25),transparent_65%)]"
          />
          <p className="relative mx-auto mb-6 flex w-fit items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-white/45 [font-family:var(--font-label)]">
            <StatusDot live={false} /> Now in development — early access
            available
          </p>
          <h2 className="relative text-balance text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
            The best decision you&apos;ll make today is{" "}
            <em className="italic">getting access</em>.
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl leading-7 text-white/60">
            Join the waitlist and be first in the boardroom when Directorium
            launches. Early access members get priority entry, founder
            pricing, and direct input into what the board focuses on first.
          </p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <PillButton href="/waitlist">Join the waitlist</PillButton>
            <GhostButton href="/about">
              Learn about Entrepreneuria
            </GhostButton>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}

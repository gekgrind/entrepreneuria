import type { Metadata } from "next";

import { ADVISORS } from "@/lib/directorium/advisors";
import { PageShell } from "@/components/marketing/PageShell";
import { Section } from "@/components/marketing/Section";
import {
  PillButton,
  GhostButton,
  StatusDot,
} from "@/components/marketing/primitives";
import { ChamberHero } from "@/components/directorium/ChamberHero";
import { Reveal } from "@/components/directorium/Reveal";
import { SixHatsDiagram } from "@/components/directorium/SixHatsDiagram";
import { BoardGrid } from "@/components/directorium/BoardGrid";
import { ProcessSequence } from "@/components/directorium/ProcessSequence";
import { BoardReadouts } from "@/components/directorium/BoardReadouts";
import { ConveneCta } from "@/components/directorium/ConveneCta";
import {
  ChamberAtmosphere,
  CouncilChamber,
} from "@/components/directorium/chamber/CouncilChamber";
import { HeroChamberStage } from "@/components/directorium/HeroChamberStage";
import { DirectoriumMotion } from "@/components/directorium/motion/DirectoriumMotion";
import { CONSTELLATION_MODE } from "@/lib/constellation";

const TITLE = "Directorium — Your AI Board of Directors | Entrepreneuria";
const DESCRIPTION =
  "Your board of directors, on demand. Six distinct AI models around one table, pressure-testing every decision before you commit. Now in development — join the waitlist.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "https://entrepreneuria.io/directorium",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://entrepreneuria.io/directorium",
    siteName: "Entrepreneuria",
    type: "website",
    // Interim: ecosystem key art until the Directorium OG image exists.
    images: [
      {
        url: "/og/constellation-og.png",
        width: 1200,
        height: 630,
        alt: "The Entrepreneuria ecosystem — an ecosystem of intelligence surrounding one founder.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og/constellation-og.png"],
  },
};

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

/**
 * /directorium — "The Chamber Convenes".
 *
 * Server-rendered in its finished state: every chamber composition is
 * static SVG + HTML, and the copy is the semantic truth. Client islands
 * are limited to the shared hero/section entrances, the fadeUp Reveal
 * wrapper, ProcessStateSync (which only flips chamber state), and the
 * Phase 2 motion layer:
 *   - hero assembly + ambient: CSS (starts with first paint), paused
 *     off-screen and given pointer depth by HeroChamberStage
 *   - scroll choreography: DirectoriumMotion (deferred GSAP engine)
 * Reduced motion and the static kill switch
 * (NEXT_PUBLIC_CONSTELLATION_MODE=static) render the compositions at rest.
 */
export default function DirectoriumPage() {
  const motionEnabled = CONSTELLATION_MODE !== "static";
  return (
    <PageShell>
      <ChamberHero
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
        visual={
          <HeroChamberStage atmosphere={<ChamberAtmosphere className="inset-[-22%]" />}>
            <CouncilChamber
              id="hero"
              state="convened"
              intro={motionEnabled ? "hero" : undefined}
              ambient={motionEnabled}
              title="The Directorium council chamber: six advisors — Strategist, Contrarian, Risk Analyst, Capitalist, Operator, and Growth Architect — seated around one founder decision."
            />
          </HeroChamberStage>
        }
      >
        <ul role="list" aria-label="Models on the board" className="flex flex-wrap gap-2 sm:gap-2.5">
          {ADVISORS.map((advisor) => (
            <li
              key={advisor.id}
              className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.035] px-3.5 py-1.5 text-xs text-white/80"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: advisor.color,
                  boxShadow: `0 0 8px ${advisor.color}88`,
                }}
              />
              {advisor.model}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-4">
          <PillButton href="/waitlist">Join the waitlist</PillButton>
          <GhostButton href="#how-it-works">See how it works</GhostButton>
        </div>
      </ChamberHero>

      <Section bordered={false} kicker="01 — The solo founder reality">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal
            as="blockquote"
            className="border-l-2 border-[#d27a2c] pl-6 text-2xl font-medium italic leading-snug text-white sm:text-3xl"
          >
            “Most founders don&apos;t fail from lack of effort. They fail from
            making decisions alone.”
          </Reveal>

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
        bordered={false}
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
        <SixHatsDiagram />

        <div className="mt-20 grid gap-6 lg:mt-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <h3 className="max-w-md text-balance text-2xl font-medium leading-snug tracking-tight text-white sm:text-3xl">
            Why different models — not just different prompts — actually
            matters
          </h3>
          <p className="leading-8 text-white/60">
            Claude reasons with nuance and ethical depth. Gemini brings
            Google-scale research synthesis. Perplexity grounds answers in
            real-time sourced data. OpenAI delivers razor-sharp
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
        bordered={false}
        kicker="03 — Meet the board"
        title={
          <>
            Six advisors. Six <em className="italic">distinct</em> minds.
          </>
        }
        lede="Each advisor is a specialist persona powered by a purpose-matched AI model — chosen because their architecture fits the role. This isn't decoration. It's deliberate."
      >
        <BoardGrid />
      </Section>

      <Section
        bordered={false}
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
        <ProcessSequence steps={processSteps} />
      </Section>

      <Section
        bordered={false}
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

          <BoardReadouts items={numbers} />
        </div>
      </Section>

      <ConveneCta
        id="waitlist"
        kicker="06 — Early access"
        status="Now in development — early access available"
        title={
          <>
            The best decision you&apos;ll make today is{" "}
            <em className="italic">getting access</em>.
          </>
        }
        lede="Join the waitlist and be first in the boardroom when Directorium launches. Early access members get priority entry, founder pricing, and direct input into what the board focuses on first."
      />

      {motionEnabled ? <DirectoriumMotion /> : null}
    </PageShell>
  );
}

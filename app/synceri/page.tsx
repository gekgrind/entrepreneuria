import type { Metadata } from "next";

import { getPrimaryCta } from "@/lib/launch";
import { getProduct, PRODUCT_STATUS_LABELS } from "@/lib/ecosystem/products";
import { ProductShot } from "@/components/home/ProductShot";
import {
  FlowCanvas,
  Glow,
  PaperBleed,
} from "@/components/marketing/flow/atmosphere";
import { FlowSection, Panel } from "@/components/marketing/flow/FlowSection";
import { Reveal, RevealGroup } from "@/components/marketing/flow/Reveal";
import {
  PrimaryAction,
  SecondaryAction,
} from "@/components/marketing/flow/cta";
import { CapacityView } from "@/components/synceri/CapacityView";
import { ChannelRelay } from "@/components/synceri/ChannelRelay";
import { CirclePermissions } from "@/components/synceri/CirclePermissions";
import { ContextField } from "@/components/synceri/ContextField";
import { DayThread } from "@/components/synceri/DayThread";
import { MemoryLedger } from "@/components/synceri/MemoryLedger";
import { SyncMoment } from "@/components/synceri/SyncMoment";

const TITLE = "Synceri — Keep your life in sync | Entrepreneuria";
const DESCRIPTION =
  "Synceri remembers what matters, understands how it connects, notices what's coming, and helps you handle it. A personal intelligence for everything you're keeping track of. In development — join the waitlist.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://entrepreneuria.io/synceri" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://entrepreneuria.io/synceri",
    siteName: "Entrepreneuria",
    type: "website",
    // Interim: ecosystem key art until a Synceri OG image exists.
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

/** Where it all currently lives, in the order a person would list it. */
const SOURCES = [
  "Your calendar",
  "Two inboxes",
  "A group chat",
  "The school portal",
  "A note on the fridge",
  "Four apps",
  "A voicemail you haven't played",
];

/** What the context field holds, said plainly. */
const HOLDS = [
  {
    title: "The people",
    body: "Who's in your life, what you owe them, what they told you last week, what they're waiting on.",
  },
  {
    title: "The commitments",
    body: "Appointments, deadlines, the thing you said you'd handle, the thing that happens every third Tuesday.",
  },
  {
    title: "The details",
    body: "Sizes, policy numbers, the code for the gate, when the warranty runs out, how long that drive actually takes.",
  },
];

/** The progression from reminding to doing — honestly staged. */
const LADDER = [
  {
    step: "01",
    title: "It tells you",
    body: "The reminder you'd have wanted, at the hour it's useful, with the context that makes it actionable.",
    horizon: "Core to the first release",
  },
  {
    step: "02",
    title: "It gets you ready",
    body: "The document pulled up before the call. The address, the route, the account number, the thing you said last time. Ready when you get there.",
    horizon: "Core to the first release",
  },
  {
    step: "03",
    title: "It handles it",
    body: "Booking the appointment, sending the follow-up, filling the form, putting the order in — each one on your say-so, and only where you've connected it.",
    horizon: "Planned, as integrations open up",
  },
];

/** The commodity capabilities, named and deliberately kept short. */
const ALSO = [
  "Ask it anything, the way you'd ask anyone",
  "Draft the message you're avoiding",
  "Read the letter and tell you what it actually says",
  "Look something up and come back with a straight answer",
  "Make sense of a photo, a PDF, a screenshot of a schedule",
];

/**
 * /synceri — "Keep your life in sync".
 *
 * A rebuild, not a polish pass. The page this replaced sold a
 * founder-facing life-admin tool through ten identical feature boxes.
 * Synceri is now a standalone consumer product, and the page is built
 * around the one thing that actually distinguishes it: it holds context
 * about a person's life and turns that into help before it's asked for.
 *
 * Built on the flow system (`/prospra` is the reference implementation):
 * one continuous field, no rules between sections, rhythm and light for
 * boundaries. Page-specific figures live in `components/synceri` and
 * carry the page's one visual idea — orange is the person's light, cyan
 * is Synceri's, and the threads between them run warm to cool.
 *
 * Product truth: Synceri is in development. Nothing here is written as
 * though it ships today. The forward-looking beats (approved actions,
 * voice and wearable surfaces, Circles) are marked where they sit, and
 * the close states the stage outright rather than scattering
 * disclaimers.
 */
export default function SynceriPage() {
  const synceri = getProduct("synceri");
  const cta = getPrimaryCta();
  const statusLabel = PRODUCT_STATUS_LABELS[synceri.status];
  const shot = synceri.screenshot;

  return (
    <FlowCanvas>
      {/* Without JS the IntersectionObserver never attaches, and the
          reveal CSS would leave the page blank. Hand those readers the
          finished state. */}
      {/* Without JS neither observer attaches — the flow system's
          reveals and the Synceri figures' Stage entrances would both be
          left hidden. Hand those readers the finished state. */}
      <noscript>
        <style>{`[data-flow-reveal],[data-flow-reveal-group]>*,[data-syn-item]{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section
        aria-labelledby="synceri-hero-heading"
        className="relative overflow-hidden px-6 pb-16 pt-[calc(var(--header-height)+80px)] sm:px-10 sm:pb-24 lg:px-16 lg:pt-[calc(var(--header-height)+112px)]"
      >
        {/* the person's light, top-left — the homepage hero's rhyme */}
        <Glow
          tone="human"
          className="hero-light-drift left-[-16%] top-[2%] h-[560px] w-[560px]"
          opacity={0.8}
        />
        <Glow
          tone="atmosphere"
          className="right-[-20%] top-[20%] h-[680px] w-[680px]"
          opacity={0.7}
        />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] xl:gap-20">
          <div>
            <Reveal distance={14}>
              <p className="type-kicker mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-white/55">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-intelligence shadow-[0_0_8px_rgba(0,212,255,0.8)]"
                  />
                  {synceri.name}
                </span>
                <span aria-hidden="true" className="text-white/25">
                  /
                </span>
                <span>Personal intelligence</span>
                <span aria-hidden="true" className="text-white/25">
                  /
                </span>
                <span>{statusLabel}</span>
              </p>
            </Reveal>

            <h1
              id="synceri-hero-heading"
              className="type-display-lg max-w-[17ch] text-balance"
            >
              Your life has a lot of moving pieces. Synceri keeps them in sync.
            </h1>

            <Reveal>
              <p className="type-lede mt-8 max-w-xl text-white/70">
                It remembers what matters, understands how it all connects,
                notices what&apos;s coming, and helps you handle it — before it
                turns into a problem.
              </p>
            </Reveal>

            <Reveal>
              <div className="mt-11 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <PrimaryAction href={cta.href}>{cta.label}</PrimaryAction>
                <SecondaryAction href="#understand">
                  See how it works
                </SecondaryAction>
              </div>
            </Reveal>
          </div>

          <div className="w-full max-w-xl xl:max-w-none xl:pt-4">
            <SyncMoment logo={synceri.logo} name={synceri.name} />
          </div>
        </div>
      </section>

      {/* ── Where it all lives ───────────────────────────────────── */}
      {/* Typographic by design. The problem is fragmentation, and
          rendering it as seven tidy boxes would contradict the sentence
          it's illustrating. */}
      <FlowSection
        id="fragments"
        layout="split"
        eyebrow="Where it all lives"
        title="None of it lives in one place."
        lede="And the rest of it — the part nobody ever wrote down — lives in your head. Which is fine, right up until the week you're carrying too much of it."
      >
        <div>
          <RevealGroup className="flex flex-wrap gap-x-3 gap-y-3">
            {SOURCES.map((source) => (
              <span
                key={source}
                className="rounded-full border border-white/[0.09] px-4 py-2 text-[15px] text-white/55"
              >
                {source}
              </span>
            ))}
          </RevealGroup>

          <Reveal>
            <p className="type-display-sm mt-14 max-w-[22ch] text-balance text-white">
              The work isn&apos;t doing the things. It&apos;s holding all of
              them at once.
            </p>
          </Reveal>
        </div>
      </FlowSection>

      {/* ── The shift ────────────────────────────────────────────── */}
      <FlowSection
        id="shift"
        eyebrow="The shift"
        title="Most assistants wait to be asked."
        lede="Which means you still have to know what to ask, and remember to ask it, at the exact moment it would have helped. That's not assistance. That's another thing to keep track of."
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-20">
          <Reveal>
            <p className="type-kinetic-interior max-w-[20ch] text-balance text-white">
              You shouldn&apos;t have to remember to use the thing that
              remembers for you.
            </p>
          </Reveal>

          <Reveal>
            <p className="leading-8 text-white/65">
              Synceri is built the other way round. It holds the moving pieces
              of your life, keeps track of how they fit together, and comes to
              you when something needs you — with enough context that
              you&apos;re not starting from scratch. The rest of the time, it
              stays out of your way.
            </p>
          </Reveal>
        </div>
      </FlowSection>

      {/* ── Remember & understand ────────────────────────────────── */}
      {/* The differentiator, and the page's centrepiece figure. */}
      <section
        id="understand"
        aria-labelledby="synceri-understand-heading"
        className="relative px-6 py-20 sm:px-10 sm:py-28 lg:px-16 lg:py-36"
      >
        <Glow
          tone="intelligence"
          className="left-1/2 top-[10%] h-[620px] w-[min(94vw,900px)] -translate-x-1/2"
          opacity={0.75}
        />

        <div className="relative mx-auto w-full max-w-6xl">
          <div className="max-w-2xl">
            <Reveal distance={14}>
              <p className="type-kicker mb-5 text-white/50">
                Remember &amp; understand
              </p>
            </Reveal>
            <h2
              id="synceri-understand-heading"
              className="type-display-md max-w-[18ch] text-balance"
            >
              It learns the shape of your life, not just your to-do list.
            </h2>
            <Reveal>
              <p className="type-lede mt-7 max-w-xl text-white/70">
                Tell it something once. A name, a preference, a date, a thing
                you keep meaning to do. Synceri keeps it, and — this is the
                part that matters — keeps track of what it has to do with
                everything else.
              </p>
            </Reveal>
          </div>

          <Reveal distance={34} className="mt-14 lg:mt-16">
            <ContextField />
          </Reveal>

          <RevealGroup
            as="dl"
            className="mx-auto mt-16 grid max-w-5xl gap-x-14 gap-y-10 sm:grid-cols-3"
          >
            {HOLDS.map((item) => (
              <div key={item.title}>
                <dt className="font-semibold text-white">{item.title}</dt>
                <dd className="mt-2.5 leading-7 text-white/65">{item.body}</dd>
              </div>
            ))}
          </RevealGroup>

          <Reveal>
            <p className="type-display-sm mx-auto mt-16 max-w-[30ch] text-balance text-center text-white/85">
              A calendar knows you have a dentist appointment. Synceri knows
              it&apos;s the one you moved twice, it&apos;s across town, and
              you&apos;ve got the school run at 3.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Anticipate ───────────────────────────────────────────── */}
      <FlowSection
        id="anticipate"
        layout="split"
        eyebrow="Anticipate"
        title="It notices what's coming."
        lede="Not one reminder, fired once, at the moment it's already too late to be useful. A commitment followed all the way through — and, eventually, a suggestion about how you'd rather be reminded."
      >
        <DayThread />
      </FlowSection>

      {/* ── Capacity ─────────────────────────────────────────────── */}
      <FlowSection
        id="today"
        eyebrow="What matters now"
        title="Some days, the honest answer is four things."
        lede="Calendars understand time. Task managers understand tasks. Neither of them understands the thing you actually needed help with, which is how much you can carry today."
      >
        <CapacityView />

        <Reveal>
          <p className="type-display-sm mt-16 max-w-[26ch] text-balance text-white/85">
            Synceri isn&apos;t trying to make you more productive. It&apos;s
            trying to make the day survivable.
          </p>
        </Reveal>
      </FlowSection>

      {/* ── The product ──────────────────────────────────────────── */}
      {/* Registry-driven: no screenshot, no frame, per the no-fake-UI
          rule. */}
      {shot ? (
        <section
          aria-labelledby="synceri-proof-heading"
          className="relative px-6 pb-20 pt-4 sm:px-10 sm:pb-28 lg:px-16 lg:pb-36"
        >
          <Glow
            tone="intelligence"
            className="left-1/2 top-[-6%] h-[520px] w-[min(94vw,940px)] -translate-x-1/2"
            opacity={0.75}
          />
          <div className="relative mx-auto w-full max-w-5xl">
            <div className="max-w-2xl">
              <Reveal distance={14}>
                <p className="type-kicker mb-5 text-white/50">Being built</p>
              </Reveal>
              <h2
                id="synceri-proof-heading"
                className="type-display-md text-balance"
              >
                What it looks like so far.
              </h2>
              <Reveal>
                <p className="type-lede mt-7 max-w-xl text-white/70">
                  One day, in one place: what deserves your attention, what
                  Synceri noticed on its own, and what&apos;s still waiting.
                </p>
              </Reveal>
            </div>

            <Reveal distance={34} className="mt-14 lg:mt-16">
              <ProductShot
                src={shot.src}
                alt={shot.alt}
                width={1200}
                height={750}
                caption={`${synceri.name} — the day view, ${statusLabel.toLowerCase()}`}
              />
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ── Act ──────────────────────────────────────────────────── */}
      <FlowSection
        id="act"
        layout="split"
        eyebrow="Act"
        title="Telling you is the easy part."
        lede="A reminder moves a task from the app back onto you. The useful version keeps going — and where Synceri can finish something, it should, with your say-so."
      >
        <RevealGroup as="ol" className="flex flex-col gap-11 sm:gap-14">
          {LADDER.map((rung) => (
            <li key={rung.step} className="relative flex gap-6 sm:gap-8">
              <span className="type-label relative z-10 mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-void-900 text-white/55 sm:h-8 sm:w-8">
                {rung.step}
              </span>
              <div className="min-w-0">
                <h3 className="type-display-sm text-white">{rung.title}</h3>
                <p className="mt-3 max-w-xl leading-7 text-white/65">
                  {rung.body}
                </p>
                <p className="type-label mt-4 text-white/35">{rung.horizon}</p>
              </div>
            </li>
          ))}
        </RevealGroup>
      </FlowSection>

      {/* ── Everywhere ───────────────────────────────────────────── */}
      <FlowSection
        id="everywhere"
        eyebrow="Everywhere"
        title="It meets you where the day is happening."
        lede="Opening an app is a thing you have to remember to do. Synceri is meant to reach you on whichever surface you're actually near — and to be quiet on the rest."
      >
        <ChannelRelay />
      </FlowSection>

      {/* ── Shared life ──────────────────────────────────────────── */}
      <FlowSection
        id="circles"
        eyebrow="Shared life"
        title="Some of it was never only yours."
        lede="Someone says “we need nappies.” Somebody buys them. Nobody texts three people to find out whether it's handled. That's a Circle — a small amount of shared context, and nothing else."
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <CirclePermissions />

          <Reveal>
            <div className="lg:pt-2">
              <h3 className="type-display-sm max-w-[20ch] text-balance text-white">
                Shared is a decision you make, row by row.
              </h3>
              <p className="mt-5 leading-8 text-white/65">
                A Circle shares the specific things you put in it. It is not a
                window into your life, it doesn&apos;t report where you are or
                what you&apos;ve been doing, and it doesn&apos;t give anyone a
                say over your day. Everyone in a Circle keeps their own
                Synceri, and their own privacy, entirely intact.
              </p>
              <p className="mt-5 leading-8 text-white/65">
                Coordination should cost less than a group chat. It should
                never cost independence.
              </p>
              <p className="type-label mt-7 text-white/35">
                Planned — after the first release
              </p>
            </div>
          </Reveal>
        </div>
      </FlowSection>

      {/* ── Also ─────────────────────────────────────────────────── */}
      {/* Deliberately compact. These capabilities are table stakes now;
          giving them a third of the page would misrepresent what makes
          Synceri worth having. */}
      <FlowSection
        id="also"
        layout="split"
        eyebrow="Also"
        title="And everything you'd expect an AI to do."
        lede="Synceri does the things you already know how to use an AI for. They're just not the reason it exists."
      >
        <div>
          <RevealGroup
            as="ul"
            className="divide-y divide-white/[0.08] border-y border-white/[0.08]"
          >
            {ALSO.map((item) => (
              <li key={item} className="py-5 leading-7 text-white/70">
                {item}
              </li>
            ))}
          </RevealGroup>

          <Reveal>
            <p className="mt-9 max-w-xl leading-8 text-white/55">
              Every assistant can hold a conversation. The difference is
              whether it knows anything about you when the conversation
              starts.
            </p>
          </Reveal>
        </div>
      </FlowSection>

      {/* ── Trust ────────────────────────────────────────────────── */}
      {/* The page's one temperature shift, spent on the section that
          earns it: a product that knows this much has to be the part you
          can see into. */}
      <PaperBleed direction="into" />

      <section
        aria-labelledby="synceri-trust-heading"
        className="relative bg-paper px-6 pb-20 pt-6 text-ink sm:px-10 sm:pb-28 lg:px-16"
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="max-w-2xl">
            <Reveal distance={14}>
              <p className="type-kicker mb-5 text-ink/55">Memory and control</p>
            </Reveal>
            <h2
              id="synceri-trust-heading"
              className="type-display-md text-balance"
            >
              Four questions you should be able to ask it.
            </h2>
            <Reveal>
              <p className="type-lede mt-7 max-w-xl text-ink/70">
                Synceri only works if it knows things about you. That makes
                inspection, explanation and deletion part of the product — not
                a policy page you never read.
              </p>
            </Reveal>
          </div>

          <Reveal className="mt-14 lg:mt-16">
            <MemoryLedger />
          </Reveal>

          <Reveal>
            <p className="mt-10 max-w-2xl leading-8 text-ink/65">
              These are the principles Synceri is being built to: what it knows
              is inspectable, what it does is explainable, what you remove is
              gone, and what it can reach is yours to grant and yours to take
              back.
            </p>
          </Reveal>
        </div>
      </section>

      <PaperBleed direction="out-of" />

      {/* ── The ecosystem ────────────────────────────────────────── */}
      {/* Kept to one beat on purpose. Synceri has to stand on its own
          for someone who will never touch another product here. */}
      <FlowSection
        id="ecosystem"
        eyebrow="If you also run a business"
        title="Then it has more to work with."
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16">
          <Reveal>
            <p className="leading-8 text-white/65">
              Synceri is part of Entrepreneuria, so for anyone building
              something, it can sit between the life and the business — the
              follow-up from this morning&apos;s conversation, the proposal
              that&apos;s due, the school pickup at 3, all understood as one
              person&apos;s day rather than two separate systems with two
              separate notification badges.
            </p>
            <p className="mt-5 leading-8 text-white/65">
              That&apos;s an advantage if you want it. It is not a requirement,
              and nothing about Synceri assumes you run anything at all.
            </p>
          </Reveal>

          <Reveal>
            <Panel className="h-fit p-7 sm:p-8">
              <p className="type-label text-white/45">Works with</p>
              <p className="mt-4 leading-8 text-white/75">
                Prospra, Architecta, Directorium and Channelwright — as each
                one ships.
              </p>
              <p className="mt-6 border-t border-white/[0.08] pt-5 leading-7 text-white/55">
                Synceri works on its own from day one. The ecosystem is the
                ceiling, not the entry price.
              </p>
            </Panel>
          </Reveal>
        </div>
      </FlowSection>

      {/* ── The close ────────────────────────────────────────────── */}
      <section
        aria-labelledby="synceri-close-heading"
        className="relative overflow-hidden px-6 pb-36 pt-8 text-center sm:px-10 sm:pb-44 lg:px-16"
      >
        <Glow
          tone="human"
          className="left-1/2 top-[6%] h-[560px] w-[min(94vw,800px)] -translate-x-1/2"
          opacity={0.75}
        />
        <div className="relative mx-auto max-w-3xl">
          <Reveal distance={14}>
            <p className="type-kicker mb-6 text-white/50">Soon</p>
          </Reveal>
          <h2 id="synceri-close-heading" className="type-display-lg text-balance">
            Life has enough to remember.
          </h2>
          <Reveal>
            <p className="type-lede mx-auto mt-7 max-w-xl text-white/70">
              Synceri is being built so the important things stop depending on
              whether you happened to think of them. It&apos;s in development
              now — join the waitlist and you&apos;ll be among the first people
              using it.
            </p>
          </Reveal>
          <Reveal>
            <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <PrimaryAction href={cta.href}>{cta.label}</PrimaryAction>
              <SecondaryAction href="/#ecosystem">
                Explore the ecosystem
              </SecondaryAction>
            </div>
          </Reveal>
          <Reveal>
            <p className="type-caption mx-auto mt-10 max-w-md text-white/40">
              Synceri is {statusLabel.toLowerCase()}. Capabilities on this page
              marked “planned” are the direction it&apos;s being built in, not
              what ships first.
            </p>
          </Reveal>
        </div>
      </section>
    </FlowCanvas>
  );
}

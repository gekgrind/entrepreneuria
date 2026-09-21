import type { Metadata } from "next";
import Image from "next/image";

import { getPrimaryCta } from "@/lib/launch";
import { PRODUCTS } from "@/lib/ecosystem/products";
import { FREE_TOOLS } from "@/lib/resources/tools";
import { libraryStats, loadLibrary, spellCount } from "@/lib/resources/library";
import Link from "@/components/transition/TransitionLink";
import {
  FlowCanvas,
  Glow,
  PaperBleed,
} from "@/components/marketing/flow/atmosphere";
import { FlowSection } from "@/components/marketing/flow/FlowSection";
import { Reveal, RevealGroup } from "@/components/marketing/flow/Reveal";
import {
  PrimaryAction,
  SecondaryAction,
} from "@/components/marketing/flow/cta";
import { EcosystemIndex } from "@/components/about/EcosystemIndex";
import { RoleFan } from "@/components/about/RoleFan";

const TITLE = "About Entrepreneuria — One AI Ecosystem for Solo Founders";
const DESCRIPTION =
  "Why Entrepreneuria exists: one connected AI business ecosystem for people building a company alone, instead of a dozen disconnected tools, docs, and chat windows.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Entrepreneuria",
    description: DESCRIPTION,
    url: "https://entrepreneuria.io/about",
    type: "website",
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
    title: "About Entrepreneuria",
    description: DESCRIPTION,
    images: ["/og/constellation-og.png"],
  },
};

/** The problem, in three moves. Typographic, because a grid of boxes is
 *  the thing this page is arguing against. */
const PROBLEM = [
  {
    step: "01",
    title: "You become the whole org chart.",
    body: "Nobody hands a solo founder a department. You set the strategy, research the market, write the emails, answer them, price the offer, and reconcile the invoices — and every one of those is a different kind of thinking, done by the same tired brain.",
  },
  {
    step: "02",
    title: "Then the work scatters.",
    body: "A doc here, a spreadsheet there, a tracker, a board, an inbox, a folder of half-finished notes. The business is real. It just doesn’t live anywhere in particular, and nothing in it knows about anything else.",
  },
  {
    step: "03",
    title: "AI added capability. It also added tabs.",
    body: "Four chat windows, none of which know what the others were told. Enormous leverage, handed over one disconnected conversation at a time — which leaves the founder doing the integrating, again.",
  },
];

/** The philosophy. Three statements, not three features. */
const APPROACH = [
  {
    title: "It takes the work you would have delegated.",
    body: "Research, structure, first drafts, the version of the thing that exists so you have something to react to. The work that eats the week and was never the reason you started.",
  },
  {
    title: "You keep the call.",
    body: "Pricing, positioning, who to hire, what to stop doing. The system can lay out the tradeoff, disagree with you, and say what it would do. Deciding stays where it belongs.",
  },
  {
    title: "It is built to carry context.",
    body: "The point of one ecosystem is that the business gets described once. What you work out in one place is meant to inform the next — not be retyped into it.",
  },
];

/**
 * /about — the brand page, on the constellation system the homepage
 * established and /prospra brought to secondary pages.
 *
 * The argument runs: one person holds every job → the tools scattered
 * the work and AI scattered it again → here is why that is worth fixing
 * → here is the system, indexed by the kind of intelligence rather than
 * by product → here is what AI is and is not allowed to do here → here
 * is how it grows → start.
 *
 * Product names, roles, taglines, statuses and links all come from the
 * ecosystem registry, and the counts in the vision and close sections
 * are derived from it and from the resource registries, so this page
 * cannot drift out of step with what the site actually offers.
 */
export default function AboutPage() {
  const cta = getPrimaryCta();
  const toolCount = spellCount(FREE_TOOLS.length).toLowerCase();
  const libraryCount = spellCount(libraryStats(loadLibrary()).total).toLowerCase();
  const launching = PRODUCTS.filter((p) => p.status === "now-launching").length;
  const building = PRODUCTS.filter(
    (p) => p.status === "in-development",
  ).length;

  return (
    <FlowCanvas>
      {/* Without JS the IntersectionObserver never attaches, and the
          reveal CSS would leave the page blank. Hand those readers the
          finished state. */}
      <noscript>
        <style>{`[data-flow-reveal],[data-flow-reveal-group]>*{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section
        aria-labelledby="about-hero-heading"
        className="relative overflow-hidden px-6 pb-16 pt-[calc(var(--header-height)+80px)] sm:px-10 sm:pb-24 lg:px-16 lg:pt-[calc(var(--header-height)+112px)]"
      >
        {/* the founder's light, behind the point every job fans back to */}
        <Glow
          tone="human"
          className="hero-light-drift right-[2%] top-[14%] h-[520px] w-[520px]"
          opacity={0.7}
        />
        <Glow
          tone="atmosphere"
          className="left-[-18%] top-[-6%] h-[720px] w-[720px]"
          opacity={0.75}
        />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 xl:gap-24">
          <div>
            <Reveal distance={14}>
              <p className="type-kicker mb-6 text-white/50">
                About Entrepreneuria
              </p>
            </Reveal>

            <h1
              id="about-hero-heading"
              className="type-display-lg max-w-[16ch] text-balance"
            >
              It takes a whole company to build a company. You’re{" "}
              <em className="text-white/90">one</em> person.
            </h1>

            <Reveal>
              <p className="type-lede mt-8 max-w-xl text-white/70">
                Entrepreneuria is an AI-powered business ecosystem for the
                people who are the entire company — the strategy, the
                marketing, the numbers, and the final call. One system, built
                so the work you do in one place is still there in the next.
              </p>
            </Reveal>

            <Reveal>
              <div className="mt-11 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <PrimaryAction href={cta.href}>{cta.label}</PrimaryAction>
                <SecondaryAction href="#ecosystem">
                  See how it fits together
                </SecondaryAction>
              </div>
            </Reveal>
          </div>

          {/* Between the phone and the two-column breakpoint the figure
              is the only thing in its row, so it centres rather than
              hugging the left edge with half a screen of void beside it. */}
          <div className="w-full max-w-md sm:mx-auto lg:mx-0 lg:justify-self-end">
            <RoleFan />
          </div>
        </div>
      </section>

      {/* ── The problem ──────────────────────────────────────────── */}
      <FlowSection
        id="why"
        layout="split"
        eyebrow="Why this exists"
        title="Software was supposed to make this lighter."
        lede="It made it faster. It also made it fragmented — and then AI arrived and fragmented it again."
      >
        <RevealGroup as="ol" className="flex flex-col">
          {PROBLEM.map((move) => (
            <li
              key={move.step}
              className="border-t border-white/[0.08] py-9 first:border-t-0 first:pt-0 sm:py-11 sm:first:pt-0"
            >
              <p className="type-label text-intelligence/70">{move.step}</p>
              <h3 className="type-display-sm mt-5 max-w-[22ch] text-balance text-white">
                {move.title}
              </h3>
              <p className="mt-4 max-w-[58ch] leading-8 text-white/65">
                {move.body}
              </p>
            </li>
          ))}
        </RevealGroup>

        <Reveal>
          <p className="type-display-sm mt-14 max-w-[30ch] text-balance text-white/80 sm:mt-16">
            The gap was never a missing tool. It’s that nothing was
            holding the pieces together.
          </p>
        </Reveal>
      </FlowSection>

      {/* ── From the founder ─────────────────────────────────────── */}
      {/* The one temperature shift on the page — dissolved in and out
          rather than cut, the same way /prospra enters its letter. */}
      <PaperBleed direction="into" />

      <section
        aria-labelledby="about-founder-heading"
        className="relative bg-paper px-6 pb-20 pt-6 text-ink sm:px-10 sm:pb-28 lg:px-16"
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <Reveal
              as="figure"
              className="relative overflow-hidden rounded-2xl shadow-[0_32px_80px_-40px_rgba(26,41,66,0.45)]"
            >
              <Image
                src="/images/founder/misti-portrait-1200.webp"
                alt="Misti, founder of Entrepreneuria, standing in a city street."
                width={1200}
                height={1200}
                sizes="(min-width: 1024px) 38vw, 92vw"
                className="h-auto w-full object-cover"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 [background:linear-gradient(315deg,rgba(210,122,44,0.18)_0%,transparent_45%)]"
              />
            </Reveal>

            <div>
              <Reveal distance={14}>
                <p className="type-kicker mb-5 text-ink/70">From the founder</p>
              </Reveal>
              <h2
                id="about-founder-heading"
                className="type-display-md text-balance"
              >
                Built from this side of the desk.
              </h2>

              <RevealGroup className="type-lede mt-8 space-y-5 text-ink/80">
                <p>
                  I didn’t set out to build a platform. I set out to build
                  a business — and then spent most of my time on everything
                  that wasn’t the business.
                </p>
                <p>
                  No single tool was the problem. Individually, each one was
                  fine. It was the switching: restating the same context,
                  rebuilding the same picture, making a decision in one place
                  that no other tool would ever know about.
                </p>
                <p>
                  So Entrepreneuria is the thing I wanted at that point. Not
                  another app to keep up with — somewhere the whole business
                  can sit, with intelligence attached to each part of it that
                  understands the rest.
                </p>
              </RevealGroup>
            </div>
          </div>

          {/* Italic serif is this site's interior voice. This is one. */}
          <Reveal
            as="figure"
            className="mx-auto mt-20 max-w-4xl border-t border-ink/[0.12] pt-12 text-center sm:mt-24"
          >
            <blockquote className="type-kinetic-interior text-balance text-ink/90">
              &ldquo;The hardest part of building alone was never the work. It
              was holding all of it in one head.&rdquo;
            </blockquote>
            <figcaption className="type-label mt-8 text-ink/70">
              Misti — Founder, Entrepreneuria
            </figcaption>
          </Reveal>
        </div>
      </section>

      <PaperBleed direction="out-of" />

      {/* ── The ecosystem ────────────────────────────────────────── */}
      <FlowSection
        id="ecosystem"
        eyebrow="The ecosystem"
        title="Different kinds of intelligence. One system."
        lede="Not a suite of apps that happen to share a login. Each one is built for a different part of the work — and for the fact that the same person is doing all of it."
      >
        <EcosystemIndex products={PRODUCTS} />

        <Reveal>
          <div className="mt-16 grid gap-8 border-t border-white/[0.08] pt-12 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-12">
            <p className="max-w-[56ch] leading-8 text-white/65">
              The products are still being built. The free layer already
              exists: {toolCount} AI tools that draft the first version of
              the work for you, and {libraryCount} templates, playbooks, and
              checklists to download and make your own. No account, no
              waiting.
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Link
                href="/tools"
                className="no-accent-link group inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold !text-white/80 transition hover:!text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-intelligence"
              >
                Free AI Tools
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
              <Link
                href="/library"
                className="no-accent-link group inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold !text-white/80 transition hover:!text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-intelligence"
              >
                The Library
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>
          </div>
        </Reveal>
      </FlowSection>

      {/* ── The approach to AI ───────────────────────────────────── */}
      {/* Quieter than the ecosystem on purpose: this is the page's
          argument, and arguments don't need furniture. */}
      <section
        aria-labelledby="about-approach-heading"
        className="relative px-6 py-20 sm:px-10 sm:py-28 lg:px-16 lg:py-36"
      >
        <Glow
          tone="intelligence"
          className="left-1/2 top-[-4%] h-[520px] w-[min(94vw,900px)] -translate-x-1/2"
          opacity={0.7}
        />

        <div className="relative mx-auto w-full max-w-5xl">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal distance={14}>
              <p className="type-kicker mb-5 text-white/50">The approach</p>
            </Reveal>
            <h2
              id="about-approach-heading"
              className="type-display-md text-balance"
            >
              Leverage, not autopilot.
            </h2>
            <Reveal>
              <p className="type-lede mx-auto mt-7 max-w-2xl text-white/70">
                Entrepreneuria is built to help you think, plan, organize,
                create, and execute — with better information and far less of
                the week spent on the parts nobody starts a business for. What
                it is not built to do is take over the part that was yours.
              </p>
            </Reveal>
          </div>

          <div className="mt-16 lg:mt-20">
            <RevealGroup
              as="dl"
              className="divide-y divide-white/[0.08] border-y border-white/[0.08]"
            >
              {APPROACH.map((item) => (
                <div
                  key={item.title}
                  className="grid gap-3 py-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 md:py-10"
                >
                  <dt className="type-display-xs max-w-[24ch] text-balance text-white">
                    {item.title}
                  </dt>
                  <dd className="max-w-[56ch] leading-8 text-white/65">
                    {item.body}
                  </dd>
                </div>
              ))}
            </RevealGroup>
          </div>

          <Reveal>
            <p className="type-display-sm mx-auto mt-16 max-w-[32ch] text-balance text-center text-white/80">
              A founder with better information is still the founder. That is
              the whole design.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Where it goes ────────────────────────────────────────── */}
      <FlowSection
        id="vision"
        eyebrow="Where it goes"
        title="A system that grows with the person building the business."
      >
        <RevealGroup className="grid gap-x-16 gap-y-8 md:grid-cols-2">
          <p className="max-w-[56ch] leading-8 text-white/70">
            The ecosystem is designed as a registry rather than a bundle. The
            role comes first — guidance, voice, judgment, order, reach — and a
            product exists because a role needed answering. When founders keep
            running into something the system doesn’t cover, that becomes
            the next kind of intelligence in it.
          </p>
          <p className="max-w-[56ch] leading-8 text-white/70">
            What you won’t find here is a roadmap of names and dates.{" "}
            {spellCount(PRODUCTS.length)} products are in the registry today —{" "}
            {spellCount(launching).toLowerCase()} now launching,{" "}
            {spellCount(building).toLowerCase()} in development — and each one
            is labeled with exactly where it is. Anything beyond that gets
            announced when it’s real, and not before.
          </p>
        </RevealGroup>
      </FlowSection>

      {/* ── The close ────────────────────────────────────────────── */}
      {/* No box. The page opens out, the founder's light comes back, and
          the field runs on into the footer. */}
      <section
        aria-labelledby="about-close-heading"
        className="relative overflow-hidden px-6 pb-36 pt-8 text-center sm:px-10 sm:pb-44 lg:px-16"
      >
        <Glow
          tone="human"
          className="left-1/2 top-[6%] h-[560px] w-[min(94vw,800px)] -translate-x-1/2"
          opacity={0.75}
        />
        <div className="relative mx-auto max-w-3xl">
          <Reveal distance={14}>
            <p className="type-kicker mb-6 text-white/50">Begin</p>
          </Reveal>
          <h2 id="about-close-heading" className="type-display-lg text-balance">
            You don’t have to keep being the whole company.
          </h2>
          <Reveal>
            <p className="type-lede mx-auto mt-7 max-w-xl text-white/70">
              The free tools and the Library are open today, and the waitlist
              is how you get the products as each one arrives. Start from
              wherever you actually are.
            </p>
          </Reveal>
          <Reveal>
            <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <PrimaryAction href={cta.href}>{cta.label}</PrimaryAction>
              <SecondaryAction href="/tools">
                Open the free tools
              </SecondaryAction>
            </div>
          </Reveal>
        </div>
      </section>
    </FlowCanvas>
  );
}

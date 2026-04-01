"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import PageHeader from "@/components/PageHeader";
import { Playfair_Display } from "next/font/google";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

export default function AboutPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <section className="relative -mt-[calc(var(--header-height)+1rem)] flex h-[78vh] min-h-[620px] items-center justify-center overflow-hidden">
        <PageHeader
          title=""
          subtitle=""
          videoSrc="/videos/about-header.mp4"
          imageSrc="/images/home-fallback.jpg"
        />

        <div className="absolute inset-0 z-10 bg-[#061426]/45" />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[-100px] top-[-100px] z-10 h-[700px] w-[700px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)",
          }}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-150px] right-[-100px] z-10 h-[600px] w-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(210,122,44,0.10) 0%, transparent 70%)",
          }}
        />

        <div className="absolute inset-0 z-20 flex items-center px-4 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <div className="max-w-3xl text-left">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="mb-6 inline-flex items-center gap-3 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[#00D4FF]"
              >
                <span className="block h-px w-8 bg-[#00D4FF]" />
                <span>The Blueprint</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.08 }}
                className="text-5xl font-semibold leading-[0.95] tracking-[0.02em] text-white sm:text-6xl md:text-7xl lg:text-[5.5rem]"
              >
                Built for founders who{" "}
                  <span className={`${playfairDisplay.className} italic text-[#00D4FF] tracking-[0.01em]`}>
                    build.
                  </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.16 }}
                className="mt-6 max-w-2xl text-base font-light leading-8 text-white/80 sm:text-lg"
              >
                Entrepreneuria exists for{" "}
                <strong className="font-semibold text-white">one reason</strong>: to
                make sure that building a business while flying solo doesn&apos;t have
                to mean figuring it out alone. We&apos;re the infrastructure behind your
                ambition.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.24 }}
                className="mt-10 flex flex-wrap gap-4"
              >
                <Link
                  href="/apps"
                  className="inline-flex items-center gap-2 rounded-full bg-[#00D4FF] px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#061426] transition hover:-translate-y-0.5 hover:bg-[#33ddff]"
                >
                  Explore the Stack <span aria-hidden="true">→</span>
                </Link>

                <Link
                  href="/waitlist"
                  className="inline-flex items-center rounded-full border border-[#00D4FF] bg-transparent px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#00D4FF] transition hover:-translate-y-0.5 hover:bg-[#00D4FF]/10"
                >
                  Join the Waitlist
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

<section className="border-y border-white/10 bg-[#0b1730]/80 px-4 py-20 sm:px-6 lg:px-8">
  <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
    <div className="relative">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-10">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#00D4FF] via-[#7c3aed] to-[#d27a2c]" />

        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
          The Origin
        </p>

        <h2 className="mb-6 text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Started From{" "}
          <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
            Frustration.
          </span>
          <br />
            Built From{" "}
          <span className={`${playfairDisplay.className} italic text-[#d27a2c]`}>
            Purpose.
          </span>
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#00D4FF]/10 bg-black/20 p-5 text-center">
            <div className="text-4xl font-bold leading-none text-[#00D4FF] sm:text-5xl">
              95%
            </div>
            <div className="mt-3 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-white/60">
              Of aspiring founders never find a mentor
            </div>
          </div>

          <div className="rounded-2xl border border-[#00D4FF]/10 bg-black/20 p-5 text-center">
            <div className="text-4xl font-bold leading-none text-[#00D4FF] sm:text-5xl">
              93%
            </div>
            <div className="mt-3 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-white/60">
              Of self-made millionaires had one
            </div>
          </div>

          <div className="rounded-2xl border border-[#00D4FF]/10 bg-black/20 p-5 text-center">
            <div className="text-4xl font-bold leading-none text-[#00D4FF] sm:text-5xl">
              84%
            </div>
            <div className="mt-3 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-white/60">
              Of CEOs say their mentor saved them from costly mistakes
            </div>
          </div>

          <div className="rounded-2xl border border-[#00D4FF]/10 bg-black/20 p-5 text-center">
            <div className="text-4xl font-bold leading-none text-[#00D4FF] sm:text-5xl">
              1
            </div>
            <div className="mt-3 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-white/60">
              Platform built to change all of that
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="max-w-2xl">
      <p className="mb-5 text-medium font-light leading-8 text-white">
        Entrepreneuria didn&apos;t start in a boardroom. It started with a
        question:{" "}
        <strong className="font-semibold text-white">
          why do the most successful people in the world have mentors and almost
          nobody else gets that same advantage?
        </strong>
      </p>

      <p className="mb-5 text-medium leading-8 text-white/70">
        Warren Buffett mentored Bill Gates. Maya Angelou mentored Oprah. Steve
        Jobs mentored Mark Zuckerberg while he was building Meta. The pattern
        was impossible to ignore and so was the gap.{" "}
        <strong className="font-semibold text-white">
          95% of people looking for a mentor fail to find one.
        </strong>{" "}
        That felt like a problem worth solving.
      </p>

      <p className="mb-5 text-medium leading-8 text-white/70">
        So we built it. Not just a mentor, an entire ecosystem. AI-powered
        tools, strategic resources, and a community built for the solo founder
        who&apos;s moving fast and needs to move smart.
      </p>

      <p className="text-base leading-8 text-white/70">
        <strong className="font-semibold text-white">
          This is Entrepreneuria. Welcome to the platform that was built because
          you deserve the same edge everyone at the top already has.
        </strong>
      </p>
    </div>
  </div>
</section>

<section className="px-4 py-24 sm:px-6 lg:px-8">
  <div className="mx-auto max-w-6xl">
    {/* Section Header */}
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
        Our Mission
      </p>

    <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
      We Exist to{" "}
      <span className={`${playfairDisplay.className}`}>
      Give
      </span>{" "}
      Founders{" "}
        <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
        Unfair Advantage.
        </span>
    </h2>

      <p className="mt-6 text-medium leading-8 text-white/70">
        Every tool, resource, and app we build is designed around the same
        belief:{" "}
        <strong className="text-white">
          solo founders deserve enterprise-grade intelligence.
        </strong>
      </p>
    </div>

    {/* Cards */}
    <div className="mt-14 grid gap-6 md:grid-cols-3">
      {/* Card 1 */}
      <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-8 transition hover:-translate-y-1 hover:border-[#00D4FF]/60">
        <div className="mb-5 text-2xl">🤖</div>

        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
          AI-Powered Tools
        </h3>

        <p className="mt-3 text-sm leading-7 text-white/70">
          A full suite of apps from AI mentorship to content creation, business
          architecture to market intelligence built specifically for the way
          solo founders actually work.
        </p>

        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-[#00D4FF] to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>

      {/* Card 2 */}
      <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-8 transition hover:-translate-y-1 hover:border-[#00D4FF]/60">
        <div className="mb-5 text-2xl">🚀</div>

        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
          Launch-Ready Resources
        </h3>

        <p className="mt-3 text-sm leading-7 text-white/70">
          Frameworks, templates, guides, and strategic tools that cut through
          the noise and help you execute fast. The Launchpad is your shortcut
          from idea to action.
        </p>

        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-[#00D4FF] to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>

      {/* Card 3 */}
      <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-8 transition hover:-translate-y-1 hover:border-[#00D4FF]/60">
        <div className="mb-5 text-2xl">🤝</div>

        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
          A Founder Community
        </h3>

        <p className="mt-3 text-sm leading-7 text-white/70">
          The Exchange is where the real conversations happen. Strategy,
          support, accountability, and real talk from founders who are in it
          with you, not above you.
        </p>

        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-[#00D4FF] to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>
    </div>
  </div>
</section>

<section className="px-4 py-24 sm:px-6 lg:px-8">
  <div className="mx-auto max-w-6xl">
    {/* Section Header */}
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
        Our Mission
      </p>

      <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
        One system. Built for how founders actually{" "}
        <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
          build.
        </span>
      </h2>

      <p className="mt-6 text-base leading-8 text-white/70">
        Every tool, resource, and app we build is designed around the same
        belief:{" "}
        <strong className="text-white">
          solo founders deserve enterprise-grade intelligence.
        </strong>
      </p>
    </div>

    {/* Cards */}
    <div className="mt-14 grid gap-6 md:grid-cols-3">
      {/* Card 1 */}
      <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-8 transition hover:-translate-y-1 hover:border-[#00D4FF]/60">
        <div className="mb-5 text-2xl">🤖</div>

        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
          AI-Powered Tools
        </h3>

        <p className="mt-3 text-sm leading-7 text-white/70">
          A full suite of apps from AI mentorship to content creation, business
          architecture to market intelligence built specifically for the way
          solo founders actually work.
        </p>

        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-[#00D4FF] to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>

      {/* Card 2 */}
      <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-8 transition hover:-translate-y-1 hover:border-[#00D4FF]/60">
        <div className="mb-5 text-2xl">🚀</div>

        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
          Launch-Ready Resources
        </h3>

        <p className="mt-3 text-sm leading-7 text-white/70">
          Frameworks, templates, guides, and strategic tools that cut through
          the noise and help you execute fast. The Launchpad is your shortcut
          from idea to action.
        </p>

        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-[#00D4FF] to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>

      {/* Card 3 */}
      <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-8 transition hover:-translate-y-1 hover:border-[#00D4FF]/60">
        <div className="mb-5 text-2xl">🤝</div>

        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
          A Founder Community
        </h3>

        <p className="mt-3 text-sm leading-7 text-white/70">
          The Exchange is where the real conversations happen. Strategy,
          support, accountability, and real talk from founders who are in it
          with you not above you.
        </p>

        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-[#00D4FF] to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>
    </div>
  </div>
</section>

<section className="px-4 py-24 sm:px-6 lg:px-8">
  <div className="mx-auto max-w-6xl">
    {/* Header */}
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
        The Stack
      </p>

      <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
        Meet the{" "}
        <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
          Stack
        </span>{" "}
          That Runs
        <br />
          Your Business.
      </h2>

      <p className="mt-6 text-base leading-8 text-white/70">
        Five AI-powered apps. One ecosystem. Built to handle the work so you
        can focus on the vision that matters.
      </p>
    </div>

    {/* Grid */}
    <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {/* Prospra */}
      <a
        href="/prospra"
        className="group block rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition hover:-translate-y-1 hover:bg-[#00D4FF]/5"
      >
        <div className="mb-3 text-2xl">🎯</div>
        <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[#00D4FF]">
          Prospra
        </div>
        <div className="mt-1 text-xs text-white/60">
          AI mentor & business advisor
        </div>
      </a>

      {/* Architecta */}
      <a
        href="/architecta"
        className="group block rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition hover:-translate-y-1 hover:bg-[#00D4FF]/5"
      >
        <div className="mb-3 text-2xl">✍️</div>
        <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[#00D4FF]">
          Architecta
        </div>
        <div className="mt-1 text-xs text-white/60">
          AI content studio & creator
        </div>
      </a>

      {/* Directorium */}
      <a
        href="/directorium"
        className="group block rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition hover:-translate-y-1 hover:bg-[#00D4FF]/5"
      >
        <div className="mb-3 text-2xl">🏛️</div>
        <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[#00D4FF]">
          Directorium
        </div>
        <div className="mt-1 text-xs text-white/60">
          Your AI board of directors
        </div>
      </a>

      {/* Synceri */}
      <a
        href="/synceri"
        className="group block rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition hover:-translate-y-1 hover:bg-[#00D4FF]/5"
      >
        <div className="mb-3 text-2xl">⚡</div>
        <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[#00D4FF]">
          Synceri
        </div>
        <div className="mt-1 text-xs text-white/60">
          AI operations & workflow hub
        </div>
      </a>

      {/* Coming Soon */}
      <a
        href="/waitlist"
        className="group block rounded-2xl border border-dashed border-[#d27a2c] bg-white/5 p-6 text-center transition hover:-translate-y-1 hover:bg-[#d27a2c]/5"
      >
        <div className="mb-3 text-2xl">🔮</div>
        <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[#d27a2c]">
          Coming Soon
        </div>
        <div className="mt-1 text-xs text-white/60">
          More in the pipeline. Join the waitlist.
        </div>
      </a>
    </div>
  </div>
</section>

<section className="border-y border-white/10 bg-[linear-gradient(135deg,#0b1730_0%,rgba(0,212,255,0.06)_50%,#0b1730_100%)] px-4 py-24 sm:px-6 lg:px-8">
  <div className="mx-auto max-w-3xl text-center">
    <h2 className="text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
      Ready to Build
      <br />
        <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
        Smarter?
        </span>
    </h2>

    <p className="mt-6 text-base leading-8 text-white/70">
      Join thousands of solo founders already using Entrepreneuria to move
      faster, think bigger, and build better with AI in their corner.
    </p>

    <div className="mt-10 flex flex-wrap justify-center gap-4">
      <a
        href="/waitlist"
        className="inline-flex items-center gap-2 rounded-full bg-[#00D4FF] px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#061426] transition hover:-translate-y-0.5 hover:bg-[#33ddff]"
      >
        Join the Waitlist <span aria-hidden="true">→</span>
      </a>

      <a
        href="/apps"
        className="inline-flex items-center rounded-full border border-[#00D4FF] bg-transparent px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#00D4FF] transition hover:-translate-y-0.5 hover:bg-[#00D4FF]/10"
      >
        Explore the Stack
      </a>
    </div>
  </div>
</section>
</main>
  );
}
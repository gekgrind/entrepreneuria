import Link from "next/link"

export default function WhatIsEntrepreneuriaPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-20 text-white">
      <article className="mx-auto max-w-3xl">
        <p className="mb-4 text-sm uppercase tracking-[0.18em] text-[#00D4FF]">
          ABOUT
        </p>

        <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">
          What Is Entrepreneuria — And Why We Built It for the Solo Founder Who&apos;s Tired of Figuring It All Out Alone
        </h1>

        <p className="mb-10 text-white/70">READ TIME: ~5 MIN</p>

        <div className="space-y-6 text-lg leading-8 text-white/90">
          <p>
            At some point in the early stages of building a business, almost every solo founder has the same moment of clarity: this is so much harder than anyone told me it would be.
          </p>

          <p>
            Not because the work is too hard. You can handle the work. What&apos;s hard is the aloneness of it. The endless stream of decisions you&apos;re making without anyone who&apos;s been there to run them by. The frameworks you&apos;re building from scratch that someone, somewhere, has definitely already figured out. The feeling that you&apos;re constantly reinventing the wheel while also somehow trying to move the car.
          </p>

          <p>Entrepreneuria exists because of that feeling.</p>

          <p>We built the platform we wish we&apos;d had when we were starting out.</p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            What We Built
          </h2>

          <p>
            Entrepreneuria is a platform designed specifically for solo founders, solopreneurs, and early-stage entrepreneurs. Not enterprise software. Not a course for wannabe influencers. A real, working toolkit for people who are doing the hard thing — building something from nothing.
          </p>

          <p>
            That means free, comprehensive resources organized so you can find what you need when you need it. AI-powered tools that give you the analytical horsepower of a full team without the payroll. Digital products built to be genuinely useful, not just impressive-looking. And a growing community of founders who are in it with you.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Why Free Resources?
          </h2>

          <p>
            Because access to good information shouldn&apos;t be a competitive advantage for people with money. The frameworks that help founders succeed — the pitch deck templates, the financial models, the scaling playbooks — these shouldn&apos;t live behind a consulting retainer or a $2,000 course. They should be available to anyone who&apos;s willing to do the work.
          </p>

          <p>
            We&apos;re building a platform where the first thing you find is genuinely useful. Because we know that if we give you real value up front, you&apos;ll be back when you need more. And you&apos;ll tell someone else who needs it.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Who This Is For
          </h2>

          <p>
            If you&apos;re building something by yourself, or close to it — if you&apos;re making most of the decisions, wearing most of the hats, and figuring out as you go — this is built for you. The scrappy founder who&apos;s resourceful and driven but sometimes just needs the right tool, framework, or piece of insight to unlock the next level.
          </p>

          <p>
            We&apos;re not here to sell you a dream. We&apos;re here to give you what you need to build one.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Where We&apos;re Going
          </h2>

          <p>
            Entrepreneuria is growing. New resources, new AI tools, new products are added regularly. We&apos;re building a full platform — including an AI-powered advisory system that gives you access to expert-level strategic thinking without the expert-level price tag.
          </p>

          <p>
            But you don&apos;t have to wait for any of that. Everything you need right now is already here. Start with the Launchpad. Download something. Use a tool. Read something that shifts how you see the problem you&apos;re working on.
          </p>

          <p>You&apos;re not alone in this. You never had to be.</p>

          <p>Welcome to Entrepreneuria. Let&apos;s build something.</p>
        </div>

        <div className="mt-12">
          <Link href="/blog" className="text-[#00D4FF] hover:underline">
            ← Back to Blog
          </Link>
        </div>
      </article>
    </main>
  )
}
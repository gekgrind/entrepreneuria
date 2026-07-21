import Link from "next/link"

export default function FounderMindsetShiftPage() {
  return (
    <div className="relative -mt-[calc(var(--header-height)+20px)] min-h-screen overflow-x-clip bg-[#081527] px-6 pb-24 pt-[calc(var(--header-height)+88px)] text-white">
      <article className="mx-auto max-w-3xl">
        <p className="mb-5 text-[11px] uppercase tracking-[0.28em] text-white/45 [font-family:var(--font-label)] sm:text-xs">
          MINDSET &amp; LEADERSHIP
        </p>

        <h1 className="mb-5 text-balance text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
          The Founder Mindset Shift That Changes Everything (Most People Miss This)
        </h1>

        <p className="mb-12 text-[11px] uppercase tracking-[0.24em] text-white/40 [font-family:var(--font-label)]">READ TIME: ~6 MIN</p>

        <div className="space-y-6 text-lg leading-8 text-white/70">
          <p>
            Most of the advice you&apos;ll read about founder mindset focuses on resilience, grit, positive thinking. And those things matter. But there&apos;s a subtler shift that tends to happen in the founders who actually break through — one that doesn&apos;t get talked about much because it&apos;s harder to put on a motivational poster.
          </p>

          <p>
            The shift is this: stop thinking like someone building a thing, and start thinking like someone building the system that builds the thing.
          </p>

          <p>It sounds like a small distinction. It isn&apos;t.</p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            The Builder vs. the Architect
          </h2>

          <p>
            Most founders start as builders. They&apos;re making the product, writing the content, having the sales calls, doing the deliverables. All of this is necessary, especially early. The problem is when founders get stuck in builder mode long after the business needs something different.
          </p>

          <p>
            The architect mindset asks different questions. Instead of &apos;how do I do this?&apos;, it asks &apos;how do I build a system that does this?&apos; Instead of &apos;how do I solve this customer&apos;s problem?&apos;, it asks &apos;how do I build a process that consistently solves this problem for every customer?&apos;
          </p>

          <p>
            The output might look similar from the outside. But the internal orientation — and therefore the trajectory of the business — is completely different.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Why Most Founders Miss It
          </h2>

          <p>
            Because the builder mode feels productive. You&apos;re making things. You&apos;re moving fast. There&apos;s visible progress and it feels good. The architect mode requires slowing down, stepping back, and investing time in things that don&apos;t produce immediate output.
          </p>

          <p>
            In a culture that rewards hustle and visible momentum, pausing to build systems can feel like falling behind. It&apos;s actually how you get ahead.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            What the Shift Looks Like in Practice
          </h2>

          <p>
            You start documenting your processes, not because you&apos;re planning to hire, but because you want to understand them well enough to improve them. You start thinking about your role in the business, not just your tasks. You start asking whether the growth you&apos;re building is sustainable, or whether you&apos;re just trading hours for dollars at a slightly higher rate.
          </p>

          <p>You start designing the business instead of just running it.</p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            The Uncomfortable Part
          </h2>

          <p>
            This shift often requires letting go of being the best at the doing. The founder who&apos;s a brilliant individual contributor has to become the founder who builds systems brilliant enough to produce great results without their constant presence.
          </p>

          <p>
            For a lot of founders, that&apos;s genuinely hard. Their identity is wrapped up in doing the work. Becoming the person who builds the infrastructure for the work requires a real evolution — not just tactically, but psychologically.
          </p>

          <p>
            You&apos;re not trying to build a job for yourself. You&apos;re trying to build a business. Those require fundamentally different versions of you.
          </p>

          <p>
            The founders who make this shift tend to talk about it as the moment everything changed. Not because the work got easier, but because they finally understood what they were actually trying to build.
          </p>

          <p>Most people miss it because nobody explicitly names it. Consider it named.</p>
        </div>

        <div className="mt-12">
          <Link href="/launch-pad/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold !text-white/70 transition hover:!text-white">
            ← Back to Blog
          </Link>
        </div>
      </article>
    </div>
  )
}
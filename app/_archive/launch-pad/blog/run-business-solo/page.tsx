import Link from "@/components/transition/TransitionLink"

export default function RunBusinessSoloPage() {
  return (
    <div className="relative -mt-[calc(var(--header-height)+20px)] min-h-screen overflow-x-clip bg-[#081527] px-6 pb-24 pt-[calc(var(--header-height)+88px)] text-white">
      <article className="mx-auto max-w-3xl">
        <p className="mb-5 text-[11px] uppercase tracking-[0.28em] text-white/45 [font-family:var(--font-label)] sm:text-xs">
          PRODUCTIVITY &amp; OPERATIONS
        </p>

        <h1 className="mb-5 text-balance text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
          How to Run the Whole Business by Yourself Without Losing Your Mind
        </h1>

        <p className="mb-12 text-[11px] uppercase tracking-[0.24em] text-white/40 [font-family:var(--font-label)]">READ TIME: ~7 MIN</p>

        <div className="space-y-6 text-lg leading-8 text-white/70">
          <p>
            Nobody warns you about this part. You&apos;re so focused on building the thing, selling the thing, delivering the thing — and somewhere in the middle of all of it, you realize that you are also the accountant, the marketing department, the customer service rep, the strategist, the IT department, and the janitor.
          </p>

          <p>Welcome to solopreneurship.</p>

          <p>
            The good news: it&apos;s absolutely manageable. Not because you learn to do all of it perfectly, but because you build structures that hold the weight so you don&apos;t have to.
          </p>

          <p>
            The goal isn&apos;t to do everything. It&apos;s to make sure everything gets done.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            First: Accept That You Cannot Hold It All in Your Head
          </h2>

          <p>
            The moment your business gets complex enough to require this conversation, it&apos;s too complex to run from memory. Your brain is for thinking, not for storing. Everything that is currently living in your head needs to live somewhere else — a project management tool, a CRM, a documented process.
          </p>

          <p>
            This single shift will buy you hours every week. Not because you&apos;re doing less, but because you stop spending cognitive energy trying to remember what needs to happen next.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Batch Everything Batchable
          </h2>

          <p>
            Context switching is one of the most expensive things a solo operator does. Every time you jump from deep work to a quick email to a creative task and back again, you&apos;re paying a mental tax. The solution is batching: doing like tasks together in blocks.
          </p>

          <p>
            Content day. Admin day. Deep work blocks. Communication windows. When you batch, you&apos;re not just managing your time — you&apos;re protecting your focus. And focus is your most valuable resource.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Build a Decision Filter
          </h2>

          <p>
            When you&apos;re operating solo, you&apos;ll get pulled in seventeen directions every single day. Opportunities, requests, ideas, problems — they all feel urgent and important. They&apos;re not.
          </p>

          <p>
            Build yourself a simple decision filter: does this move the business forward? Does it need to happen right now? Does it need to happen at all? Most things that feel urgent aren&apos;t, and most things that feel important don&apos;t require you personally to handle them.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Automate the Predictable
          </h2>

          <p>
            Every task you do more than once is a candidate for automation. Scheduling, invoicing, follow-up emails, social media posting, document workflows — most of this can run on autopilot with the right tools in place.
          </p>

          <p>
            The goal isn&apos;t to automate your business. It&apos;s to automate everything except the parts that require your judgment, your creativity, or your relationships. Those parts you protect jealously.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Make Rest Non-Negotiable
          </h2>

          <p>
            This one will get skipped, so hear it again: rest is operational infrastructure, not a reward for finishing. A founder who doesn&apos;t sleep, doesn&apos;t take weekends, and doesn&apos;t step away from the work regularly is a founder operating at 60% capacity — and eventually burning out entirely.
          </p>

          <p>
            You are the most important asset in your business. Protect it accordingly.
          </p>

          <p>
            Running a one-person business is one of the hardest things you can do. It&apos;s also one of the most rewarding — if you build it to sustain you, not just consume you.
          </p>

          <p>
            The founders who last aren&apos;t the ones who hustle the hardest. They&apos;re the ones who build structures that let them do their best work consistently, for years. Start building yours.
          </p>
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
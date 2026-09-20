import Link from "@/components/transition/TransitionLink"

export default function First100CustomersPage() {
  return (
    <div className="relative -mt-[calc(var(--header-height)+20px)] min-h-screen overflow-x-clip bg-[#081527] px-6 pb-24 pt-[calc(var(--header-height)+88px)] text-white">
      <article className="mx-auto max-w-3xl">
        <p className="mb-5 text-[11px] uppercase tracking-[0.28em] text-white/45 [font-family:var(--font-label)] sm:text-xs">
          GROWTH &amp; MARKETING
        </p>

        <h1 className="mb-5 text-balance text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
          How to Get Your First 100 Customers Without a Big Budget or a Big Audience
        </h1>

        <p className="mb-12 text-[11px] uppercase tracking-[0.24em] text-white/40 [font-family:var(--font-label)]">READ TIME: ~8 MIN</p>

        <div className="space-y-6 text-lg leading-8 text-white/70">
          <p>
            Your first hundred customers aren&apos;t found through a viral TikTok or a perfectly optimized ad campaign. They&apos;re earned through direct, human, slightly uncomfortable outreach — and they&apos;re more valuable than the next thousand combined.
          </p>

          <p>
            Here&apos;s why: your first hundred customers are your research, your validation, your referral engine, and your proof that this thing is real. Everything that comes after is built on that foundation. Get this wrong and you&apos;re scaling a broken model. Get it right and you have everything you need to grow.
          </p>

          <p>The goal of the first 100 customers isn&apos;t revenue. It&apos;s signal.</p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Step One: Get Embarrassingly Specific About Who You&apos;re Serving
          </h2>

          <p>
            Most founders fail at customer acquisition because they&apos;re still trying to appeal to everyone. &apos;Small business owners.&apos; &apos;Entrepreneurs.&apos; &apos;People who want to grow.&apos; These aren&apos;t customers — they&apos;re demographics.
          </p>

          <p>
            Get specific. Uncomfortably specific. Not &apos;entrepreneurs&apos; — &apos;first-time founders in the B2B SaaS space who&apos;ve just raised a pre-seed round and are trying to hire their first sales rep.&apos; That level of specificity feels limiting. It&apos;s actually what makes everything else possible.
          </p>

          <p>
            Because when you know exactly who you&apos;re serving, you know where to find them.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Step Two: Go Where They Already Are
          </h2>

          <p>
            Your first customers are not going to find you through SEO or organic social. You&apos;re going to find them. This means showing up in the communities they&apos;re already in — Slack groups, subreddits, LinkedIn circles, Discord servers, industry events, niche newsletters.
          </p>

          <p>
            Not to pitch. To contribute. To answer questions. To share things that are genuinely useful. The founders who build audiences fastest are the ones who give the most before they ask for anything.
          </p>

          <p>
            Do this consistently for sixty days and you&apos;ll have warm relationships with people who trust you before you&apos;ve spent a dollar on marketing.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Step Three: Ask for the Conversation, Not the Sale
          </h2>

          <p>
            The most effective early-stage customer acquisition tactic is still direct outreach — but only if you do it right. The goal of your first message is not to sell. It&apos;s to have a conversation. Ask if they&apos;d be willing to spend twenty minutes helping you understand their problem. Offer something of value in return. Make it easy to say yes.
          </p>

          <p>
            You&apos;ll be surprised how many people say yes when you&apos;re genuinely curious about them rather than trying to push a product.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Step Four: Make It So Good They Can&apos;t Not Tell Someone
          </h2>

          <p>
            Your first customers are your distribution channel. If their experience with your product or service is merely good, they might recommend you when asked. If it&apos;s extraordinary — if you&apos;ve gone further than they expected, solved something they didn&apos;t know was broken, made them feel like the luckiest person for having found you — they&apos;ll bring you their network without being asked.
          </p>

          <p>
            Obsess over the early customer experience. Respond faster than any competitor would. Fix problems before they&apos;re raised. Make people feel seen. This is how you turn 100 customers into 500.
          </p>

          <h2 className="pt-6 text-2xl font-semibold text-white">
            Step Five: Ask for Referrals. Directly.
          </h2>

          <p>
            This is the step most founders skip because it feels awkward. Do it anyway. When a customer has a great experience, ask them: &apos;Is there anyone else in your world who&apos;s dealing with this same problem? I&apos;d love an introduction.&apos;
          </p>

          <p>
            A warm referral converts ten times better than any cold lead. Your happiest early customers are your best salespeople. Give them the words and make it easy to introduce you.
          </p>

          <p>
            You don&apos;t need a big budget or a big audience to get your first hundred customers. You need clarity, consistency, and a product worth talking about.
          </p>

          <p>
            A hundred customers is within reach for almost any founder who&apos;s willing to do the human work. Start with ten. Then ten more. Each one teaches you something that makes the next ten easier.
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
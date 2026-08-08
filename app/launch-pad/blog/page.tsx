import type { Metadata } from "next";
import Link from "@/components/transition/TransitionLink";
import { ArrowRight } from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";

export const metadata: Metadata = {
  title: "The Knowledge Blueprint | Entrepreneuria Launch Pad",
  description:
    "Insights, inspiration, and straight talk for founders who are figuring it out in real time — frameworks, systems, and mindsets for solo builders.",
};

const posts = [
  {
    category: "AI & tools",
    title:
      "The Solopreneur Tech Stack for 2026: Every Tool You Actually Need to Run a One-Person Business",
    date: "March 2026",
    excerpt:
      "There's a version of the solopreneur tech stack that actually works — and it's smaller than you think.",
    href: "/launch-pad/blog/ai-tools",
  },
  {
    category: "Launch & operations",
    title:
      "Why Most Solo Founders Fail in Year One — And the Systems That Save the Rest",
    date: "March 2026",
    excerpt:
      "The real reason most solo businesses stall out isn't a lack of hustle. It's the lack of systems.",
    href: "/launch-pad/blog/solo-founders-fail-year-one",
  },
  {
    category: "Growth & marketing",
    title:
      "How to Get Your First 100 Customers Without a Big Budget or a Big Audience",
    date: "March 2026",
    excerpt:
      "Your first 100 customers won't come from going viral. They come from clarity, consistency, and doing the human work.",
    href: "/launch-pad/blog/first-100-customers",
  },
  {
    category: "Productivity & operations",
    title: "How to Run the Whole Business by Yourself Without Losing Your Mind",
    date: "March 2026",
    excerpt:
      "Running a one-person business isn't about doing everything. It's about building systems that carry the weight.",
    href: "/launch-pad/blog/run-business-solo",
  },
  {
    category: "Mindset & leadership",
    title:
      "The Founder Mindset Shift That Changes Everything (Most People Miss This)",
    date: "March 2026",
    excerpt:
      "The biggest founder shift isn't working harder. It's learning to build the system that builds the thing.",
    href: "/launch-pad/blog/founder-minset-shift",
  },
  {
    category: "About",
    title:
      "What Is Entrepreneuria — And Why We Built It for the Solo Founder Who's Tired of Figuring It All Out Alone",
    date: "March 2026",
    excerpt:
      "Entrepreneuria was built for the founder who's tired of figuring everything out alone. Here's why it exists.",
    href: "/launch-pad/blog/what-is-entrepreneuria",
  },
];

export default function BlogPage() {
  return (
    <PageShell>
      <PageHero
        kicker="The Launch Pad · The Knowledge Blueprint"
        title={
          <>
            The Knowledge <em className="italic">Blueprint</em>.
          </>
        }
        lede="Insights, inspiration, and straight talk for founders who are figuring it out in real time."
      />

      <Section
        kicker="01 — Why it exists"
        title={
          <>
            No recycled <em className="italic">listicles</em>.
          </>
        }
      >
        <p className="max-w-2xl text-lg leading-8 text-white/60">
          This isn&apos;t a corporate content blog. No recycled listicles. No
          thought leadership from people who&apos;ve never actually built
          anything. The Knowledge Blueprint is where we share the real stuff —
          the frameworks that work, the mindsets that shift everything, the
          strategies that solo founders and early-stage entrepreneurs actually
          need. Pull up a chair. There&apos;s a lot worth reading.
        </p>
      </Section>

      <Section kicker="02 — The articles" title="Start anywhere.">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.href}
              href={post.href}
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25 sm:p-8"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 [font-family:var(--font-label)]">
                {post.category}
              </p>
              <h3 className="mt-3 text-xl font-medium leading-snug tracking-tight text-white">
                {post.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-white/55">
                {post.excerpt}
              </p>
              <div className="mt-6 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                  Read the article
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="text-[11px] uppercase tracking-[0.15em] text-white/30 [font-family:var(--font-label)]">
                  {post.date}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

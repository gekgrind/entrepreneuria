import type { Metadata } from "next";
import { Users, MessageSquare, Calendar } from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { PillButton, StatusDot } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Community — The Founder's Table | Entrepreneuria",
  description:
    "The Founder's Table is Entrepreneuria's community for solo founders — discussions, events, and real talk from people building alongside you. In development.",
};

const pillars = [
  {
    icon: MessageSquare,
    title: "Active discussions",
    body: "Share advice, ask questions, and connect in founder discussions built around real problems — strategy, pricing, launches, and the messy middle.",
  },
  {
    icon: Calendar,
    title: "Events & workshops",
    body: "Virtual meetups, founder roundtables, and AI training sessions — practical rooms, not webinars that should have been an email.",
  },
  {
    icon: Users,
    title: "Member spotlights",
    body: "Real founders, real builds, real numbers. As the community grows, the people doing the work get the spotlight — no stock personas.",
  },
];

export default function CommunityPage() {
  return (
    <PageShell>
      <PageHero
        kicker={
          <span className="inline-flex items-center gap-3">
            <StatusDot live={false} />
            The Founder&apos;s Table · In development
          </span>
        }
        title={
          <>
            Founders who are <em className="italic">in it with you</em>.
          </>
        }
        lede="The Founder's Table is where the real conversations will happen — strategy, support, accountability, and real talk from founders building alongside you, not above you."
      >
        <div className="flex flex-wrap gap-4">
          <PillButton href="/waitlist">Get notified when it opens</PillButton>
        </div>
      </PageHero>

      <Section
        kicker="01 — What's planned"
        title={
          <>
            A table, not an <em className="italic">audience</em>.
          </>
        }
        lede="Here's what the community is being built around. What's live is live; what isn't is labeled — and this one is still in the shop."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.title}
                className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-8"
              >
                <Icon
                  className="mb-5 h-6 w-6 text-[#00d4ff]"
                  aria-hidden="true"
                />
                <h3 className="text-2xl font-medium tracking-tight text-white">
                  {pillar.title}
                </h3>
                <p className="mt-3 flex-1 leading-7 text-white/60">
                  {pillar.body}
                </p>
              </article>
            );
          })}
        </div>

        <p className="mt-14 max-w-2xl text-sm leading-6 text-white/45">
          The waitlist is the door: members get first invites as The
          Founder&apos;s Table opens, alongside early access to the AI products.
        </p>
      </Section>
    </PageShell>
  );
}

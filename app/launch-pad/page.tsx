import type { Metadata } from "next";
import Link from "@/components/transition/TransitionLink";
import {
  ArrowRight,
  BookOpen,
  Download,
  Sparkles,
  Users,
} from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { PillButton, StatusDot } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Launch Pad | Entrepreneuria",
  description:
    "The Launch Pad: free AI founder tools, startup templates and playbooks, and straight-talk articles — live today, free while in beta.",
};

const destinations = [
  {
    icon: Sparkles,
    title: "Free AI tools",
    live: true,
    status: "Live now",
    body: "Six AI systems for the problems founders face most — business models, market analysis, financial projections, personas, pitch decks, and hiring.",
    href: "/launch-pad/tools",
    cta: "Open the tools",
  },
  {
    icon: Download,
    title: "Resources & templates",
    live: true,
    status: "Live now",
    body: "Free, downloadable frameworks, playbooks, and templates — funding, growth, startup frameworks, and team building — organized so you can stop searching and start doing.",
    href: "/launch-pad/resources",
    cta: "Browse the library",
  },
  {
    icon: BookOpen,
    title: "The Knowledge Blueprint",
    live: true,
    status: "Live now",
    body: "Insights, frameworks, and straight talk for founders figuring it out in real time. No recycled listicles, no armchair thought leadership.",
    href: "/launch-pad/blog",
    cta: "Read the articles",
  },
  {
    icon: Users,
    title: "The Founder's Table",
    live: false,
    status: "In development",
    body: "Discussions, events, and real talk from founders building alongside you. In development — the waitlist gets first invites when it opens.",
    href: "/launch-pad/community",
    cta: "See what's planned",
  },
];

const tools = [
  {
    name: "Business Model Blueprint",
    desc: "Generate a clear, structured business model canvas with AI assistance.",
    href: "/launch-pad/tools/business-model-blueprint",
  },
  {
    name: "Market Analysis AI",
    desc: "Market sizing, competitive landscape, and positioning insights.",
    href: "/launch-pad/tools/market-analysis-ai",
  },
  {
    name: "Financial Projector",
    desc: "Realistic, defensible projections without needing to be a CFO.",
    href: "/launch-pad/tools/financial-projector",
  },
  {
    name: "Customer Persona Builder",
    desc: "Rich personas grounded in behavioral and psychographic detail.",
    href: "/launch-pad/tools/customer-persona-builder",
  },
  {
    name: "Pitch Deck Creator",
    desc: "A compelling narrative arc and slide-ready content for investors.",
    href: "/launch-pad/tools/pitch-deck-creator",
  },
  {
    name: "Hiring Assistant",
    desc: "Sharper job descriptions and interview frameworks for your stage.",
    href: "/launch-pad/tools/hiring-assistant",
  },
];

export default function HubPage() {
  return (
    <PageShell>
      <PageHero
        kicker={
          <span className="inline-flex items-center gap-3">
            <StatusDot live />
            The Launch Pad · Free while in beta
          </span>
        }
        title={
          <>
            Your gateway to <em className="italic">entrepreneurial</em>{" "}
            success.
          </>
        }
        lede="A growing library of AI-powered tools, guides, templates, and startup frameworks for every stage of your journey — live on this site, free today."
      >
        <div className="flex flex-wrap gap-4">
          <PillButton href="/launch-pad/tools">Open the free tools</PillButton>
        </div>
      </PageHero>

      <Section
        kicker="01 — What's inside"
        title={
          <>
            A growing <em className="italic">ecosystem</em>.
          </>
        }
        lede="Four sections, honestly labeled. What's live is live; what isn't is marked."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {destinations.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25 sm:p-8"
              >
                <div className="flex items-center justify-between">
                  <Icon
                    className="h-6 w-6 text-[#00d4ff]"
                    aria-hidden="true"
                  />
                  <span
                    className={`inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] [font-family:var(--font-label)] ${
                      item.live ? "text-[#00d4ff]" : "text-white/40"
                    }`}
                  >
                    <StatusDot live={item.live} />
                    {item.status}
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-medium tracking-tight text-white">
                  {item.title}
                </h3>
                <p className="mt-3 flex-1 leading-7 text-white/60">
                  {item.body}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                  {item.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section
        kicker="02 — The AI toolkit"
        title={
          <>
            Six systems, ready <em className="italic">today</em>.
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.name}
              href={tool.href}
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/25"
            >
              <p className="text-[15px] font-semibold text-white">
                {tool.name}
              </p>
              <p className="mt-2 flex-1 text-sm leading-6 text-white/50">
                {tool.desc}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 transition group-hover:text-white">
                Launch tool
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section kicker="03 — What's next">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-14 text-center sm:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.25),transparent_65%)]"
          />
          <h2 className="relative text-balance text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
            The Launch Pad keeps <em className="italic">growing</em>.
          </h2>
          <p className="relative mx-auto mt-5 max-w-2xl leading-7 text-white/60">
            New tools, templates, and articles land here first — and the
            waitlist gets first access to Prospra, Architecta, and Synceri as
            each one ships.
          </p>
          <div className="relative mt-9 flex justify-center">
            <PillButton href="/waitlist">Join the waitlist</PillButton>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}

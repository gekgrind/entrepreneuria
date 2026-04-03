"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  MessageCircle,
  CheckCircle,
  Compass,
  LineChart,
  Rocket,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  {
    value: "93%",
    label: "of self-made millionaires credit a mentor",
  },
  {
    value: "84%",
    label: "of CEOs say their mentor helped them avoid costly mistakes",
  },
  {
    value: "95%",
    label: "of people looking for a mentor never find one",
  },
];

const steps = [
  {
    step: "1",
    title: "Tell Us About You",
    description:
      "Walk through a personalized onboarding process. Prospra learns your business stage, goals, available time, and founder journey so every interaction starts from where you really are.",
  },
  {
    step: "2",
    title: "Get Matched With Your Mentor",
    description:
      "Your AI mentor combines current business trends, proven frameworks, and your onboarding context to deliver practical guidance instead of generic internet advice.",
  },
  {
    step: "3",
    title: "Build, Grow, Repeat",
    description:
      "From ideation to production to scaling, Prospra works alongside you with mentor chat and built-in tools so you can keep making progress when it matters most.",
  },
];

const benefits = [
  {
    title: "Expert-Level Guidance",
    description:
      "Access strategies and insights usually locked behind high-ticket consultants and accelerators.",
  },
  {
    title: "Personalized Direction",
    description:
      "Prospra learns your business model, industry, and goals so guidance stays specific and useful.",
  },
  {
    title: "Always Available",
    description:
      "Get support whenever you need it without waiting on calendars, introductions, or office hours.",
  },
  {
    title: "Proven Frameworks",
    description:
      "Use practical systems built around how real founders validate, launch, and grow.",
  },
];

const tools = [
  {
    icon: Sparkles,
    title: "FounderFuel",
    description:
      "Stop guessing at prompts. Enter your goals, details, and AI platform, then FounderFuel generates stronger expert-level prompts.",
  },
  {
    icon: Compass,
    title: "Web Advisory",
    description:
      "Get a full website audit with a clear advisory score, identified gaps, and specific next actions.",
  },
  {
    icon: Rocket,
    title: "Copy Architect",
    description:
      "Create and optimize website copy that ranks, converts, and sounds aligned with your brand.",
  },
];

const supportingFeatures = [
  {
    icon: LineChart,
    title: "Progress Tracking and Milestones",
    description:
      "Set goals, track milestones, and keep momentum visible so you stay focused on meaningful progress.",
  },
  {
    icon: Brain,
    title: "Resource Vault and Smart Recommendations",
    description:
      "Access curated templates, frameworks, and founder resources with recommendations matched to your current stage.",
  },
  {
    icon: MessageCircle,
    title: "Personalized Mindset Coach",
    description:
      "Work through founder pressure with practical support for stress management, clarity, and confidence.",
  },
  {
    icon: ArrowRight,
    title: "Pivot Advisor",
    description:
      "Evaluate whether to keep pushing or pivot with structured analysis that supports confident decisions.",
  },
];

const mentorSupport = [
  "Expert support across strategy, operations, marketing, and finance",
  "Context-aware responses based on your stage and goals",
  "Momentum support when founder pressure gets heavy",
  "Built to scale from your first idea to your first million",
];

export default function ProspraPage() {
  return (
    <main className="overflow-hidden bg-[var(--brand-navy)] text-white">
      {/* Hero */}
      <section className="relative isolate min-h-[88vh] overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/videos/prospra-header.mp4"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(8,15,28,0.45),rgba(8,15,28,0.68),rgba(8,15,28,0.82))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.18),transparent_32%)]" />

        <div className="relative z-10 flex min-h-[88vh] items-center justify-center px-6 pt-16 pb-20 sm:px-10 lg:px-12">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-5 border border-white/30 bg-white/15 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-white">
              LAUNCHING SOON
            </Badge>

            <h1 className="font-heading text-4xl font-bold leading-tight drop-shadow-lg md:text-6xl">
              Meet {" "}
              <span className="font-heading italic text-[#00D4FF] font-semibold">
                Prospra
              </span>
              , your AI-powered business mentor
            </h1>

            <p className="mt-5 text-lg leading-relaxed text-white/90 md:text-2xl">
              Expert guidance from ideation to scaling, on demand, on your
              terms. Because every founder deserves a mentor in their corner.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="px-8 py-3 text-base font-semibold md:text-lg"
              >
                <Link href="#waitlist">
                  Join the Waitlist <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white bg-transparent px-8 py-3 text-base text-white transition-all hover:bg-white hover:text-[#4f7ca7] md:text-lg"
              >
                <Link href="#features">See What&apos;s Inside</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-white/10 bg-[var(--brand-navy)]/85 px-6 py-12 sm:px-10 lg:px-12">
        <div className="mx-auto grid max-w-5xl gap-6 text-center sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-6"
            >
              <p className="text-4xl font-semibold text-[#00D4FF]">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-white/70">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section
        id="story"
        className="border-b border-white/10 bg-[#f7f9fc] px-6 py-24 text-[var(--brand-navy)] sm:px-10 lg:px-12"
      >
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.22em] text-[#00D4FF] sm:text-sm">
              WHY PROSPRA EXISTS?
            </p>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Built by a founder who needed what nobody was offering
            </h2>
            <div className="mt-8 space-y-5 text-lg leading-8 text-slate-700">
              <p>
                Prospra was born out of frustration. I was building a business
                and hitting walls that felt impossible to get past alone —
                the kind of walls that make you question everything.
              </p>
              <p>
                Then I saw the pattern: Steve Jobs mentored Mark Zuckerberg.
                Warren Buffet mentored Bill Gates. Maya Angelou mentored Oprah.
                Behind nearly every successful founder, there was a mentor — and
                the data backed it up. 
              </p>
              <p>
                But 95% of people looking for a mentor never find one. 
              </p>
              <p>
                So I built Prospra — not just as an AI mentor, but as a hands-on
                partner, to help you make better decisions, move faster, and 
                actually reach your goals.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[24px] border-slate-200 bg-white text-[var(--brand-navy)] shadow-[0_20px_60px_rgba(26,41,66,0.1)]">
              <CardContent className="p-7">
                <blockquote className="text-lg leading-8 text-slate-700">
                  &quot;That just did not seem right to me, so I wanted everyone to
                  have something to turn to when they need advice, have
                  questions, or feel overwhelmed.&quot;
                </blockquote>
                <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-orange)]">
                  Misti, Founder of Entrepreneuria
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-white/10 px-6 py-24 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-xs uppercase tracking-[0.22em] text-[#00D4FF] sm:text-sm">
            HOW IT WORKS
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Up and running in three steps
          </h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/78">
            Prospra&apos;s onboarding learns about you, your business, and your
            goals so your mentorship experience is relevant from day one.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((item) => (
              <Card key={item.title} className="border-white/15 bg-white/8">
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-[#ffd7af]">
                    {item.step}
                  </div>
                  <CardTitle className="pt-3 text-2xl text-white">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white/80">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="border-b border-white/10 bg-[#f7f9fc] px-6 py-24 text-[var(--brand-navy)] sm:px-10 lg:px-12"
      >
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-xs uppercase tracking-[0.22em] text-[#00D4FF] sm:text-sm">
            FEATURES & TOOLS
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">
            Prospra combines AI-powered mentorship with practical tools designed
            to help solo founders move faster and smarter.
          </p>

          <div className="mt-12 grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <h3 className="text-3xl font-semibold tracking-tight">
                Why entrepreneurs choose Prospra
              </h3>
              <div className="mt-8 space-y-4">
                {benefits.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <CheckCircle className="mt-1 h-5 w-5 shrink-0 text-[var(--brand-orange)]" />
                    <div>
                      <h4 className="text-lg font-semibold">{item.title}</h4>
                      <p className="mt-1 text-slate-700">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Card className="rounded-[28px] border-0 bg-[var(--brand-navy)] text-white shadow-[0_24px_70px_rgba(26,41,66,0.22)]">
              <CardContent className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
                <div>
                  <h3 className="text-3xl font-semibold text-white">
                    On-demand mentor chat
                  </h3>
                  <p className="mt-4 text-lg leading-8 text-white/82">
                    Your mentor is available 24/7, informed by your onboarding
                    profile and current business strategies. Ask anything,
                    anytime.
                  </p>
                  <ul className="mt-6 space-y-3 text-white/82">
                    {mentorSupport.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-[#00D4FF]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/95 p-5 text-[var(--brand-navy)] shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    You
                  </p>
                  <p className="mt-2 rounded-xl bg-slate-50 p-4 text-slate-700 shadow-sm">
                    I&apos;ve been working on my MVP for 3 months and I&apos;m not sure if I
                    should keep going or pivot. How do I know?
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-orange)]">
                    Prospra Mentor
                  </p>
                  <p className="mt-2 rounded-xl bg-[var(--brand-navy)] px-4 py-4 text-white">
                    Great question. Let&apos;s look at user feedback, traction
                    metrics, and whether the core problem still energizes you.
                    Walk me through what you&apos;re seeing.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {tools.map((tool) => {
              const Icon = tool.icon;

              return (
                <Card
                  key={tool.title}
                  className="border-slate-200 bg-white text-[var(--brand-navy)] shadow-sm transition-transform duration-200 hover:-translate-y-1"
                >
                  <CardHeader>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-navy)] text-white shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="pt-3 text-2xl">{tool.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-700">{tool.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Supporting features */}
      <section className="border-b border-white/10 px-6 py-24 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-xs uppercase tracking-[0.22em] text-[#00D4FF] sm:text-sm">
            AND THERE&apos;S MORE
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Built-in tools to keep you moving
          </h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/78">
            Prospra is not just a chatbot. It&apos;s a founder support layer designed
            around how real businesses get built.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {supportingFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-white/15 bg-white/8 p-6 backdrop-blur"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                      <Icon className="h-5 w-5 text-[#ffd7af]" />
                    </div>
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                  </div>
                  <p className="mt-3 text-white/78">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        id="waitlist"
        className="bg-white/10 px-4 py-20 text-center backdrop-blur-sm"
      >
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-4xl font-bold drop-shadow-lg sm:text-5xl">
            Ready to build with a mentor in your corner?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/80">
            Prospra is almost here. Join the waitlist and be first in line when
            we launch. Real guidance, real momentum, and a smarter way to build
            without doing it all alone.
          </p>

          <div className="mt-10 flex justify-center">
            <Button
              size="lg"
              asChild
              className="group relative overflow-hidden rounded-full bg-[#1a2942] !text-white font-medium tracking-wide transition-all duration-300 hover:bg-[#223556] hover:scale-[1.03] shadow-[0_0_15px_rgba(0,212,255,0.25)] hover:shadow-[0_0_30px_rgba(0,212,255,0.7)]"
            >
              <Link
                href="/waitlist"
                className="relative inline-flex items-center justify-center px-8 py-6"
              >
                <span className="relative z-10">Join the Waitlist</span>
                <span aria-hidden="true" className="button-shimmer" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
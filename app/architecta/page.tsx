"use client";

import React from "react";
import { Playfair_Display } from "next/font/google";
import {
  ArrowRight,
  CheckCircle,
  Folder,
  Layers,
  Minus,
  PenTool,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";

import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const eyebrowClass =
  "mb-5 inline-flex border border-[#00D4FF]/35 bg-[#00D4FF]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#00D4FF]";

const features = [
  {
    number: "01",
    title: "Idea Builder",
    kicker: "From rough thought to ready-to-create, in seconds.",
    desc: (
      <>
        You know what you want to say. You just don&apos;t know how to say it.
        The Idea Builder turns scattered thoughts, rough notes, and half-formed
        ideas into clear, structured content directions you can actually use.
      </>
    ),
    founderLine: "For founders who have the expertise but not the words.",
    icon: Sparkles,
  },
  {
    number: "02",
    title: "Strategy-to-Content Engine",
    kicker: "Set your strategy once. Architecta runs with it.",
    desc: (
      <>
        Define your audience, your offer, and your tone one time. Architecta
        remembers and applies that context across everything it creates, so your
        content stops feeling disconnected and starts working as one system.
      </>
    ),
    founderLine: "For founders tired of reinventing the wheel every content day.",
    icon: Target,
  },
  {
    number: "03",
    title: "Brand Voice Studio",
    kicker: "Sound like you, everywhere, every time.",
    desc: (
      <>
        Your brand voice is not “professional yet approachable.” It&apos;s
        specific. It&apos;s yours. Brand Voice Studio learns your phrasing,
        rhythm, and energy so every piece of content feels consistent and
        recognizably you.
      </>
    ),
    founderLine:
      "For founders who cringe when AI content sounds like a robot wrote it.",
    icon: PenTool,
  },
  {
    number: "04",
    title: "Multi-Platform Generator",
    kicker: "One source, many channels.",
    desc: (
      <>
        Start with one core idea. Architecta adapts it into platform-ready
        content for LinkedIn, Instagram, email, blogs, ads, and more, with each
        version shaped for the channel it belongs on.
      </>
    ),
    founderLine: "For founders who are everywhere but can't be everywhere.",
    icon: Layers,
  },
  {
    number: "05",
    title: "Smart Editing Tools",
    kicker: "Polish without rewriting.",
    desc: (
      <>
        Make it shorter. Bolder. Friendlier. More confident. Architecta gives
        you fast variations without losing your original point, so you can
        refine what matters instead of starting over.
      </>
    ),
    founderLine:
      "For leaders who know 'this isn't quite right' but can't pinpoint why.",
    icon: CheckCircle,
  },
  {
    number: "06",
    title: "Content Library",
    kicker: "Your content brain, not your content mess.",
    desc: (
      <>
        Everything you create stays organized and reusable. Search by topic,
        platform, campaign, or date. Revisit winning ideas, remix old assets,
        and build long-term content equity instead of starting from zero.
      </>
    ),
    founderLine: "For businesses building long-term content equity.",
    icon: Folder,
  },
];

const steps = [
  {
    step: "1",
    title: "Teach Architecta Your Brand",
    punchline: "Dial in your voice once.",
    desc: "Tell Architecta who you are, who you serve, and how you sound. It learns your brand DNA and applies it to everything going forward.",
  },
  {
    step: "2",
    title: "Create Content Your Way",
    punchline: "Create exactly how you want to work.",
    desc: "Start from scratch, generate strategically, or go multi-platform. Mix, match, and move as fast as you need.",
  },
  {
    step: "3",
    title: "Refine and Publish",
    punchline: "Polish it. Save it. Ship it.",
    desc: "Edit the tone, refine the message, and keep what works. Publish when you're ready. No friction, no robotic output.",
  },
];

const comparisonRows = [
  {
    label: "Planning-to-publishing speed",
    architecta: "Minutes with guided structure",
    oldWay: "Hours across disconnected tools",
  },
  {
    label: "Brand voice consistency",
    architecta: "Unified voice profile and reusable standards",
    oldWay: "Inconsistent writing across contributors",
  },
  {
    label: "Channel adaptation",
    architecta: "Built-in multi-platform output",
    oldWay: "Manual rewrites for every channel",
  },
  {
    label: "Founder workload",
    architecta: "Reduced cognitive load and clean workflows",
    oldWay: "Constant context switching and bottlenecks",
  },
];

const faqs = [
  {
    value: "faq-1",
    question: "Can Architecta actually match my brand voice?",
    answer:
      "Yes. Architecta learns from your positioning and preferred tone, then applies that context across content types so messaging stays consistent.",
  },
  {
    value: "faq-2",
    question: "Is this only for social posts?",
    answer:
      "No. Architecta supports broader marketing workflows, including launch messaging, campaign copy, long-form drafts, and channel-specific adaptations.",
  },
  {
    value: "faq-3",
    question: "Will I still need to edit outputs?",
    answer:
      "You keep full editorial control. Architecta accelerates drafting and structure, while your final review ensures every piece meets your standards.",
  },
  {
    value: "faq-4",
    question: "Who gets the most value from Architecta?",
    answer:
      "Founder-led teams and lean operators who need premium marketing output without adding expensive agency or in-house overhead.",
  },
  {
    value: "faq-5",
    question: "Is Architecta just another ChatGPT wrapper?",
    answer:
      "No. Architecta isn't a chat window where you type a prompt and hope for the best. It's a structured content studio with dedicated tools for ideation, brand voice, multi-platform creation, editing, and organization. The AI is the engine under the hood, not the entire product.",
  },
  {
    value: "faq-6",
    question: "Do I need to be good at writing to use Architecta?",
    answer:
      "Not even a little bit. Architecta is built specifically for people who aren't writers but need to create professional, on-brand content consistently. The Idea Builder helps you get started, the Brand Voice Studio makes sure it sounds like you, and Smart Editing lets you polish without rewriting.",
  },
  {
    value: "faq-7",
    question: "How is this different from Jasper, Copy.ai, or Blaze?",
    answer:
      "Those tools are excellent for marketers. They assume you already know what you want to create, what platform you're targeting, and what your brand voice sounds like. Architecta starts further upstream. It helps you define your strategy, build your voice, and then creates the content to match. It's the difference between a power tool and a workshop.",
  },
  {
    value: "faq-8",
    question: "Will my content sound robotic or generic?",
    answer:
      "That's the whole point of the Brand Voice Studio. You teach Architecta your voice, your specific phrases, your energy, your tone, and it applies that voice to everything. The result is content that sounds like you wrote it on a good day, not like a robot summarized a marketing textbook.",
  },
];

const ecosystemCards = [
  {
    title: "Prospra",
    desc: "Your AI-powered business mentor that helps founders think through strategy, decisions, and next moves with more clarity.",
    href: "/prospra",
    cta: "Explore Prospra",
  },
  {
    title: "Launch Pad",
    desc: "A growing set of startup-ready tools, templates, and systems designed to help founders build faster and smarter.",
    href: "/launch-pad/tools",
    cta: "See Launch Pad",
  },
  {
    title: "Entrepreneuria",
    desc: "The larger ecosystem connecting AI apps, founder tools, and resources into one business-building suite.",
    href: "/",
    cta: "View the Ecosystem",
  },
];

export default function ArchitectaPage() {
  const [activeFaq, setActiveFaq] = React.useState<string>(faqs[0].value);

  return (
    <main className="min-h-screen overflow-hidden bg-[#050b14] text-white">
      <section className="relative -mt-[calc(var(--header-height)+1rem)]">
        <PageHeader
          title=""
          videoSrc="/videos/architecta-header.mp4"
          textColor="text-transparent"
        />

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4">
          <div className="pointer-events-auto mx-auto max-w-4xl text-center">
            <Badge className={eyebrowClass}>AI Content Studio</Badge>

            <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold leading-tight text-white md:text-6xl">
              Stop guessing your content.
              <br />
              Start engineering it.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85 md:text-xl">
              Architecta turns your ideas into structured, platform-ready content
              without the chaos, rewrites, or wasted hours.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="bg-[#00D4FF] px-8 text-sm text-[#04101f] hover:bg-[#00D4FF]/90"
              >
                Get Early Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="border-white/25 bg-black/20 text-white backdrop-blur-sm hover:border-white/40 hover:bg-white/10"
              >
                See How It Works
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mr-auto max-w-2xl text-left">
            <Badge className={eyebrowClass}>SOUND FAMILIAR?</Badge>

            <h2 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
              You didn&apos;t start a business to become a content manager.
            </h2>

            <p className="mt-6 text-lg leading-relaxed text-white/80">
              You know you need to post. You know you need emails, blogs, social
              content, ad copy, all of it. But you&apos;re one person running an
              entire business.
            </p>

            <p className="mt-4 text-lg leading-relaxed text-white/80">
              So the content either doesn&apos;t get done, or it eats your entire
              week. You&apos;re staring at blank screens, rewriting the same idea
              four different ways for four different platforms, and toggling
              between tabs like it&apos;s a competitive sport.
            </p>

            <p className="mt-4 text-lg leading-relaxed text-white/80">
              Meanwhile, the AI tools that were supposed to help spit out generic
              copy that sounds nothing like you and still needs an hour of
              editing.
            </p>

            <p className="mt-6 text-lg font-medium italic text-[#00D4FF]">
              You don&apos;t need another AI writing app. You need a system.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white/[0.04] px-4 py-20 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <Badge className={eyebrowClass}>MEET ARCHITECTA</Badge>

          <h2 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
            Not another AI marketing app.
            <br />
            A real content system.
          </h2>

          <p className="mt-6 text-lg leading-relaxed text-white/80">
            Architecta is a content studio, not a chatbot with a text box. You
            tell it who you are, who you serve, and how you want to sound once.
            Then Architecta creates, adapts, and organizes your content across
            every platform: blogs, emails, social posts, ads, and landing pages.
          </p>

          <p className="mt-4 text-lg leading-relaxed text-white/80">
            Think of it as the content department you can&apos;t afford to hire,
            built into one intelligent tool.
          </p>

          <h3 className="mt-8 text-xl font-semibold italic text-[#00D4FF]">
            &ldquo;Content isn&apos;t chaos. It&apos;s architecture.&rdquo;
          </h3>
        </div>
      </section>

      <section className="bg-white/[0.04] px-4 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center md:mb-14">
            <Badge className={eyebrowClass}>What&apos;s Inside</Badge>
            <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
              Six features. Zero guesswork.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="group relative flex h-full flex-col rounded-2xl border border-white/15 bg-[#0b1728]/85 p-6 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] transition duration-300 hover:-translate-y-0.5 hover:border-[#00D4FF]/45 hover:shadow-[0_16px_40px_rgba(0,212,255,0.12)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-[#00D4FF]/45 bg-[#00D4FF]/10 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-[#00D4FF]">
                      {feature.number}
                    </span>
                    <Icon className="h-5 w-5 text-[#00D4FF]/85" />
                  </div>

                  <h3 className="mt-5 text-xl font-semibold leading-snug">
                    {feature.title}
                  </h3>

                  <p className="mt-2 text-sm font-medium text-[#00D4FF]">
                    {feature.kicker}
                  </p>

                  <p className="mt-4 flex-1 text-sm leading-relaxed text-white/78">
                    {feature.desc}
                  </p>

                  <div className="my-5 h-px bg-gradient-to-r from-[#00D4FF]/40 via-white/20 to-transparent" />

                  <p className="text-xs font-medium italic leading-relaxed text-white/70">
                    {feature.founderLine}
                  </p>

                  <div
                    className={`pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100 ${
                      index % 2 === 0
                        ? "bg-[radial-gradient(circle_at_top_right,rgba(0,212,255,0.08),transparent_55%)]"
                        : "bg-[radial-gradient(circle_at_bottom_left,rgba(0,212,255,0.06),transparent_55%)]"
                    }`}
                  />
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="border-t border-white/10 pt-16 md:pt-20">
            <div className="mx-auto max-w-4xl text-center">
              <Badge className={eyebrowClass}>Three Steps. That&apos;s It.</Badge>

              <h2 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-[0.01em] text-white sm:text-5xl lg:text-6xl">
                From idea to published.
                <br className="hidden sm:block" />
                In one flow.
              </h2>
            </div>

            <div className="mx-auto mt-16 grid max-w-6xl gap-14 md:mt-20 md:grid-cols-3 md:gap-10 lg:gap-14">
              {steps.map((step) => (
                <div
                  key={step.step}
                  className="flex flex-col items-center text-center"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#00D4FF]/80 bg-transparent shadow-[0_0_0_1px_rgba(0,212,255,0.08),0_0_30px_rgba(0,212,255,0.10)] md:h-24 md:w-24">
                    <span className="text-3xl font-bold leading-none text-[#00D4FF] md:text-4xl">
                      {step.step}
                    </span>
                  </div>

                  <h3 className="mt-8 text-2xl font-semibold leading-tight text-white">
                    {step.title}
                  </h3>

                  <p className="mt-4 text-base font-medium leading-7 text-[#00D4FF] md:text-lg">
                    {step.punchline}
                  </p>

                  <p className="mt-4 max-w-sm text-base leading-8 text-white/72 md:text-[17px]">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white/[0.04] px-4 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-4xl text-left">
            <Badge className={eyebrowClass}>Why Architecta</Badge>

          <h2 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            <span className={`${playfairDisplay.className} md:whitespace-nowrap`}>
            Built for founders who market everything.
            </span>
            <br />
            <span className={`${playfairDisplay.className} text-white/70`}>
            Without a marketing department.
            </span>
          </h2>

            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/78 md:text-xl">
              Most AI content tools assume you already have a marketing system.
              Architecta is built for the founder who is the system, giving you
              structure, clarity, and ready-to-publish output without the usual chaos.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-2xl border border-white/15 bg-[#0b1626]/90 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
            <div className="grid grid-cols-2 border-b border-white/12 px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/60 md:px-8 md:text-sm">
              <p>What other tools expect</p>
              <p className="text-[#00D4FF]">What Architecta does</p>
            </div>

            {comparisonRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-1 border-b border-white/10 px-5 py-5 last:border-b-0 md:grid-cols-2 md:px-8"
              >
                <p className="pr-6 text-base leading-relaxed text-white/60">
                  {row.oldWay}
                </p>
                <p className="mt-3 text-base font-medium leading-relaxed text-white md:mt-0">
                  {row.architecta}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <Badge className={eyebrowClass}>FAQ</Badge>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Questions before you start?
            </h2>
          </div>

          <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-6">
            <Accordion
              type="single"
              collapsible
              value={activeFaq}
              onValueChange={(value) => setActiveFaq(value || "")}
            >
              {faqs.map((faq) => {
                const isOpen = activeFaq === faq.value;

                return (
                  <AccordionItem
                    key={faq.value}
                    value={faq.value}
                    className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-[#0f1d32]/90 transition-all duration-200 last:mb-0"
                  >
                    <AccordionTrigger className="group px-4 py-5 text-left text-base font-medium text-white hover:no-underline md:px-5">
                      <span className="flex w-full items-center justify-between gap-4">
                        <span
                          className={`transition-colors duration-200 ${
                            isOpen
                              ? "text-[#00D4FF]"
                              : "text-white/90 group-hover:text-white"
                          }`}
                        >
                          {faq.question}
                        </span>

                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 transition-all duration-200 group-hover:border-[#00D4FF]">
                          {isOpen ? (
                            <Minus className="h-4 w-4 text-[#00D4FF]" />
                          ) : (
                            <Plus className="h-4 w-4 text-white/70 group-hover:text-[#00D4FF]" />
                          )}
                        </span>
                      </span>
                    </AccordionTrigger>

                    <AccordionContent className="px-4 pb-5 pt-0 text-[15px] leading-relaxed text-white/70 md:px-5">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </div>
      </section>

      <section className="bg-white/[0.04] px-4 py-20 text-center md:py-24">
        <div className="mx-auto max-w-6xl">
          <Badge className={eyebrowClass}>Ecosystem</Badge>
          <h2 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
            Part of the{" "}
            <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
              Entrepreneuria
            </span>{" "}
            AI business suite
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-white/80">
            Architecta works seamlessly with other Entrepreneuria tools so your
            business runs smarter, not harder.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {ecosystemCards.map((card) => (
              <article
                key={card.title}
                className="flex h-full flex-col rounded-2xl border border-white/15 bg-[#0b1728]/85 p-6 text-left"
              >
                <h3 className="text-xl font-semibold">{card.title}</h3>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-white/78">
                  {card.desc}
                </p>
                <a
                  href={card.href}
                  className="mt-6 inline-flex items-center text-sm font-semibold text-[#00D4FF] transition hover:text-[#7cecff]"
                >
                  {card.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-24 text-center">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/10 px-6 py-14 shadow-[0_20px_60px_rgba(0,0,0,0.25)] md:px-10">
          <h2 className="text-4xl font-bold leading-tight text-white md:text-5xl">
            <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
              Your content strategy
            </span>{" "}
            starts here.
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-white/80">
            You&apos;ve been the founder, the marketer, and the content creator
            long enough. It&apos;s time to build the system that does the heavy
            lifting so you can get back to building the business.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="bg-[#00D4FF] px-10 text-base font-semibold text-[#05111f] hover:bg-[#00D4FF]/90"
            >
              Get Early Access to Architecta
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white/90 hover:border-white/50 hover:bg-white/10"
            >
              Book a walkthrough
            </Button>
          </div>

          <p className="mt-4 text-xs text-white/60 md:text-sm">
            No agency retainers. No heavy onboarding. Just focused output.
          </p>
        </div>
      </section>
    </main>
  );
}
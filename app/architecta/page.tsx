import type { Metadata } from "next";
import {
  CheckCircle,
  Folder,
  Layers,
  PenTool,
  Sparkles,
  Target,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import {
  PillButton,
  GhostButton,
  ArrowLink,
  StatusDot,
} from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Architecta — AI Content Studio | Entrepreneuria",
  description:
    "Architecta turns your ideas into structured, platform-ready content without the chaos, rewrites, or wasted hours. In design — join the waitlist.",
};

const features = [
  {
    number: "01",
    title: "Idea Builder",
    kicker: "From rough thought to ready-to-create, in seconds.",
    desc: "You know what you want to say. You just don't know how to say it. The Idea Builder turns scattered thoughts, rough notes, and half-formed ideas into clear, structured content directions you can actually use.",
    founderLine: "For founders who have the expertise but not the words.",
    icon: Sparkles,
  },
  {
    number: "02",
    title: "Strategy-to-Content Engine",
    kicker: "Set your strategy once. Architecta runs with it.",
    desc: "Define your audience, your offer, and your tone one time. Architecta remembers and applies that context across everything it creates, so your content stops feeling disconnected and starts working as one system.",
    founderLine:
      "For founders tired of reinventing the wheel every content day.",
    icon: Target,
  },
  {
    number: "03",
    title: "Brand Voice Studio",
    kicker: "Sound like you, everywhere, every time.",
    desc: "Your brand voice is not “professional yet approachable.” It's specific. It's yours. Brand Voice Studio learns your phrasing, rhythm, and energy so every piece of content feels consistent and recognizably you.",
    founderLine:
      "For founders who cringe when AI content sounds like a robot wrote it.",
    icon: PenTool,
  },
  {
    number: "04",
    title: "Multi-Platform Generator",
    kicker: "One source, many channels.",
    desc: "Start with one core idea. Architecta adapts it into platform-ready content for LinkedIn, Instagram, email, blogs, ads, and more, with each version shaped for the channel it belongs on.",
    founderLine: "For founders who are everywhere but can't be everywhere.",
    icon: Layers,
  },
  {
    number: "05",
    title: "Smart Editing Tools",
    kicker: "Polish without rewriting.",
    desc: "Make it shorter. Bolder. Friendlier. More confident. Architecta gives you fast variations without losing your original point, so you can refine what matters instead of starting over.",
    founderLine:
      "For leaders who know 'this isn't quite right' but can't pinpoint why.",
    icon: CheckCircle,
  },
  {
    number: "06",
    title: "Content Library",
    kicker: "Your content brain, not your content mess.",
    desc: "Everything you create stays organized and reusable. Search by topic, platform, campaign, or date. Revisit winning ideas, remix old assets, and build long-term content equity instead of starting from zero.",
    founderLine: "For businesses building long-term content equity.",
    icon: Folder,
  },
];

const steps = [
  {
    step: "01",
    title: "Teach Architecta your brand",
    punchline: "Dial in your voice once.",
    desc: "Tell Architecta who you are, who you serve, and how you sound. It learns your brand DNA and applies it to everything going forward.",
  },
  {
    step: "02",
    title: "Create content your way",
    punchline: "Create exactly how you want to work.",
    desc: "Start from scratch, generate strategically, or go multi-platform. Mix, match, and move as fast as you need.",
  },
  {
    step: "03",
    title: "Refine and publish",
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
    cta: "View the ecosystem",
  },
];

export default function ArchitectaPage() {
  return (
    <PageShell>
      <PageHero
        kicker={
          <span className="inline-flex items-center gap-3">
            <StatusDot live={false} />
            Architecta · AI content studio — in design
          </span>
        }
        title={
          <>
            Stop guessing your content. Start{" "}
            <em className="italic">engineering</em> it.
          </>
        }
        lede="Architecta turns your ideas into structured, platform-ready content without the chaos, rewrites, or wasted hours."
      >
        <div className="flex flex-wrap gap-4">
          <PillButton href="/waitlist">Get early access</PillButton>
          <GhostButton href="#how-it-works">See how it works</GhostButton>
        </div>
      </PageHero>

      <Section
        kicker="01 — Sound familiar?"
        title={
          <>
            You didn&apos;t start a business to become a{" "}
            <em className="italic">content manager</em>.
          </>
        }
      >
        <div className="max-w-2xl space-y-5 text-lg leading-8 text-white/60">
          <p>
            You know you need to post. You know you need emails, blogs, social
            content, ad copy, all of it. But you&apos;re one person running an
            entire business.
          </p>
          <p>
            So the content either doesn&apos;t get done, or it eats your entire
            week. You&apos;re staring at blank screens, rewriting the same idea
            four different ways for four different platforms, and toggling
            between tabs like it&apos;s a competitive sport.
          </p>
          <p>
            Meanwhile, the AI tools that were supposed to help spit out generic
            copy that sounds nothing like you and still needs an hour of
            editing.
          </p>
          <p className="font-medium italic text-white">
            You don&apos;t need another AI writing app. You need a system.
          </p>
        </div>
      </Section>

      <Section
        kicker="02 — Meet Architecta"
        title={
          <>
            Not another AI marketing app.
            <br />A real content <em className="italic">system</em>.
          </>
        }
      >
        <div className="max-w-2xl space-y-5 text-lg leading-8 text-white/60">
          <p>
            Architecta is a content studio, not a chatbot with a text box. You
            tell it who you are, who you serve, and how you want to sound once.
            Then Architecta creates, adapts, and organizes your content across
            every platform: blogs, emails, social posts, ads, and landing
            pages.
          </p>
          <p>
            Think of it as the content department you can&apos;t afford to
            hire, built into one intelligent tool.
          </p>
          <blockquote className="border-l-2 border-[#d27a2c] pl-6 text-2xl font-medium italic leading-snug text-white">
            “Content isn&apos;t chaos. It&apos;s architecture.”
          </blockquote>
        </div>
      </Section>

      <Section
        kicker="03 — What's inside"
        title={
          <>
            Six features. <em className="italic">Zero</em> guesswork.
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] tracking-[0.2em] text-white/35 [font-family:var(--font-label)]">
                    {feature.number}
                  </span>
                  <Icon
                    className="h-5 w-5 text-[#00d4ff]"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mt-5 text-2xl font-medium tracking-tight text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm font-medium text-white/80">
                  {feature.kicker}
                </p>
                <p className="mt-3 flex-1 text-sm leading-6 text-white/60">
                  {feature.desc}
                </p>
                <p className="mt-5 border-t border-white/10 pt-4 text-xs italic leading-5 text-white/45">
                  {feature.founderLine}
                </p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        id="how-it-works"
        kicker="04 — Three steps. That's it."
        title={
          <>
            From idea to published. In <em className="italic">one</em> flow.
          </>
        }
      >
        <ul className="grid gap-10 md:grid-cols-3">
          {steps.map((step) => (
            <li key={step.step} className="flex gap-5">
              <span className="pt-1 text-[11px] tracking-[0.2em] text-white/35 [font-family:var(--font-label)]">
                {step.step}
              </span>
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm font-medium text-[#00d4ff]">
                  {step.punchline}
                </p>
                <p className="mt-2 leading-7 text-white/60">{step.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        kicker="05 — Why Architecta"
        title={
          <>
            Built for founders who market everything — without a{" "}
            <em className="italic">marketing department</em>.
          </>
        }
        lede="Most AI content tools assume you already have a marketing system. Architecta is built for the founder who is the system, giving you structure, clarity, and ready-to-publish output without the usual chaos."
      >
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="grid grid-cols-2 border-b border-white/10 px-6 py-4 text-[11px] uppercase tracking-[0.2em] [font-family:var(--font-label)] md:px-8">
            <p className="text-white/40">What other tools expect</p>
            <p className="text-[#00d4ff]">What Architecta does</p>
          </div>
          {comparisonRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-1 border-b border-white/[0.05] px-6 py-5 last:border-b-0 md:grid-cols-2 md:px-8"
            >
              <p className="pr-6 leading-7 text-white/45">{row.oldWay}</p>
              <p className="mt-3 font-medium leading-7 text-white md:mt-0">
                {row.architecta}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="06 — FAQ" title="Questions before you start?">
        <div className="max-w-3xl">
          <Accordion
            type="single"
            collapsible
            defaultValue="faq-1"
            className="space-y-1"
          >
            {faqs.map((faq) => (
              <AccordionItem
                key={faq.value}
                value={faq.value}
                className="border-b border-white/10"
              >
                <AccordionTrigger className="py-5 text-left text-base font-semibold text-white hover:no-underline [&>svg]:text-white/50">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-6 leading-7 text-white/60">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      <Section
        kicker="07 — The ecosystem"
        title={
          <>
            Part of the <em className="italic">Entrepreneuria</em> AI business
            suite.
          </>
        }
        lede="Architecta works seamlessly with other Entrepreneuria tools so your business runs smarter, not harder."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {ecosystemCards.map((item) => (
            <article
              key={item.title}
              className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7"
            >
              <h3 className="text-2xl font-medium tracking-tight text-white">
                {item.title}
              </h3>
              <p className="mt-3 flex-1 leading-7 text-white/60">{item.desc}</p>
              <div className="mt-6">
                <ArrowLink href={item.href}>{item.cta}</ArrowLink>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section kicker="08 — The close">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-14 text-center sm:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.25),transparent_65%)]"
          />
          <h2 className="relative text-balance text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
            Your content strategy <em className="italic">starts here</em>.
          </h2>
          <p className="relative mx-auto mt-5 max-w-2xl leading-7 text-white/60">
            You&apos;ve been the founder, the marketer, and the content creator
            long enough. It&apos;s time to build the system that does the heavy
            lifting so you can get back to building the business.
          </p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <PillButton href="/waitlist">
              Get early access to Architecta
            </PillButton>
            <GhostButton href="/contact">Book a walkthrough</GhostButton>
          </div>
          <p className="relative mt-6 text-sm text-white/40">
            No agency retainers. No heavy onboarding. Just focused output.
          </p>
        </div>
      </Section>
    </PageShell>
  );
}

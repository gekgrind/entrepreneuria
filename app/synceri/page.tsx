import type { Metadata } from "next";
import {
  Bot,
  Brain,
  CalendarClock,
  CalendarX2,
  ClipboardList,
  Cog,
  CreditCard,
  Heart,
  Home,
  Plane,
  User,
  Users,
  Wallet,
} from "lucide-react";

import { HomeWaitlistForm } from "@/components/home/HomeWaitlistForm";
import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import {
  PillButton,
  GhostButton,
  StatusDot,
} from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Synceri — AI Life Admin | Entrepreneuria",
  description:
    "Synceri is your AI-powered life admin assistant — designed to organize, automate, and manage the invisible workload that quietly drains your energy every day.",
};

const chaos = [
  {
    icon: ClipboardList,
    title: "Scattered tasks",
    desc: "To-dos across five apps, three sticky notes, and your memory — which isn't great right now.",
  },
  {
    icon: CreditCard,
    title: "Forgotten bills",
    desc: "That subscription you forgot about. The late fee that stings. The autopay you never checked.",
  },
  {
    icon: CalendarX2,
    title: "Calendar chaos",
    desc: "Triple-booked Tuesdays. No buffer. No breathing room. No strategy behind your schedule.",
  },
  {
    icon: Brain,
    title: "Mental overload",
    desc: "Your brain is running background processes 24/7. No wonder you can't focus on what matters.",
  },
];

const triad = [
  {
    icon: Bot,
    title: "Personal assistant",
    desc: 'Ask anything. "What do I need to do today?" "What bills are coming up?" Synceri responds like a real assistant, not a dumb list.',
  },
  {
    icon: Cog,
    title: "Systems operator",
    desc: "Automates workflows, closes loops, follows up when you don't. It doesn't just remind — it orchestrates the entire process until it's done.",
  },
  {
    icon: CalendarClock,
    title: "Life coordinator",
    desc: "Aligns your time with your priorities. Prevents overload. Builds structure without making you feel like a robot on a spreadsheet.",
  },
];

type Feature = {
  number: string;
  title: string;
  desc: string;
  footnoteLead?: string;
  footnote?: string;
  wide?: boolean;
};

const features: Feature[] = [
  {
    number: "01",
    title: "Life Dashboard",
    desc: "Your command center. Tasks, calendar, bills, documents, goals, and priorities — all in one clean interface. Your entire life, at a glance.",
    footnoteLead: "Your Life OS →",
    footnote:
      "No more switching between five different apps to find one piece of information.",
  },
  {
    number: "02",
    title: "AI Life Assistant",
    desc: "Conversational AI that actually understands context. Ask it about your week, your bills, your priorities. It answers like a real assistant — because it is one.",
    footnoteLead: "Try asking →",
    footnote: '"Plan my week around these three priorities."',
  },
  {
    number: "03",
    title: "Smart Reminders",
    desc: "Not the kind you ignore. Synceri nudges you at the right time, adjusts based on your behavior, and follows up if you ghost it. Politely persistent.",
    footnoteLead: "Adaptive →",
    footnote: "Learns when you actually respond and adjusts timing accordingly.",
  },
  {
    number: "04",
    title: "Bills & Subscriptions",
    desc: "Track recurring payments, get alerts before due dates, flag unusual charges, and kill forgotten subscriptions. Because adulthood is basically invoices.",
    footnoteLead: "Never again →",
    footnote: "Late fees from that bill you definitely didn't forget.",
  },
  {
    number: "05",
    title: "Digital Vault",
    desc: "Secure storage for IDs, insurance, warranties, medical info, contracts, and every important document you'd panic without. All searchable by AI.",
    footnoteLead: "Just ask →",
    footnote: '"When does my car insurance expire?"',
  },
  {
    number: "06",
    title: "Calendar Intelligence",
    desc: "Not just events — strategy. Synceri suggests optimal scheduling, prevents overload, and aligns your time with what you said actually matters to you.",
    footnoteLead: "Smart blocking →",
    footnote: "Protects focus time and prevents triple-booking.",
  },
  {
    number: "08",
    title: "Routine & Habit Builder",
    desc: "Morning routines, evening wind-downs, weekly resets. Synceri helps you build structure with adaptive nudges — not rigid schedules that make you feel like a failure by Tuesday.",
  },
  {
    number: "09",
    title: "Life Categories",
    desc: 'Everything modular and organized: Personal, Home, Health, Finance, Family, Travel. No more "where did I put that?" because everything has a place.',
  },
];

const automationSteps = [
  "Identifies what needs to happen",
  "Breaks it into clear steps",
  "Schedules time on your calendar",
  "Sends reminders at the right moment",
  "Follows up until it's done",
];

const otherApps = [
  "Reactive — waits for you to remember",
  "Static lists that just sit there",
  "Scattered across a dozen platforms",
  "Stores data — doesn't think about it",
  "You're still the project manager of your own life",
];

const synceriWay = [
  "Proactive — thinks ahead so you don't have to",
  "Intelligent workflows that close loops",
  "One centralized command center",
  "Understands, reminds, suggests, and acts",
  "Synceri is the project manager — you just live your life",
];

const categories = [
  { icon: User, label: "Personal" },
  { icon: Home, label: "Home" },
  { icon: Heart, label: "Health" },
  { icon: Wallet, label: "Finance" },
  { icon: Users, label: "Family" },
  { icon: Plane, label: "Travel" },
];

function FeaturePanel({ feature }: { feature: Feature }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25 sm:p-8">
      <span className="text-[11px] tracking-[0.2em] text-white/35 [font-family:var(--font-label)]">
        {feature.number}
      </span>
      <h3 className="mt-3 text-2xl font-medium tracking-tight text-white">
        {feature.title}
      </h3>
      <p className="mt-3 flex-1 leading-7 text-white/60">{feature.desc}</p>
      {feature.footnote ? (
        <p className="mt-5 border-t border-white/10 pt-4 text-sm italic leading-6 text-white/45">
          <span className="not-italic text-[#00d4ff]">
            {feature.footnoteLead}{" "}
          </span>
          {feature.footnote}
        </p>
      ) : null}
    </article>
  );
}

export default function SynceriPage() {
  return (
    <PageShell>
      <PageHero
        kicker={
          <span className="inline-flex items-center gap-3">
            <StatusDot live={false} />
            Synceri · Ops &amp; admin flow — in design
          </span>
        }
        title={
          <>
            Your life, <em className="italic">finally organized</em>.
          </>
        }
        lede="Synceri is your AI-powered life admin assistant — designed to organize, automate, and manage the invisible workload that quietly drains your energy every single day."
      >
        <div className="flex flex-wrap gap-4">
          <PillButton href="#waitlist">Get early access</PillButton>
          <GhostButton href="#features">See what it does</GhostButton>
        </div>
      </PageHero>

      <Section
        kicker="01 — The problem"
        title={
          <>
            You&apos;re doing everything.
            <br />
            That&apos;s the <em className="italic">problem</em>.
          </>
        }
      >
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div className="max-w-xl">
            <p className="leading-8 text-white/60">
              Scheduling. Bills. Appointments. Documents. Subscriptions.
              Follow-ups. The DMV. That thing you&apos;ve been meaning to do
              for three weeks. It doesn&apos;t make you money — but it quietly
              eats your energy, your focus, and your bandwidth.
            </p>
            <p className="mt-5 leading-8 text-white/60">
              You&apos;ve got 37 open tabs in your brain and not one of them is
              the thing you actually sat down to work on.
            </p>
            <blockquote className="mt-8 border-l-2 border-[#d27a2c] pl-6 text-xl font-medium italic leading-snug text-white">
              “What would it feel like if your life actually stayed organized…
              without you constantly trying?”
            </blockquote>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {chaos.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <Icon
                    className="mb-3 h-5 w-5 text-[#00d4ff]"
                    aria-hidden="true"
                  />
                  <h4 className="text-[15px] font-semibold text-white">
                    {item.title}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-white/50">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      <Section
        kicker="02 — Meet Synceri"
        title={
          <>
            Not another to-do app.
            <br />A life <em className="italic">operating system</em>.
          </>
        }
        lede="Synceri doesn't just store information. It thinks, reminds, suggests, and acts. It's the intelligent layer between you and the chaos — a personal assistant, systems operator, and life coordinator in one."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {triad.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-8"
              >
                <Icon
                  className="mb-5 h-6 w-6 text-[#00d4ff]"
                  aria-hidden="true"
                />
                <h3 className="text-2xl font-medium tracking-tight text-white">
                  {item.title}
                </h3>
                <p className="mt-3 leading-7 text-white/60">{item.desc}</p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        id="features"
        kicker="03 — Core features"
        title={
          <>
            Everything you need.
            <br />
            <em className="italic">Nothing</em> you don&apos;t.
          </>
        }
        lede="Ten powerful modules designed to take the invisible workload off your plate — for good."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {features.slice(0, 6).map((feature) => (
            <FeaturePanel key={feature.number} feature={feature} />
          ))}

          {/* 07 — the loop-closer, full width */}
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25 sm:p-9 md:col-span-2">
            <div className="grid items-center gap-10 md:grid-cols-2">
              <div>
                <span className="text-[11px] tracking-[0.2em] text-white/35 [font-family:var(--font-label)]">
                  07
                </span>
                <h3 className="mt-3 text-2xl font-medium tracking-tight text-white">
                  Task &amp; Errand Automation
                </h3>
                <p className="mt-3 leading-7 text-white/60">
                  This is where Synceri closes loops. It doesn&apos;t just
                  remind you something needs doing — it maps out the steps,
                  schedules the time, and follows up until it&apos;s actually
                  done. This is the magic.
                </p>
              </div>
              <ul className="flex flex-col gap-3">
                {automationSteps.map((step, index) => (
                  <li
                    key={step}
                    className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
                  >
                    <span className="min-w-[24px] text-[11px] tracking-[0.15em] text-[#00d4ff] [font-family:var(--font-label)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-white/65">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          {features.slice(6).map((feature) => (
            <FeaturePanel key={feature.number} feature={feature} />
          ))}

          {/* 10 — integrations, full width */}
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-10 text-center transition-colors hover:border-white/25 md:col-span-2">
            <span className="text-[11px] tracking-[0.2em] text-white/35 [font-family:var(--font-label)]">
              10
            </span>
            <h3 className="mt-3 text-2xl font-medium tracking-tight text-white">
              Integrations
            </h3>
            <p className="mx-auto mt-3 max-w-2xl leading-7 text-white/60">
              Google Calendar, Apple Calendar, Gmail, Outlook, banking, smart
              home, travel platforms — Synceri connects to the tools you
              already use and becomes the intelligent layer on top of all of
              them.
            </p>
            <p className="mt-5 text-sm italic leading-6 text-white/45">
              <span className="not-italic text-[#00d4ff]">
                The future power move →{" "}
              </span>
              One system to rule them all.
            </p>
          </article>
        </div>
      </Section>

      <Section
        kicker="04 — The difference"
        title={
          <>
            Most apps store info.
            <br />
            Synceri <em className="italic">manages your life</em>.
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-7 sm:p-8">
            <p className="mb-7 text-[11px] uppercase tracking-[0.24em] text-white/40 [font-family:var(--font-label)]">
              Every other app
            </p>
            <ul className="space-y-4">
              {otherApps.map((item) => (
                <li key={item} className="flex gap-3 leading-7 text-white/45">
                  <span aria-hidden="true" className="text-white/30">
                    —
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/25 bg-white/[0.04] p-7 sm:p-8">
            <p className="mb-7 flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-[#00d4ff] [font-family:var(--font-label)]">
              <StatusDot live /> Synceri
            </p>
            <ul className="space-y-4">
              {synceriWay.map((item) => (
                <li key={item} className="flex gap-3 leading-7 text-white/70">
                  <span
                    aria-hidden="true"
                    className="mt-3 h-1 w-1 shrink-0 rounded-full bg-[#00d4ff]"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section
        kicker="05 — Modular organization"
        title={
          <>
            Every part of your life. <em className="italic">One</em> place.
          </>
        }
        lede="Synceri organizes everything into clean, modular categories so nothing falls through the cracks."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center transition-colors hover:border-white/25"
              >
                <Icon
                  className="mx-auto mb-3 h-5 w-5 text-[#00d4ff]"
                  aria-hidden="true"
                />
                <h4 className="text-[11px] uppercase tracking-[0.15em] text-white/70 [font-family:var(--font-label)]">
                  {item.label}
                </h4>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="waitlist" kicker="06 — Early access">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-14 sm:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.25),transparent_65%)]"
          />
          <div className="relative mx-auto max-w-xl text-center">
            <h2 className="text-balance text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
              Your brain has <em className="italic">better things</em> to do.
            </h2>
            <p className="mx-auto mt-5 leading-7 text-white/60">
              Stop being the project manager of your own life. Synceri is
              coming soon — get on the list and be the first to experience what
              it feels like when everything just… works.
            </p>
            <div className="mt-8 text-left">
              <HomeWaitlistForm source="synceri-page" />
            </div>
            <p className="mt-4 text-sm text-white/40">
              Free to join. No spam. Just early access when we launch.
            </p>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}

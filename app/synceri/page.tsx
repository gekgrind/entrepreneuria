"use client";

import { motion } from "framer-motion";
import { Playfair_Display } from "next/font/google";
import PageHeader from "@/components/PageHeader";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export default function SynceriPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#061426] text-white">
      {/* 🎬 HEADER VIDEO */}
      <section className="relative -mt-[calc(var(--header-height)+1rem)] flex h-[85vh] items-center justify-center overflow-hidden">
        <PageHeader
          title=""
          subtitle=""
          videoSrc="/videos/synceri-header.mp4"
          imageSrc="/images/synceri-fallback.jpg"
        />

        {/* HERO OVERLAY */}
        <div className="absolute inset-0 z-20 flex items-center justify-center px-4">
          {/* ORBITS */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="absolute h-[500px] w-[500px] animate-[spin_60s_linear_infinite] rounded-full border border-cyan-400/10" />
            <div className="absolute h-[750px] w-[750px] animate-[spin_90s_linear_infinite_reverse] rounded-full border border-purple-400/10" />
            <div className="absolute h-[1000px] w-[1000px] animate-[spin_120s_linear_infinite] rounded-full border border-red-400/10" />
          </div>

          {/* HERO CONTENT */}
          <div className="relative z-30 max-w-4xl text-center">
            {/* BADGE */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6 inline-flex items-center gap-2 border border-cyan-400/20 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-[#00D4FF] backdrop-blur-md"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#00D4FF] shadow-[0_0_8px_#00D4FF]" />
              Coming Soon — Entrepreneuria Ecosystem
            </motion.div>

            {/* HEADLINE */}
            <motion.h1
              className={`${playfairDisplay.className} text-5xl font-semibold leading-tight text-white md:text-6xl`}
            >
              Your Life,
              <br />
              <span
                className={`${playfairDisplay.className} italic text-[#00D4FF]`}
              >
                Finally organized.
              </span>
            </motion.h1>

            {/* SUBTEXT */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70"
            >
              Synceri is your AI-powered Life Admin Assistant — designed to
              organize, automate, and manage the invisible workload that quietly
              drains your energy every single day.
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9 }}
              className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <a
                href="#waitlist"
                className="bg-[#00D4FF] px-8 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-[#061426] transition hover:shadow-[0_0_25px_rgba(0,212,255,0.4)]"
                style={{
                  clipPath:
                    "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
                }}
              >
                Get Early Access
              </a>

              <a
                href="#features"
                className="border border-[#00D4FF]/40 px-8 py-3 text-sm uppercase tracking-[0.15em] text-[#00D4FF] transition hover:bg-[#00D4FF]/10"
                style={{
                  clipPath:
                    "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
                }}
              >
                See What It Does
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ======== PROBLEM SECTION ======== */}
      <section className="relative px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 md:grid-cols-2">
            {/* LEFT SIDE */}
            <div>
              {/* LABEL */}
              <p className="mb-6 text-xs uppercase tracking-[0.25em] text-[#00D4FF]">
                The Problem
              </p>

              {/* HEADLINE */}
              <h2 className="text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl">
                You're Building a Business.
                <br />
                <span
                  className={`${playfairDisplay.className} italic text-[#ff6b6b]`}
                >
                  Your Life Shouldn't Fall Apart
                  <br />
                  While You Do It.
                </span>
              </h2>

              {/* BODY */}
              <p className="mb-5 mt-6 leading-relaxed text-white/70">
                Scheduling. Bills. Appointments. Documents. Subscriptions.
                Follow-ups. The DMV. That thing you've been meaning to do for
                three weeks. It doesn't make you money — but it quietly eats
                your energy, your focus, and your bandwidth.
              </p>

              <p className="leading-relaxed text-white/70">
                You've got 37 open tabs in your brain and not one of them is the
                thing you actually sat down to work on.
              </p>

              {/* CALLOUT */}
              <div className="mt-8 border-l-2 border-[#00D4FF] pl-5 text-lg italic text-[#00D4FF]">
                "What would it feel like if your life actually stayed
                organized… without you constantly trying?"
              </div>
            </div>

            {/* RIGHT SIDE – CHAOS CARDS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                {
                  icon: "📋",
                  title: "Scattered Tasks",
                  desc: "To-dos across five apps, three sticky notes, and your memory — which isn't great right now.",
                },
                {
                  icon: "💳",
                  title: "Forgotten Bills",
                  desc: "That subscription you forgot about. The late fee that stings. The autopay you never checked.",
                },
                {
                  icon: "📅",
                  title: "Calendar Chaos",
                  desc: "Triple-booked Tuesdays. No buffer. No breathing room. No strategy behind your schedule.",
                },
                {
                  icon: "🧠",
                  title: "Mental Overload",
                  desc: "Your brain is running background processes 24/7. No wonder you can't focus on what matters.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="relative border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#ff6b6b]/40"
                >
                  <div className="absolute left-0 top-0 h-full w-[3px] bg-[#ff6b6b]/60" />

                  <span className="mb-2 block text-xl">{item.icon}</span>

                  <h4 className="mb-1 text-xs uppercase tracking-[0.15em] text-[#ff6b6b]">
                    {item.title}
                  </h4>

                  <p className="text-xs leading-relaxed text-white/60">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ======== WHAT IS SYNCERI ======== */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          {/* HEADER */}
          <div className="mb-16 max-w-2xl">
            <p className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#00D4FF]">
              <span className="h-[1px] w-6 bg-[#00D4FF]" />
              Meet Synceri
            </p>

            <h2 className="text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl">
              Not Another To-Do App.
              <br />
              <span
                className={`${playfairDisplay.className} italic text-[#00D4FF]`}
              >
                A Life Operating System.
              </span>
            </h2>

            <p className="mt-4 text-lg leading-relaxed text-white/70">
              Synceri doesn't just store information. It thinks, reminds,
              suggests, and acts. It's the intelligent layer between you and the
              chaos — a personal assistant, systems operator, and life
              coordinator in one.
            </p>
          </div>

          {/* TRIAD */}
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: "🧠",
                title: "Personal Assistant",
                desc: `Ask anything. "What do I need to do today?" "What bills are coming up?" Synceri responds like a real assistant, not a dumb list.`,
                color: "#00D4FF",
                glow: "rgba(0,212,255,0.15)",
              },
              {
                icon: "⚙️",
                title: "Systems Operator",
                desc: `Automates workflows, closes loops, follows up when you don't. It doesn't just remind — it orchestrates the entire process until it's done.`,
                color: "#a855f7",
                glow: "rgba(168,85,247,0.15)",
              },
              {
                icon: "📅",
                title: "Life Coordinator",
                desc: `Aligns your time with your priorities. Prevents overload. Builds structure without making you feel like a robot on a spreadsheet.`,
                color: "#ff6b6b",
                glow: "rgba(255,107,107,0.15)",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="relative border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4FF]/30"
              >
                <div
                  className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full text-2xl"
                  style={{
                    background: item.glow,
                    border: `1px solid ${item.color}33`,
                  }}
                >
                  {item.icon}
                </div>

                <h3 className="mb-3 text-sm uppercase tracking-[0.2em]">
                  {item.title}
                </h3>

                <p className="text-sm leading-relaxed text-white/60">
                  {item.desc}
                </p>

                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${item.color}, transparent)`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======== FEATURES ======== */}
      <section id="features" className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <p className="mb-4 text-xs uppercase tracking-[0.25em] text-[#00D4FF]">
              Core Features
            </p>

            <h2 className="text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl">
              Everything You Need.
              <br />
              <span
                className={`${playfairDisplay.className} italic text-[#a855f7]`}
              >
                Nothing You Don&apos;t.
              </span>
            </h2>

            <p className="mt-4 text-lg text-white/70">
              Ten powerful modules designed to take the invisible workload off
              your plate — for good.
            </p>
          </div>

          {/* FEATURE ROW 1 */}
          <div className="mb-6 grid gap-6 md:grid-cols-2">
            <div className="relative overflow-hidden border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4FF]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div
                className="mb-4 text-5xl font-bold leading-none"
                style={{
                  color: "#00D4FF",
                  textShadow: "0 0 30px rgba(0,212,255,0.2)",
                }}
              >
                01
              </div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.18em]">
                Life Dashboard
              </h3>
              <p className="leading-relaxed text-white/70">
                Your command center. Tasks, calendar, bills, documents, goals,
                and priorities — all in one clean interface. Your entire life,
                at a glance.
              </p>
              <div className="mt-5 border-t border-white/10 pt-4 text-sm italic text-white/50">
                <span className="not-italic text-[#00D4FF]">Your Life OS → </span>
                No more switching between five different apps to find one piece
                of information.
              </div>
            </div>

            <div className="relative overflow-hidden border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4FF]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div
                className="mb-4 text-5xl font-bold leading-none"
                style={{
                  color: "#a855f7",
                  textShadow: "0 0 30px rgba(168,85,247,0.2)",
                }}
              >
                02
              </div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.18em]">
                AI Life Assistant
              </h3>
              <p className="leading-relaxed text-white/70">
                Conversational AI that actually understands context. Ask it
                about your week, your bills, your priorities. It answers like a
                real assistant — because it is one.
              </p>
              <div className="mt-5 border-t border-white/10 pt-4 text-sm italic text-white/50">
                <span className="not-italic text-[#00D4FF]">Try asking → </span>
                &quot;Plan my week around these three priorities.&quot;
              </div>
            </div>
          </div>

          {/* FEATURE ROW 2 */}
          <div className="mb-6 grid gap-6 md:grid-cols-2">
            <div className="relative overflow-hidden border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4FF]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div
                className="mb-4 text-5xl font-bold leading-none"
                style={{
                  color: "#ff6b6b",
                  textShadow: "0 0 30px rgba(255,107,107,0.2)",
                }}
              >
                03
              </div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.18em]">
                Smart Reminders
              </h3>
              <p className="leading-relaxed text-white/70">
                Not the kind you ignore. Synceri nudges you at the right time,
                adjusts based on your behavior, and follows up if you ghost it.
                Politely persistent.
              </p>
              <div className="mt-5 border-t border-white/10 pt-4 text-sm italic text-white/50">
                <span className="not-italic text-[#00D4FF]">Adaptive → </span>
                Learns when you actually respond and adjusts timing accordingly.
              </div>
            </div>

            <div className="relative overflow-hidden border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4FF]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div
                className="mb-4 text-5xl font-bold leading-none"
                style={{
                  color: "#34d399",
                  textShadow: "0 0 30px rgba(52,211,153,0.2)",
                }}
              >
                04
              </div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.18em]">
                Bills &amp; Subscriptions
              </h3>
              <p className="leading-relaxed text-white/70">
                Track recurring payments, get alerts before due dates, flag
                unusual charges, and kill forgotten subscriptions. Because
                adulthood is basically invoices.
              </p>
              <div className="mt-5 border-t border-white/10 pt-4 text-sm italic text-white/50">
                <span className="not-italic text-[#00D4FF]">Never again → </span>
                Late fees from that bill you definitely didn&apos;t forget.
              </div>
            </div>
          </div>

          {/* FEATURE ROW 3 */}
          <div className="mb-6 grid gap-6 md:grid-cols-2">
            <div className="relative overflow-hidden border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4FF]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div
                className="mb-4 text-5xl font-bold leading-none"
                style={{
                  color: "#fbbf24",
                  textShadow: "0 0 30px rgba(251,191,36,0.2)",
                }}
              >
                05
              </div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.18em]">
                Digital Vault
              </h3>
              <p className="leading-relaxed text-white/70">
                Secure storage for IDs, insurance, warranties, medical info,
                contracts, and every important document you&apos;d panic without.
                All searchable by AI.
              </p>
              <div className="mt-5 border-t border-white/10 pt-4 text-sm italic text-white/50">
                <span className="not-italic text-[#00D4FF]">Just ask → </span>
                &quot;When does my car insurance expire?&quot;
              </div>
            </div>

            <div className="relative overflow-hidden border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4FF]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div
                className="mb-4 text-5xl font-bold leading-none"
                style={{
                  color: "#00D4FF",
                  textShadow: "0 0 30px rgba(0,212,255,0.2)",
                }}
              >
                06
              </div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.18em]">
                Calendar Intelligence
              </h3>
              <p className="leading-relaxed text-white/70">
                Not just events — strategy. Synceri suggests optimal scheduling,
                prevents overload, and aligns your time with what you said
                actually matters to you.
              </p>
              <div className="mt-5 border-t border-white/10 pt-4 text-sm italic text-white/50">
                <span className="not-italic text-[#00D4FF]">
                  Smart blocking →{" "}
                </span>
                Protects focus time and prevents triple-booking.
              </div>
            </div>
          </div>

          {/* FEATURE ROW 4 - FULL WIDTH */}
          <div className="mb-6 grid gap-6">
            <div className="relative overflow-hidden border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4FF]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-10">
              <div className="grid items-center gap-10 md:grid-cols-2">
                <div>
                  <div
                    className="mb-4 text-5xl font-bold leading-none"
                    style={{
                      color: "#a855f7",
                      textShadow: "0 0 30px rgba(168,85,247,0.2)",
                    }}
                  >
                    07
                  </div>
                  <h3 className="mb-3 text-sm uppercase tracking-[0.18em]">
                    Task &amp; Errand Automation
                  </h3>
                  <p className="leading-relaxed text-white/70">
                    This is where Synceri closes loops. It doesn&apos;t just
                    remind you something needs doing — it maps out the steps,
                    schedules the time, and follows up until it&apos;s actually
                    done. This is the magic.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {[
                    "Identifies what needs to happen",
                    "Breaks it into clear steps",
                    "Schedules time on your calendar",
                    "Sends reminders at the right moment",
                    "Follows up until it's done ✓",
                  ].map((step, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 border-l-2 border-[#00D4FF] bg-[#00D4FF]/5 px-4 py-3 text-sm transition-all hover:translate-x-1 hover:bg-[#00D4FF]/10"
                    >
                      <span className="min-w-[24px] text-xs font-semibold tracking-[0.1em] text-[#00D4FF]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-white/65">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FEATURE ROW 5 */}
          <div className="mb-6 grid gap-6 md:grid-cols-2">
            <div className="relative overflow-hidden border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4FF]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div
                className="mb-4 text-5xl font-bold leading-none"
                style={{
                  color: "#ff6b6b",
                  textShadow: "0 0 30px rgba(255,107,107,0.2)",
                }}
              >
                08
              </div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.18em]">
                Routine &amp; Habit Builder
              </h3>
              <p className="leading-relaxed text-white/70">
                Morning routines, evening wind-downs, weekly resets. Synceri
                helps you build structure with adaptive nudges — not rigid
                schedules that make you feel like a failure by Tuesday.
              </p>
            </div>

            <div className="relative overflow-hidden border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4FF]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div
                className="mb-4 text-5xl font-bold leading-none"
                style={{
                  color: "#34d399",
                  textShadow: "0 0 30px rgba(52,211,153,0.2)",
                }}
              >
                09
              </div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.18em]">
                Life Categories
              </h3>
              <p className="leading-relaxed text-white/70">
                Everything modular and organized: Personal, Home, Health,
                Finance, Family, Travel. No more &quot;where did I put
                that?&quot; because everything has a place.
              </p>
            </div>
          </div>

          {/* FEATURE ROW 6 - FULL WIDTH CENTERED */}
          <div className="grid gap-6">
            <div className="relative overflow-hidden border border-white/10 bg-white/5 px-8 py-12 text-center backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4FF]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div
                className="mb-4 text-4xl font-bold leading-none"
                style={{
                  color: "#fbbf24",
                  textShadow: "0 0 30px rgba(251,191,36,0.2)",
                }}
              >
                10
              </div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.18em]">
                Integrations
              </h3>
              <p className="mx-auto max-w-2xl leading-relaxed text-white/70">
                Google Calendar, Apple Calendar, Gmail, Outlook, banking, smart
                home, travel platforms — Synceri connects to the tools you
                already use and becomes the intelligent layer on top of all of
                them.
              </p>
              <div className="mt-5 text-sm italic text-white/50">
                <span className="not-italic text-[#00D4FF]">
                  The future power move →{" "}
                </span>
                One system to rule them all.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======== THE DIFFERENCE ======== */}
      <section id="different" className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <p className="mb-4 text-xs uppercase tracking-[0.25em] text-[#00D4FF]">
              The Difference
            </p>

            <h2 className="text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl">
              Most Apps Store Info.
              <br />
              <span
                className={`${playfairDisplay.className} italic text-[#00D4FF]`}
              >
                Synceri Manages Your Life.
              </span>
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="relative border border-white/10 bg-white/5 p-8 backdrop-blur-md">
              <div className="absolute left-0 right-0 top-0 h-[3px] bg-gradient-to-r from-[#ff6b6b] to-[#ff6b6b]/30" />

              <h3 className="mb-8 text-sm uppercase tracking-[0.25em] text-[#ff6b6b]">
                Every Other App
              </h3>

              {[
                "Reactive — waits for you to remember",
                "Static lists that just sit there",
                "Scattered across a dozen platforms",
                "Stores data — doesn't think about it",
                "You're still the project manager of your own life",
              ].map((item, i) => (
                <div key={i} className="mb-4 flex gap-3">
                  <span className="text-lg text-[#ff6b6b]">✕</span>
                  <p className="text-white/60">{item}</p>
                </div>
              ))}
            </div>

            <div className="relative border border-white/10 bg-white/5 p-8 backdrop-blur-md">
              <div className="absolute left-0 right-0 top-0 h-[3px] bg-gradient-to-r from-[#00D4FF] to-[#00D4FF]/30" />

              <h3 className="mb-8 text-sm uppercase tracking-[0.25em] text-[#00D4FF]">
                Synceri
              </h3>

              {[
                "Proactive — thinks ahead so you don't have to",
                "Intelligent workflows that close loops",
                "One centralized command center",
                "Understands, reminds, suggests, and acts",
                "Synceri is the project manager — you just live your life",
              ].map((item, i) => (
                <div key={i} className="mb-4 flex gap-3">
                  <span className="text-lg text-[#00D4FF]">⚡</span>
                  <p className="text-white/70">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ======== CATEGORIES ======== */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-xl text-center">
            <p className="mb-4 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.25em] text-[#00D4FF]">
              <span className="h-[1px] w-6 bg-[#00D4FF]" />
              Modular Organization
            </p>

            <h2 className="text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl">
              Every Part of Your Life.
              <br />
              <span
                className={`${playfairDisplay.className} italic text-[#a855f7]`}
              >
                One Place.
              </span>
            </h2>

            <p className="mt-4 text-lg text-white/70">
              Synceri organizes everything into clean, modular categories so
              nothing falls through the cracks.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { icon: "👤", label: "Personal" },
              { icon: "🏠", label: "Home" },
              { icon: "❤️", label: "Health" },
              { icon: "💰", label: "Finance" },
              { icon: "👨‍👩‍👧", label: "Family" },
              { icon: "✈️", label: "Travel" },
            ].map((item, i) => (
              <div
                key={i}
                className="relative border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md transition-all hover:-translate-y-1 hover:border-[#00D4FF]/30"
              >
                <span className="mb-3 block text-2xl">{item.icon}</span>

                <h4 className="text-xs uppercase tracking-[0.15em] text-white/80">
                  {item.label}
                </h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======== CTA SECTION ======== */}
      <section
        id="waitlist"
        className="relative overflow-hidden px-4 py-32 text-center"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(0,212,255,0.08)_0%,rgba(168,85,247,0.04)_40%,transparent_70%)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-xl">
          <p className="mb-4 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.25em] text-[#00D4FF]">
            <span className="h-[1px] w-6 bg-[#00D4FF]" />
            Early Access
          </p>

          <h2 className="mb-6 text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl">
            Your Brain Has
            <br />
            <span
              className={`${playfairDisplay.className} italic text-[#00D4FF] drop-shadow-[0_0_25px_rgba(0,212,255,0.35)]`}
            >
              Better Things to Do.
            </span>
          </h2>

          <p className="mb-10 text-lg leading-relaxed text-white/70">
            Stop being the project manager of your own life. Synceri is coming
            soon — get on the list and be the first to experience what it feels
            like when everything just… works.
          </p>

          <form
            className="mx-auto mb-4 flex max-w-md flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              alert("You're on the Synceri waitlist 🚀");
            }}
          >
            <input
              type="email"
              required
              placeholder="Enter your email"
              className="flex-1 border border-white/10 bg-[#0d1321] px-4 py-3 text-white outline-none transition placeholder:text-white/40 focus:border-[#00D4FF]"
            />

            <button
              type="submit"
              className="bg-[#00D4FF] px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-[#061426] transition hover:shadow-[0_0_25px_rgba(0,212,255,0.4)]"
              style={{
                clipPath:
                  "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
              }}
            >
              Join Waitlist
            </button>
          </form>

          <p className="text-xs text-white/40">
            Free to join. No spam. Just early access when we launch.
          </p>
        </div>
      </section>
    </main>
  );
}
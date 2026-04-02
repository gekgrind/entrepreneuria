"use client"

import { useState } from "react"
import Link from "next/link"
import PageHeader from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Layers3,
  LineChart,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Target,
  Workflow,
  Zap,
} from "lucide-react"

const valueCards = [
  {
    icon: <Zap className="h-8 w-8 text-[#00D4FF]" />,
    title: "Built for Execution",
    desc: "Agents do not just suggest the next move. They help carry it out.",
  },
  {
    icon: <Workflow className="h-8 w-8 text-[#00D4FF]" />,
    title: "Plug Into Your Stack",
    desc: "Connect your workflows, tools, and systems without starting from scratch.",
  },
  {
    icon: <Brain className="h-8 w-8 text-[#00D4FF]" />,
    title: "Trained on Your Business",
    desc: "Agents adapt to your tone, goals, offers, and operating style.",
  },
  {
    icon: <Clock3 className="h-8 w-8 text-[#00D4FF]" />,
    title: "Automates the Repetitive",
    desc: "Offload the busywork so you can stay focused on leverage and growth.",
  },
  {
    icon: <LineChart className="h-8 w-8 text-[#00D4FF]" />,
    title: "Compounds Over Time",
    desc: "Your workflows get sharper, smarter, and more useful the more you use them.",
  },
  {
    icon: <Sparkles className="h-8 w-8 text-[#00D4FF]" />,
    title: "Runs 24/7",
    desc: "Because your business should not stall every time you step away.",
  },
]

const agentCards = [
  {
    icon: <MessageSquare className="h-7 w-7 text-[#00D4FF]" />,
    title: "Content Agent",
    desc: "Creates content drafts, repurposes ideas, and keeps your publishing pipeline moving.",
  },
  {
    icon: <BarChart3 className="h-7 w-7 text-[#00D4FF]" />,
    title: "SEO Agent",
    desc: "Finds opportunities, builds briefs, and helps turn search traffic into traction.",
  },
  {
    icon: <Target className="h-7 w-7 text-[#00D4FF]" />,
    title: "Growth Agent",
    desc: "Surfaces patterns, priorities, and next-best actions so momentum does not get lost.",
  },
  {
    icon: <Calendar className="h-7 w-7 text-[#00D4FF]" />,
    title: "Admin Agent",
    desc: "Handles reminders, scheduling, coordination, and recurring operational tasks.",
  },
  {
    icon: <Layers3 className="h-7 w-7 text-[#00D4FF]" />,
    title: "Systems Agent",
    desc: "Helps organize workflows, connect moving parts, and reduce founder chaos.",
  },
  {
    icon: <Bot className="h-7 w-7 text-[#00D4FF]" />,
    title: "Support Agent",
    desc: "Assists with customer responses, FAQs, and keeping communication moving.",
  },
]

const steps = [
  {
    number: "01",
    title: "Deploy",
    desc: "Choose the agents that match the way you work and the business you are building.",
  },
  {
    number: "02",
    title: "Connect",
    desc: "Link your data, workflows, and tools so agents can operate with useful context.",
  },
  {
    number: "03",
    title: "Execute",
    desc: "Let agents handle recurring tasks, surface priorities, and keep work in motion.",
  },
  {
    number: "04",
    title: "Optimize",
    desc: "Refine what is working, improve what is not, and build a smarter operating system over time.",
  },
]

const faqs = [
  {
    q: "What is Agentverse, exactly?",
    a: "Agentverse is the AI workforce layer inside Entrepreneuria. It gives founders access to specialized AI agents that help handle marketing, operations, planning, admin, and execution across the business.",
  },
  {
    q: "Are these just chatbots?",
    a: "Nope. Agentverse is designed around execution, not just conversation. The goal is not to give you another place to ask questions. The goal is to help you delegate work.",
  },
  {
    q: "Do I need to be technical to use it?",
    a: "Not at all. Agentverse is being built for founders, solopreneurs, and small business owners who need leverage without a giant setup process or a full tech team.",
  },
  {
    q: "Can agents be customized to my business?",
    a: "Yes. The vision is for agents to adapt to your brand voice, business model, offers, priorities, and workflows so they feel less generic and far more useful.",
  },
  {
    q: "How does Agentverse fit with the other Entrepreneuria apps?",
    a: "Think of it as the workforce layer. Prospra helps you think, Architecta helps you create, Directorium helps you decide, and Agentverse helps work get done.",
  },
]

export default function AgentversePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.14),_transparent_32%),linear-gradient(180deg,_#061426_0%,_#081a2f_40%,_#061426_100%)] text-white">
            {/* Hero / Header Video */}
      <section className="relative -mt-[var(--header-height)] h-[90svh] min-h-[720px] w-full overflow-hidden bg-black sm:h-[80svh] lg:h-[86svh]">
        <PageHeader
          title=""
          subtitle=""
          videoSrc="/videos/agentverse-header.mp4"
          imageSrc="/images/agentverse-fallback.jpg"
        />

        <div className="absolute inset-0 z-10 bg-[#061426]/45" />

        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center px-4 pt-40 pb-24 sm:pt-44 lg:pt-48">
          <div className="pointer-events-auto mx-auto flex w-full max-w-5xl -translate-y-10 flex-col items-center text-center sm:-translate-y-12 lg:-translate-y-16">
            <Badge className="mb-5 border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#00D4FF] backdrop-blur-md">
              The AI workforce layer
            </Badge>

            <h1 className="max-w-5xl text-balance text-4xl font-semibold leading-[1.02] text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.45)] sm:text-5xl md:text-6xl lg:text-7xl">
              Your Business.
              <br />
              <span className="italic text-[#00D4FF]">Running Without You.</span>
            </h1>

            <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/85 sm:text-lg md:text-xl">
              You do not need more tools.
              <br className="hidden sm:block" /> You need execution.
            </p>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/72 sm:text-base md:text-lg">
              Agentverse deploys specialized AI agents that help handle your
              marketing, operations, growth, and admin so the business keeps
              moving even when you are not doing every single thing yourself.
            </p>

            <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="min-w-[220px] rounded-full bg-[#00D4FF] px-7 text-[#061426] hover:bg-[#6FE7FF]"
              >
                <Link href="/waitlist">
                  Deploy Your First Agents
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-w-[220px] rounded-full border-white/25 bg-white/5 px-7 text-white hover:bg-white/10"
              >
                <Link href="/contact">See How It Works</Link>
              </Button>
            </div>

            <div className="mt-8 grid w-full max-w-4xl gap-3 text-left sm:grid-cols-3">
              {[
                "Specialized agents for marketing and growth",
                "Operational support without hiring a full team",
                "A scalable system built for founder leverage",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-sm text-white/80 backdrop-blur-md"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#00D4FF]" />
                    <span>{item}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
            Stop doing everything yourself
          </p>

          <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
            You did not start a business
            <br />
            to become the <span className="italic text-[#00D4FF]">bottleneck.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-white/75 sm:text-lg">
            Writing content. Answering messages. Planning strategy. Tracking
            performance. Following up. Organizing the moving pieces.
          </p>

          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-white/75 sm:text-lg">
            It never really ends. Agentverse is built to change that by giving
            you an AI workforce that can help keep the machine running.
          </p>
        </div>
      </section>

      {/* Why Agentverse */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              Why Agentverse
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              A digital workforce built
              <br />
              for <span className="italic text-[#00D4FF]">founder speed.</span>
            </h2>

            <p className="mt-6 text-base leading-relaxed text-white/75 sm:text-lg">
              Agentverse is not about piling on more software. It is about
              turning repetitive work, scattered decisions, and messy execution
              into systems that actually move.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {valueCards.map((item) => (
              <Card
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/5 text-white shadow-[0_12px_50px_rgba(0,0,0,0.18)] backdrop-blur-md transition duration-300 hover:border-[#00D4FF]/30 hover:bg-white/7"
              >
                <CardHeader className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/10">
                    {item.icon}
                  </div>
                  <CardTitle className="text-xl font-semibold text-white">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed text-white/72">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Agent Grid */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              Your AI workforce
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              Specialized agents.
              <br />
              <span className="italic text-[#00D4FF]">One connected system.</span>
            </h2>

            <p className="mt-6 text-base leading-relaxed text-white/75 sm:text-lg">
              Instead of asking one general-purpose assistant to do everything,
              Agentverse gives you a coordinated set of operators built for
              distinct kinds of work.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {agentCards.map((agent) => (
              <Card
                key={agent.title}
                className="rounded-3xl border border-white/10 bg-[#081a2f]/80 text-white shadow-[0_12px_50px_rgba(0,0,0,0.18)] backdrop-blur-md transition duration-300 hover:border-[#00D4FF]/30 hover:bg-[#0b2138]/90"
              >
                <CardHeader className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/10">
                    {agent.icon}
                  </div>
                  <CardTitle className="text-xl font-semibold text-white">
                    {agent.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed text-white/72">{agent.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              How it works
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              Simple to start.
              <br />
              Powerful when it <span className="italic text-[#00D4FF]">stacks up.</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step) => (
              <div
                key={step.number}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
              >
                <div className="text-sm font-semibold tracking-[0.22em] text-[#00D4FF]">
                  {step.number}
                </div>
                <h3 className="mt-4 text-2xl font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-4 leading-relaxed text-white/72">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Outcome Strip */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-[#00D4FF]/15 bg-[linear-gradient(180deg,rgba(0,212,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-8 text-center shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-md sm:p-12">
          <ShieldCheck className="mx-auto h-10 w-10 text-[#00D4FF]" />

          <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
            Less founder overload.
            <br />
            More consistent <span className="italic text-[#00D4FF]">execution.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-white/75 sm:text-lg">
            The goal is not to replace your vision. The goal is to remove the
            drag, reduce the bottlenecks, and give your business a workforce
            that helps it run with more speed, structure, and consistency.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-white/10 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
              Frequently asked questions
            </p>

            <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              What founders usually ask
              <br />
              about <span className="italic text-[#00D4FF]">Agentverse.</span>
            </h2>
          </div>

          <div className="mt-12 space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index

              return (
                <div
                  key={faq.q}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base font-semibold text-white sm:text-lg">
                      {faq.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-[#00D4FF]" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-[#00D4FF]" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/10 px-6 pb-6 pt-4 text-white/72">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00D4FF]">
            Build the workforce
          </p>

          <h2 className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-6xl">
            You can keep doing
            <br />
            everything yourself.
            <br />
            Or build a business that <span className="italic text-[#00D4FF]">runs.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-white/75 sm:text-lg">
            Agentverse is for founders who are done being the entire department.
            It is time to delegate differently.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="min-w-[220px] rounded-full bg-[#00D4FF] px-7 text-[#061426] hover:bg-[#6FE7FF]"
            >
              <Link href="/waitlist">
                Deploy Your First Agents
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-w-[220px] rounded-full border-white/25 bg-white/5 px-7 text-white hover:bg-white/10"
            >
              <Link href="/contact">Talk to Us</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
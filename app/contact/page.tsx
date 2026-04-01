"use client"

import { useMemo, useRef, useState } from "react"
import type React from "react"
import { Playfair_Display } from "next/font/google"
import PageHeader from "@/components/PageHeader"

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

type Message = {
  id: number
  role: "assistant" | "user"
  content: string
}

const QUICK_PROMPTS = [
  "Tell me about Prospra",
  "How do I join the waitlist?",
  "What apps does Entrepreneuria offer?",
  "What is Directorium?",
]

const FAQS = [
  {
    question: "What is Entrepreneuria?",
    answer:
      "Entrepreneuria is an AI-powered business ecosystem built for solopreneurs, entrepreneurs, and small business owners. It brings strategy, execution, support, and growth tools into one connected experience.",
  },
  {
    question: "Which apps are part of the ecosystem?",
    answer:
      "Entrepreneuria includes Prospra, Architecta, Synceri, and Directorium, with more tools planned as the ecosystem grows.",
  },
  {
    question: "How do I get early access?",
    answer:
      "You can join the waitlist for upcoming tools and launches through the waitlist pathway or by emailing waitlist@entrepreneuria.io.",
  },
  {
    question: "How do I get support?",
    answer:
      "For support questions, use the AI assistant first for quick answers or email support@entrepreneuria.io for direct help.",
  },
]

export default function ContactPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content:
        "Hey there! I’m the Entrepreneuria AI assistant. Ask me about the apps, the ecosystem, early access, or where to start.",
    },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const messageId = useRef(2)

  const responseMap = useMemo(
    () => [
      {
        match: /prospra/i,
        reply:
          "Prospra is your AI mentor and strategy partner. It’s designed to help founders think clearly, make smarter decisions, and keep moving.",
      },
      {
        match: /architecta/i,
        reply:
          "Architecta is your founder growth engine. It helps you turn ideas into clear messaging, content, and marketing direction without needing a full team.",
      },
      {
        match: /synceri/i,
        reply:
          "Synceri is your AI life-admin assistant. It’s built to help founders handle the personal logistics that usually eat up time and headspace.",
      },
      {
        match: /directorium/i,
        reply:
          "Directorium gives you an on-demand AI board of directors. Different model perspectives challenge your thinking so you can pressure-test decisions before you make them.",
      },
      {
        match: /waitlist|early access/i,
        reply:
          "You can join the waitlist to get early access to launches and updates. For waitlist questions, email waitlist@entrepreneuria.io.",
      },
      {
        match: /apps|offer|ecosystem/i,
        reply:
          "The Entrepreneuria ecosystem is designed to help founders build, launch, and grow with a connected set of AI tools instead of a pile of disconnected tabs and guesswork.",
      },
    ],
    [],
  )

  const getAssistantReply = (text: string) => {
    const match = responseMap.find((item) => item.match.test(text))
    if (match) return match.reply

    return "I can help with questions about Entrepreneuria, the apps, support, and early access. You can also email hello@entrepreneuria.io, support@entrepreneuria.io, or waitlist@entrepreneuria.io depending on what you need."
  }

  const sendMessage = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const userMessage: Message = {
      id: messageId.current++,
      role: "user",
      content: trimmed,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    window.setTimeout(() => {
      const assistantMessage: Message = {
        id: messageId.current++,
        role: "assistant",
        content: getAssistantReply(trimmed),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsTyping(false)
    }, 700)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#061426] via-[#0b1b32] to-[#102347] text-white">
      {/* Hero */}
      <section className="relative -mt-[calc(var(--header-height)+1rem)] flex min-h-[78vh] items-center overflow-hidden">
        <PageHeader
          title=""
          subtitle=""
          videoSrc="/videos/contact-header.mp4"
          imageSrc="/images/contact-fallback.jpg"
        />

        <div className="absolute inset-0 z-20">
          <div className="pointer-events-none absolute -right-20 -top-20 h-[600px] w-[600px] bg-[radial-gradient(circle,rgba(0,212,255,0.10)_0%,transparent_70%)]" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-[500px] w-[500px] bg-[radial-gradient(circle,rgba(0,212,255,0.06)_0%,transparent_70%)]" />

          <div className="mx-auto flex h-full w-full max-w-6xl items-center px-4 sm:px-6 lg:px-8">
            <div className="relative z-10 max-w-2xl text-left">
              <div className="relative z-10 max-w-2xl text-left [text-shadow:0_2px_18px_rgba(0,0,0,0.35)]">
          <div className="mb-5 inline-flex items-center gap-2 text-[0.72rem] font-semibold tracking-[0.2em] text-[#00D4FF]">
            <span className="block h-px w-7 bg-[#00D4FF]" />
            GET IN TOUCH
          </div>

          <h1
            className={`${playfairDisplay.className} text-6xl font-bold leading-[0.95] text-white sm:text-5xl md:text-6xl lg:text-7xl`}
          >
            We&apos;re{" "}
            <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
              Here.
            </span>
            <br />
              Let&apos;s{" "}
            <span className={`${playfairDisplay.className} italic text-[#00D4FF]`}>
              Talk.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base font-medium leading-8 text-white/85 sm:text-lg">
            Whether you have a question, need support, want to partner up,
            or just want to say hey, Entrepreneuria gives you a faster place
            to start.
          </p>
          </div>
        </div>
      </div>
      </div>
      </section>

      {/* First section: 2-column layout */}
      <section className="relative z-10 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-[1300px]">
          <div className="grid items-start gap-8 lg:grid-cols-2">
            {/* Left: AI Assistant */}
            <div className="min-w-0">
              <div className="mb-4 flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.2em] text-[#00D4FF]">
                <span className="block h-px w-5 bg-[#00D4FF]" />
                Start Here
              </div>

              <h2
                className={`${playfairDisplay.className} mb-5 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl`}
              >
                Meet the fastest way
                <br />
                to get unstuck.
              </h2>

              <p className="mb-8 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
                Start with the assistant. Ask about the apps, the ecosystem,
                early access, or where to begin. It&apos;s the quickest on-ramp
                into Entrepreneuria.
              </p>

              <div className="relative overflow-hidden rounded-[1.5rem] border border-[#1a2942] bg-[#1a2942] shadow-[0_0_30px_rgba(0,0,0,0.2)]">
                <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#00D4FF] via-[#00D4FF] to-[#00D4FF]" />

                <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5 sm:px-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00D4FF] text-sm font-semibold text-[#061426]">
                    ✦
                  </div>

                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">
                      Entrepreneuria AI
                    </div>
                    <div className="text-xs text-[#00D4FF]">
                      Online · Ready to Help
                    </div>
                  </div>

                  <div className="text-[0.65rem] tracking-[0.14em] text-white/30">
                    Assistant
                  </div>
                </div>

                <div className="flex min-h-[520px] max-h-[520px] flex-col">
                  <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 ${
                            message.role === "user"
                              ? "border border-[rgba(0,212,255,0.28)] bg-[rgba(0,212,255,0.12)] text-white/90"
                              : "border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.06)] text-white/90"
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    ))}

                    {isTyping ? (
                      <div className="flex justify-start">
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.06)] px-4 py-3 text-sm text-white/70">
                          Thinking...
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-white/10 px-5 py-4 sm:px-6">
                    <div className="mb-4 flex flex-wrap gap-2">
                      {QUICK_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => sendMessage(prompt)}
                          className="rounded-full border border-[rgba(0,212,255,0.25)] bg-[rgba(0,212,255,0.10)] px-3 py-2 text-[0.68rem] font-semibold tracking-[0.08em] text-[#00D4FF] transition hover:bg-[rgba(0,212,255,0.18)]"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleSubmit} className="flex gap-3">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask anything about Entrepreneuria..."
                        className="min-w-0 flex-1 rounded-full border border-[rgba(0,212,255,0.25)] bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#00D4FF]"
                      />
                      <button
                        type="submit"
                        className="rounded-full bg-[#00D4FF] px-5 py-3 text-[0.72rem] font-bold tracking-[0.12em] text-[#061426] transition hover:bg-[#33ddff]"
                      >
                        Send
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Human Contact */}
            <div className="min-w-0 lg:pt-[2.15rem]">
              <div className="mb-4 flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.2em] text-[#00D4FF]">
                <span className="block h-px w-5 bg-[#00D4FF]" />
                Prefer Human Contact?
              </div>

              <h2
                className={`${playfairDisplay.className} mb-5 text-3xl font-semibold leading-tight text-white sm:text-4xl`}
              >
                Reach the right inbox.
              </h2>

              <p className="mb-8 max-w-xl text-base leading-8 text-white/70">
                Prefer a human over the assistant? No problem. Pick the best
                path and we&apos;ll get you to the right place faster.
              </p>

              <div className="space-y-4">
                <a
                  href="mailto:hello@entrepreneuria.io"
                  className="block rounded-[1.25rem] border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:border-[#00D4FF]"
                >
                  <div className="mb-2 text-xl">✉️</div>
                  <div className="text-[0.72rem] font-bold tracking-[0.14em] text-[#00D4FF]">
                    General inquiries
                  </div>
                  <div className="mt-1 text-sm text-white/80">
                    hello@entrepreneuria.io
                  </div>
                  <div className="mt-2 text-xs leading-6 text-white/60">
                    Questions, hellos, and general founder-world things.
                  </div>
                </a>

                <a
                  href="mailto:support@entrepreneuria.io"
                  className="block rounded-[1.25rem] border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:border-[#00D4FF]"
                >
                  <div className="mb-2 text-xl">🛠️</div>
                  <div className="text-[0.72rem] font-bold tracking-[0.14em] text-[#00D4FF]">
                    App support
                  </div>
                  <div className="mt-1 text-sm text-white/80">
                    support@entrepreneuria.io
                  </div>
                  <div className="mt-2 text-xs leading-6 text-white/60">
                    Help with any Entrepreneuria app or feature.
                  </div>
                </a>

                <a
                  href="mailto:waitlist@entrepreneuria.io"
                  className="block rounded-[1.25rem] border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:border-[#00D4FF]"
                >
                  <div className="mb-2 text-xl">🚀</div>
                  <div className="text-[0.72rem] font-bold tracking-[0.14em] text-[#00D4FF]">
                    Early access
                  </div>
                  <div className="mt-1 text-sm text-white/80">
                    waitlist@entrepreneuria.io
                  </div>
                  <div className="mt-2 text-xs leading-6 text-white/60">
                    Questions about launches, early access, and what&apos;s
                    coming.
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="relative z-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mx-auto max-w-[1300px]">
          <div className="mb-4 flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.2em] text-[#00D4FF]">
            <span className="block h-px w-5 bg-[#00D4FF]" />
            Quick Answers
          </div>

          <h2
            className={`${playfairDisplay.className} mb-8 max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl`}
          >
            A few things people usually ask first.
          </h2>

          <div className="space-y-3">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index

              return (
                <div
                  key={faq.question}
                  className={`overflow-hidden rounded-[1.25rem] border bg-white/5 transition ${
                    isOpen ? "border-[#00D4FF]" : "border-white/10"
                  } hover:border-[#00D4FF]`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
                  >
                    <span className="text-sm font-semibold tracking-[0.02em] text-white">
                      {faq.question}
                    </span>
                    <span
                      className={`text-[#00D4FF] transition ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="px-5 pb-5 text-sm leading-7 text-white/65 sm:px-6">
                      {faq.answer}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Socials */}
      <section className="relative z-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-[1300px]">
          <div className="mb-4 flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.2em] text-[#00D4FF]">
            <span className="block h-px w-5 bg-[#00D4FF]" />
            Follow Along
          </div>

          <h2
            className={`${playfairDisplay.className} mb-4 max-w-2xl text-3xl font-semibold leading-tight text-white sm:text-4xl`}
          >
            Stay close to the build.
          </h2>

          <p className="mb-8 max-w-2xl text-base leading-8 text-white/70">
            Plug in your real social links later. The layout is ready whenever
            you are.
          </p>

          <div className="flex flex-wrap gap-3">
            {["Instagram", "LinkedIn", "X / Twitter", "Facebook", "Pinterest"].map(
              (label) => (
                <a
                  key={label}
                  href="#"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold tracking-[0.1em] text-white/60 transition hover:-translate-y-1 hover:border-[#00D4FF] hover:text-[#00D4FF]"
                >
                  {label}
                </a>
              ),
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
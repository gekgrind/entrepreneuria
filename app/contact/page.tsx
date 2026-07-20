"use client";

import { useMemo, useRef, useState } from "react";
import type React from "react";
import { Mail, Rocket, Wrench } from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { StatusDot } from "@/components/marketing/primitives";

type Message = {
  id: number;
  role: "assistant" | "user";
  content: string;
};

const QUICK_PROMPTS = [
  "Tell me about Prospra",
  "How do I join the waitlist?",
  "What apps does Entrepreneuria offer?",
  "What is Directorium?",
];

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
];

const inboxes = [
  {
    icon: Mail,
    label: "General inquiries",
    email: "hello@entrepreneuria.io",
    note: "Questions, hellos, and general founder-world things.",
  },
  {
    icon: Wrench,
    label: "App support",
    email: "support@entrepreneuria.io",
    note: "Help with any Entrepreneuria app or feature.",
  },
  {
    icon: Rocket,
    label: "Early access",
    email: "waitlist@entrepreneuria.io",
    note: "Questions about launches, early access, and what's coming.",
  },
];

export default function ContactPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content:
        "Hey there! I’m the Entrepreneuria AI assistant. Ask me about the apps, the ecosystem, early access, or where to start.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const messageId = useRef(2);

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
  );

  const getAssistantReply = (text: string) => {
    const match = responseMap.find((item) => item.match.test(text));
    if (match) return match.reply;

    return "I can help with questions about Entrepreneuria, the apps, support, and early access. You can also email hello@entrepreneuria.io, support@entrepreneuria.io, or waitlist@entrepreneuria.io depending on what you need.";
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: messageId.current++,
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    window.setTimeout(() => {
      const assistantMessage: Message = {
        id: messageId.current++,
        role: "assistant",
        content: getAssistantReply(trimmed),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 700);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <PageShell>
      <PageHero
        kicker="Get in touch"
        title={
          <>
            We&apos;re here. Let&apos;s <em className="italic">talk</em>.
          </>
        }
        lede="Whether you have a question, need support, want to partner up, or just want to say hey, Entrepreneuria gives you a faster place to start."
      />

      <Section
        kicker="01 — Start here"
        title={
          <>
            The fastest way to get <em className="italic">unstuck</em>.
          </>
        }
        lede="Start with the assistant. Ask about the apps, the ecosystem, early access, or where to begin. Prefer a human? The right inboxes are one click away."
      >
        <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* AI assistant */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
              <StatusDot live />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  Entrepreneuria AI
                </p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#00d4ff] [font-family:var(--font-label)]">
                  Online · ready to help
                </p>
              </div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 [font-family:var(--font-label)]">
                Assistant
              </p>
            </div>

            <div className="flex max-h-[520px] min-h-[520px] flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 text-white/85 ${
                        message.role === "user"
                          ? "border border-[rgba(0,212,255,0.25)] bg-[rgba(0,212,255,0.1)]"
                          : "border border-white/10 bg-white/[0.05]"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {isTyping ? (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/60">
                      Thinking...
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-white/10 px-6 py-4">
                <div className="mb-4 flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white/70 transition hover:border-white/40 hover:text-white"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="flex gap-3">
                  <label htmlFor="assistant-input" className="sr-only">
                    Ask anything about Entrepreneuria
                  </label>
                  <input
                    id="assistant-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything about Entrepreneuria..."
                    className="h-12 min-w-0 flex-1 rounded-full !border-white/15 !bg-white/[0.06] px-5 text-sm !text-white outline-none transition placeholder:!text-white/40 focus:!border-white/40"
                  />
                  <button
                    type="submit"
                    className="group relative h-12 shrink-0 overflow-hidden rounded-full bg-[var(--brand-orange)] px-6 text-sm font-semibold text-white transition hover:bg-[#b96a24]"
                  >
                    Send
                    <span className="button-shimmer" aria-hidden="true" />
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Human contact */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45 [font-family:var(--font-label)]">
              Prefer human contact?
            </p>
            <h3 className="mt-3 text-2xl font-medium tracking-tight text-white">
              Reach the right inbox.
            </h3>
            <div className="mt-6 space-y-4">
              {inboxes.map((inbox) => {
                const Icon = inbox.icon;
                return (
                  <a
                    key={inbox.email}
                    href={`mailto:${inbox.email}`}
                    className="no-accent-link block rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/25"
                  >
                    <Icon
                      className="mb-3 h-5 w-5 text-[#00d4ff]"
                      aria-hidden="true"
                    />
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45 [font-family:var(--font-label)]">
                      {inbox.label}
                    </p>
                    <p className="mt-1.5 font-semibold text-white">
                      {inbox.email}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      {inbox.note}
                    </p>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section
        kicker="02 — Quick answers"
        title="A few things people usually ask first."
      >
        <div className="max-w-3xl space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;

            return (
              <div
                key={faq.question}
                className={`overflow-hidden rounded-2xl border bg-white/[0.03] transition-colors ${
                  isOpen ? "border-white/30" : "border-white/10"
                } hover:border-white/30`}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="font-semibold text-white">
                    {faq.question}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`text-white/50 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>

                {isOpen ? (
                  <div className="px-6 pb-6 leading-7 text-white/60">
                    {faq.answer}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Section>
    </PageShell>
  );
}

"use client"

import type React from "react"
import Link from "next/link"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import PageHeader from "@/components/PageHeader" // 🆕 Header video added

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414l2.293 2.293 6.543-6.543a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function RocketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4.5 16.5c-1.5 1.25-2 5-2 5s3.75-.5 5-2c.625-.625 1-1.5 1-2.5a2.5 2.5 0 00-2.5-2.5c-1 0-1.875.375-2.5 1z" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  )
}

function LightbulbIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 006 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  )
}

type Tier = {
  name: string
  price: string
  features: string[]
  cta: string
  href: string
  badge?: string
  highlight?: boolean
}

const PRICING_TIERS: Tier[] = [
  {
    name: "Starter",
    price: "$0–$9",
    features: [
      "Free trial access",
      "Limited Prospra queries",
      "Basic Synceri task automation",
      "Resource Hub access",
    ],
    cta: "Start Free",
    href: "/signup?plan=starter",
  },
  {
    name: "Growth",
    price: "$29",
    features: [
      "Unlimited Prospra mentorship",
      "Full Synceri automation",
      "Resource Hub templates & guides",
      "Email support",
    ],
    cta: "Upgrade to Growth",
    href: "/signup?plan=growth",
    badge: "Most Popular",
    highlight: true,
  },
  {
    name: "Pro",
    price: "$59",
    features: [
      "Advanced frameworks & playbooks",
      "Priority support",
      "Advisor insights & premium resources",
      "Workspace sharing",
    ],
    cta: "Go Pro",
    href: "/signup?plan=pro",
  },
]

const TESTIMONIALS = [
  {
    quote:
      "The Growth plan paid for itself in one week—I saved 10+ hours with Synceri.",
    author: "Sarah Chen",
    title: "Startup Founder",
  },
  {
    quote: "Prospra's mentorship is worth more than the monthly fee alone.",
    author: "Marcus Rodriguez",
    title: "Small Business Owner",
  },
]

const FAQS = [
  {
    q: "Is there a free trial?",
    a: "Yes—all plans start with a free trial so you can test Prospra + Synceri risk-free.",
  },
  {
    q: "What's included in each plan?",
    a: "Every plan includes Prospra, Synceri, and Resource Hub access, with advanced features in Growth + Pro tiers.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes—there are no long-term contracts. Cancel with one click.",
  },
  {
    q: "Do you offer refunds?",
    a: "Yes—we offer a 30-day money-back guarantee.",
  },
  {
    q: "Can I upgrade or downgrade later?",
    a: "Yes—plans are flexible so you can scale up or down as your needs change.",
  },
]

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<string | undefined>(undefined)

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-[#4f7ca7] to-[#d27a2c] text-white overflow-hidden z-0">
      {/* 🎥 Header Video */}
      <div className="relative -mt-[calc(var(--header-height)+1rem)]">
        <PageHeader
          title="Simple Pricing"
          subtitle="Powerful Tools. Fair Value."
          videoSrc="/videos/pricing-header.mp4"
          imageSrc="/images/pricing-fallback.jpg"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-20 pb-24">
        {/* === Intro Section === */}
        <section className="text-center mb-20 backdrop-blur-sm bg-white/10 rounded-2xl p-12 shadow-xl">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 drop-shadow-lg">
            Simple Pricing. Powerful Value.
          </h1>
          <p className="text-xl mb-8 text-white/90 max-w-3xl mx-auto leading-relaxed">
            Whether you're just starting or scaling, Entrepreneuria has a plan
            designed for your journey. All plans include a free trial—cancel
            anytime.
          </p>

          <div className="flex flex-wrap justify-center gap-6 mb-8 text-white/90">
            <div className="flex items-center gap-2">
              <RocketIcon className="w-5 h-5 text-[#d27a2c]" />
              <span>Get started free</span>
            </div>
            <div className="flex items-center gap-2">
              <LightbulbIcon className="w-5 h-5 text-[#d27a2c]" />
              <span>Upgrade as you grow</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon className="w-5 h-5 text-[#d27a2c]" />
              <span>Cancel anytime, risk-free</span>
            </div>
          </div>

          <Button
            asChild
            size="lg"
            className="bg-[#d27a2c] hover:bg-[#b86824] text-white text-lg px-8"
          >
            <Link href="/signup">Start Free Trial →</Link>
          </Button>
        </section>

        {/* === Pricing Tiers === */}
        <section className="mb-24">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING_TIERS.map((tier) => (
              <Card key={tier.name} className={`bg-[#f7fbff] border-2 border-[#1a2942] text-[#1a2942] relative p-8 transition-all rounded-2xl backdrop-blur-md ${
                tier.highlight
                  ? "border-[#d27a2c] shadow-2xl scale-105"
                  : "border-white/30"
              }`}
              >
                {tier.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-[#d27a2c] text-white px-4 py-1 rounded-full text-sm font-semibold shadow-md">
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2 text-[#1a2942]">{tier.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    <span className="text-white/70">/mo</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckIcon className="w-5 h-5 text-[#d27a2c] flex-shrink-0 mt-0.5" />
                      <span className="text-[#1a2942]">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className={`w-full ${
                    tier.highlight
                      ? "bg-[#d27a2c] hover:bg-[#b86824]"
                      : "bg-white/20 hover:bg-white/30"
                  } text-white font-semibold`}
                >
                  <Link href={tier.href}>{tier.cta}</Link>
                </Button>
              </Card>
            ))}
          </div>

          <p className="text-center text-white/80 mt-8">
            Try Entrepreneuria free. Cancel anytime—no credit card stress.
          </p>
        </section>

        {/* === Testimonials === */}
        <section className="mb-20 text-center">
          <h2 className="text-4xl font-bold mb-12 drop-shadow-md">
            Trusted by Founders Like You
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {TESTIMONIALS.map((testimonial, i) => (
              <Card key={i} className="bg-[#f7fbff] border border-[#1a2942] text-[#1a2942] p-8 rounded-2xl backdrop-blur-md"
              >
                <blockquote className="text-[#1a2942] mb-4 italic leading-relaxed">
                  "{testimonial.quote}"
                </blockquote>
                <cite className="text-[#1a2942] not-italic font-semibold">
                  — {testimonial.author}, {testimonial.title}
                </cite>
              </Card>
            ))}
          </div>
        </section>

        {/* === FAQ Section === */}
        <section className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 drop-shadow-md">
            Pricing FAQs
          </h2>
          <Card className="max-w-3xl mx-auto bg-[#f7fbff] border border-[#1a2942] text-[#1a2942] p-8 rounded-2xl">
            <Accordion
              type="single"
              collapsible
              value={openFaq}
              onValueChange={setOpenFaq}
              className="space-y-4"
            >
              {FAQS.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-white hover:text-[#d27a2c]">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/80">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </section>

        {/* === Final CTA === */}
        <section className="text-center backdrop-blur-sm bg-white/10 p-12 rounded-2xl shadow-xl">
          <h2 className="text-3xl font-bold mb-6 drop-shadow-md">
            Entrepreneurship is tough enough. Pricing shouldn’t be.
          </h2>
          <p className="text-xl text-white/80 mb-8 leading-relaxed max-w-3xl mx-auto">
            Start free, see the value, and only pay when you're ready to grow.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-[#d27a2c] hover:bg-[#b86824] text-white text-lg px-8"
          >
            <Link href="/signup">Start Free Trial →</Link>
          </Button>
        </section>
      </div>
    </main>
  )
}

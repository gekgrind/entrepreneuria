"use client"

import type React from "react"
import Link from "next/link"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

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
    features: ["Free trial access", "Limited Prospra queries", "Basic Synceri task automation", "Resource Hub access"],
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
    quote: "The Growth plan paid for itself in one week—I saved 10+ hours with Synceri.",
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
    <main className="relative z-10 pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4">
        <section className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-white">Simple Pricing. Powerful Value.</h1>
          <p className="text-xl text-card-foreground/80 mb-8 max-w-3xl mx-auto leading-relaxed">
            Whether you're just starting or scaling, Entrepreneuria has a plan designed for your journey. All plans
            include a free trial—cancel anytime.
          </p>

          {/* Micro-bullets */}
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            <div className="flex items-center gap-2">
              <RocketIcon className="w-5 h-5 text-primary" />
              <span className="text-card-foreground">Get started free</span>
            </div>
            <div className="flex items-center gap-2">
              <LightbulbIcon className="w-5 h-5 text-primary" />
              <span className="text-card-foreground">Upgrade as you grow</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon className="w-5 h-5 text-primary" />
              <span className="text-card-foreground">Cancel anytime, risk-free</span>
            </div>
          </div>

          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white">
            <Link href="/signup">Start Free Trial →</Link>
          </Button>
        </section>

        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12 text-card-foreground">
            Why Entrepreneuria's Pricing Works for Entrepreneurs
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="p-6 bg-card border-2 border-primary">
              <div className="flex items-start gap-3">
                <CheckIcon className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-card-foreground mb-2">Transparent & Fair</h3>
                  <p className="text-muted-foreground">No hidden fees—clear monthly pricing.</p>
                </div>
              </div>
            </Card>
            <Card className="p-6 bg-card border-2 border-primary">
              <div className="flex items-start gap-3">
                <CheckIcon className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-card-foreground mb-2">Scalable</h3>
                  <p className="text-muted-foreground">
                    Plans that grow with you, from solo founder to scaling startup.
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-6 bg-card border-2 border-primary">
              <div className="flex items-start gap-3">
                <CheckIcon className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-card-foreground mb-2">Full Access</h3>
                  <p className="text-muted-foreground">
                    Every plan includes Prospra, Synceri, and Resource Hub access.
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-6 bg-card border-2 border-primary">
              <div className="flex items-start gap-3">
                <CheckIcon className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-card-foreground mb-2">Risk-Free</h3>
                  <p className="text-muted-foreground">Free trial + cancel anytime guarantee.</p>
                </div>
              </div>
            </Card>
            <Card className="p-6 bg-card border-2 border-primary md:col-span-2 lg:col-span-1">
              <div className="flex items-start gap-3">
                <CheckIcon className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-card-foreground mb-2">Designed for Entrepreneurs</h3>
                  <p className="text-muted-foreground">
                    Features built specifically for startup needs, not generic SaaS fluff.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="mb-20">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING_TIERS.map((tier) => (
              <Card
                key={tier.name}
                className={`relative p-8 bg-card border-2 ${
                  tier.highlight ? "border-primary shadow-lg scale-105" : "border-primary"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold">
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-card-foreground mb-2">{tier.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-card-foreground">{tier.price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckIcon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-card-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className={`w-full ${
                    tier.highlight
                      ? "bg-primary hover:bg-primary/90 text-white"
                      : "bg-card-foreground hover:bg-card-foreground/90 text-white"
                  }`}
                >
                  <Link href={tier.href}>{tier.cta}</Link>
                </Button>
              </Card>
            ))}
          </div>

          <p className="text-center text-muted-foreground mt-8">
            Try Entrepreneuria free. Cancel anytime—no credit card stress.
          </p>
        </section>

        <section className="mb-20">
          <Card className="p-8 bg-card border-2 border-primary max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-6 text-card-foreground">Which plan fits your journey?</h2>
            <div className="space-y-4 mb-8">
              <div>
                <h3 className="font-semibold text-card-foreground mb-2">Starter</h3>
                <p className="text-muted-foreground">Perfect for testing ideas and trying AI mentorship.</p>
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground mb-2">Growth</h3>
                <p className="text-muted-foreground">
                  Designed for solopreneurs and small business owners ready to scale.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground mb-2">Pro</h3>
                <p className="text-muted-foreground">
                  For ambitious founders who want full access and premium support.
                </p>
              </div>
            </div>

            <div className="border-t-2 border-primary/20 pt-6">
              <h3 className="font-semibold text-card-foreground mb-3">Why It's Affordable</h3>
              <p className="text-muted-foreground leading-relaxed">
                Traditional mentorship costs $200+ per session. Entrepreneuria gives you ongoing guidance and admin
                support for less than the cost of coffee a day.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12 text-card-foreground">Trusted by Founders Like You</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {TESTIMONIALS.map((testimonial, i) => (
              <Card key={i} className="p-8 bg-card border-2 border-primary">
                <blockquote className="text-card-foreground mb-4 leading-relaxed">"{testimonial.quote}"</blockquote>
                <cite className="text-muted-foreground font-semibold not-italic">
                  — {testimonial.author}, {testimonial.title}
                </cite>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-8 mt-8">
            <div className="flex items-center gap-2">
              <CheckIcon className="w-5 h-5 text-primary" />
              <span className="text-card-foreground">30-day money-back guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon className="w-5 h-5 text-primary" />
              <span className="text-card-foreground">Trusted by early-stage entrepreneurs</span>
            </div>
          </div>
        </section>

        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12 text-card-foreground">Pricing FAQs</h2>
          <Card className="max-w-3xl mx-auto bg-card border-2 border-primary p-8">
            <Accordion type="single" collapsible value={openFaq} onValueChange={setOpenFaq}>
              {FAQS.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-card-foreground hover:text-primary">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </section>

        <section className="text-center mb-20">
          <Card className="p-12 bg-gradient-to-r from-[#d27a2c]/10 to-[#4f7ca7]/10 border-2 border-primary max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-card-foreground">
              Entrepreneurship is tough enough. Pricing shouldn't be.
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Start free, see the value, and only pay when you're ready to grow.
            </p>
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white">
              <Link href="/signup">Start Free Trial →</Link>
            </Button>
          </Card>
        </section>

        <section className="text-center">
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              asChild
              variant="outline"
              className="border-primary text-card-foreground hover:bg-card bg-transparent"
            >
              <Link href="/">Homepage</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-primary text-card-foreground hover:bg-card bg-transparent"
            >
              <Link href="/prospra">Prospra</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-primary text-card-foreground hover:bg-card bg-transparent"
            >
              <Link href="/synceri">Synceri</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-primary text-card-foreground hover:bg-card bg-transparent"
            >
              <Link href="/hub">Resource Hub</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}

"use client"

import type React from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/PageHeader"
import ResourceFAQs from "./ResourceFAQs" // ✅ this handles all FAQ logic

// icons... (same as before, no changes)
function BookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}
function RocketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4.5 16.5c-1.5 1.25-2 5-2 5s3.75-.5 5-2c.625-.625 1-1.5 1-2.5a2.5 2.5 0 0 0-2.5-2.5c-1 0-1.875.375-2.5 1z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  )
}

function TargetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function TrendingUpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function FolderIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function LightbulbIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  )
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 0 1 0 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3-3a1 1 0 1 1 1.414-1.414l2.293 2.293 6.543-6.543a1 1 0 0 1 1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}


const RESOURCE_CATEGORIES = [
  {
    title: "Startup Foundations",
    icon: RocketIcon,
    resources: ["Lean Canvas", "Business Model Template", "Pitch Deck Outline"],
  },
  {
    title: "Funding & Finance",
    icon: TrendingUpIcon,
    resources: ["Investor Pitch Template", "Due Diligence Checklist", "Financial Model Template"],
  },
  {
    title: "Growth & Marketing",
    icon: TargetIcon,
    resources: ["Growth Hacking Toolkit", "Product-Market Fit Guide", "Content Strategy Playbook"],
  },
  {
    title: "Operations & Team",
    icon: FolderIcon,
    resources: ["Hiring Playbook", "Remote Team Guide", "Culture Building Kit"],
  },
  {
    title: "Legal & Compliance",
    icon: CheckIcon,
    resources: ["NDA Template", "Copyright Transfer Agreement", "Operating Agreement (general)"],
  },
]

const TESTIMONIALS = [
  {
    quote: "The Growth Playbook gave me clarity on my customer acquisition strategy.",
    author: "Startup Founder",
  },
  {
    quote: "Having all these templates in one place saved me weeks of work.",
    author: "Educator/Coach",
  },
]


export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#4f7ca7] to-[#d27a2c] overflow-hidden text-white z-0">
      {/* 🧠 Cinematic Header Video Section */}
      <div className="relative -mt-[var(--header-height)]">
        <PageHeader
          title="Free Tools, Templates & Playbooks"
          subtitle="Everything you need to start, grow, and scale—ready to download."
          videoSrc="/videos/resources-header.mp4"
          imageSrc="/images/resources-fallback.jpg"
          textColor="text-white"
        />
      </div>

      {/* === Features Section === */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-col md:flex-row justify-center gap-8 mb-8">
            <div className="flex items-center justify-center gap-3">
              <BookIcon className="w-6 h-6 text-[#d27a2c]" />
              <span className="text-white/90">Templates that save time & cut confusion</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <RocketIcon className="w-6 h-6 text-[#d27a2c]" />
              <span className="text-white/90">Playbooks that turn ideas into action</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <TargetIcon className="w-6 h-6 text-[#d27a2c]" />
              <span className="text-white/90">Practical guides you can apply today</span>
            </div>
          </div>
          <Button asChild size="lg" className="bg-white text-[#4f7ca7] hover:bg-white/90">
            <Link href="#resources">Browse Resources →</Link>
          </Button>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4">
        {/* Benefits */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12 text-card-foreground">
            Why Entrepreneurs Love These Resources
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* cards (no change) */}
          </div>
        </section>

        {/* Categories */}
        <section id="resources" className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12 text-card-foreground">
            Explore Resource Categories
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {RESOURCE_CATEGORIES.map((category) => {
              const Icon = category.icon
              return (
                <Card key={category.title} className="p-6 bg-[#f7fbff] border-2 border-[#1a2942] text-[#1a2942] hover:shadow-lg transition">
                  <div className="flex items-center gap-3 mb-4">
                    <Icon className="w-6 h-6 text-[#1a2942]" />
                    <h3 className="font-semibold text-lg text-[#1a2942]">{category.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {category.resources.map((resource) => (
                      <li key={resource} className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span className="text-[#1a2942] text-sm">{resource}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )
            })}
          </div>
        </section>

        {/* Deep content */}
        <section className="mb-20">
          <Card className="p-8 bg-[#f7fbff] border-2 border-[#1a2942] text-[#1a2942] max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-[#1a2942]">
              Entrepreneurship has no manual—but Entrepreneuria's Resource Hub comes close.
            </h2>
            <p className="text-[#1a2942] mb-8 leading-relaxed">
              These templates and playbooks are designed to take the guesswork out of starting and growing your
              business. Whether you're validating an idea or scaling sales, we've got the tools you need.
            </p>
            {/* micro content blocks (no changes) */}
          </Card>
        </section>

        {/* Testimonials */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12 text-card-foreground">
            What Entrepreneurs Are Saying
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-8">
            {TESTIMONIALS.map((testimonial, i) => (
              <Card key={i} className="p-8 bg-[#f7fbff] border-2 border-[#1a2942] text-[#1a2942]">
                <blockquote className="text-[#1a2942] mb-4 leading-relaxed italic">
                  "{testimonial.quote}"
                </blockquote>
                <cite className="text-[#1a2942] font-semibold not-italic">— {testimonial.author}</cite>
              </Card>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {/* Trust badges (no change) */}
          </div>
        </section>

        {/* Pricing/Access */}
        <section className="mb-20">
          <Card className="p-8 bg-[#f7fbff] border-2 border-[#1a2942] text-[#1a2942] max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-[#1a2942] text-center">Access Model</h2>
            {/* ...same as before */}
          </Card>
        </section>

        {/* ✅ FAQ Section — use the component only */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12 text-card-foreground">
            Frequently Asked Questions
          </h2>
          <ResourceFAQs /> {/* ← client component, clean */}
        </section>

        {/* Final CTA */}
        <section className="text-center mb-20">
          {/* ... no changes */}
        </section>

        {/* Footer links */}
        <section className="text-center">
          {/* ... no changes */}
        </section>
      </div>
    </main>
  )
}

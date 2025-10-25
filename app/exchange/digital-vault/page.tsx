"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Lock,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  Star,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Target,
  Link2,
  FileText,
  BarChart3,
  Zap,
  BookOpen,
} from "lucide-react"

export default function DigitalVaultPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [showStickyCta, setShowStickyCta] = useState(false)

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.getElementById("hero")
      if (heroSection) {
        const heroBottom = heroSection.offsetTop + heroSection.offsetHeight
        setShowStickyCta(window.scrollY > heroBottom)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <main className="relative z-10 pt-24 pb-24">
      {/* Hero Section */}
      <section id="hero" className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold font-sans mb-6 text-white text-balance leading-tight">
                Unlock the Vault. Access Every Advantage.
              </h1>
              <p className="text-xl mb-8 text-white/90 text-pretty leading-relaxed">
                Your one-stop digital marketplace for premium templates, guides, and playbooks to launch, grow, and
                scale your business.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-white/90">
                  <CheckCircle2 className="h-5 w-5 text-[#d27a2c]" />
                  <span>💼 Plug-and-play business templates</span>
                </div>
                <div className="flex items-center gap-3 text-white/90">
                  <CheckCircle2 className="h-5 w-5 text-[#d27a2c]" />
                  <span>📘 Growth & marketing playbooks</span>
                </div>
                <div className="flex items-center gap-3 text-white/90">
                  <CheckCircle2 className="h-5 w-5 text-[#d27a2c]" />
                  <span>🧭 Strategic workbooks & planners</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Button
                  size="lg"
                  className="bg-[#d27a2c] text-white hover:bg-[#b86824] text-lg px-8 py-6 shadow-lg"
                  onClick={() => scrollToSection("final-cta")}
                >
                  Browse the Vault <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-white text-white hover:bg-white/10 bg-transparent text-lg px-8 py-6"
                  onClick={() => scrollToSection("catalog")}
                >
                  See What's Inside
                </Button>
              </div>
              <p className="text-white/80 text-sm">Instant access • Lifetime updates • 30-day guarantee</p>
            </div>

            {/* Animated vault icon */}
            <div className="flex justify-center items-center">
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="relative bg-white/10 backdrop-blur-md border-2 border-white/30 rounded-2xl p-12 shadow-2xl">
                  <Lock className="h-32 w-32 text-white drop-shadow-lg" />
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <KeyRound className="h-16 w-16 text-[#d27a2c] animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-6 text-white">Why the Digital Vault?</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <Zap className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">Save Time</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Skip the guesswork with done-for-you templates.</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <Target className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">Proven Systems</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Built and tested by real entrepreneurs.</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <CheckCircle2 className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">Instant Access</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Download instantly, implement immediately.</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <BookOpen className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">Curated Collections</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">SEO, strategy, content, and brand kits.</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <Star className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">Affordable Excellence</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Big-business quality, solopreneur pricing.</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <TrendingUp className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">Ever-Growing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">New resources added regularly.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      {/* Why the Vault Exists */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-xl">
              <div className="flex justify-center items-center h-full relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#d27a2c]/20 to-[#4f7ca7]/20 rounded-2xl blur-2xl animate-pulse"></div>
                <Lock className="relative h-48 w-48 text-white/80" />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-32 h-32 bg-white/30 rounded-full blur-xl animate-pulse"></div>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-4xl font-bold font-sans mb-6 text-white">Because you're tired of guesswork.</h2>
              <div className="space-y-4 text-xl text-white/90 leading-relaxed">
                <p>
                  You've seen courses that talk in circles. You've bought templates that sit in Google Drive forever.
                  You don't need more information — you need systems that actually work.
                </p>
                <p>
                  That's why I created The Digital Vault: your private library of ready-to-use business systems,
                  frameworks, and automations that get real results.
                </p>
                <p>When you open the Vault, you don't just get tools. You get clarity, strategy, and momentum.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      {/* Featured Product - The Secret SEO Formula System */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-[#d27a2c] text-white text-lg px-4 py-2">Featured Product</Badge>
            <h2 className="text-5xl font-bold font-sans mb-4 text-white">The Secret SEO Formula</h2>
            <p className="text-2xl text-white/90 mb-6">Your no-guess roadmap to page-one domination.</p>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              If your website isn't bringing traffic, leads, and sales — this is your missing piece. The Secret SEO
              Formula gives you a clear, repeatable framework to grow visibility and traffic in just 7 minutes a day.
            </p>
          </div>

          <div className="mb-12">
            <h3 className="text-3xl font-bold text-white text-center mb-8">What's Inside</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card className="border-2 border-primary hover:border-primary/70 transition-all hover:scale-105">
                <CardContent className="pt-6 text-center">
                  <TrendingUp className="h-12 w-12 text-primary mb-3 mx-auto" />
                  <h4 className="text-card-foreground font-semibold mb-2">Keyword Blueprint</h4>
                  <p className="text-muted-foreground text-sm">Find profitable keywords in minutes</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary hover:border-primary/70 transition-all hover:scale-105">
                <CardContent className="pt-6 text-center">
                  <Target className="h-12 w-12 text-primary mb-3 mx-auto" />
                  <h4 className="text-card-foreground font-semibold mb-2">Topic Cluster Mapping</h4>
                  <p className="text-muted-foreground text-sm">Build a structure Google loves</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary hover:border-primary/70 transition-all hover:scale-105">
                <CardContent className="pt-6 text-center">
                  <FileText className="h-12 w-12 text-primary mb-3 mx-auto" />
                  <h4 className="text-card-foreground font-semibold mb-2">On-Page & Technical SEO Kit</h4>
                  <p className="text-muted-foreground text-sm">Templates, checklists, automations</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary hover:border-primary/70 transition-all hover:scale-105">
                <CardContent className="pt-6 text-center">
                  <Link2 className="h-12 w-12 text-primary mb-3 mx-auto" />
                  <h4 className="text-card-foreground font-semibold mb-2">Backlink Growth Playbook</h4>
                  <p className="text-muted-foreground text-sm">Earn high-quality links without spam</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary hover:border-primary/70 transition-all hover:scale-105">
                <CardContent className="pt-6 text-center">
                  <BarChart3 className="h-12 w-12 text-primary mb-3 mx-auto" />
                  <h4 className="text-card-foreground font-semibold mb-2">SEO Maintenance Framework</h4>
                  <p className="text-muted-foreground text-sm">Keep results compounding monthly</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mb-12">
            <h3 className="text-3xl font-bold text-white text-center mb-8">Benefits</h3>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-primary mb-3 mx-auto" />
                <p className="text-white text-lg font-semibold">Predictable growth without ads</p>
              </div>
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-primary mb-3 mx-auto" />
                <p className="text-white text-lg font-semibold">Reusable across multiple sites</p>
              </div>
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-primary mb-3 mx-auto" />
                <p className="text-white text-lg font-semibold">Fast setup, lasting impact</p>
              </div>
            </div>
          </div>

          <div className="text-center mb-8">
            <p className="text-white/90 text-lg">Try it risk-free. 30-day money-back guarantee.</p>
          </div>

          <div className="text-center">
            <Button size="lg" className="bg-[#d27a2c] text-white hover:bg-[#b86824] text-xl px-12 py-6 shadow-lg">
              Unlock the SEO Formula <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      {/* Vault Catalog */}
      <section id="catalog" className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-6 text-white">
              All Your Tools. One Vault. Endless Possibilities.
            </h2>
            <p className="text-xl text-white/90 max-w-3xl mx-auto">
              As I build new systems — from AI marketing toolkits to content strategy templates — you'll find them here.
              This isn't just a product page; it's a growing ecosystem. Your vault key gives you access to everything I
              create next.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Active Product - SEO Formula */}
            <Card className="border-2 border-primary hover:border-primary/70 hover:scale-105 transition-all">
              <CardHeader>
                <div className="bg-[#d27a2c] text-white text-sm font-bold px-3 py-1 rounded-full w-fit mb-3">
                  AVAILABLE NOW
                </div>
                <CardTitle className="text-2xl">The Secret SEO Formula</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Rank faster. Grow smarter.</p>
                <Button className="w-full bg-[#d27a2c] text-white hover:bg-[#b86824]">
                  Unlock Now <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/30 opacity-75 hover:opacity-90 transition-opacity">
              <CardHeader>
                <div className="bg-muted text-muted-foreground text-sm font-bold px-3 py-1 rounded-full w-fit mb-3">
                  COMING SOON
                </div>
                <CardTitle className="text-2xl text-muted-foreground">AI Content Planner</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Your personal content strategist in a spreadsheet.</p>
                <Button variant="outline" className="w-full bg-transparent" disabled>
                  Coming Soon
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/30 opacity-75 hover:opacity-90 transition-opacity">
              <CardHeader>
                <div className="bg-muted text-muted-foreground text-sm font-bold px-3 py-1 rounded-full w-fit mb-3">
                  COMING SOON
                </div>
                <CardTitle className="text-2xl text-muted-foreground">Brand Identity Kit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Professional branding made plug-and-play.</p>
                <Button variant="outline" className="w-full bg-transparent" disabled>
                  Coming Soon
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/30 opacity-75 hover:opacity-90 transition-opacity">
              <CardHeader>
                <div className="bg-muted text-muted-foreground text-sm font-bold px-3 py-1 rounded-full w-fit mb-3">
                  COMING SOON
                </div>
                <CardTitle className="text-2xl text-muted-foreground">Entrepreneuria Growth Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Visualize, plan, and scale your business data.</p>
                <Button variant="outline" className="w-full bg-transparent" disabled>
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      {/* Testimonials */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-4 text-white">Real Entrepreneurs. Real Results.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-2 border-primary">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-[#d27a2c] text-[#d27a2c]" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 italic">
                  "My organic traffic doubled in 8 weeks using this system. It's not fluff — it's formulas that work."
                </p>
                <p className="text-card-foreground font-semibold">— Sarah M.</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-[#d27a2c] text-[#d27a2c]" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 italic">
                  "I finally understand SEO. The Vault turned something intimidating into a daily system I can stick
                  with."
                </p>
                <p className="text-card-foreground font-semibold">— Jason L.</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-[#d27a2c] text-[#d27a2c]" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 italic">
                  "Entrepreneuria's Digital Vault is my new business gym — I log in, put in reps, and see growth every
                  week."
                </p>
                <p className="text-card-foreground font-semibold">— Amira P.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-4 text-white">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "What is the Digital Vault?",
                answer: "Entrepreneuria's marketplace for premium entrepreneur tools and templates.",
              },
              {
                question: "Do I need a membership?",
                answer: "No — purchase individually or join for bundles.",
              },
              {
                question: "Are the files editable?",
                answer: "Yes, most are editable in Google Docs, Sheets, Canva, or PDF.",
              },
              {
                question: "What if it doesn't work for me?",
                answer: "You're covered by a 30-day money-back guarantee.",
              },
              {
                question: "Can I use it for multiple businesses?",
                answer: "Absolutely — once unlocked, it's yours forever.",
              },
            ].map((faq, index) => (
              <Card
                key={index}
                className="border-2 border-primary cursor-pointer hover:border-primary/70 transition-colors"
                onClick={() => toggleFaq(index)}
              >
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xl">{faq.question}</CardTitle>
                    {openFaq === index ? (
                      <ChevronUp className="h-6 w-6 text-primary" />
                    ) : (
                      <ChevronDown className="h-6 w-6 text-primary" />
                    )}
                  </div>
                </CardHeader>
                {openFaq === index && (
                  <CardContent>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      {/* Final CTA */}
      <section id="final-cta" className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-[#d27a2c]/30 rounded-full blur-2xl animate-pulse"></div>
              <Lock className="relative h-16 w-16 text-white" />
            </div>
          </div>
          <h2 className="text-5xl font-bold font-sans mb-6 text-white">
            Your next business breakthrough is already in the Vault.
          </h2>
          <p className="text-2xl mb-8 text-white/90">Download, apply, and grow smarter — today.</p>
          <Button size="lg" className="bg-[#d27a2c] text-white hover:bg-[#b86824] text-xl px-12 py-6 shadow-lg mb-4">
            Browse Now <ArrowRight className="ml-2 h-6 w-6" />
          </Button>
          <p className="text-white/80 text-sm mb-2">Instant Access • Lifetime Updates • Secure Checkout</p>
          <p className="text-white/70 text-sm italic">Your future self will thank you.</p>
        </div>
      </section>
    </main>
  )
}

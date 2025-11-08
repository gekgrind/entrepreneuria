"use client"

import { useState, useEffect } from "react"
import PageHeader from "@/components/PageHeader"
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
    <main className="relative z-0">
      {/* 🧊 Page Header Video Section */}
      <div className="relative -mt-[var(--header-height)]">
        <PageHeader
          title="The Data Core"
          subtitle="Secure. Intelligent. Limitless."
          videoSrc="/videos/digital-vault-header.mp4"
          imageSrc="/images/digital-vault-fallback.jpg"
        />
      </div>

      {/* Main Content */}
      <div className="pt-24 pb-24">
        {/* Hero Section */}
        <section id="hero" className="py-20 px-4 backdrop-blur-sm bg-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="text-5xl md:text-6xl font-bold font-sans mb-6 text-white leading-tight">
                  Unlock the Vault. Access Every Advantage.
                </h1>
                <p className="text-xl mb-8 text-white/90 leading-relaxed">
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

        {/* 💾 Rest of your page content stays exactly the same */}
      </div>
    </main>
  )
}

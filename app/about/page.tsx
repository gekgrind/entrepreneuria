"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  ArrowRight,
  Target,
  Lightbulb,
  Globe,
  Heart,
  Zap,
  CheckCircle2,
  DollarSign,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import PageHeader from "@/components/PageHeader" // 🆕 Added for cinematic header

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#4f7ca7] to-[#d27a2c] text-white overflow-hidden z-0">
      {/* 🎬 Cinematic Header Video Section */}
      <div className="relative -mt-[calc(var(--header-height)+1rem)]">
        <PageHeader
          title="Origin"
          subtitle="The Story Behind Entrepreneuria"
          videoSrc="/videos/about-header.mp4"
          imageSrc="/images/about-fallback.jpg"
        />
      </div>

      {/* === Hero Section === */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge
                variant="secondary"
                className="mb-4 bg-white/90 text-[#1a2942] font-semibold"
              >
                Our Story
              </Badge>
              <h1 className="text-5xl md:text-6xl font-bold font-sans mb-6 drop-shadow-lg">
                Built by Entrepreneurs, for Entrepreneurs.
              </h1>
              <p className="text-xl mb-8 text-white/90 leading-relaxed">
                Entrepreneuria exists to remove the roadblocks founders face—
                giving you the tools, mentorship, and support you need to thrive.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-white">
                  <Sparkles className="h-5 w-5 flex-shrink-0 text-[#d27a2c]" />
                  <span>AI-powered mentorship & admin support</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-[#d27a2c]" />
                  <span>Practical resources built on proven frameworks</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <Globe className="h-5 w-5 flex-shrink-0 text-[#d27a2c]" />
                  <span>A community of founders helping founders</span>
                </div>
              </div>

              <Button
                size="lg"
                asChild
                className="bg-white text-[#4f7ca7] hover:bg-white/90"
              >
                <Link href="/resources">
                  Explore Our Tools <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>

            <div className="relative">
              <div className="aspect-square bg-white/10 backdrop-blur-sm rounded-2xl border-2 border-white/20 flex items-center justify-center">
                <div className="text-center p-8">
                  <Globe className="h-24 w-24 text-white mx-auto mb-4" />
                  <p className="text-white/90 text-lg">
                    Supporting entrepreneurs worldwide
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === Mission + Vision === */}
      <section className="py-20 px-4 bg-white/10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 drop-shadow-md">
            Our Mission, Vision, and Promise
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {[
            {
              icon: <Target className="h-8 w-8 text-[#d27a2c] mb-2" />,
              title: "Mission",
              desc: "To make entrepreneurship accessible, less overwhelming, and more achievable for everyone.",
            },
            {
              icon: <Lightbulb className="h-8 w-8 text-[#d27a2c] mb-2" />,
              title: "Vision",
              desc: "A world where anyone with an idea can turn it into a business with the right support.",
            },
            {
              icon: <Zap className="h-8 w-8 text-[#d27a2c] mb-2" />,
              title: "Approach",
              desc: "Combining AI mentorship (Prospra), admin automation (Synceri), and resource libraries into one ecosystem.",
            },
            {
              icon: <Heart className="h-8 w-8 text-[#d27a2c] mb-2" />,
              title: "Promise",
              desc: "Tools that are affordable, practical, and designed to empower—not confuse—entrepreneurs.",
            },
          ].map((item, i) => (
            <Card
              key={i}
              className="bg-[#f7fbff] border-2 border-[#1a2942] text-[#1a2942] shadow-lg hover:bg-[#f7fbff]/90 transition-all"
            >
              <CardHeader>{item.icon}</CardHeader>
              <CardTitle className="text-xl text-[#1a2942]">{item.title}</CardTitle>
              <CardContent>
                <p className="text-[#1a2942] leading-relaxed">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* === Founder Story === */}
      <section className="py-20 px-4 bg-white/10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold mb-4 drop-shadow-md">
            Founder Story
          </h2>
        </div>

        <Card className="bg-white/10 border border-white/30 shadow-lg">
          <CardContent className="p-8">
            <p className="text-white/90 leading-relaxed mb-6">
              "Entrepreneuria was founded by Misti, an entrepreneur who knows
              the struggles of starting, funding, and scaling businesses
              firsthand. After experiencing the challenges of entrepreneurship,
              she built Entrepreneuria to give others the support system she
              wished existed."
            </p>
            <div className="mt-8 pt-6 border-t border-white/30 flex items-center gap-4">
              <div className="w-16 h-16 bg-[#1a2942] rounded-full flex items-center justify-center text-white font-bold text-xl">
                T
              </div>
              <div>
                <div className="font-semibold text-lg">Misti</div>
                <div className="text-white/70">
                  Founder — Visionary Entrepreneur & Creator of Entrepreneuria
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 🎯 The rest of your sections (Board, Testimonials, FAQ, CTA) stay unchanged */}
    </main>
  )
}

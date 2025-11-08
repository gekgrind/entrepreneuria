"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, TrendingUp, DollarSign, Users, FileText, UserPlus, ArrowRight } from "lucide-react"

export default function AIToolsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#4f7ca7]/10 to-[#d27a2c]/10 text-foreground z-0">
      {/* 🧠 Cinematic Header Video Section */}
      <div className="relative -mt-[var(--header-height)]">
        <PageHeader
          title="AI-Powered Tools"
          subtitle="Turn your ideas into action with intelligent, startup-ready AI systems."
          videoSrc="/videos/ai-tools-hero.mp4"
          imageSrc="/images/tools-fallback.jpg"
          textColor="text-white"
        />
      </div>

      {/* ⚙️ Tools Grid */}
      <section className="py-20 px-6 bg-white/10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Intelligent Tools for Modern Entrepreneurs</h2>
          <p className="text-lg text-muted-foreground">
            Explore powerful AI systems built to help you ideate, analyze, and grow faster.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Business Model Generator */}
          <Card className="bg-[#f7fbff] border border-[#1a2942] text-[#1a2942] hover:shadow-lg transition">
            <CardHeader>
              <Brain className="h-8 w-8 text-[#1a2942] mb-2" />
              <CardTitle className="text-[#1a2942]">Business Model Generator</CardTitle>
              <CardDescription className="text-[#1a2942]">AI-assisted canvas creation</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[#1a2942] mb-4">
                Instantly map your business model with AI insights for value proposition, revenue streams, and key activities.
              </p>
              <Button className="w-full bg-[#4f7ca7] text-white hover:bg-[#3f658a]">Launch Tool</Button>
            </CardContent>
          </Card>

          {/* Market Analysis AI */}
          <Card className="bg-[#f7fbff] border border-[#1a2942] hover:shadow-lg transition">
            <CardHeader>
              <TrendingUp className="h-8 w-8 text-[#1a2942] mb-2" />
              <CardTitle className="text-[#1a2942]">Market Analysis AI</CardTitle>
              <CardDescription className="text-[#1a2942]">Intelligent market research</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Uncover market size, competitor data, and hidden opportunities with AI-driven research.
              </p>
              <Button className="w-full bg-[#4f7ca7] text-white hover:bg-[#3f658a]">Launch Tool</Button>
            </CardContent>
          </Card>

          {/* Financial Projector */}
          <Card className="bg-white/70 backdrop-blur-lg border border-[#4f7ca7]/20 hover:shadow-lg transition">
            <CardHeader>
              <DollarSign className="h-8 w-8 text-[#4f7ca7] mb-2" />
              <CardTitle className="text-[#1a2942]">Financial Projector</CardTitle>
              <CardDescription className="text-[#1a2942]">Smart financial modeling</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Generate revenue forecasts, break-even analyses, and cash-flow projections using AI assumptions.
              </p>
              <Button className="w-full bg-[#4f7ca7] text-white hover:bg-[#3f658a]">Launch Tool</Button>
            </CardContent>
          </Card>

          {/* Customer Persona Builder */}
          <Card className="bg-white/70 backdrop-blur-lg border border-[#4f7ca7]/20 hover:shadow-lg transition">
            <CardHeader>
              <Users className="h-8 w-8 text-[#4f7ca7] mb-2" />
              <CardTitle className="text-[#1a2942]">Customer Persona Builder</CardTitle>
              <CardDescription className="text-[#1a2942]">AI customer insights</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Create data-driven personas that capture motivations, pain points, and purchase behaviors.
              </p>
              <Button className="w-full bg-[#4f7ca7] text-white hover:bg-[#3f658a]">Launch Tool</Button>
            </CardContent>
          </Card>

          {/* Pitch Deck Creator */}
          <Card className="bg-white/70 backdrop-blur-lg border border-[#4f7ca7]/20 hover:shadow-lg transition">
            <CardHeader>
              <FileText className="h-8 w-8 text-[#4f7ca7] mb-2" />
              <CardTitle className="text-[#1a2942]">Pitch Deck Creator</CardTitle>
              <CardDescription className="text-[#1a2942]">AI-powered presentations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Auto-build a compelling pitch deck with smart copy, design layouts, and storytelling prompts.
              </p>
              <Button className="w-full bg-[#4f7ca7] text-white hover:bg-[#3f658a]">Launch Tool</Button>
            </CardContent>
          </Card>

          {/* Hiring Assistant */}
          <Card className="bg-white/70 backdrop-blur-lg border border-[#4f7ca7]/20 hover:shadow-lg transition">
            <CardHeader>
              <UserPlus className="h-8 w-8 text-[#4f7ca7] mb-2" />
              <CardTitle className="text-[#1a2942]">Hiring Assistant</CardTitle>
              <CardDescription className="text-[#1a2942]">Smart recruitment automation</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Write job descriptions, screen candidates, and craft interview questions instantly with AI.
              </p>
              <Button className="w-full bg-[#4f7ca7] text-white hover:bg-[#3f658a]">Launch Tool</Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}

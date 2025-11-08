"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import PageHeader from "@/components/PageHeader" // 🆕 Added for header video

import {
  Bot,
  Zap,
  TrendingUp,
  MessageSquare,
  DollarSign,
  Users,
  BarChart3,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Brain,
  Target,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

export default function AgentversePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-[#4f7ca7] to-[#d27a2c] text-white overflow-hidden z-0">
      {/* 🚀 Cinematic Header Video */}
      <div className="relative -mt-[calc(var(--header-height)+1rem)]">
        <PageHeader
          title="The Network Hive"
          subtitle="Where AI Agents Collaborate to Build Your Success"
          videoSrc="/videos/agentverse-header.mp4"
          imageSrc="/images/agentverse-fallback.jpg"
        />
      </div>

      {/* === Hero Section === */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto text-center">
          <Badge
            variant="secondary"
            className="mb-4 bg-white/90 text-[#1a2942] font-semibold"
          >
            The Agentverse
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold font-sans mb-6 drop-shadow-lg">
            Meet Your AI Dream Team
          </h1>
          <p className="text-xl mb-8 text-white/90 max-w-3xl mx-auto leading-relaxed">
            From marketing to admin to growth — the Agentverse connects you with
            specialized AI agents built to supercharge your business.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-8 text-white/90">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#d27a2c]" />
              <span>🤖 Marketing & SEO Agents</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#d27a2c]" />
              <span>📅 Admin & Scheduling Bots</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#d27a2c]" />
              <span>📈 Growth Strategy Assistants</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-[#d27a2c] hover:bg-white/90"
            >
              Explore the Agentverse <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 bg-transparent"
            >
              See Agents in Action
            </Button>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      {/* === Why the Agentverse Section === */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-6 drop-shadow-md">
              Why the Agentverse?
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <Bot className="h-10 w-10 text-[#d27a2c] mb-3" />,
                title: "Purpose-Built AI Agents",
                desc: "No setup, just results.",
              },
              {
                icon: <Zap className="h-10 w-10 text-[#d27a2c] mb-3" />,
                title: "Plug-and-Play Integration",
                desc: "Works with your existing tools.",
              },
              {
                icon: <Target className="h-10 w-10 text-[#d27a2c] mb-3" />,
                title: "Customizable Intelligence",
                desc: "Personalize tone & goals.",
              },
              {
                icon: <DollarSign className="h-10 w-10 text-[#d27a2c] mb-3" />,
                title: "Affordable Automation",
                desc: "Big productivity, small cost.",
              },
              {
                icon: <Brain className="h-10 w-10 text-[#d27a2c] mb-3" />,
                title: "Ever-Evolving",
                desc: "Agents learn and improve over time.",
              },
              {
                icon: <Sparkles className="h-10 w-10 text-[#d27a2c] mb-3" />,
                title: "Always Available",
                desc: "24/7 productivity, no breaks needed.",
              },
            ].map((item, i) => (
              <Card
                key={i}
                className="border-2 border-[#1a2942] bg-[#f7fbff] hover:bg-[#f7fbff]/90 transition-all"
              >
                <CardHeader>{item.icon}</CardHeader>
                <CardTitle className="text-xl text-[#1a2942] text-center">
                  {item.title}
                </CardTitle>
                <CardContent>
                  <p className="text-[#1a2942] text-center">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 🧩 Rest of your sections remain unchanged */}
      {/* Featured Agents, Agent Types, How It Works, Benefits, Social Proof, FAQ, CTA */}
    </main>
  )
}

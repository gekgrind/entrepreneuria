"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  Zap,
  Calendar,
  Mail,
  Bell,
  Briefcase,
  CheckCircle,
} from "lucide-react"
import PageHeader from "@/components/PageHeader" // 🆕 Added import

export default function SynceriPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#4f7ca7] to-[#d27a2c] overflow-hidden text-white z-0">
      {/* 🧠 Cinematic Header Video Section */}
      <div className="relative -mt-[calc(var(--header-height)+1rem)]">
        <PageHeader
          title="The Flow"
          subtitle="Automation in Motion"
          videoSrc="/videos/synceri-header.mp4"
          imageSrc="/images/synceri-fallback.jpg"
          textColor="text-white"
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
                AI-Powered Life Admin
              </Badge>
              <h1 className="text-5xl md:text-6xl font-bold font-sans mb-6">
                Your AI Life Admin
              </h1>
              <p className="text-xl mb-8 text-white/90 leading-relaxed">
                Synceri automates your personal and business tasks so you can
                focus on growth, creativity, and freedom.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  variant="secondary"
                  className="text-lg px-8 py-3 bg-[#1a2942] text-white hover:bg-[#4f7ca7]"
                >
                  Get Synceri Working for You{" "}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-3 bg-transparent border-white text-white hover:bg-white hover:text-[#4f7ca7] transition-all"
                >
                  See It in Action
                </Button>
              </div>
            </div>

            {/* Right-Side Dashboard Card */}
            <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm hover:bg-white/20 transition-all shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Zap className="h-6 w-6 text-[#d27a2c]" />
                  <span className="font-semibold">Synceri Dashboard</span>
                </div>
                <div className="space-y-3">
                  <div className="bg-white/15 p-3 rounded-lg flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-[#d27a2c]" />
                    <span className="text-sm text-white/90">
                      Scheduled 3 meetings for next week
                    </span>
                  </div>
                  <div className="bg-white/15 p-3 rounded-lg flex items-center gap-3">
                    <Mail className="h-4 w-4 text-[#d27a2c]" />
                    <span className="text-sm text-white/90">
                      Responded to 12 emails automatically
                    </span>
                  </div>
                  <div className="bg-white/15 p-3 rounded-lg flex items-center gap-3">
                    <Bell className="h-4 w-4 text-[#d27a2c]" />
                    <span className="text-sm text-white/90">
                      Prioritized 8 tasks for today
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === Features Section === */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold font-sans mb-4">
              Automate Everything, Focus on What Matters
            </h2>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              Let AI handle the routine so you can concentrate on building your
              empire.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Calendar className="h-8 w-8 text-[#d27a2c] mb-2" />,
                title: "AI Scheduling",
                desc: "Intelligent calendar management that finds optimal meeting times and handles scheduling conflicts.",
              },
              {
                icon: <Mail className="h-8 w-8 text-[#d27a2c] mb-2" />,
                title: "Email Automation",
                desc: "Smart email responses, follow-ups, and inbox organization based on your communication style.",
              },
              {
                icon: <Bell className="h-8 w-8 text-[#d27a2c] mb-2" />,
                title: "Smart Reminders",
                desc: "AI-powered task prioritization and intelligent reminders that adapt to your workflow.",
              },
              {
                icon: <Briefcase className="h-8 w-8 text-[#d27a2c] mb-2" />,
                title: "Business Integration",
                desc: "Seamlessly manage both personal and business tasks in one unified, intelligent system.",
              },
            ].map((item, i) => (
              <Card
                key={i}
                className="bg-white/10 border border-white/20 shadow-lg hover:bg-white/20 transition"
              >
                <CardHeader>
                  {item.icon}
                  <CardTitle className="text-xl text-white">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white/90">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* === Remaining Sections stay unchanged === */}
      {/* Benefits, How It Works, Social Proof, CTA */}
    </main>
  )
}

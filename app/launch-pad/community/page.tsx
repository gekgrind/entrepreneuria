"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, MessageSquare, Calendar, Star } from "lucide-react"
import { ArrowRight } from "lucide-react"

export default function CommunityPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#d27a2c]/10 to-[#4f7ca7]/10 text-foreground z-0">
      {/* 🧠 Cinematic Header Video Section */}
      <div className="relative -mt-[var(--header-height)]">
        <PageHeader
          title="Community Hub"
          subtitle="Connect, share, and grow with fellow entrepreneurs and creators."
          videoSrc="/videos/community-hero.mp4"
          imageSrc="/images/community-fallback.jpg"
          textColor="text-white"
        />
      </div>

      {/* 👥 Sections */}
      <section className="py-20 px-6 bg-white/10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
          <Card className="bg-[#f7fbff] border border-[#1a2942] text-[#1a2942]">
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-[#4f7ca7] mb-2" />
              <CardTitle className="text-[#1a2942]">Active Discussions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[#1a2942] mb-4">
                Share advice, ask questions, and connect in our vibrant startup discussions.
              </p>
              <Button className="w-full bg-[#4f7ca7] text-white hover:bg-[#3f658a]">
                View Topics
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#f7fbff] border border-[#1a2942] text-[#1a2942]">
            <CardHeader>
              <Calendar className="h-8 w-8 text-[#4f7ca7] mb-2" />
              <CardTitle className="text-[#1a2942]">Events & Workshops</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[#1a2942] mb-4">
                Join virtual meetups, founder roundtables, and AI training sessions every month.
              </p>
              <Button className="w-full bg-[#4f7ca7] text-white hover:bg-[#3f658a]">
                View Calendar
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#f7fbff] border border-[#1a2942] text-[#1a2942] md:col-span-2">
            <CardHeader>
              <Users className="h-8 w-8 text-[#4f7ca7] mb-2" />
              <CardTitle className="text-[#1a2942]">Member Spotlight</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 text-center">
                {["Alex", "Jasmine", "Riley"].map((name, i) => (
                  <div key={i}>
                    <div className="w-16 h-16 mx-auto bg-[#4f7ca7] text-white rounded-full flex items-center justify-center text-xl font-bold mb-3">
                      {name.charAt(0)}
                    </div>
                    <h4 className="font-semibold text-[#1a2942]">{name}</h4>
                    <p className="text-sm text-[#1a2942]">Founder @ StartupCo</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}

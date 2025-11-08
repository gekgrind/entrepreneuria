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
    <main className="relative z-10 pt-[var(--header-height)] pb-24 min-h-screen bg-gradient-to-br from-[#d27a2c]/10 to-[#4f7ca7]/10 text-foreground">
  {/* 🎬 Hero Video */}
  <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
    <video
      className="absolute inset-0 w-full h-full object-cover z-0"
      src="/videos/community-hero.mp4"
      autoPlay
      loop
      muted
      playsInline
    />
    <div className="relative z-20 text-center px-6">
      <Badge variant="secondary" className="mb-4 bg-white/20 text-white backdrop-blur-md">
        Launch Pad
      </Badge>
      <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
        The Entrepreneuria Blog
      </h1>
      <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto mb-8">
        Insights, inspiration, and AI-powered wisdom for founders and creators.
      </p>
      <Button
        size="lg"
        variant="secondary"
        className="text-lg px-8 py-3 bg-white text-[#1a2942] hover:bg-white/90"
      >
        Read Articles <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
    </div>
  </section>

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

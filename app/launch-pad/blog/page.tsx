"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, ArrowRight } from "lucide-react"

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#d27a2c]/10 to-[#4f7ca7]/10 text-foreground z-0">
      {/* 🧠 Cinematic Header Video Section */}
      <div className="relative -mt-[var(--header-height)]">
        <PageHeader
          title="The Knowledge Blueprint"
          subtitle="Insights, inspiration, and AI-powered wisdom for founders and creators."
          videoSrc="/videos/blog-hero.mp4"
          imageSrc="/images/blog-fallback.jpg"
          textColor="text-white"
        />
      </div>

      {/* 📰 Blog Cards */}
      <section className="py-20 px-6 bg-white/10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card
              key={i}
              className="bg-white/70 border border-[#d27a2c]/30 hover:shadow-lg transition flex flex-col justify-between"
            >
              <CardHeader>
                <Badge variant="secondary" className="mb-2 bg-[#d27a2c]/20 text-[#d27a2c]">
                  {i % 2 === 0 ? "AI Strategy" : "Growth Tips"}
                </Badge>
                <CardTitle>Article Title Example {i}</CardTitle>
                <CardDescription>Published {i} days ago</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Learn how entrepreneurs are leveraging AI, creativity, and automation to scale smarter.
                </p>
                <Button variant="outline" size="sm">
                  Read More
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}

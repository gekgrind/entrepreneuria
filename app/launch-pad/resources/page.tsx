"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, TrendingUp, Users, DollarSign } from "lucide-react"

export default function ResourcesPage() {
  return (
    <main className="relative z-10 pt-0 pb-24 min-h-screen bg-gradient-to-br from-[#4f7ca7]/10 to-[#d27a2c]/10 text-foreground">
      {/* 🎬 Hero Video */}
      <section className="relative -mt-[var(--header-height)] h-[80vh] flex items-center justify-center overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover z-0"
          src="/videos/resources-hero.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        {/* Optional: subtle gradient for readability */}
        {/* <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent z-10"></div> */}
        <div className="relative z-20 text-center px-6">
          <Badge variant="secondary" className="mb-4 bg-white/20 text-white backdrop-blur-md">
            Launch Pad
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Resources & Templates
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto mb-8">
            Download frameworks, playbooks, and templates to accelerate your startup’s growth.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="text-lg px-8 py-3 bg-white text-[#1a2942] hover:bg-white/90"
          >
            Browse Resources
          </Button>
        </div>
      </section>

      {/* 📁 Resource Cards */}
      <section className="py-20 px-6 bg-white/10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Downloadable Templates & Frameworks</h2>
          <p className="text-lg text-muted-foreground">
            Proven systems to plan, validate, and scale your business efficiently.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="bg-white/70 border border-[#4f7ca7]/20 hover:shadow-lg transition">
            <CardHeader>
              <FileText className="h-8 w-8 text-[#4f7ca7] mb-2" />
              <CardTitle>Lean Startup Canvas</CardTitle>
              <CardDescription>Strategic template for business models</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Identify problems, solutions, key metrics, and value propositions in one simple sheet.
              </p>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/70 border border-[#4f7ca7]/20 hover:shadow-lg transition">
            <CardHeader>
              <TrendingUp className="h-8 w-8 text-[#4f7ca7] mb-2" />
              <CardTitle>Growth Playbook</CardTitle>
              <CardDescription>Step-by-step growth systems</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Marketing tactics, automation frameworks, and growth loops to expand your reach.
              </p>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Toolkit
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/70 border border-[#4f7ca7]/20 hover:shadow-lg transition">
            <CardHeader>
              <DollarSign className="h-8 w-8 text-[#4f7ca7] mb-2" />
              <CardTitle>Funding Guide</CardTitle>
              <CardDescription>Investor-ready financial template</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Use AI-assisted financial models to prepare for grants, seed rounds, or Series A.
              </p>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Get Template
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/70 border border-[#4f7ca7]/20 hover:shadow-lg transition">
            <CardHeader>
              <Users className="h-8 w-8 text-[#4f7ca7] mb-2" />
              <CardTitle>Team Culture Kit</CardTitle>
              <CardDescription>Build thriving teams</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Core values worksheets, remote collaboration frameworks, and feedback templates.
              </p>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Kit
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}

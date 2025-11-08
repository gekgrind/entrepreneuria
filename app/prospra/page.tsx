"use client";

import React from "react";
import {
  ArrowRight,
  Brain,
  Target,
  Users,
  TrendingUp,
  MessageCircle,
  BookOpen,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/PageHeader"; // 🆕 Added import

export default function ProspraPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#4f7ca7] to-[#d27a2c] text-white overflow-hidden z-0">
      {/* 🧠 Cinematic Header Video */}
      <div className="relative -mt-[calc(var(--header-height)+1rem)]">
        <PageHeader
          title="Mentor's Mind"
          subtitle="Where Ideas Become Empires"
          videoSrc="/videos/prospra-header.mp4"
          imageSrc="/images/prospra-fallback.jpg"
          textColor="text-white"
        />
      </div>

      {/* === Hero Section (1) === */}
      <section
        data-reveal
        className="py-20 px-4 bg-white/10 backdrop-blur-sm text-center md:text-left"
      >
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div data-reveal>
            <Badge variant="secondary" className="mb-4">
              AI-Powered Startup Mentor
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold font-sans mb-6 drop-shadow-lg">
              Your Startup's Secret Weapon
            </h1>
            <p className="text-xl mb-8 text-white/90 leading-relaxed">
              Prospra is your 24/7 AI-powered entrepreneurial mentor — guiding
              you from ideation to funding to exit strategy.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Button
                size="lg"
                variant="secondary"
                className="text-lg px-8 py-3 font-semibold"
              >
                Start with Prospra <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-3 bg-transparent border-white text-white hover:bg-white hover:text-[#4f7ca7] transition-all"
              >
                Watch Demo
              </Button>
            </div>

            <div
              data-reveal
              className="flex justify-center items-center my-8 md:justify-start"
            >
              <div className="bg-white/15 backdrop-blur-md border border-white/20 px-6 py-3 rounded-lg shadow-md">
                <p className="text-white text-center font-medium drop-shadow-sm">
                  Transform Your Vision Into Reality
                </p>
              </div>
            </div>

            <div
              data-reveal
              className="flex justify-center md:justify-start mt-12"
            >
              <div className="bg-white/20 backdrop-blur-md border border-white/30 px-8 py-4 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold text-white text-center drop-shadow-md">
                  Our Flagship Products
                </h3>
              </div>
            </div>
          </div>

          <div
            data-reveal
            className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm hover:bg-white/20 transition-all shadow-lg"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Brain className="h-6 w-6 text-white" />
                <span className="font-semibold">AI Mentor Interface</span>
              </div>
              <div className="bg-white/15 p-4 rounded-lg">
                <p className="text-sm text-white/70 mb-2">You:</p>
                <p className="mb-4">
                  “I have a SaaS idea but don't know where to start.”
                </p>
                <p className="text-sm text-white/70 mb-2">Prospra:</p>
                <p>
                  “Let's break this down into actionable steps. First, let's
                  validate your idea with the Lean Startup Canvas…”
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === Features Section (2) === */}
      <section data-reveal className="py-20 px-4 bg-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <div data-reveal className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 drop-shadow-lg">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-white/90 max-w-2xl mx-auto drop-shadow-md">
              Comprehensive AI-powered tools and guidance for every stage of
              your entrepreneurial journey.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <MessageCircle className="h-8 w-8 text-white mb-2" />,
                title: "AI Mentor Chat",
                desc: "24/7 access to personalized business advice, strategic guidance, and problem-solving support.",
              },
              {
                icon: <BookOpen className="h-8 w-8 text-white mb-2" />,
                title: "Business Playbooks",
                desc: "Stage-based frameworks and templates tailored to your business model and industry.",
              },
              {
                icon: <Target className="h-8 w-8 text-white mb-2" />,
                title: "Idea Validation",
                desc: "Systematic approach to validate your business idea before investing time and money.",
              },
              {
                icon: <TrendingUp className="h-8 w-8 text-white mb-2" />,
                title: "Milestone Tracking",
                desc: "Set goals, track progress, and stay accountable with AI-powered milestone management.",
              },
            ].map((item, i) => (
              <Card key={i} data-reveal className="bg-[#f7fbff] border border-[#1a2942] text-[#1a2942] shadow-lg hover:bg-[#e6eef5] transition-all"
              >
                <CardHeader>
                  {item.icon}
                  <CardTitle className="text-xl text-[#1a2942]">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[#1a2942]">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* === Benefits Section (3) === */}
      <section data-reveal className="py-20 px-4 bg-white/10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div data-reveal>
            <h2 className="text-4xl font-bold mb-6 drop-shadow-lg">
              Why Entrepreneurs Choose Prospra
            </h2>
            <div className="space-y-6">
              {[
                {
                  title: "Expert-Level Guidance",
                  desc: "Access to strategies and insights typically reserved for high-level consultants and accelerators.",
                },
                {
                  title: "Personalized Approach",
                  desc: "AI learns your business model, industry, and goals to provide tailored recommendations.",
                },
                {
                  title: "Always Available",
                  desc: "Get answers and guidance whenever you need it, without scheduling meetings or waiting for responses.",
                },
                {
                  title: "Proven Frameworks",
                  desc: "Built on methodologies used by successful startups and validated by thousands of entrepreneurs.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  data-reveal
                  className="flex items-start gap-4 bg-white/5 p-4 rounded-xl hover:bg-white/10 transition"
                >
                  <CheckCircle className="h-6 w-6 text-[#4f7ca7] mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                    <p className="text-white/90">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            data-reveal
            className="bg-white/20 backdrop-blur-md border border-white/30 p-8 rounded-lg shadow-xl"
          >
            <h3 className="text-2xl font-bold mb-6 text-center drop-shadow-lg">
              Success Metrics
            </h3>
            <div className="grid grid-cols-2 gap-6 text-center">
              {[
                ["85%", "Faster Time to Market"],
                ["3x", "Higher Success Rate"],
                ["$2M", "Average Funding Raised"],
                ["92%", "User Satisfaction"],
              ].map(([value, label], i) => (
                <div key={i} data-reveal>
                  <div className="text-3xl font-bold mb-2 drop-shadow-md">
                    {value}
                  </div>
                  <div className="text-sm text-white/90 drop-shadow-sm">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* === Coming Soon (4) === */}
      <section data-reveal className="py-20 px-4 bg-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <div data-reveal className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 drop-shadow-lg">
              Coming Soon
            </h2>
            <p className="text-xl text-white/90 drop-shadow-md">
              Exciting new features to supercharge your entrepreneurial journey.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Users className="h-8 w-8 text-white/70 mb-2" />,
                title: "Live Community Mentorship",
                desc: "Connect with experienced entrepreneurs and mentors in real-time group sessions.",
              },
              {
                icon: <Target className="h-8 w-8 text-white/70 mb-2" />,
                title: "Expert Marketplace",
                desc: "Access to vetted specialists for legal, financial, and technical expertise.",
              },
              {
                icon: <MessageCircle className="h-8 w-8 text-white/70 mb-2" />,
                title: "Fireside Chats",
                desc: "Weekly sessions with successful founders sharing their journey and insights.",
              },
            ].map((item, i) => (
              <Card key={i} data-reveal className="bg-[#f7fbff] border-2 border-[#1a2942] text-[#1a2942] shadow-lg hover:bg-[#e6eef5] transition"
              >
                <CardHeader>
                  {item.icon}
                  <CardTitle className="text-xl text-[#1a2942]">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[#1a2942]">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* === CTA (5) === */}
      <section
        data-reveal
        className="py-20 px-4 bg-white/10 backdrop-blur-sm text-center"
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6 drop-shadow-lg">
            Ready to Unlock Your Startup's Potential?
          </h2>
          <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
            Join thousands of entrepreneurs who are already using Prospra to
            accelerate their success.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="secondary"
              className="text-lg px-8 py-3 font-semibold"
            >
              Start with Prospra <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-3 bg-transparent border-white text-white hover:bg-white hover:text-[#4f7ca7] transition-all"
            >
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import React from "react";
import {
  ArrowRight,
  Sparkles,
  Target,
  Layers,
  PenTool,
  Folder,
  CheckCircle,
  Users,
  Rocket,
  Calendar,
} from "lucide-react";

import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ArchitectaPage() {
  return (
    <main className="min-h-screen bg-[#050b14] text-white overflow-hidden">
      {/* Header Video */}
      <div className="relative -mt-[calc(var(--header-height)+1rem)]">
        <PageHeader
          title="Architecta"
          subtitle="Turn ideas into impact"
          videoSrc="/videos/architecta-header.mp4"
          textColor="text-white"
        />
      </div>

      {/* HERO */}
      <section className="py-24 px-4 text-center">
        <Badge variant="secondary" className="mb-6">
          AI Content Studio
        </Badge>

        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          Turn ideas{" "}
          <span className="text-teal-400 italic">into impact.</span>
        </h1>

        <p className="max-w-2xl mx-auto text-xl text-white/80 mb-10">
          An AI content studio built for founders and small businesses—turning
          strategy into content and content into growth.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="text-lg px-8">
            Start Creating for Free <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/30 text-white hover:bg-white hover:text-black"
          >
            See How It Works
          </Button>
        </div>
      </section>

      {/* REALITY */}
      <section className="py-24 px-4 bg-white/5">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge className="mb-4">The Reality</Badge>
            <h2 className="text-4xl font-bold mb-6">
              Marketing shouldn’t feel{" "}
              <span className="text-teal-400 italic">this hard.</span>
            </h2>

            <ul className="space-y-3 text-white/80">
              <li>Come up with ideas</li>
              <li>Write posts, emails, ads, blogs</li>
              <li>Stay consistent everywhere</li>
              <li>Still run the business somehow</li>
            </ul>
          </div>

          <div className="bg-white/10 p-8 rounded-2xl border border-white/10">
            <p className="mb-3">Most tools are built for marketers.</p>
            <p className="mb-3">Agencies are expensive.</p>
            <p className="mb-6">DIY feels overwhelming.</p>
            <p className="text-teal-400 font-semibold">
              Architecta fixes that.
            </p>
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="py-24 px-4 text-center">
        <Badge className="mb-4">The Solution</Badge>
        <h2 className="text-4xl font-bold mb-6">
          Marketing that finally{" "}
          <span className="text-teal-400 italic">fits your workflow.</span>
        </h2>

        <p className="max-w-3xl mx-auto text-white/80">
          Architecta removes the friction between having an idea and putting
          high-quality content into the world.
        </p>
      </section>

      {/* FEATURES */}
      <section className="py-24 px-4 bg-white/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">
            Everything you need to create great marketing{" "}
            <span className="text-teal-400 italic">
              without becoming a marketer.
            </span>
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <Sparkles />,
                title: "Idea Builder",
                desc: "Turn rough thoughts into clear, publishable content ideas.",
              },
              {
                icon: <Target />,
                title: "Strategy-to-Content Engine",
                desc: "Your strategy—automatically translated into content.",
              },
              {
                icon: <PenTool />,
                title: "Brand Voice Studio",
                desc: "Train Architecta to sound like you everywhere.",
              },
              {
                icon: <Layers />,
                title: "Multi-Platform Generator",
                desc: "Create once. Publish everywhere.",
              },
              {
                icon: <CheckCircle />,
                title: "Smart Editing Tools",
                desc: "Polish without rewriting. You stay in control.",
              },
              {
                icon: <Folder />,
                title: "Content Library",
                desc: "Save, remix, and reuse content that compounds.",
              },
            ].map((f, i) => (
              <Card
                key={i}
                className="bg-white/10 border-white/10 hover:bg-white/15 transition"
              >
                <CardHeader>
                  <div className="mb-3 text-teal-400">{f.icon}</div>
                  <CardTitle>{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white/80">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-4 text-center">
        <Badge className="mb-4">How It Works</Badge>
        <h2 className="text-4xl font-bold mb-16">
          From idea to impact—{" "}
          <span className="text-teal-400 italic">in minutes.</span>
        </h2>

        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              icon: <Sparkles />,
              title: "Start with an idea",
              desc: "A goal, a sentence, or a messy brain dump is enough.",
            },
            {
              step: "02",
              icon: <Target />,
              title: "Architecta builds",
              desc: "Strategy → copy → platform-ready content.",
            },
            {
              step: "03",
              icon: <PenTool />,
              title: "Edit & publish",
              desc: "Tweak, approve, and go live—on your terms.",
            },
          ].map((s, i) => (
            <Card
              key={i}
              className="bg-white/10 border-white/10 text-left"
            >
              <CardHeader>
                <div className="text-sm text-white/50 mb-2">{s.step}</div>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-teal-400">{s.icon}</span>
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/80">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="py-24 px-4 bg-white/5 text-center">
        <Badge className="mb-4">Who It’s For</Badge>
        <h2 className="text-4xl font-bold mb-16">
          Built for people who want great{" "}
          <span className="text-teal-400 italic">marketing results</span>{" "}
          without the headache.
        </h2>

        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Users />,
              title: "Solo founders",
              desc: "Consistent marketing without burnout.",
            },
            {
              icon: <Users />,
              title: "Small teams",
              desc: "Stay visible while running the business.",
            },
            {
              icon: <Rocket />,
              title: "Growing businesses",
              desc: "Scale content without scaling chaos.",
            },
          ].map((p, i) => (
            <Card
              key={i}
              className="bg-white/10 border-white/10"
            >
              <CardHeader>
                <div className="text-teal-400 mb-2">{p.icon}</div>
                <CardTitle>{p.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/80">{p.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ECOSYSTEM */}
      <section className="py-24 px-4 text-center">
        <Badge className="mb-4">Ecosystem</Badge>
        <h2 className="text-4xl font-bold mb-6">
          Part of the{" "}
          <span className="text-teal-400 italic">Entrepreneuria</span> AI Business
          Suite
        </h2>

        <p className="max-w-2xl mx-auto text-white/80 mb-12">
          Architecta works seamlessly with other Entrepreneuria tools so your
          business runs smarter—not harder.
        </p>

        <div className="flex justify-center gap-6 flex-wrap">
          <Badge className="px-6 py-3">Prospra · Live</Badge>
          <Badge className="px-6 py-3">Architecta · Live</Badge>
          <Badge className="px-6 py-3">Synceri · Coming Soon</Badge>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 bg-white/10 text-center">
        <h2 className="text-4xl font-bold mb-6">
          Create better marketing—faster.
        </h2>
        <p className="text-white/80 mb-8">
          Professional content without the agency price tag.
        </p>
        <Button size="lg" className="text-lg px-10">
          Start Free with Architecta <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </section>
    </main>
  );
}

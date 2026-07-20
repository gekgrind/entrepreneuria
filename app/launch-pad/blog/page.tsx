"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#00D4FF]/10 to-[#1a2942]/40 text-foreground">
      {/* Header Video */}
      <section className="relative -mt-[calc(var(--header-height)+1rem)]">
        <PageHeader
          title=""
          videoSrc="/videos/blog-hero.mp4"
          imageSrc="/images/blog-fallback.jpg"
          textColor="text-transparent"
        />

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
          <div className="pointer-events-auto mx-auto max-w-4xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#00D4FF]">
              THE LAUNCHPAD — THE KNOWLEDGE BLUEPRINT
            </p>

            <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
              The Knowledge Blueprint
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-lg text-white/85 md:text-xl">
              Insights, inspiration, and straight talk for founders who are
              figuring it out in real time.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#061426] px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-base leading-8 text-white/80 md:text-lg">
            This isn&apos;t a corporate content blog. No recycled listicles. No
            thought leadership from people who&apos;ve never actually built
            anything. The Knowledge Blueprint is where we share the real stuff —
            the frameworks that work, the mindsets that shift everything, the
            strategies that solo founders and early-stage entrepreneurs actually
            need. Pull up a chair. There&apos;s a lot worth reading.
          </p>
        </div>
      </section>

      <div className="mx-auto mt-10 h-px max-w-5xl bg-white/10" />

      {/* Blog Cards */}
      <section className="bg-white/10 px-6 py-20 backdrop-blur-sm">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Card className="flex flex-col justify-between border border-[var(--brand-accent)]/30 bg-white/70 transition hover:shadow-lg">
            <CardHeader>
              <Badge className="mb-2 bg-[var(--brand-accent)]/20 text-[var(--brand-accent)]">
                AI & TOOLS
              </Badge>
              <CardTitle>
                The Solopreneur Tech Stack for 2026: Every Tool You Actually
                Need to Run a One-Person Business
              </CardTitle>
              <CardDescription>Published March 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">
                There&apos;s a version of the solopreneur tech stack...
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/blog/ai-tools">
                  Read More <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between border border-[var(--brand-accent)]/30 bg-white/70 transition hover:shadow-lg">
            <CardHeader>
              <Badge className="mb-2 bg-[var(--brand-accent)]/20 text-[var(--brand-accent)]">
                Launch &amp; Operations
              </Badge>
              <CardTitle>
                Why Most Solo Founders Fail in Year One — And the Systems That
                Save the Rest
              </CardTitle>
              <CardDescription>Published March 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">
                The real reason most solo businesses stall out isn’t a lack of
                hustle. It&apos;s the lack of systems.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/blog/solo-founders-fail-year-one">
                  Read More <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between border border-[var(--brand-accent)]/30 bg-white/70 transition hover:shadow-lg">
            <CardHeader>
              <Badge className="mb-2 bg-[var(--brand-accent)]/20 text-[var(--brand-accent)]">
                Growth & Marketing
              </Badge>
              <CardTitle>
                How to Get Your First 100 Customers Without a Big Budget or a
                Big Audience
              </CardTitle>
              <CardDescription>Published March 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">
                Your first 100 customers won&apos;t come from going viral. They
                come from clarity, consistency, and doing the human work.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/blog/first-100-customers">
                  Read More <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between border border-[var(--brand-accent)]/30 bg-white/70 transition hover:shadow-lg">
            <CardHeader>
              <Badge className="mb-2 bg-[var(--brand-accent)]/20 text-[var(--brand-accent)]">
                Productivity & Operations
              </Badge>
              <CardTitle>
                How to Run the Whole Business by Yourself Without Losing Your
                Mind
              </CardTitle>
              <CardDescription>Published March 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">
                Running a one-person business isn&apos;t about doing everything.
                It&apos;s about building systems that carry the weight.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/blog/run-business-solo">
                  Read More <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between border border-[var(--brand-accent)]/30 bg-white/70 transition hover:shadow-lg">
            <CardHeader>
              <Badge className="mb-2 bg-[var(--brand-accent)]/20 text-[var(--brand-accent)]">
                Mindset & Leadership
              </Badge>
              <CardTitle>
                The Founder Mindset Shift That Changes Everything (Most People
                Miss This)
              </CardTitle>
              <CardDescription>Published March 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">
                The biggest founder shift isn&apos;t working harder. It&apos;s
                learning to build the system that builds the thing.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/blog/founder-mindset-shift">
                  Read More <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between border border-[var(--brand-accent)]/30 bg-white/70 transition hover:shadow-lg">
            <CardHeader>
              <Badge className="mb-2 bg-[var(--brand-accent)]/20 text-[var(--brand-accent)]">
                About
              </Badge>
              <CardTitle>
                What Is Entrepreneuria — And Why We Built It for the Solo
                Founder Who&apos;s Tired of Figuring It All Out Alone
              </CardTitle>
              <CardDescription>Published March 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">
                Entrepreneuria was built for the founder who&apos;s tired of
                figuring everything out alone. Here&apos;s why it exists.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/blog/what-is-entrepreneuria">
                  Read More <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

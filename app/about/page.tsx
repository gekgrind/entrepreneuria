"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ArrowRight, Target, Lightbulb, Globe, Heart, Zap, CheckCircle2, DollarSign, Sparkles } from "lucide-react"
import Link from "next/link"

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}

      <section className="relative py-20 px-4 pt-24 bg-gradient-to-r from-[#4f7ca7] to-[#d27a2c]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30">
                Our Story
              </Badge>
              <h1 className="text-5xl md:text-6xl font-bold font-sans mb-6 text-balance text-white">
                Built by Entrepreneurs, for Entrepreneurs.
              </h1>
              <p className="text-xl mb-8 text-white/90 text-pretty leading-relaxed">
                Entrepreneuria exists to remove the roadblocks founders face—giving you the tools, mentorship, and
                support you need to thrive.
              </p>

              {/* Micro-bullets */}
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-white">
                  <Sparkles className="h-5 w-5 flex-shrink-0" />
                  <span>AI-powered mentorship & admin support</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  <span>Practical resources built on proven frameworks</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <Globe className="h-5 w-5 flex-shrink-0" />
                  <span>A community of founders helping founders</span>
                </div>
              </div>

              <Button size="lg" asChild className="bg-white text-primary hover:bg-white/90">
                <Link href="/resources">
                  Explore Our Tools <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>

            <div className="relative">
              <div className="aspect-square bg-white/10 backdrop-blur-sm rounded-2xl border-2 border-white/20 flex items-center justify-center">
                <div className="text-center p-8">
                  <Globe className="h-24 w-24 text-white mx-auto mb-4" />
                  <p className="text-white/90 text-lg">Supporting entrepreneurs worldwide</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission + Vision Block */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-4 text-white">Our Mission, Vision, and Promise</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-card border-2 border-primary">
              <CardHeader>
                <Target className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-card-foreground">Mission</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  To make entrepreneurship accessible, less overwhelming, and more achievable for everyone.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary">
              <CardHeader>
                <Lightbulb className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-card-foreground">Vision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  A world where anyone with an idea can turn it into a business with the right support.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary">
              <CardHeader>
                <Zap className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-card-foreground">Approach</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Combining AI mentorship (Prospra), admin automation (Synceri), and resource libraries into one
                  ecosystem.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary">
              <CardHeader>
                <Heart className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-card-foreground">Promise</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Tools that are affordable, practical, and designed to empower—not confuse—entrepreneurs.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Founder Story Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-[#d27a2c]/10 to-[#4f7ca7]/10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold font-sans mb-4 text-white">Founder Story</h2>
          </div>

          <Card className="bg-card border-2 border-primary">
            <CardContent className="p-8">
              <div className="space-y-6 text-muted-foreground leading-relaxed">
                <p>
                  "Entrepreneuria was founded by Misti, an entrepreneur who knows the struggles of starting, funding,
                  and scaling businesses firsthand. After experiencing the challenges of entrepreneurship, she built
                  Entrepreneuria to give others the support system she wished existed."
                </p>
              </div>
              <div className="mt-8 pt-6 border-t-2 border-primary/20">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl">
                    T
                  </div>
                  <div>
                    <div className="font-semibold text-lg text-card-foreground">Misti</div>
                    <div className="text-muted-foreground">
                      Founder — Visionary Entrepreneur & Creator of Entrepreneuria
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Board of Advisors */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-4 text-white">Our Board of Advisors</h2>
            <p className="text-muted-foreground text-lg">Experienced leaders guiding our mission</p>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-8">
            {[
              { name: "Sonja Howell", initials: "SH" },
              { name: "Danny Howell", initials: "DH" },
              { name: "Jill Gordon", initials: "JG" },
              { name: "Jay Rosier", initials: "JR" },
              { name: "Mary Gonyou", initials: "MG" },
            ].map((advisor) => (
              <Card key={advisor.name} className="bg-card border-2 border-primary text-center">
                <CardContent className="p-6">
                  <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                    {advisor.initials}
                  </div>
                  <h3 className="font-semibold text-card-foreground">{advisor.name}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonials */}
      <section className="py-20 px-4 bg-gradient-to-r from-[#4f7ca7]/10 to-[#d27a2c]/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-4 text-white">What Entrepreneurs Say</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-card border-2 border-primary">
              <CardContent className="p-8">
                <p className="text-muted-foreground leading-relaxed mb-4 italic">
                  "Finally, a platform that understands entrepreneurs at every stage."
                </p>
                <p className="text-card-foreground font-semibold">— Early User</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary">
              <CardContent className="p-8">
                <p className="text-muted-foreground leading-relaxed mb-4 italic">
                  "The advisor team brings serious credibility and expertise."
                </p>
                <p className="text-card-foreground font-semibold">— Educator</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Deep Dive / Explainer Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-4 text-white">Why We Built Entrepreneuria</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Entrepreneurship is often painted as glamorous—but behind the scenes, it's long hours, uncertainty, and
              constant decisions. We built Entrepreneuria to take away the overwhelm. Whether you need advice,
              automation, or templates, you'll find it here.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <Card className="bg-card border-2 border-primary text-center">
              <CardContent className="p-8">
                <Lightbulb className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-card-foreground mb-3">Empowerment through knowledge</h3>
                <p className="text-muted-foreground">Access the insights and frameworks that drive success</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary text-center">
              <CardContent className="p-8">
                <DollarSign className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-card-foreground mb-3">Accessibility through affordability</h3>
                <p className="text-muted-foreground">World-class tools without the enterprise price tag</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary text-center">
              <CardContent className="p-8">
                <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-card-foreground mb-3">
                  Innovation through AI-first solutions
                </h3>
                <p className="text-muted-foreground">Cutting-edge technology that works for you 24/7</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-[#d27a2c]/10 to-[#4f7ca7]/10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-4 text-white">Frequently Asked Questions</h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="bg-card border-2 border-primary rounded-lg px-6">
              <AccordionTrigger className="text-card-foreground hover:text-primary">
                Who started Entrepreneuria?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Entrepreneuria was founded by Misti, an entrepreneur passionate about making startup support more
                accessible.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-card border-2 border-primary rounded-lg px-6">
              <AccordionTrigger className="text-card-foreground hover:text-primary">
                Why was Entrepreneuria created?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                To give entrepreneurs the mentorship, admin support, and resources that are usually hard to access or
                expensive.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-card border-2 border-primary rounded-lg px-6">
              <AccordionTrigger className="text-card-foreground hover:text-primary">
                Who is on the Board of Advisors?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Entrepreneuria's advisors include Advisor A,Advisor B, Advisor C, Advisor D, Advisor E.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-card border-2 border-primary rounded-lg px-6">
              <AccordionTrigger className="text-card-foreground hover:text-primary">
                Is Entrepreneuria just for startups?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                No—our tools support solopreneurs, small businesses, and educators too.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="bg-card border-2 border-primary rounded-lg px-6">
              <AccordionTrigger className="text-card-foreground hover:text-primary">
                Where is Entrepreneuria based?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Entrepreneuria is a US-based company, serving entrepreneurs globally.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-20 px-4 bg-gradient-to-r from-[#4f7ca7] to-[#d27a2c]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold font-sans mb-6 text-white">Join the Movement</h2>
          <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto text-pretty leading-relaxed">
            We're on a mission to make entrepreneurship less overwhelming and more empowering. Join us and be part of
            the next generation of founders who build smarter, not harder.
          </p>
          <Button size="lg" asChild className="bg-white text-primary hover:bg-white/90 text-lg px-8">
            <Link href="/resources">
              Explore Entrepreneuria <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>

          {/* Internal Links */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="flex flex-wrap justify-center gap-6 text-white/90">
              <Link href="/" className="hover:text-white transition-colors">
                Homepage
              </Link>
              <Link href="/prospra" className="hover:text-white transition-colors">
                Prospra
              </Link>
              <Link href="/synceri" className="hover:text-white transition-colors">
                Synceri
              </Link>
              <Link href="/resources" className="hover:text-white transition-colors">
                Resources Hub
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

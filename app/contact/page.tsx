"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Mail, Send, MessageSquare, Users, Globe, Zap, Heart, CheckCircle } from "lucide-react"

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    messageType: "Support",
    message: "",
  })

  const [errors, setErrors] = useState({
    name: false,
    email: false,
    message: false,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors = {
      name: !formData.name,
      email: !formData.email || !/\S+@\S+\.\S+/.test(formData.email),
      message: !formData.message,
    }

    setErrors(newErrors)

    if (!Object.values(newErrors).some((error) => error)) {
      console.log("Form submitted:", formData)
      alert("Thank you for your message! We'll get back to you soon.")
      setFormData({ name: "", email: "", messageType: "Support", message: "" })
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: false }))
  }

  return (
    <main className="min-h-screen">
      <section className="py-20 px-4 pt-24 bg-gradient-to-r from-[#4f7ca7] to-[#d27a2c]">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30">
            Get in Touch
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold font-sans mb-6 text-balance text-white">Let's Connect.</h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto text-pretty mb-8">
            Whether you have a question, need support, or want to explore partnerships, our team is here to help.
          </p>

          <div className="flex flex-wrap justify-center gap-6 mb-8 text-white/90">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <span>Quick support response</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>Partnerships welcome</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <span>Serving entrepreneurs worldwide</span>
            </div>
          </div>

          <Button
            size="lg"
            className="bg-white text-primary hover:bg-white/90"
            onClick={() => document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" })}
          >
            Send Us a Message →
          </Button>
        </div>
      </section>

      <section className="py-16 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-card-foreground">Why Reach Out?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-card border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-card-foreground">
                  <Zap className="h-6 w-6 text-primary" />
                  Human + AI Support
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Get fast answers powered by AI and backed by real humans.</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-card-foreground">
                  <Heart className="h-6 w-6 text-primary" />
                  Dedicated to Entrepreneurs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Every inquiry is handled with the urgency and care founders deserve.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-card-foreground">
                  <MessageSquare className="h-6 w-6 text-primary" />
                  Clear Communication
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We keep it simple, direct, and supportive—no tech jargon required.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-card-foreground">
                  <Globe className="h-6 w-6 text-primary" />
                  Multiple Channels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Contact us via form, email, or socials—whatever's easiest for you.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="contact-form" className="py-16 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="bg-card border-2 border-primary">
                <CardHeader>
                  <CardTitle className="text-card-foreground">Send a Message</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-card-foreground mb-2">
                        Your Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-4 py-2 rounded-lg bg-background border-2 border-primary/20 text-card-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Your name"
                        required
                      />
                      {errors.name && <p className="mt-1 text-sm text-red-500">Please enter your name</p>}
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-card-foreground mb-2">
                        Your Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-4 py-2 rounded-lg bg-background border-2 border-primary/20 text-card-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="your@email.com"
                        required
                      />
                      {errors.email && <p className="mt-1 text-sm text-red-500">Please enter a valid email</p>}
                    </div>

                    <div>
                      <label htmlFor="messageType" className="block text-sm font-medium text-card-foreground mb-2">
                        Message Type
                      </label>
                      <select
                        id="messageType"
                        name="messageType"
                        value={formData.messageType}
                        onChange={handleChange}
                        className="w-full px-4 py-2 rounded-lg bg-background border-2 border-primary/20 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option>Support</option>
                        <option>Product Question</option>
                        <option>Partnership</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-card-foreground mb-2">
                        Your Message
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows={6}
                        className="w-full px-4 py-2 rounded-lg bg-background border-2 border-primary/20 text-card-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        placeholder="Tell us more about your inquiry..."
                        required
                      />
                      {errors.message && <p className="mt-1 text-sm text-red-500">Please enter a message</p>}
                    </div>

                    <Button type="submit" size="lg" className="w-full bg-primary hover:bg-primary/90 text-white">
                      <Send className="mr-2 h-5 w-5" />
                      Send Message
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="bg-card border-2 border-primary">
                <CardHeader>
                  <CardTitle className="text-card-foreground flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Email
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <a href="mailto:support@entrepreneuria.io" className="text-primary hover:underline font-medium">
                    support@entrepreneuria.io
                  </a>
                  <p className="text-sm text-muted-foreground mt-2">We typically respond within 24 hours</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-2 border-primary">
                <CardHeader>
                  <CardTitle className="text-card-foreground">Connect With Us</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <span>🔗</span>
                      <span>LinkedIn</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span>🐦</span>
                      <span>Twitter/X</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span>▶️</span>
                      <span>YouTube</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-card-foreground">What Founders Say</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card className="bg-card border-2 border-primary">
              <CardContent className="pt-6">
                <p className="text-muted-foreground italic mb-4">
                  "I reached out with a product question and got a reply within 24 hours."
                </p>
                <p className="text-card-foreground font-semibold">— User</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary">
              <CardContent className="pt-6">
                <p className="text-muted-foreground italic mb-4">
                  "The team was super helpful in walking me through setup."
                </p>
                <p className="text-card-foreground font-semibold">— Founder</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <Badge variant="secondary" className="bg-card border-2 border-primary text-card-foreground">
              <Zap className="h-4 w-4 mr-2 text-primary" />
              Typical response: &lt;24 hrs
            </Badge>
            <Badge variant="secondary" className="bg-card border-2 border-primary text-card-foreground">
              <CheckCircle className="h-4 w-4 mr-2 text-primary" />
              Support backed by founder expertise
            </Badge>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-lg text-muted-foreground leading-relaxed">
            Entrepreneurship moves fast—so do we. Whether you're a founder with a burning question, an educator looking
            for resources, or a partner exploring collaboration, Entrepreneuria is only a message away.
          </p>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-card-foreground">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="bg-card border-2 border-primary rounded-lg px-6">
              <AccordionTrigger className="text-card-foreground hover:no-underline">
                How can I contact Entrepreneuria support?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Use the contact form above or email us directly at support@entrepreneuria.io.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-card border-2 border-primary rounded-lg px-6">
              <AccordionTrigger className="text-card-foreground hover:no-underline">
                What's the response time?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                We aim to respond within 24 hours on business days.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-card border-2 border-primary rounded-lg px-6">
              <AccordionTrigger className="text-card-foreground hover:no-underline">
                Can I request a demo?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes—select 'Product Question' in the contact form, and we'll follow up with demo details.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-card border-2 border-primary rounded-lg px-6">
              <AccordionTrigger className="text-card-foreground hover:no-underline">
                Do you have phone support?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Not yet—email and contact form are the fastest ways to reach us.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="bg-card border-2 border-primary rounded-lg px-6">
              <AccordionTrigger className="text-card-foreground hover:no-underline">
                Do you support international users?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes—we serve entrepreneurs worldwide.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <section className="py-20 px-4 bg-gradient-to-r from-[#4f7ca7] to-[#d27a2c] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Don't hesitate—reach out today.</h2>
          <p className="text-xl mb-8 text-white/90">
            Whether you're curious, stuck, or ready to partner, we'd love to hear from you.
          </p>
          <Button
            size="lg"
            className="bg-white text-primary hover:bg-white/90"
            onClick={() => document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" })}
          >
            Send Us a Message →
          </Button>
        </div>
      </section>

      <section className="py-12 px-4 bg-background border-t-2 border-primary/20">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link href="/" className="text-primary hover:underline font-medium">
              Homepage
            </Link>
            <Link href="/prospra" className="text-primary hover:underline font-medium">
              Prospra
            </Link>
            <Link href="/synceri" className="text-primary hover:underline font-medium">
              Synceri
            </Link>
            <Link href="/resources" className="text-primary hover:underline font-medium">
              Resources Hub
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

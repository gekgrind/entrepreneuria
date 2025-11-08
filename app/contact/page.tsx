"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Mail, Send, MessageSquare, Users, Globe, Zap, Heart, CheckCircle } from "lucide-react"
import PageHeader from "@/components/PageHeader" // 🆕 header video added

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
    if (!Object.values(newErrors).some(Boolean)) {
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
    <main className="relative min-h-screen bg-gradient-to-br from-[#4f7ca7] to-[#d27a2c] text-white overflow-hidden z-0">
      {/* 🎥 Header Video */}
      <div className="relative -mt-[calc(var(--header-height)+1rem)]">
        <PageHeader
          title="The Connection Bridge"
          subtitle="We're here to support your entrepreneurial journey."
          videoSrc="/videos/contact-header.mp4"
          imageSrc="/images/contact-fallback.jpg"
        />
      </div>

      {/* Intro Section */}
      <section className="py-20 px-4 text-center backdrop-blur-sm bg-white/10 rounded-2xl shadow-xl max-w-5xl mx-auto mt-12">
        <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30">
          Get in Touch
        </Badge>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 drop-shadow-lg">Let's Connect.</h1>
        <p className="text-xl text-white/90 max-w-2xl mx-auto mb-8 leading-relaxed">
          Whether you have a question, need support, or want to explore partnerships, our team is here to help.
        </p>

        <div className="flex flex-wrap justify-center gap-6 mb-8 text-white/90">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#d27a2c]" />
            <span>Quick support response</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#d27a2c]" />
            <span>Partnerships welcome</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-[#d27a2c]" />
            <span>Serving entrepreneurs worldwide</span>
          </div>
        </div>

        <Button
          size="lg"
          className="bg-[#d27a2c] hover:bg-[#b86824] text-white text-lg px-8"
          onClick={() => document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" })}
        >
          Send Us a Message →
        </Button>
      </section>

      {/* Why Reach Out Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 drop-shadow-md">Why Reach Out?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { icon: Zap, title: "Human + AI Support", desc: "Get fast answers powered by AI and backed by real humans." },
              { icon: Heart, title: "Dedicated to Entrepreneurs", desc: "Every inquiry is handled with care and urgency." },
              { icon: MessageSquare, title: "Clear Communication", desc: "We keep it simple and supportive—no tech jargon required." },
              { icon: Globe, title: "Multiple Channels", desc: "Reach us via form, email, or socials—your choice." },
            ].map((item, i) => (
              <Card key={i} className="bg-[#f7fbff] border border-[#1a2942] rounded-2xl p-6">
                <CardHeader className="flex flex-row items-center gap-3 mb-2">
                  <item.icon className="h-6 w-6 text-[#1a2942]" />
                  <CardTitle className="text-[#1a2942]">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[#1a2942] leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact-form" className="py-20 px-4">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <Card className="bg-white/10 border border-white/30 rounded-2xl backdrop-blur-md p-8">
              <CardHeader>
                <CardTitle className="text-white text-2xl">Send a Message</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-white/90 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-white/60 focus:ring-2 focus:ring-[#d27a2c] outline-none"
                      placeholder="Your name"
                    />
                    {errors.name && <p className="text-sm text-red-400 mt-1">Please enter your name</p>}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-white/90 mb-2">
                      Your Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-white/60 focus:ring-2 focus:ring-[#d27a2c] outline-none"
                      placeholder="your@email.com"
                    />
                    {errors.email && <p className="text-sm text-red-400 mt-1">Please enter a valid email</p>}
                  </div>

                  <div>
                    <label htmlFor="messageType" className="block text-white/90 mb-2">
                      Message Type
                    </label>
                    <select
                      id="messageType"
                      name="messageType"
                      value={formData.messageType}
                      onChange={handleChange}
                      className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white focus:ring-2 focus:ring-[#d27a2c] outline-none"
                    >
                      <option>Support</option>
                      <option>Product Question</option>
                      <option>Partnership</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-white/90 mb-2">
                      Your Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows={6}
                      className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-white/60 focus:ring-2 focus:ring-[#d27a2c] outline-none resize-none"
                      placeholder="Tell us more about your inquiry..."
                    />
                    {errors.message && <p className="text-sm text-red-400 mt-1">Please enter a message</p>}
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-[#d27a2c] hover:bg-[#b86824] text-white text-lg"
                  >
                    <Send className="mr-2 h-5 w-5" />
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            <Card className="bg-[#f7fbff] border border-[#1a2942] rounded-2xl p-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1a2942]">
                  <Mail className="h-5 w-5 text-[#1a2942]" />
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a href="mailto:support@entrepreneuria.io" className="text-[#d27a2c] hover:underline font-semibold">
                  support@entrepreneuria.io
                </a>
                <p className="text-white/70 text-sm mt-2">We typically respond within 24 hours</p>
              </CardContent>
            </Card>

            <Card className="bg-[#f7fbff] border border-[#1a2942] rounded-2xl p-6">
              <CardHeader>
                <CardTitle className="text-[#1a2942]">Connect With Us</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[#1a2942]">
                <p>🔗 LinkedIn</p>
                <p>🐦 Twitter/X</p>
                <p>▶️ YouTube</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center backdrop-blur-sm bg-white/10 rounded-2xl shadow-xl max-w-4xl mx-auto mb-20">
        <h2 className="text-4xl font-bold mb-4 drop-shadow-md">Don’t hesitate—reach out today.</h2>
        <p className="text-xl mb-8 text-white/90 leading-relaxed">
          Whether you’re curious, stuck, or ready to partner, we’d love to hear from you.
        </p>
        <Button
          size="lg"
          className="bg-[#d27a2c] hover:bg-[#b86824] text-white text-lg px-8"
          onClick={() => document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" })}
        >
          Send Us a Message →
        </Button>
      </section>
    </main>
  )
}

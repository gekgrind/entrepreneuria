"use client"

import { motion } from "framer-motion"
import ScrollReveal from "@/components/ScrollReveal"
import DockMenu from "@/components/DockMenu"
import PageHeader from "@/components/PageHeader"
import Link from "next/link"
import {
  Bot,
  Sparkles,
  Store,
  BookOpen,
  Star,
  ArrowRight,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-entrepreneuria overflow-hidden flex flex-col z-0">
      {/* 🧊 Cinematic Header Video Section */}
      <div className="relative -mt-[calc(var(--header-height)+1rem)]">
        <PageHeader
          title="City of Ideas"
          subtitle="Where Every Vision Starts"
          videoSrc="/videos/home-header.mp4"
          imageSrc="/images/home-fallback.jpg"
        />
      </div>

      <div className="pb-24">
        {/* === Hero Section === */}
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-12 sm:pt-16">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl sm:text-6xl font-bold mb-6 text-white drop-shadow-lg"
          >
            Everything Entrepreneur. All in one place.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="text-lg sm:text-xl max-w-2xl opacity-90 mb-6 text-white"
          >
            Entrepreneuria gives you the tools, AI agents, and digital
            resources you need to start, build, and scale your business with
            confidence.
          </motion.p>

          {/* Horizontal Feature Icons */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-wrap justify-center items-center text-xs sm:text-sm md:text-base text-white/90 gap-4 sm:gap-6 mb-8 leading-relaxed text-center tracking-wide"
          >
            <p className="flex items-center gap-1.5">
              <Bot size={16} className="text-white" />
              <strong className="text-white font-semibold">Prospra:</strong> AI-powered mentor
            </p>
            <span className="text-white/70 hidden sm:inline">•</span>

            <p className="flex items-center gap-1.5">
              <Sparkles size={16} className="text-white" />
              <strong className="text-white font-semibold">Synceri:</strong> AI Life-admin assistant
            </p>
            <span className="text-white/70 hidden sm:inline">•</span>

            <p className="flex items-center gap-1.5">
              <Store size={16} className="text-white" />
              <strong className="text-white font-semibold">Exchange:</strong> Digital Vault & Agentverse
            </p>
            <span className="text-white/70 hidden sm:inline">•</span>

            <p className="flex items-center gap-1.5">
              <BookOpen size={16} className="text-white" />
              <strong className="text-white font-semibold">Launch Pad:</strong> Templates & Playbooks
            </p>
          </motion.div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <a
              href="/pricing"
              className="px-8 py-3 rounded-xl bg-[#1a2942] text-white font-semibold shadow-md hover:bg-[#4f7ca7] transition duration-300"
            >
              Start Free Today
            </a>
            <a
              href="/exchange"
              className="px-8 py-3 rounded-xl border border-white/40 hover:bg-white/10 transition duration-300 text-white"
            >
              Explore the Exchange
            </a>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-sm sm:text-base text-white/80 mt-2"
          >
            Join <strong>500+ entrepreneurs</strong> already unlocking growth with Entrepreneuria’s
            AI-powered tools and Exchange.
          </motion.p>
        </div>

        {/* === Explore Ecosystem Section === */}
        <section className="relative py-24 px-6 sm:px-12 text-center bg-[#f7fbff]">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-4xl sm:text-5xl font-bold mb-14 text-[#1a2942]"
          >
            Explore Our Ecosystem
          </motion.h2>

          <div className="max-w-6xl mx-auto flex flex-col gap-8 text-[#1a2942]">
            <div className="grid sm:grid-cols-2 gap-8">
              {[
                {
                  title: "Prospra",
                  text: "Your AI-powered mentor for entrepreneurs. Get 24/7 guidance, tailored business insights, and action steps to scale smarter and faster.",
                  link: "/prospra",
                  label: "Meet Prospra →",
                },
                {
                  title: "Synceri",
                  text: "Your AI life-admin assistant. Automate tasks, manage schedules, and keep everything running smoothly behind the scenes.",
                  link: "/synceri",
                  label: "Meet Synceri →",
                },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  className="p-8 rounded-2xl bg-[#e6eef5] border-2 border-[#1a2942] shadow-md hover:shadow-lg hover:-translate-y-1 transition text-left"
                >
                  <h3 className="text-3xl font-bold mb-3">{card.title}</h3>
                  <p className="opacity-90 mb-4">{card.text}</p>
                  <a
                    href={card.link}
                    className="text-[#d27a2c] font-semibold hover:text-[#e48b3e] transition-colors"
                  >
                    {card.label}
                  </a>
                </motion.div>
              ))}
            </div>

            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  title: "The Digital Vault",
                  text: "Download curated digital products, templates, and business systems built to help you grow faster and save time.",
                  link: "/exchange/digital-vault",
                  label: "Explore the Vault →",
                },
                {
                  title: "The Agentverse",
                  text: "Shop purpose-built AI agents ready to deploy. From marketing to admin, Agentverse connects you with your next digital teammate.",
                  link: "/exchange/agentverse",
                  label: "Visit the Agentverse →",
                },
                {
                  title: "The LaunchPad",
                  text: "Explore templates, playbooks, and startup frameworks built to help founders and solopreneurs bring their ideas to life faster.",
                  link: "/launchpad",
                  label: "Visit the LaunchPad →",
                },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  className="p-8 rounded-2xl bg-[#e6eef5] border-2 border-[#1a2942] shadow-md hover:shadow-lg hover:-translate-y-1 transition text-left"
                >
                  <h3 className="text-2xl font-semibold mb-3">{card.title}</h3>
                  <p className="opacity-90 mb-4">{card.text}</p>
                  <a
                    href={card.link}
                    className="text-[#d27a2c] font-semibold hover:text-[#e48b3e] transition-colors"
                  >
                    {card.label}
                  </a>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* === Testimonials Section === */}
        <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
                Loved by entrepreneurs like you
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  text: `"Entrepreneuria helped me go from idea to launch in 30 days."`,
                  name: "— Founder, Early Beta",
                },
                {
                  text: `"The Digital Vault saved me weeks of setup time. Worth every penny."`,
                  name: "— Small Business Owner",
                },
                {
                  text: `"Having access to both AI mentorship and ready-made digital systems is a game changer."`,
                  name: "— Educator",
                },
              ].map((t, i) => (
                <Card key={i} className="bg-[#f7fbff] border-2 border-[#1a2942] text-[#1a2942]">
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className="h-5 w-5 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>
                    <p className="text-lg mb-4 italic text-[#1a2942]">{t.text}</p>
                    <p className="text-sm text-[#1a2942]">{t.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-12 text-center">
              <div className="mb-4">
                <Badge
                  variant="secondary"
                  className="text-base px-4 py-2 bg-white/20 text-white"
                >
                  Early Access Beta
                </Badge>
              </div>
              <p className="text-white/80 text-sm sm:text-base">
                <strong>Advisory Backing:</strong> Entrepreneuria is guided by
                experienced advisors and industry professionals who understand
                the startup journey inside out.
              </p>
            </div>
          </div>
        </section>

        {/* === Audience Section === */}
        <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white">
                Entrepreneuria isn't just another platform—it's your
                entrepreneurial ecosystem.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-12">
              {[
                {
                  title: "💡 Idea-Stage Founders",
                  text: "Validate faster with Prospra and launch with templates from the Digital Vault.",
                },
                {
                  title: "📈 Growth-Stage Entrepreneurs",
                  text: "Delegate admin to Synceri and scale with help from specialized AI agents in the Agentverse.",
                },
                {
                  title: "🎓 Educators & Mentors",
                  text: "Equip your students with ready-to-use tools and AI-powered resources.",
                },
              ].map((card, i) => (
                <Card
                  key={i}
                  className="bg-[#f7fbff] border-2 border-[#1a2942] text-[#1a2942] hover:border-[#1a2942]/80 transition-colors"
                >
                  <CardHeader>
                    <CardTitle className="text-xl text-[#1a2942]">
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[#1a2942]">{card.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* === FAQ Section === */}
        <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
                Got questions?
              </h2>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {[
                {
                  q: "What is Entrepreneuria?",
                  a: "Entrepreneuria is an all-in-one platform with AI mentorship, admin support, and business resources.",
                },
                {
                  q: "Who is Entrepreneuria for?",
                  a: "Entrepreneurs, small business owners, and educators who want AI-powered tools to start and scale smarter.",
                },
                {
                  q: "How does Prospra work?",
                  a: "Prospra provides tailored growth advice, strategies, and motivation.",
                },
                {
                  q: "What is Synceri?",
                  a: "Synceri automates scheduling, reminders, and repetitive tasks.",
                },
                {
                  q: "What resources are included?",
                  a: "Templates, guides, and playbooks covering planning, funding, growth, and scaling.",
                },
              ].map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="border-white/20"
                >
                  <AccordionTrigger className="text-white hover:text-white/80 text-left">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/80">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* === Final CTA Section === */}
        <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white text-balance">
              Entrepreneurship isn't a solo mission anymore.
            </h2>
            <p className="text-lg sm:text-xl mb-8 max-w-2xl mx-auto text-white/90 text-pretty">
              With AI mentors, digital systems, and your own AI team, you're
              never building alone.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" className="text-lg px-8 py-3" asChild>
                <Link href="/pricing">
                  Start Free <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-3 bg-white/10 hover:bg-white/20 text-white border-white/30"
                asChild
              >
                <Link href="#marketplaces">
                  Explore Marketplaces <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

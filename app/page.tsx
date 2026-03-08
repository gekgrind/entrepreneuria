"use client"


import { motion } from "framer-motion"
import DockMenu from "@/components/DockMenu"
import PageHeader from "@/components/PageHeader"
import Link from "next/link"
import {
  Bot,
  Sparkles,
  Store,
  BookOpen,
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
      <div className="relative -mt-[calc(var(--header-height)+1rem)]">
        <PageHeader
          title="The Operating System for Solo Founders"
          subtitle="Tools, resources, and AI-powered support to help you launch and grow with confidence."
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
            Digital tools for founders. AI apps coming soon.
          </motion.h1>


          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="text-lg sm:text-xl max-w-3xl opacity-90 mb-6 text-white"
          >
            Entrepreneuria gives solopreneurs, founders, and small business owners
            practical resources they can use today, plus early access to the next
            generation of AI-powered business tools.
          </motion.p>


          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-wrap justify-center items-center text-xs sm:text-sm md:text-base text-white/90 gap-4 sm:gap-6 mb-8 leading-relaxed text-center tracking-wide"
          >
            <p className="flex items-center gap-1.5">
              <Store size={16} className="text-white" />
              <strong className="text-white font-semibold">Available now:</strong> Founder tools on Etsy
            </p>
            <span className="text-white/70 hidden sm:inline">•</span>


            <p className="flex items-center gap-1.5">
              <BookOpen size={16} className="text-white" />
              <strong className="text-white font-semibold">Free resources:</strong> Templates & playbooks
            </p>
            <span className="text-white/70 hidden sm:inline">•</span>


            <p className="flex items-center gap-1.5">
              <Bot size={16} className="text-white" />
              <strong className="text-white font-semibold">Prospra:</strong> Coming soon
            </p>
            <span className="text-white/70 hidden sm:inline">•</span>


            <p className="flex items-center gap-1.5">
              <Sparkles size={16} className="text-white" />
              <strong className="text-white font-semibold">Architecta + Synceri:</strong> Coming soon
            </p>
          </motion.div>


          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <a
              href="https://www.etsy.com/shop/Entrepreneuria"
              target="_blank"
              rel="noreferrer"
              className="px-8 py-3 rounded-xl bg-[#1a2942] text-white font-semibold shadow-md hover:bg-[#4f7ca7] transition duration-300"
            >
              Shop Founder Tools on Etsy
            </a>
            <a
              href="/contact"
              className="px-8 py-3 rounded-xl border border-white/40 hover:bg-white/10 transition duration-300 text-white"
            >
              Join the Waitlist
            </a>
          </div>


          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-sm sm:text-base text-white/80 mt-2"
          >
            Shop digital products today and get early access to upcoming AI tools.
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
            Explore Entrepreneuria
          </motion.h2>


          <div className="max-w-6xl mx-auto flex flex-col gap-8 text-[#1a2942]">
            <div className="grid sm:grid-cols-2 gap-8">
              {[
                {
                  title: "Prospra",
                  text: "Your AI-powered business mentor designed to help founders think clearly, make faster decisions, and move forward with confidence. Coming soon.",
                  link: "/prospra",
                  label: "Learn about Prospra →",
                },
                {
                  title: "Architecta + Synceri",
                  text: "AI-powered systems for content, execution, and life admin support. These apps are in development and will be available soon.",
                  link: "/synceri",
                  label: "See what's coming →",
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
                  title: "Founder Tools",
                  text: "Digital products, templates, and business systems available now through the Entrepreneuria Etsy shop.",
                  link: "https://www.etsy.com/shop/Entrepreneuria",
                  label: "Shop on Etsy →",
                  external: true,
                },
                {
                  title: "Resources & Templates",
                  text: "Explore funding resources, growth playbooks, startup frameworks, and team-building tools already live on the site.",
                  link: "/launch-pad/resources",
                  label: "Explore Resources →",
                  external: false,
                },
                {
                  title: "Join the Waitlist",
                  text: "Be first in line for upcoming AI apps, new founder tools, launch updates, and early access opportunities.",
                  link: "/contact",
                  label: "Join the Waitlist →",
                  external: false,
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
                  {card.external ? (
                    <a
                      href={card.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#d27a2c] font-semibold hover:text-[#e48b3e] transition-colors"
                    >
                      {card.label}
                    </a>
                  ) : (
                    <a
                      href={card.link}
                      className="text-[#d27a2c] font-semibold hover:text-[#e48b3e] transition-colors"
                    >
                      {card.label}
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>


        {/* === Replace Testimonials Section === */}
        <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
                Built for real solo founders
              </h2>
              <p className="text-white/85 max-w-3xl mx-auto text-lg">
                Entrepreneuria is designed for entrepreneurs who need practical tools,
                momentum, and support without a giant team behind them.
              </p>
            </div>


            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: "Validate faster",
                  text: "Use structured tools and guided resources to move from idea to action with more confidence and less guesswork.",
                },
                {
                  title: "Build smarter",
                  text: "Access founder systems, templates, and playbooks that save time and make execution easier.",
                },
                {
                  title: "Grow with support",
                  text: "Join the waitlist for upcoming AI-powered tools built to help you plan, market, and operate more effectively.",
                },
              ].map((item, i) => (
                <Card key={i} className="bg-[#f7fbff] border-2 border-[#1a2942] text-[#1a2942]">
                  <CardHeader>
                    <CardTitle className="text-xl text-[#1a2942]">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[#1a2942]">{item.text}</p>
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
                  Launching Founder Tools Now • AI Apps Coming Soon
                </Badge>
              </div>
            </div>
          </div>
        </section>


        {/* === Audience Section === */}
        <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white">
                Built for founders who are doing a lot with a little
              </h2>
            </div>


            <div className="grid md:grid-cols-3 gap-6 mt-12">
              {[
                {
                  title: "Idea-Stage Founders",
                  text: "Get clarity, validate faster, and access practical launch tools without wasting months spinning in circles.",
                },
                {
                  title: "Growth-Focused Entrepreneurs",
                  text: "Use better systems, stronger resources, and upcoming AI support to streamline execution and unlock momentum.",
                },
                {
                  title: "Small Business Builders",
                  text: "Find founder-friendly tools, templates, and guidance designed for people building without a full in-house team.",
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
                  a: "Entrepreneuria is a founder-focused ecosystem that includes digital business tools available now, plus AI-powered apps currently in development.",
                },
                {
                  q: "What can I access right now?",
                  a: "You can explore founder resources on the site and shop Entrepreneuria digital products on Etsy right now.",
                },
                {
                  q: "Are Prospra, Architecta, and Synceri live yet?",
                  a: "Not yet. These AI-powered apps are currently in development and will launch in future phases.",
                },
                {
                  q: "What is on the Resources & Templates page?",
                  a: "You’ll find funding resources, growth playbooks, startup frameworks, team-building tools, and other practical founder support materials.",
                },
                {
                  q: "How do I get updates on new apps and features?",
                  a: "Join the waitlist through the contact page to get launch updates, early access news, and product announcements.",
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
              Build smarter now. Get early access to what’s next.
            </h2>
            <p className="text-lg sm:text-xl mb-8 max-w-2xl mx-auto text-white/90 text-pretty">
              Shop founder tools today, explore free resources, and join the waitlist
              for the AI-powered future of Entrepreneuria.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" className="text-lg px-8 py-3" asChild>
                <a
                  href="https://entrepreneuriatools.etsy.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  Shop on Etsy <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-3 bg-white/10 hover:bg-white/20 text-white border-white/30"
                asChild
              >
                <Link href="/contact">
                  Join the Waitlist <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>


        <DockMenu />
      </div>
    </main>
  )
}

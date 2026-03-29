"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DirectoriumHeroProps {
  videoSrc: string
  posterSrc?: string
}

export default function DirectoriumHero({
  videoSrc,
  posterSrc,
}: DirectoriumHeroProps) {
  return (
    <section className="relative -mt-[calc(var(--header-height)+1rem)] min-h-[72vh] md:min-h-[82vh] overflow-hidden flex items-end">
      <video
        autoPlay
        muted
        loop
        playsInline
        poster={posterSrc}
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={videoSrc} type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/30 to-[#0d1b2d]/80" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full px-4 sm:px-6 pb-14 sm:pb-20"
      >
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight text-white">
            You Don&apos;t Need More Advice.
            <br />
            You Need a Boardroom.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/90 max-w-3xl mx-auto">
            Directorium is your AI-powered Board of Directors, built to challenge
            your thinking, sharpen your strategy, and help you make better
            decisions faster.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-[#4f7ca7] hover:bg-[#3f6790] text-white"
            >
              <Link href="/waitlist">
                Enter the Boardroom <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="#how-it-works">See How It Works</Link>
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

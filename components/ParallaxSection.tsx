"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import React from "react"

interface ParallaxSectionProps {
  from?: string
  to?: string
  intensity?: number
  className?: string
  children: React.ReactNode
}

export default function ParallaxSection({
  from = "#4f7ca7",
  to = "#d27a2c",
  intensity = 100,
  className = "",
  children,
}: ParallaxSectionProps) {
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, intensity * 10], [0, -intensity])

  return (
    <motion.section
      style={{
        y,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        backgroundAttachment: "fixed",
      }}
      className={`relative overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative z-10">{children}</div>
    </motion.section>
  )
}

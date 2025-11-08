"use client"

import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

interface PageHeaderProps {
  title: string
  subtitle?: string
  videoSrc?: string
  imageSrc?: string
  menuOpen?: boolean
  textColor?: string // ✅ NEW optional prop for dynamic text color
}

export default function PageHeader({
  title,
  subtitle,
  videoSrc,
  imageSrc,
  menuOpen = false,
  textColor = "text-white", // ✅ Default to white for best contrast
}: PageHeaderProps) {
  return (
    <section className="relative w-full h-[60vh] md:h-[70vh] overflow-hidden flex items-center justify-center text-center">
      {/* 🎬 Background Video or Fallback Image */}
      {videoSrc ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={imageSrc}
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : (
        imageSrc && (
          <Image
            src={imageSrc}
            alt={title}
            fill
            priority
            className="object-cover object-center"
          />
        )
      )}

      {/* 🌈 Gradient Tint Overlay (for readability) */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-transparent"></div>

      {/* 🫧 Fade / Blur Overlay when Menu Opens */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-white/60 backdrop-blur-md z-20"
          />
        )}
      </AnimatePresence>

      {/* 📝 Title + Subtitle */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 max-w-3xl px-4"
      >
        <h1
          className={`text-4xl md:text-6xl font-bold drop-shadow-lg ${textColor}`}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={`mt-3 text-lg md:text-2xl font-medium ${
              textColor.includes("white")
                ? "text-white/90"
                : textColor.includes("black")
                ? "text-black/70"
                : textColor
            }`}
          >
            {subtitle}
          </p>
        )}
      </motion.div>
    </section>
  )
}

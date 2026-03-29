"use client"

import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"

interface PageHeaderProps {
  title: string
  subtitle?: string
  videoSrc?: string
  imageSrc?: string
  menuOpen?: boolean
  textColor?: string
  titleClassName?: string
  subtitleClassName?: string
  contentClassName?: string
  heightClassName?: string
}

export default function PageHeader({
  title,
  subtitle,
  videoSrc,
  imageSrc,
  menuOpen = false,
  textColor = "text-white",
  titleClassName,
  subtitleClassName,
  contentClassName,
  heightClassName,
}: PageHeaderProps) {
  const subtitleColorClass = textColor.includes("white")
    ? "text-white/90"
    : textColor.includes("black")
      ? "text-black/70"
      : textColor

  return (
    <section
      className={`relative w-full overflow-hidden bg-black text-center ${
        heightClassName ?? "min-h-[56vh] md:min-h-[64vh]"
      }`}
    >
      {videoSrc ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={imageSrc}
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : imageSrc ? (
        <Image
          src={imageSrc}
          alt={title}
          fill
          priority
          className="object-cover object-center"
        />
      ) : null}

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/20"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,212,255,0.14),transparent_35%)]"
      />

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 z-20 bg-white/60 backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 flex min-h-[inherit] items-start justify-center px-4 pt-28 pb-16 md:px-6 md:pt-32 md:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className={`mx-auto max-w-3xl ${contentClassName ?? ""}`}
        >
          <h1
            className={`text-4xl font-bold leading-tight drop-shadow-lg md:text-6xl ${textColor} ${
              titleClassName ?? ""
            }`}
          >
            {title}
          </h1>

          {subtitle ? (
            <p
              className={`mt-4 text-lg font-medium leading-relaxed md:text-2xl ${subtitleColorClass} ${
                subtitleClassName ?? ""
              }`}
            >
              {subtitle}
            </p>
          ) : null}
        </motion.div>
      </div>
    </section>
  )
}
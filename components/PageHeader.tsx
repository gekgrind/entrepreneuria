"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title?: string
  subtitle?: string
  videoSrc?: string
  imageSrc?: string
  textColor?: string
  titleClassName?: string
  subtitleClassName?: string
  contentClassName?: string
  heightClassName?: string
  children?: React.ReactNode
}

export default function PageHeader({
  title,
  subtitle,
  videoSrc,
  imageSrc,
  textColor = "text-white",
  titleClassName,
  subtitleClassName,
  contentClassName,
  heightClassName,
  children,
}: PageHeaderProps) {
  const hasVideo = Boolean(videoSrc)

  return (
    <section
      className={cn(
        "relative w-full overflow-hidden bg-black",
        heightClassName ?? "min-h-[70svh] md:min-h-[78svh]"
      )}
    >
      <div className="absolute inset-0">
        {hasVideo ? (
          <video
            key={videoSrc}
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            fill
            priority
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-black" />
        )}
      </div>

      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.25),rgba(0,0,0,0.45))]" />

      {(title || subtitle || children) && (
        <div className="relative z-10 flex min-h-[70svh] items-center justify-center px-4 py-24 md:min-h-[78svh]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className={cn("mx-auto w-full max-w-5xl text-center", contentClassName)}
          >
            {children ? (
              children
            ) : (
              <>
                {title ? (
                  <h1
                    className={cn(
                      "text-4xl font-semibold leading-tight md:text-6xl",
                      textColor,
                      titleClassName
                    )}
                  >
                    {title}
                  </h1>
                ) : null}

                {subtitle ? (
                  <p
                    className={cn(
                      "mx-auto mt-6 max-w-3xl text-base md:text-lg",
                      textColor === "text-white" ? "text-white/85" : textColor,
                      subtitleClassName
                    )}
                  >
                    {subtitle}
                  </p>
                ) : null}
              </>
            )}
          </motion.div>
        </div>
      )}
    </section>
  )
}
"use client"

import { useEffect, useRef, useState } from "react"
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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)

  const hasVideo = Boolean(videoSrc) && !videoFailed
  const resolvedHeightClass = heightClassName ?? "min-h-[70svh] md:min-h-[78svh]"

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc) return

    let cancelled = false

    const attemptPlay = async () => {
      try {
        video.muted = true
        video.defaultMuted = true
        video.playsInline = true
        video.setAttribute("muted", "")
        video.setAttribute("playsinline", "")
        video.setAttribute("webkit-playsinline", "")
        video.setAttribute("autoplay", "")

        const playPromise = video.play()
        if (playPromise !== undefined) {
          await playPromise
        }
      } catch {
        if (!cancelled) {
          setVideoFailed(true)
        }
      }
    }

    attemptPlay()

    return () => {
      cancelled = true
    }
  }, [videoSrc])

  return (
    <section
      className={cn("relative w-full overflow-hidden bg-black", resolvedHeightClass)}
    >
      <div className="absolute inset-0">
        {hasVideo ? (
          <video
            ref={videoRef}
            key={videoSrc}
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={imageSrc}
            aria-hidden="true"
            disablePictureInPicture
            controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
            onError={() => setVideoFailed(true)}
            onLoadedMetadata={() => {
              const video = videoRef.current
              if (!video) return

      // Force mute for iOS autoplay
              video.muted = true

              const playPromise = video.play()
              if (playPromise !== undefined) {
                playPromise.catch(() => setVideoFailed(true))
              }
            }}
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
        <div
          className={cn(
            "relative z-10 flex items-center justify-center px-4 py-24",
            resolvedHeightClass
          )}
        >
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
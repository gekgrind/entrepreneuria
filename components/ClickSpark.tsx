"use client"
import { useEffect } from "react"

export const ClickSpark = ({
  sparkColor = ["#ffffff", "#d27a2c", "#4f7ca7"],
  sparkSize = 18,
  sparkRadius = 40,
  sparkCount = 16,
  duration = 1100,
}: {
  sparkColor?: string[]
  sparkSize?: number
  sparkRadius?: number
  sparkCount?: number
  duration?: number
}) => {
  useEffect(() => {
    if (typeof window === "undefined") {
      console.log("❌ ClickSpark: window undefined (server-side render)")
      return
    }
    console.log("✅ ClickSpark initialized")
    const handleClick = (e: MouseEvent) => {
      console.log("✨ Click detected at:", e.clientX, e.clientY)
      const container = document.createElement("div")
      container.style.position = "fixed"
      container.style.left = "0"
      container.style.top = "0"
      container.style.pointerEvents = "none"
      container.style.zIndex = "999999"
      document.body.appendChild(container)
      for (let i = 0; i < sparkCount; i++) {
        const angle = Math.random() * Math.PI * 2
        const distance = Math.random() * sparkRadius + 10
        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance
        const spark = document.createElement("span")
        spark.style.position = "fixed"
        spark.style.left = `${e.clientX}px`
        spark.style.top = `${e.clientY}px`
        spark.style.width = `${sparkSize}px`
        spark.style.height = `${sparkSize}px`
        spark.style.borderRadius = "50%"
        spark.style.background = sparkColor[i % sparkColor.length]
        spark.style.opacity = "1"
        spark.style.filter = "blur(1px)"
        spark.style.mixBlendMode = "screen"
        spark.style.boxShadow = "0 0 15px rgba(255,255,255,0.8)"
        spark.style.transition = `
          transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity ${duration}ms ease-out
        `
        spark.style.transform = "translate(0, 0) scale(1)"
        container.appendChild(spark)
        requestAnimationFrame(() => {
          spark.style.transform = `translate(${x}px, ${y - 30}px) scale(0.5)`
          spark.style.opacity = "0"
        })
      }
      setTimeout(() => {
        console.log("🧹 Removing spark container")
        container.remove()
      }, duration + 100)
    }
    const timeout = setTimeout(() => {
      console.log("🪄 Adding event listener")
      window.addEventListener("click", handleClick, { passive: true })
    }, 500)
    return () => {
      console.log("🧼 Cleaning up ClickSpark")
      clearTimeout(timeout)
      window.removeEventListener("click", handleClick)
    }
  }, [sparkColor, sparkSize, sparkRadius, sparkCount, duration])
  return null
}
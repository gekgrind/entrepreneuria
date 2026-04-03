"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AccentItalicProps {
  children: ReactNode
  className?: string
  color?: string
}

export default function AccentItalic({
  children,
  className,
  color = "#00D4FF",
}: AccentItalicProps) {
  return (
    <span
      className={cn(className)}
      style={{
        fontFamily: "'Playfair Display', serif",
        fontStyle: "italic",
        color: color,
      }}
    >
      {children}
    </span>
  )
}
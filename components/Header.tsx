"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils" // remove if you don’t have a cn() utility — it just merges classes

const navItems = [
  { label: "Home", href: "/" },
  { label: "Prospra", href: "/prospra" },
  { label: "Synceri", href: "/synceri" },
  { label: "Marketplaces", href: "/exchange/digital-vault" },
  { label: "Resources", href: "/resources" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
]

export default function Header() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn(
        "fixed top-4 left-1/2 z-50 -translate-x-1/2 transition-all duration-500 ease-in-out",
        scrolled ? "scale-95 opacity-95 backdrop-blur-md" : "scale-100 opacity-100"
      )}
    >
      <nav
        className="
          flex items-center gap-2 sm:gap-4 px-6 sm:px-8 py-3
          rounded-full shadow-lg border border-white/20
          backdrop-blur-xl bg-white/10
          text-white text-sm sm:text-base
          relative overflow-hidden
        "
      >
        {/* Subtle animated background shimmer */}
        <motion.div
          className="absolute inset-0 opacity-40"
          style={{
            background: "linear-gradient(90deg, #d27a2c, #4f7ca7, #d27a2c)",
            backgroundSize: "200% 200%",
          }}
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{
            duration: 8,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />

        {/* Nav Links */}
        {navItems.map(({ label, href }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="relative px-3 py-1.5 rounded-full transition group"
            >
              {active && (
                <motion.span
                  layoutId="pill-highlight"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-[#4f7ca7] to-[#d27a2c] opacity-70"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span
                className={cn(
                  "relative z-10 font-medium transition",
                  active ? "text-white" : "text-white/90 group-hover:text-white"
                )}
              >
                {label}
              </span>

              {/* hover shimmer overlay */}
              <motion.span
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(212,122,44,0.25), rgba(79,124,167,0.25))",
                }}
                transition={{ duration: 0.3 }}
              />
            </Link>
          )
        })}
      </nav>
    </motion.header>
  )
}

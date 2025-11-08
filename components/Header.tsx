"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import CardNav from "@/components/CardNav";
import Logo from "/public/entrepreneuria-logo.png";

export default function Header({
  onMenuToggle,
}: {
  onMenuToggle?: (isOpen: boolean) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (onMenuToggle) onMenuToggle(menuOpen);
  }, [menuOpen, onMenuToggle]);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn(
        "fixed top-0 left-0 w-full z-50 transition-all duration-500 ease-in-out backdrop-blur-md",
        scrolled || menuOpen
          ? "bg-[var(--brand-navy)]/80 shadow-lg"
          : "bg-transparent"
      )}
    >
      {/* ✨ Animated accent gradient bar */}
      <motion.div
        className="absolute top-0 left-0 w-full h-[3px] opacity-70"
        style={{
          background:
            "linear-gradient(90deg, var(--brand-blue), var(--brand-orange), var(--brand-blue))",
          backgroundSize: "200% 200%",
        }}
        animate={{
          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        }}
        transition={{
          duration: 12,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />

      <div className="relative flex items-center justify-between px-6 sm:px-12 py-4">
        {/* 🌐 Logo + Text */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: menuOpen ? 0.3 : 1,
            scale: scrolled ? 0.95 : 1,
          }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3"
        >
          <Image
            src={Logo}
            alt="Entrepreneuria Logo"
            width={48}
            height={48}
            className="rounded-full drop-shadow-md"
          />
          <span className="text-white font-semibold text-xl tracking-wide hidden sm:block">
            Entrepreneuria
          </span>
        </motion.div>

        {/* 🍔 Hamburger Menu */}
        <button
          aria-label="Toggle Menu"
          onClick={toggleMenu}
          className="text-white focus:outline-none ml-4 sm:ml-8"
        >
          <motion.div
            animate={{ rotate: menuOpen ? 45 : 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-1.5"
          >
            <span className="block w-6 h-0.5 bg-white rounded" />
            <span
              className={cn(
                "block w-6 h-0.5 bg-white rounded transition-all",
                menuOpen ? "opacity-0" : "opacity-100"
              )}
            />
            <span
              className={cn(
                "block w-6 h-0.5 bg-white rounded transition-all",
                menuOpen ? "-rotate-90 -translate-y-2" : ""
              )}
            />
          </motion.div>
        </button>
      </div>

      {/* 🧭 Animated Card Menu */}
      <AnimatePresence>
        {menuOpen && <CardNav key="cardnav" onClose={closeMenu} />}
      </AnimatePresence>
    </motion.header>
  );
}

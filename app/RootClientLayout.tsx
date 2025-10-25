"use client";

import React, { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/footer";
import { ClickSpark } from "@/components/ClickSpark";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

// 🌪️ Fixed Vortex overlay animation (auto-unmounts)
function VortexTransition() {
  const pathname = usePathname();
  const [animating, setAnimating] = useState(false);
  const [key, setKey] = useState(0);
  const prev = useRef(pathname);

  useEffect(() => {
    if (prev.current !== pathname) {
      prev.current = pathname;
      setAnimating(true);
      setKey((k) => k + 1);

      // unmount the overlay after animation finishes
      const timeout = setTimeout(() => setAnimating(false), 700);
      return () => clearTimeout(timeout);
    }
  }, [pathname]);

  if (!animating) return null; // ✅ Nothing renders when not transitioning

  return (
    <motion.div
      key={key}
      className="pointer-events-none fixed inset-0 z-[60]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* inner scale+blur */}
      <motion.div
        initial={{ scale: 1, filter: "blur(0px)" }}
        animate={{ scale: 0.8, filter: "blur(6px)" }}
        transition={{ duration: 0.25 }}
        className="pointer-events-none fixed inset-0"
      />

      {/* vortex spin effect */}
      <motion.div
        initial={{ scale: 0.9, rotate: 0, opacity: 0.5 }}
        animate={{ scale: 1.1, rotate: 180, opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="pointer-events-none fixed inset-0"
        style={{
          WebkitMaskImage:
            "radial-gradient(circle at center, transparent 22%, black 23%)",
          maskImage:
            "radial-gradient(circle at center, transparent 22%, black 23%)",
          background:
            "conic-gradient(from 0deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 30%, rgba(255,255,255,0.22) 60%, rgba(255,255,255,0) 90%)",
        }}
      />
    </motion.div>
  );
}


// 🌈 ScrollReveal – smooth fade-in with auto-stagger
function ScrollReveal({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const childrenEls = Array.from(
      el.querySelectorAll<HTMLElement>("[data-reveal]")
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const index = childrenEls.indexOf(target);
            const delay = index * 100; // 100ms stagger per element
            target.style.transitionDelay = `${delay}ms`;
            target.classList.add("reveal-visible");
            observer.unobserve(target);
          }
        });
      },
      { threshold: 0.15 }
    );

    childrenEls.forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef}>{children}</div>;
}

// 🧠 RootClientLayout (header, footer, click spark, scroll reveal, vortex)
export default function RootClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* ✨ Global ClickSpark effect */}
      <ClickSpark />

      {/* 🌐 Persistent Header */}
      <Header />

      {/* 🌪️ Vortex transition overlay */}
      <VortexTransition />

      {/* 🧩 Animated Page Transition + ScrollReveal */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="min-h-[70vh] scroll-reveal-wrapper"
        >
          <ScrollReveal>{children}</ScrollReveal>
        </motion.main>
      </AnimatePresence>

      {/* 🔻 Persistent Footer */}
      <Footer />
    </>
  );
}

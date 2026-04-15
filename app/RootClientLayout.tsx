"use client";

import React, { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/footer";
import { ClickSpark } from "@/components/ClickSpark";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const AUTHENTICATED_ROUTES = ["/dashboard", "/account", "/settings"];

function isAuthenticatedRoute(pathname: string) {
  return AUTHENTICATED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

// Fixed Vortex overlay animation
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

      const timeout = setTimeout(() => setAnimating(false), 700);
      return () => clearTimeout(timeout);
    }
  }, [pathname]);

  if (!animating) return null;

  return (
    <motion.div
      key={key}
      className="pointer-events-none fixed inset-0 z-[60]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        initial={{ scale: 1, filter: "blur(0px)" }}
        animate={{ scale: 0.8, filter: "blur(6px)" }}
        transition={{ duration: 0.25 }}
        className="pointer-events-none fixed inset-0"
      />

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

// ScrollReveal
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
            const delay = index * 100;
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

export default function RootClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAuthenticatedShellRoute = pathname.startsWith("/account") || pathname.startsWith("/settings");

  const authenticatedRoute = isAuthenticatedRoute(pathname);

  useEffect(() => {
    let lastScrollY = 0;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const newHeight = scrollY > 50 ? 52 : 64;

      document.documentElement.style.setProperty(
        "--header-height",
        `${newHeight}px`
      );

      if (scrollY < lastScrollY && scrollY < 100) {
        document.documentElement.style.setProperty("--header-height", "64px");
      }

      lastScrollY = scrollY;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);


  if (isAuthenticatedShellRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <ClickSpark />

      <Header onMenuToggle={setMenuOpen} />

      <VortexTransition />

      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={`min-h-[70vh] scroll-reveal-wrapper transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
            menuOpen
              ? "pt-[calc(var(--header-height)+140px)]"
              : "pt-[calc(var(--header-height)+20px)]"
          }`}
        >
          <ScrollReveal>{children}</ScrollReveal>
        </motion.main>
      </AnimatePresence>

      <Footer />
    </>
  );
}
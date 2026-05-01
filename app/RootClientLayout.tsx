"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/footer";
import { ClickSpark } from "@/components/ClickSpark";
import UserMenu from "@/components/UserMenu";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const APP_SHELL_ROUTES = ["/dashboard", "/account", "/settings"];
const COMMAND_CENTER_ROUTES = ["/command-center"];
const AUTH_SHELL_ROUTES = [
  "/login",
  "/signup",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth",
];

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function AppCommandBar() {
  return (
    <div className="fixed left-0 top-0 z-50 w-full border-b border-cyan-300/10 bg-[#020b1f]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between px-6">
        <Link href="/command-center" className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(0,212,255,0.75)]" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Entrepreneuria
            </p>
            <p className="text-xs text-white/55">Command Center</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/75 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-white"
          >
            Dashboard
          </Link>

          <Link
            href="/account"
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/75 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-white"
          >
            Account
          </Link>

          <UserMenu />
        </div>
      </div>
    </div>
  );
}

function VortexTransition() {
  const pathname = usePathname();
  const [animating, setAnimating] = useState(false);
  const [key, setKey] = useState(0);
  const prev = useRef(pathname);

  useEffect(() => {
    if (prev.current !== pathname) {
      prev.current = pathname;

      const animationFrame = window.requestAnimationFrame(() => {
        setAnimating(true);
        setKey((k) => k + 1);
      });

      const timeout = setTimeout(() => setAnimating(false), 700);

      return () => {
        window.cancelAnimationFrame(animationFrame);
        clearTimeout(timeout);
      };
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

function ScrollReveal({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const childrenEls = Array.from(
      el.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const target = entry.target as HTMLElement;
          const index = childrenEls.indexOf(target);
          target.style.transitionDelay = `${index * 100}ms`;
          target.classList.add("reveal-visible");
          observer.unobserve(target);
        });
      },
      { threshold: 0.15 },
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

  const isAppShellRoute = matchesRoute(pathname, APP_SHELL_ROUTES);
  const isCommandCenterRoute = matchesRoute(pathname, COMMAND_CENTER_ROUTES);
  const isAuthShellRoute = matchesRoute(pathname, AUTH_SHELL_ROUTES);

  useEffect(() => {
    let lastScrollY = 0;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const newHeight = scrollY > 50 ? 52 : 64;

      document.documentElement.style.setProperty(
        "--header-height",
        `${newHeight}px`,
      );

      if (scrollY < lastScrollY && scrollY < 100) {
        document.documentElement.style.setProperty("--header-height", "64px");
      }

      lastScrollY = scrollY;
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  if (isCommandCenterRoute) {
    return (
      <>
        <AppCommandBar />
        <div className="pt-16">{children}</div>
      </>
    );
  }

  if (isAppShellRoute || isAuthShellRoute) {
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
          className={`relative min-h-[70vh] overflow-hidden scroll-reveal-wrapper transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)]
          ${
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

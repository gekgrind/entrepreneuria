"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/footer";
import { ClickSpark } from "@/components/ClickSpark";
import { CustomCursor } from "@/components/CustomCursor";
import UserMenu from "@/components/UserMenu";
import RouteTransition from "@/components/transition/RouteTransition";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

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
    <div className="sticky top-0 z-50 w-full border-b border-cyan-300/10 bg-[#020b1f]/88 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 max-w-[1800px] flex-wrap items-center gap-4 px-5 py-4 sm:px-8 lg:flex-nowrap">
        <Link
          href="/command-center"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020b1f]"
          aria-label="Entrepreneuria Command Center"
        >
          <Image
            src="/entrepreneuria-logo-nav.png"
            alt=""
            width={44}
            height={44}
            className="h-11 w-14 shrink-0 object-contain drop-shadow-[0_0_18px_rgba(0,212,255,0.28)]"
            priority
          />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200 sm:text-base">
              Entrepreneuria
            </p>
            <p className="text-xs text-white/55">Command Center</p>
          </div>
        </Link>

        <div className="order-3 w-full lg:order-none lg:w-auto lg:flex-[1.4]">
          <label htmlFor="command-center-search" className="sr-only">
            Search apps, tools, insights
          </label>
          <div className="relative mx-auto max-w-2xl">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/70"
              aria-hidden="true"
            />
            <input
              id="command-center-search"
              type="search"
              aria-label="Search apps, tools, insights"
              placeholder="Search apps, tools, insights..."
              className="h-11 w-full rounded-full border border-cyan-300/15 bg-white/[0.055] pl-11 pr-4 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.18)] outline-none transition placeholder:text-slate-400 focus:border-cyan-300/45 focus:bg-cyan-300/[0.08] focus:ring-2 focus:ring-cyan-300/25"
            />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end">
          <UserMenu />
        </div>
      </div>
    </div>
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
      <RouteTransition>
        <AppCommandBar />
        {children}
      </RouteTransition>
    );
  }

  if (isAppShellRoute || isAuthShellRoute) {
    return <RouteTransition>{children}</RouteTransition>;
  }

  return (
    <RouteTransition>
      <CustomCursor />
      <ClickSpark />

      <Header onMenuToggle={setMenuOpen} />

      {/* The element itself persists across routes so the transition has a
          stable target; ScrollReveal is keyed so its observer re-attaches to
          each incoming page's [data-reveal] nodes. Only padding transitions
          here — opacity and transform belong to the GSAP timeline. */}
      <main
        data-route-content
        className={`relative min-h-[70vh] overflow-x-clip scroll-reveal-wrapper transition-[padding-top] duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)]
        ${
          menuOpen
            ? "pt-[calc(var(--header-height)+140px)]"
            : "pt-[calc(var(--header-height)+20px)]"
        }`}
      >
        <ScrollReveal key={pathname}>{children}</ScrollReveal>
      </main>

      <Footer />
    </RouteTransition>
  );
}

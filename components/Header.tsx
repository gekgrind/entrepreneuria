"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

type NavGroup = {
  label: string;
  href?: string;
  items?: { label: string; href: string }[];
};

const navGroups: NavGroup[] = [
  { label: "Home", href: "/" },
  {
    label: "AI Apps",
    items: [
      { label: "Prospra", href: "/prospra" },
      { label: "Architecta", href: "/architecta" },
      { label: "Directorium", href: "/directorium" }, // 👈 ADDED
      { label: "Synceri", href: "/synceri" },
      { label: "Join Waitlist", href: "/waitlist" },
    ],
  },
  {
    label: "Launchpad",
    items: [
      { label: "Tools", href: "/launch-pad/tools" },       // 👈 MOVED TO TOP
      { label: "Resources", href: "/launch-pad/resources" },
      { label: "Blog", href: "/launch-pad/blog" },
    ],
  },
  {
    label: "The Exchange",
    items: [
      { label: "Digital Vault", href: "/exchange/digital-vault" },
      { label: "Agentverse", href: "/exchange/agentverse" },
    ],
  },
  {
    label: "About",
    items: [
      { label: "About Entrepreneuria", href: "/about" },
      { label: "Pricing", href: "/pricing" },
      { label: "Contact", href: "/contact" },
      { label: "Waitlist", href: "/waitlist" },
    ],
  },
];

export default function Header({
  onMenuToggle,
}: {
  onMenuToggle?: (isOpen: boolean) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDesktop, setActiveDesktop] = useState<string | null>(null);
  const [activeMobile, setActiveMobile] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    onMenuToggle?.(mobileOpen);
  }, [mobileOpen, onMenuToggle]);

  return (
    <motion.header
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn(
        "fixed left-0 top-0 z-50 w-full border-b border-white/10 transition-all duration-300",
        scrolled || mobileOpen
          ? "bg-[var(--brand-navy)]/85 backdrop-blur-xl"
          : "bg-[var(--brand-navy)]/55 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-[76px] w-full max-w-7xl items-center justify-between px-6 py-4 sm:px-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: mobileOpen ? 0.3 : 1,
            scale: scrolled ? 0.95 : 1,
          }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3"
        >
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/entrepreneuria-logo.png"
              alt="Entrepreneuria Logo"
              width={70}
              height={70}
              className="rounded-full drop-shadow-md"
            />
            <div className="hidden -translate-y-2 flex-col -space-y-0.5 sm:flex">
              <span className="font-heading text-xl font-semibold leading-none tracking-wide text-white">
                Entrepreneuria
              </span>
              <span className="font-heading text-xs font-medium leading-none tracking-[0.18em] text-[var(--brand-accent)]">
                Build. Launch. Grow.
              </span>
            </div>
          </Link>
        </motion.div>

        <nav className="hidden items-center gap-2 lg:flex">
          {navGroups.map((group) => {
            if (!group.items) {
              return (
                <Link
                  key={group.label}
                  href={group.href ?? "/"}
                  className="rounded-full px-4 py-2 text-sm font-medium text-white/95 transition hover:bg-white/10"
                >
                  {group.label}
                </Link>
              );
            }

            const open = activeDesktop === group.label;

            return (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => setActiveDesktop(group.label)}
                onMouseLeave={() => setActiveDesktop(null)}
              >
                <button
                  type="button"
                  onClick={() => setActiveDesktop(open ? null : group.label)}
                  className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-white/95 transition hover:bg-white/10"
                  aria-expanded={open}
                >
                  {group.label}
                  <ChevronDown
                    className={cn("h-4 w-4 transition", open && "rotate-180")}
                  />
                </button>

                <AnimatePresence>
                  {open ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/20 bg-[var(--brand-navy)]/95 p-2 shadow-2xl"
                    >
                      {group.items.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="block rounded-xl px-3 py-2 text-sm text-white/95 transition hover:bg-white/10"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white lg:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "calc(100dvh - 76px)" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="overflow-y-auto border-t border-white/10 bg-[var(--brand-navy)]/95 px-6 py-5 lg:hidden"
          >
            <div className="mx-auto max-w-2xl space-y-2 pb-8">
              {navGroups.map((group) => {
                if (!group.items) {
                  return (
                    <Link
                      key={group.label}
                      href={group.href ?? "/"}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-xl border border-white/15 bg-white/5 px-4 py-4 text-base text-white"
                    >
                      {group.label}
                    </Link>
                  );
                }

                const open = activeMobile === group.label;

                return (
                  <div
                    key={group.label}
                    className="rounded-xl border border-white/15 bg-white/5"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveMobile(open ? null : group.label)}
                      className="flex w-full items-center justify-between px-4 py-4 text-left text-base text-white"
                      aria-expanded={open}
                    >
                      {group.label}
                      <ChevronDown
                        className={cn("h-5 w-5 transition", open && "rotate-180")}
                      />
                    </button>

                    <AnimatePresence>
                      {open ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-white/10"
                        >
                          {group.items.map((item) => (
                            <Link
                              key={item.label}
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                              className="block px-4 py-3 text-sm text-white/90"
                            >
                              {item.label}
                            </Link>
                          ))}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
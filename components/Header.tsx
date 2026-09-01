"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";

import Link from "@/components/transition/TransitionLink";
import UserMenu from "@/components/UserMenu";
import { UserAvatar } from "@/components/auth/user-avatar";
import { useUser } from "@/components/auth/AuthProvider";
import {
  PRODUCTS,
  PRODUCT_STATUS_LABELS,
  isLitStatus,
} from "@/lib/ecosystem/products";
import { getPrimaryCta } from "@/lib/launch";
import { cn } from "@/lib/utils";

/**
 * Site header — a translucent layer of the page, not a bar over it.
 *
 * Information architecture (labels are plain; destinations are canonical):
 *   Products   ecosystem registry dropdown (statuses come from the registry)
 *   Resources  Launch Pad / Exchange material
 *   Community  /launch-pad/community (The Founder's Table)
 *   About      /about
 *   Pricing    /pricing
 *   Action     ONE entry: authenticated → Dashboard (+avatar);
 *              anonymous → the launch-state primary CTA (lib/launch).
 *
 * Scroll visibility (passive listener, refs do the math, React only
 * re-renders when the classification actually flips):
 *   near top (> -96px)            always visible
 *   intentional downward journey  recedes upward after 12px accumulated
 *   intentional upward scroll     reveals after 56px accumulated upward
 *   near page bottom              always visible (journey resolution)
 *   mobile menu open              visibility pinned until closed
 * Direction accumulators reset on every reversal, so tiny trackpad/wheel
 * noise never flickers the header.
 *
 * CINEMATIC MODE (the landing experience): the header is earned, never
 * given. The opening hero owns the full viewport — no logo, no links, no
 * bar, no flash of any of them on load, hydration, refresh, or route
 * transition. Explicit states:
 *   AT_TOP          hidden — the very top of the page
 *   SCROLLING_DOWN  hidden — the initial descent keeps the stage clean
 *   hero zone       hidden — a few pixels from the top reveals nothing
 *   SCROLLING_UP    visible — once the visitor has progressed into the
 *                   page and meaningfully scrolls back up
 *   AT_BOTTOM       visible — navigation is available at the close
 * The first painted frame is resolved in a layout effect (SSR starts
 * hidden, so there is nothing to flash), and the reveal animates from
 * above the viewport with the same translucent treatment.
 */

const TOP_ZONE_PX = 96;
const HIDE_MIN_SCROLL_Y = 160;
const DOWN_INTENT_PX = 12;
const UP_INTENT_PX = 56;
/** Cinematic state machine thresholds */
const CINEMATIC_TOP_PX = 8;

const heroThresholdPx = () =>
  Math.max(360, Math.round(window.innerHeight * 0.6));

/* SSR-safe layout effect (no server warning, runs pre-paint on client) */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type NavLeaf = { label: string; href: string; external?: boolean };

const RESOURCE_LINKS: NavLeaf[] = [
  { label: "The Launch Pad", href: "/launch-pad" },
  { label: "Free AI Tools", href: "/launch-pad/tools" },
  { label: "Resources & Templates", href: "/launch-pad/resources" },
  { label: "Blog", href: "/launch-pad/blog" },
  { label: "The Exchange", href: "/exchange" },
];

const productLinks: (NavLeaf & { status: string; lit: boolean })[] =
  PRODUCTS.map((p) => ({
    label: p.name,
    href: p.link.href,
    external: p.link.kind === "external",
    status:
      p.tier === "standalone"
        ? "From Entrepreneuria"
        : PRODUCT_STATUS_LABELS[p.status],
    lit: p.tier !== "standalone" && isLitStatus(p.status),
  }));

const ACCOUNT_HREF = "/dashboard";

/* ------------------------------------------------------------------ */
/* Quiet typographic link treatment — words with a reveal line, never  */
/* pills.                                                               */
/* ------------------------------------------------------------------ */

const navItemClass =
  "group relative px-3 py-2 text-sm font-medium text-white/70 transition-colors duration-300 hover:text-white focus-visible:outline-none focus-visible:text-white";

const underlineClass =
  "pointer-events-none absolute inset-x-3 bottom-0.5 h-px origin-left scale-x-0 bg-intelligence transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none";

const ctaClass =
  "group relative ml-1 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-human transition-[filter] duration-300 hover:brightness-125 focus-visible:outline-none focus-visible:brightness-125 motion-reduce:transition-none";

const ctaUnderlineClass =
  "pointer-events-none absolute inset-x-3 bottom-0.5 h-px origin-left scale-x-0 bg-human transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none";

function StatusNote({ status, lit }: { status: string; lit: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        className={
          lit
            ? "h-1 w-1 rounded-full bg-intelligence shadow-[0_0_6px_rgba(0,212,255,0.8)]"
            : "h-1 w-1 rounded-full border border-white/35"
        }
      />
      <span className="type-label text-white/40">{status}</span>
    </span>
  );
}

export default function Header({
  onMenuToggle,
  cinematic = false,
}: {
  onMenuToggle?: (isOpen: boolean) => void;
  cinematic?: boolean;
}) {
  const { user: authUser, loading: authLoading } = useUser();
  const cta = getPrimaryCta();

  /* cinematic landings start HIDDEN — in SSR HTML and hydration alike,
     so the hero never flashes the header before the layout effect */
  const [visible, setVisible] = useState(() => !cinematic);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<"products" | "resources" | null>(
    null,
  );
  const [mobileSection, setMobileSection] = useState<
    "products" | "resources" | null
  >(null);

  const visibleRef = useRef(!cinematic);
  const menuOpenRef = useRef(false);

  const setHeaderVisible = useCallback((next: boolean) => {
    if (visibleRef.current === next) return;
    visibleRef.current = next;
    setVisible(next);
    if (!next) setOpenGroup(null);
  }, []);

  /* ---- Resolve the correct state before the first painted frame ----- */
  useIsomorphicLayoutEffect(() => {
    if (!cinematic) {
      /* leaving the landing page: restore the default presence */
      setHeaderVisible(true);
      return;
    }
    const y = window.scrollY;
    const remaining =
      document.documentElement.scrollHeight - (y + window.innerHeight);
    const bottomZone = Math.max(320, window.innerHeight * 0.35);
    /* restored scroll: visible only when genuinely AT_BOTTOM past the
       hero; everywhere else the clean initial state is hidden */
    setHeaderVisible(y > heroThresholdPx() && remaining <= bottomZone);
  }, [cinematic, setHeaderVisible]);

  /* ---- Scroll-aware visibility -------------------------------------- */
  useEffect(() => {
    let lastY = window.scrollY;
    let downAccum = 0;
    let upAccum = 0;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      if (delta === 0 || menuOpenRef.current) return;

      const remaining =
        document.documentElement.scrollHeight - (y + window.innerHeight);
      const bottomZone = Math.max(320, window.innerHeight * 0.35);

      if (cinematic) {
        /* AT_TOP — the very top: the hero owns the whole viewport */
        if (y <= CINEMATIC_TOP_PX) {
          downAccum = 0;
          upAccum = 0;
          setHeaderVisible(false);
          return;
        }
        /* AT_BOTTOM — navigation is available at the close */
        if (remaining <= bottomZone) {
          setHeaderVisible(true);
          return;
        }
        /* hero zone — moving a few pixels from the top reveals nothing */
        if (y <= CINEMATIC_TOP_PX + heroThresholdPx()) {
          downAccum = 0;
          upAccum = 0;
          setHeaderVisible(false);
          return;
        }
        /* SCROLLING_DOWN recedes; SCROLLING_UP reveals (intent-filtered
           in both directions, so trackpad noise never flickers it) */
        if (delta > 0) {
          downAccum += delta;
          upAccum = 0;
          if (downAccum >= DOWN_INTENT_PX) setHeaderVisible(false);
        } else {
          upAccum += -delta;
          downAccum = 0;
          if (upAccum >= UP_INTENT_PX) setHeaderVisible(true);
        }
        return;
      }

      if (y <= TOP_ZONE_PX) {
        downAccum = 0;
        upAccum = 0;
        setHeaderVisible(true);
        return;
      }

      if (remaining <= bottomZone) {
        setHeaderVisible(true);
        return;
      }

      if (delta > 0) {
        downAccum += delta;
        upAccum = 0;
        if (downAccum >= DOWN_INTENT_PX && y > HIDE_MIN_SCROLL_Y) {
          setHeaderVisible(false);
        }
      } else {
        upAccum += -delta;
        downAccum = 0;
        if (upAccum >= UP_INTENT_PX) {
          setHeaderVisible(true);
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [cinematic, setHeaderVisible]);

  /* ---- Menu-open pins the header visible ---------------------------- */
  useEffect(() => {
    menuOpenRef.current = mobileOpen;
    if (mobileOpen) {
      visibleRef.current = true;
      setVisible(true);
      setOpenGroup(null);
    }
    onMenuToggle?.(mobileOpen);
  }, [mobileOpen, onMenuToggle]);

  /* ---- Escape closes menu + dropdowns ------------------------------- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setOpenGroup(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleMobileLogout() {
    await fetch("/auth/signout", {
      method: "POST",
      credentials: "same-origin",
    });
    setMobileOpen(false);
    setMobileSection(null);
    window.location.assign("/login");
  }

  const closeMobile = () => {
    setMobileOpen(false);
    setMobileSection(null);
  };

  const dropdownPanel = (group: "products" | "resources") =>
    cn(
      "absolute left-1/2 top-full w-80 -translate-x-1/2 pt-4",
      "transition-[opacity,translate,visibility] duration-200 ease-out motion-reduce:transition-none",
      openGroup === group
        ? "visible translate-y-0 opacity-100"
        : "invisible pointer-events-none translate-y-1 opacity-0",
    );

  const dropdownInner =
    "overflow-hidden rounded-2xl border border-white/[0.08] bg-void-900/90 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl";

  const dropdownItemClass =
    "group/item flex items-center justify-between gap-4 rounded-xl px-4 py-3 transition-colors duration-200 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:bg-white/[0.05]";

  return (
    <header
      data-site-header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150",
        "transition-[transform,translate,opacity,visibility,background-color,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        mobileOpen
          ? "border-white/[0.08] bg-void-950/85"
          : "border-white/[0.06] bg-void-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        visible
          ? "translate-y-0 opacity-100"
          : "invisible pointer-events-none -translate-y-full opacity-0",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 sm:px-10">
        {/* Brand lockup — icon + wordmark + promise, one deliberate unit */}
        <Link
          href="/"
          aria-label="Entrepreneuria — home"
          onClick={closeMobile}
          className="group flex shrink-0 items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intelligence/60 focus-visible:ring-offset-2 focus-visible:ring-offset-void-950"
        >
          <Image
            src="/logos/entrepreneuria-logo-nav.png"
            alt=""
            width={40}
            height={40}
            priority
            className="h-10 w-10 rounded-full drop-shadow-[0_0_14px_rgba(0,212,255,0.22)]"
          />
          <span className="hidden flex-col sm:flex">
            <span className="font-heading text-lg font-medium leading-none tracking-[0.01em] text-white">
              Entrepreneuria
            </span>
            <span className="type-label mt-1.5 text-[0.625rem] leading-none text-human">
              Build. Launch. Grow.
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {/* ---------------- Desktop primary nav ---------------- */}
          <nav aria-label="Primary" className="hidden items-center lg:flex">
            {/* Products — the ecosystem registry */}
            <div
              className="relative"
              onMouseEnter={() => setOpenGroup("products")}
              onMouseLeave={() => setOpenGroup(null)}
            >
              <button
                type="button"
                aria-expanded={openGroup === "products"}
                aria-haspopup="true"
                aria-controls="nav-products-menu"
                onClick={() =>
                  setOpenGroup(openGroup === "products" ? null : "products")
                }
                className={cn(
                  navItemClass,
                  "flex items-center gap-1",
                  openGroup === "products" && "text-white",
                )}
              >
                Products
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "h-3.5 w-3.5 text-white/45 transition-transform duration-300",
                    openGroup === "products" && "rotate-180",
                  )}
                />
                <span aria-hidden="true" className={underlineClass} />
              </button>
              <div id="nav-products-menu" className={dropdownPanel("products")}>
                <div className={dropdownInner}>
                  {productLinks.map((item) =>
                    item.external ? (
                      <a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={dropdownItemClass}
                      >
                        <span className="text-sm text-white/80 transition-colors group-hover/item:text-white">
                          {item.label}
                        </span>
                        <StatusNote status={item.status} lit={item.lit} />
                      </a>
                    ) : (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={dropdownItemClass}
                      >
                        <span className="text-sm text-white/80 transition-colors group-hover/item:text-white">
                          {item.label}
                        </span>
                        <StatusNote status={item.status} lit={item.lit} />
                      </Link>
                    ),
                  )}
                  <div className="mt-1 border-t border-white/[0.06] pt-1">
                    <Link
                      href="/"
                      className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm text-white/55 transition-colors hover:bg-white/[0.05] hover:text-intelligence focus-visible:outline-none focus-visible:bg-white/[0.05]"
                    >
                      Explore the ecosystem
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Resources — Launch Pad / Exchange material */}
            <div
              className="relative"
              onMouseEnter={() => setOpenGroup("resources")}
              onMouseLeave={() => setOpenGroup(null)}
            >
              <button
                type="button"
                aria-expanded={openGroup === "resources"}
                aria-haspopup="true"
                aria-controls="nav-resources-menu"
                onClick={() =>
                  setOpenGroup(openGroup === "resources" ? null : "resources")
                }
                className={cn(
                  navItemClass,
                  "flex items-center gap-1",
                  openGroup === "resources" && "text-white",
                )}
              >
                Resources
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "h-3.5 w-3.5 text-white/45 transition-transform duration-300",
                    openGroup === "resources" && "rotate-180",
                  )}
                />
                <span aria-hidden="true" className={underlineClass} />
              </button>
              <div
                id="nav-resources-menu"
                className={dropdownPanel("resources")}
              >
                <div className={dropdownInner}>
                  {RESOURCE_LINKS.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="block rounded-xl px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:bg-white/[0.05]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link href="/launch-pad/community" className={navItemClass}>
              Community
              <span aria-hidden="true" className={underlineClass} />
            </Link>
            <Link href="/about" className={navItemClass}>
              About
              <span aria-hidden="true" className={underlineClass} />
            </Link>
            <Link href="/pricing" className={navItemClass}>
              Pricing
              <span aria-hidden="true" className={underlineClass} />
            </Link>
          </nav>

          {/* ---------------- Single account action ---------------- */}
          <div className="hidden items-center gap-2 lg:flex">
            {!authLoading && authUser ? (
              <>
                <Link href={ACCOUNT_HREF} className={ctaClass}>
                  Dashboard
                  <span aria-hidden="true" className={ctaUnderlineClass} />
                </Link>
                <UserMenu />
              </>
            ) : !authLoading ? (
              <Link href={cta.href} className={ctaClass}>
                {cta.label}
                <ArrowRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                />
                <span aria-hidden="true" className={ctaUnderlineClass} />
              </Link>
            ) : null}
          </div>

          {/* ---------------- Mobile toggle ---------------- */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intelligence/60 lg:hidden"
          >
            {mobileOpen ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Menu aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* ---------------- Mobile menu ---------------- */}
      <div
        id="mobile-nav"
        className={cn(
          "h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-white/[0.06] bg-void-950/92 lg:hidden",
          "transition-[transform,translate,opacity,visibility] duration-300 ease-out motion-reduce:transition-none",
          mobileOpen
            ? "visible translate-y-0 opacity-100"
            : "invisible pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        <nav
          aria-label="Mobile"
          className="mx-auto w-full max-w-2xl px-6 pb-12 pt-2"
        >
          {/* Products */}
          <div className="border-b border-white/[0.06]">
            <button
              type="button"
              aria-expanded={mobileSection === "products"}
              onClick={() =>
                setMobileSection(
                  mobileSection === "products" ? null : "products",
                )
              }
              className="flex w-full items-center justify-between py-4 text-left text-base font-medium text-white/85 focus-visible:outline-none focus-visible:text-white"
            >
              Products
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 text-white/45 transition-transform duration-200",
                  mobileSection === "products" && "rotate-180",
                )}
              />
            </button>
            {mobileSection === "products" ? (
              <div className="pb-4 pl-2">
                {productLinks.map((item) =>
                  item.external ? (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closeMobile}
                      className="flex items-center justify-between gap-4 py-2.5"
                    >
                      <span className="text-sm text-white/70">{item.label}</span>
                      <StatusNote status={item.status} lit={item.lit} />
                    </a>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={closeMobile}
                      className="flex items-center justify-between gap-4 py-2.5"
                    >
                      <span className="text-sm text-white/70">{item.label}</span>
                      <StatusNote status={item.status} lit={item.lit} />
                    </Link>
                  ),
                )}
                <Link
                  href="/"
                  onClick={closeMobile}
                  className="mt-1 flex items-center gap-2 py-2.5 text-sm text-white/50"
                >
                  Explore the ecosystem
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : null}
          </div>

          {/* Resources */}
          <div className="border-b border-white/[0.06]">
            <button
              type="button"
              aria-expanded={mobileSection === "resources"}
              onClick={() =>
                setMobileSection(
                  mobileSection === "resources" ? null : "resources",
                )
              }
              className="flex w-full items-center justify-between py-4 text-left text-base font-medium text-white/85 focus-visible:outline-none focus-visible:text-white"
            >
              Resources
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 text-white/45 transition-transform duration-200",
                  mobileSection === "resources" && "rotate-180",
                )}
              />
            </button>
            {mobileSection === "resources" ? (
              <div className="pb-4 pl-2">
                {RESOURCE_LINKS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={closeMobile}
                    className="block py-2.5 text-sm text-white/70"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <Link
            href="/launch-pad/community"
            onClick={closeMobile}
            className="block border-b border-white/[0.06] py-4 text-base font-medium text-white/85"
          >
            Community
          </Link>
          <Link
            href="/about"
            onClick={closeMobile}
            className="block border-b border-white/[0.06] py-4 text-base font-medium text-white/85"
          >
            About
          </Link>
          <Link
            href="/pricing"
            onClick={closeMobile}
            className="block border-b border-white/[0.06] py-4 text-base font-medium text-white/85"
          >
            Pricing
          </Link>

          {/* Single account action */}
          {!authLoading && authUser ? (
            <div className="pt-6">
              <div className="flex items-center gap-3 pb-4">
                <UserAvatar
                  avatarUrl={authUser.avatarUrl}
                  displayName={authUser.fullName}
                  email={authUser.email}
                  className="h-10 w-10 border border-white/15"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {authUser.fullName ?? authUser.email ?? "Signed in"}
                  </p>
                  {authUser.fullName && authUser.email ? (
                    <p className="truncate text-xs text-white/55">
                      {authUser.email}
                    </p>
                  ) : null}
                </div>
              </div>
              <Link
                href={ACCOUNT_HREF}
                onClick={closeMobile}
                className="flex items-center justify-between py-3.5 text-base font-semibold text-human"
              >
                Dashboard
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="/account"
                onClick={closeMobile}
                className="block py-3.5 text-sm text-white/70"
              >
                Account
              </Link>
              <Link
                href="/settings"
                onClick={closeMobile}
                className="block py-3.5 text-sm text-white/70"
              >
                Settings
              </Link>
              <button
                type="button"
                onClick={handleMobileLogout}
                className="block w-full py-3.5 text-left text-sm text-white/70"
              >
                Log out
              </button>
            </div>
          ) : !authLoading ? (
            <div className="pt-4">
              <Link
                href={cta.href}
                onClick={closeMobile}
                className="flex items-center justify-between py-4 text-base font-semibold text-human"
              >
                {cta.label}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

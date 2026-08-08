"use client";

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import Link from "@/components/transition/TransitionLink";
import { ArrowRight, ArrowUpRight } from "lucide-react";

/** The homepage entrance: rise + fade, once, on scroll into view. */
export const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
} as const;

/** Same entrance for above-the-fold content — animates on mount. */
export const fadeUpLoad = (delay = 0) =>
  ({
    initial: { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
  }) as const;

/** DM Mono eyebrow — `01 — Section name` on dark, or tinted on paper. */
export function Kicker({
  children,
  tone = "dark",
  className = "",
}: {
  children: ReactNode;
  tone?: "dark" | "paper" | "accent";
  className?: string;
}) {
  const color =
    tone === "paper"
      ? "text-[#4f7ca7]"
      : tone === "accent"
        ? "text-[#00d4ff]"
        : "text-white/45";
  return (
    <p
      className={`text-[11px] uppercase tracking-[0.28em] ${color} [font-family:var(--font-label)] sm:text-xs ${className}`}
    >
      {children}
    </p>
  );
}

/** Live/planned indicator dot, as used on the homepage status board. */
export function StatusDot({ live }: { live: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        live
          ? "h-1.5 w-1.5 shrink-0 rounded-full bg-[#00d4ff] shadow-[0_0_8px_rgba(0,212,255,0.8)]"
          : "h-1.5 w-1.5 shrink-0 rounded-full border border-white/35"
      }
    />
  );
}

/**
 * The homepage card surface. Rendered as any element via `as`
 * (article, li, div). Class name deliberately avoids the substring
 * "card" — a legacy global rule force-restyles anything matching it.
 */
export function GlassPanel<T extends ElementType = "div">({
  as,
  className = "",
  interactive = false,
  children,
  ...rest
}: {
  as?: T;
  className?: string;
  interactive?: boolean;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      className={`rounded-2xl border border-white/10 bg-white/[0.03] ${
        interactive ? "transition-colors hover:border-white/25" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Primary action — the homepage's orange pill with shimmer. */
export function PillButton({
  href,
  children,
  external = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  className?: string;
}) {
  const classes = `group relative inline-flex h-13 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-orange)] px-7 text-[15px] font-semibold !text-white transition hover:bg-[#b96a24] ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {children}
        <span className="button-shimmer" aria-hidden="true" />
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
      <span className="button-shimmer" aria-hidden="true" />
    </Link>
  );
}

/** Secondary action — quiet bordered pill. */
export function GhostButton({
  href,
  children,
  external = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  className?: string;
}) {
  const classes = `inline-flex h-13 items-center justify-center rounded-full border border-white/15 px-7 text-[15px] font-semibold !text-white/80 transition hover:border-white/40 hover:!text-white ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

/** Inline text link with the homepage's travelling arrow. */
export function ArrowLink({
  href,
  children,
  external = false,
  tone = "bright",
  className = "",
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  tone?: "bright" | "muted";
  className?: string;
}) {
  const color =
    tone === "bright"
      ? "!text-white"
      : "!text-white/70 transition hover:!text-white";
  const classes = `group inline-flex items-center gap-1.5 text-sm font-semibold ${color} ${className}`;
  const icon = external ? (
    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
  ) : (
    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {children}
        {icon}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
      {icon}
    </Link>
  );
}

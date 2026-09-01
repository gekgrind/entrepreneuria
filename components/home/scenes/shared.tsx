import type { ReactNode } from "react";
import {
  PRODUCT_STATUS_LABELS,
  isLitStatus,
} from "@/lib/ecosystem/products";
import type { ProductStatus } from "@/lib/ecosystem/schema";

/**
 * Shared primitives for the homepage scenes. Server-component safe.
 * Colors come from the constellation token layer (Stage 2):
 *   intelligence (cyan) = the products' light, interaction
 *   human (orange)      = the founder's light, primary action
 */

export function Kicker({
  children,
  tone = "dark",
}: {
  children: ReactNode;
  /** dark = on void backgrounds; light = on paper backgrounds. */
  tone?: "dark" | "light";
}) {
  return (
    <p
      className={`type-kicker mb-5 ${tone === "light" ? "text-ink/70" : "text-white/60"}`}
    >
      {children}
    </p>
  );
}

export function StatusChip({ status }: { status: ProductStatus }) {
  const lit = isLitStatus(status);
  return (
    <span className="type-label inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-white/60">
      <span
        aria-hidden="true"
        className={
          lit
            ? "h-1.5 w-1.5 rounded-full bg-intelligence shadow-[0_0_8px_rgba(0,212,255,0.8)]"
            : "h-1.5 w-1.5 rounded-full border border-white/35"
        }
      />
      {PRODUCT_STATUS_LABELS[status]}
    </span>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="type-label inline-flex items-center rounded-full bg-intelligence/10 px-3 py-1 text-intelligence">
      {children}
    </span>
  );
}

/** The human (orange) primary CTA. Label/href come from lib/launch. */
export function PrimaryCtaLink({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
       className="group relative inline-flex h-14 w-full items-center justify-center overflow-hidden rounded-full bg-human px-8 text-sm font-semibold text-[#04222b] transition hover:brightness-110 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(0,212,255,0.3)] sm:w-auto"
    >
      <span className="button-shimmer" aria-hidden="true" />
      <span className="relative">{label}</span>
    </a>
  );
}

export function GhostLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex h-14 items-center justify-center rounded-full px-6 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-intelligence focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(0,212,255,0.3)]"
    >
      {children}
    </a>
  );
}

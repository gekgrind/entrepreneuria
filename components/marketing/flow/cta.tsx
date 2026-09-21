"use client";

import type { ReactNode } from "react";
import Link from "@/components/transition/TransitionLink";
import { ArrowRight } from "lucide-react";

/**
 * Flow-page actions.
 *
 * Visually these are the homepage's buttons (`scenes/shared`): the human
 * orange fill with deep-navy type — which, unlike the older marketing
 * pill's white-on-orange, actually clears WCAG AA at 5.2:1 — and the
 * quiet ghost beside it. Behaviourally they are the marketing site's:
 * routed through TransitionLink so the page transition still plays.
 *
 * Reuse these on the other product pages rather than re-deriving a
 * button; the two competing treatments are how the site drifted apart
 * in the first place.
 *
 * Focus is a real `outline`, not a box-shadow ring: the arbitrary
 * `focus-visible:shadow-[…]` these carried never reached the painted
 * box-shadow (the utility and its `--tw-shadow` both resolve, the
 * composite does not), so keyboard users had no indicator at all on
 * the page's primary actions. An outline follows the pill radius in
 * every current browser and survives forced-colors mode, which a ring
 * does not.
 */

export function PrimaryAction({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full bg-human px-8 text-sm font-semibold !text-[#04222b] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-intelligence ${className}`}
    >
      <span className="button-shimmer" aria-hidden="true" />
      <span className="relative">{children}</span>
    </Link>
  );
}

export function SecondaryAction({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex h-14 items-center justify-center gap-2 rounded-full border border-white/15 px-7 text-sm font-semibold !text-white/80 transition hover:border-white/35 hover:!text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-intelligence ${className}`}
    >
      {children}
      <ArrowRight
        aria-hidden="true"
        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
      />
    </Link>
  );
}

"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

/**
 * Shared shell for every marketing subpage — the same deep-navy canvas,
 * type color, and reduced-motion contract as the homepage. Pulls itself up
 * under the fixed header (RootClientLayout pads the route wrapper) so the
 * navy runs edge-to-edge behind the transparent header, exactly like the
 * homepage hero does.
 */
export function PageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`relative -mt-[calc(var(--header-height)+20px)] overflow-x-clip bg-[#081527] text-white ${className}`}
      >
        {children}
      </div>
    </MotionConfig>
  );
}

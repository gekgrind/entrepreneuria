"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { fadeUp } from "@/components/marketing/primitives";

/**
 * The page's existing scroll entrance (`fadeUp`) as a tiny client island,
 * so server-rendered Directorium sections can keep using it without the
 * whole page becoming a client component. Reduced motion is honored by
 * PageShell's MotionConfig.
 */
export function Reveal({
  as = "div",
  className = "",
  children,
}: {
  as?: "div" | "blockquote";
  className?: string;
  children: ReactNode;
}) {
  const Tag = as === "blockquote" ? motion.blockquote : motion.div;
  return (
    <Tag {...fadeUp} className={className}>
      {children}
    </Tag>
  );
}

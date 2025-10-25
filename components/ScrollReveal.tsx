// @ts-nocheck
"use client";

import React, { useEffect } from "react";
import { motion, useAnimation } from "motion/react";
import type { Variants } from "motion/react";
import { useInView } from "react-intersection-observer";

/**
 * 🌬️ ScrollReveal — Refined Float-In Animation (buttery version)
 * ---------------------------------------------------------------
 * Smooth, visible float-in motion with soft easing and slower pacing.
 */

export default function ScrollReveal({
  children,
  delay = 0,
  duration = 1.8,      // slower overall speed
  y = 100,              // stronger upward motion
  threshold = 0.2,
  staggerChildren = 0.35, // slower wave ripple
  once = true,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  threshold?: number;
  staggerChildren?: number;
  once?: boolean;
}) {
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: once,
    threshold,
  });

  useEffect(() => {
    if (inView) controls.start("visible");
  }, [controls, inView]);

  const containerVariants: Variants = {
    hidden: { opacity: 0, y },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1.0], // slower "smooth start, soft end"
        staggerChildren,
      },
    },
  };

  const childVariants: Variants = {
    hidden: { opacity: 0, y },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: duration * 0.9,
        ease: [0.25, 0.1, 0.25, 1.0],
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate={controls}
    >
      {React.Children.map(children, (child, i) =>
        React.isValidElement(child) ? (
          <motion.div key={i} variants={childVariants}>
            {child}
          </motion.div>
        ) : (
          child
        )
      )}
    </motion.div>
  );
}

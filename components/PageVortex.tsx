"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

/**
 * PageVortex renders a brief radial “suck away → reveal” overlay
 * whenever the pathname changes. It never blocks clicks (pointer-events: none)
 * and cleans itself up after the animation finishes.
 */
export default function PageVortex() {
  const pathname = usePathname();
  const [animKey, setAnimKey] = useState(0);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      // trigger overlay animation
      setAnimKey((k) => k + 1);
      prevPath.current = pathname;
    }
  }, [pathname]);

  return (
    <AnimatePresence>
      {/* Only mount the overlay when animKey increments */}
      <motion.div
        key={animKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onAnimationComplete={() => {/* auto unmount via AnimatePresence */}}
        className="pointer-events-none fixed inset-0 z-[60]"
        style={{ mixBlendMode: "normal" }}
      >
        {/* OUTRO (old page “sucked away”) */}
        <motion.div
          initial={{ scale: 1, filter: "blur(0px)" }}
          animate={{ scale: 0.85, filter: "blur(6px)" }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="pointer-events-none fixed inset-0"
        />

        {/* VORTEX MASK (CSS radial mask spinning in/out) */}
        <motion.div
          initial={{ scale: 0.9, rotate: 0 }}
          animate={{ scale: 1.05, rotate: 180 }}
          transition={{ duration: 0.35, ease: "easeInOut", delay: 0.05 }}
          className="pointer-events-none fixed inset-0"
          style={{
            // lightweight mask: radial gradient hole expands/rotates
            WebkitMaskImage:
              "radial-gradient(circle at center, transparent 22%, black 23%)",
            maskImage:
              "radial-gradient(circle at center, transparent 22%, black 23%)",
            background:
              "conic-gradient(from 0deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 30%, rgba(255,255,255,0.22) 60%, rgba(255,255,255,0) 90%)",
          }}
        />

        {/* INTRO shimmer on the new page */}
        <motion.div
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.28, ease: "easeOut", delay: 0.22 }}
          className="pointer-events-none fixed inset-0"
        />
      </motion.div>
    </AnimatePresence>
  );
}

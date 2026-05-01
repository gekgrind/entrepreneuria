"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

/**
 * PageVortex renders a brief radial “suck away → reveal” overlay
 * whenever the pathname changes. It never blocks clicks.
 */
export default function PageVortex() {
  const pathname = usePathname();
  const animKey = pathname;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={animKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="pointer-events-none fixed inset-0 z-[60]"
        style={{ mixBlendMode: "normal" }}
      >
        <motion.div
          initial={{ scale: 1, filter: "blur(0px)" }}
          animate={{ scale: 0.85, filter: "blur(6px)" }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="pointer-events-none fixed inset-0"
        />

        <motion.div
          initial={{ scale: 0.9, rotate: 0 }}
          animate={{ scale: 1.05, rotate: 180 }}
          transition={{ duration: 0.35, ease: "easeInOut", delay: 0.05 }}
          className="pointer-events-none fixed inset-0"
          style={{
            WebkitMaskImage:
              "radial-gradient(circle at center, transparent 22%, black 23%)",
            maskImage:
              "radial-gradient(circle at center, transparent 22%, black 23%)",
            background:
              "conic-gradient(from 0deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 30%, rgba(255,255,255,0.22) 60%, rgba(255,255,255,0) 90%)",
          }}
        />

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

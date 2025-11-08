import type { Variants } from "framer-motion"

// 🌟 Generic fade/float animation for cards, sections, etc.
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 25 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
}

// ✨ Container stagger animation for grouped children
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
}

// 💫 Optional extra variants you can add later
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.8 } },
}

export const scaleIn: Variants = {
  hidden: { scale: 0.9, opacity: 0 },
  show: { scale: 1, opacity: 1, transition: { duration: 0.6, ease: "easeOut" } },
}

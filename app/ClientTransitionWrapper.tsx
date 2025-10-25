'use client'

import { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

export default function ClientTransitionWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'visible',
        minHeight: '100vh',
      }}
    >
      {/* Background vortex animation */}
      <motion.div
        key={pathname + '-bg'}
        initial={{ scale: 1, rotate: 0, opacity: 1 }}
        animate={{
          scale: [1, 1.05, 1],
          rotate: [0, 5, 0],
          opacity: [1, 0.8, 1],
        }}
        transition={{
          duration: 2,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatType: 'mirror',
        }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, rgba(79,124,167,0.8), rgba(210,122,44,0.8))',
          zIndex: 0,
        }}
      />

      {/* Page transition layer */}
  <AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
    animate={{
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 1.2, ease: [0.65, 0, 0.35, 1] },
    }}
    exit={{
      opacity: 0,
      y: -40,
      filter: 'blur(10px)',
      transition: { duration: 0.9, ease: 'easeInOut' },
    }}
    style={{
      position: 'relative',
      zIndex: 1000, // 🚀 force this layer to the top
      opacity: 1,
      pointerEvents: 'auto', // allow interactions again
    }}
  >
    {children}
  </motion.div>
</AnimatePresence>
    </div>
  )
}

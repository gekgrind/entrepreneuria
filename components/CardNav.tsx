"use client";

import { useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, type Variants } from "framer-motion";
import Link from "next/link";

const cards = [
  {
    title: "Home",
    tagline: "Where Every Vision Starts",
    href: "/",
    subpages: [],
  },
  {
    title: "Nexus",
    tagline: "AI Power Meets Human Ambition",
    href: "/nexus",
    subpages: [
      { name: "Prospra", href: "/prospra" },
      { name: "Synceri", href: "/synceri" },
    ],
  },
  {
    title: "Exchange",
    tagline: "Where Ideas and Innovation Trade Hands",
    href: "/exchange",
    subpages: [
      { name: "Digital Vault", href: "/exchange/digital-vault" },
      { name: "Agentverse", href: "/exchange/agentverse" },
    ],
  },
  {
    title: "Launch Pad",
    tagline: "Ignite Your Growth",
    href: "/launch-pad",
    subpages: [
      { name: "AI-Powered Tools", href: "/launch-pad/tools" },
      { name: "Resources & Templates", href: "/launch-pad/resources" },
      { name: "Blog", href: "/launch-pad/blog" },
      { name: "Community", href: "/launch-pad/community" },
    ],
  },
  {
    title: "Origin",
    tagline: "The Vision Behind the Venture",
    href: "/origin",
    subpages: [
      { name: "About", href: "/about" },
      { name: "Pricing", href: "/pricing" },
      { name: "Contact", href: "/contact" },
    ],
  },
];

// Magnetic hover tilt
function useMagneticHover(ref: React.RefObject<HTMLDivElement | null>) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-50, 50], [10, -10]);
  const rotateY = useTransform(x, [-50, 50], [-10, 10]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left - rect.width / 2;
      const offsetY = e.clientY - rect.top - rect.height / 2;
      x.set(offsetX);
      y.set(offsetY);
    };
    const handleLeave = () => {
      x.set(0);
      y.set(0);
    };
    const node = ref.current;
    node?.addEventListener("mousemove", handleMouseMove);
    node?.addEventListener("mouseleave", handleLeave);
    return () => {
      node?.removeEventListener("mousemove", handleMouseMove);
      node?.removeEventListener("mouseleave", handleLeave);
    };
  }, [ref, x, y]);

  return { rotateX, rotateY };
}

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0, y: 100, x: -80 },
  show: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: { duration: 0.5, staggerChildren: 0.1, ease: "easeOut" },
  },
  exit: { opacity: 0, y: 100, x: 80, transition: { duration: 0.4, ease: "easeIn" } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 40, x: 20 },
  show: { opacity: 1, y: 0, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function CardNav({ onClose }: { onClose?: () => void }) {
  // Close when clicking outside the nav
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("nav")) return; // inside menu, ignore
      onClose?.(); // click outside closes
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [onClose]);

  return (
    <motion.nav
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="fixed top-[var(--header-height)] left-0 w-full flex justify-center bg-black/60 backdrop-blur-md py-8 z-40"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6 max-w-6xl w-full px-6">
        {cards.map((card, i) => {
          const cardRef = useRef<HTMLDivElement | null>(null);
          const { rotateX, rotateY } = useMagneticHover(cardRef);

          return (
            <motion.div
              key={i}
              ref={cardRef as React.Ref<HTMLDivElement>}
              variants={cardVariants}
              style={{ rotateX, rotateY }}
              whileHover={{ scale: 1.05, y: -5 }}
              className="group relative flex flex-col justify-between rounded-2xl p-6 bg-gradient-to-br from-[#1a2942] via-[#4f7ca7] to-[#d27a2c] shadow-lg border border-white/10 cursor-pointer overflow-hidden min-h-[230px]"
            >
              {/* shimmer overlay */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />

              {/* Top section */}
              <Link href={card.href} onClick={onClose}>
                <div className="relative z-10">
                  <h3 className="text-xl font-semibold text-white mb-1 drop-shadow-lg">
                    {card.title}
                  </h3>
                  <p className="text-sm text-white/70">{card.tagline}</p>
                </div>
              </Link>

              {/* Bottom section (sub-links aligned bottom) */}
              {card.subpages.length > 0 && (
                <div className="relative z-10 space-y-1 mt-6">
                  {card.subpages.map((sub, j) => (
                    <Link
                      key={j}
                      href={sub.href}
                      onClick={onClose}
                      className="flex items-center gap-1 text-sm text-white/80 hover:text-[#d27a2c] transition-colors"
                    >
                      <span>↗</span>
                      <span>{sub.name}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* border glow */}
              <div className="absolute inset-0 rounded-2xl border border-transparent group-hover:border-[#d27a2c]/60 transition duration-300" />
            </motion.div>
          );
        })}
      </div>
    </motion.nav>
  );
}

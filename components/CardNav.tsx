"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
  type Variants,
} from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

const cards = [
  {
    title: "Home",
    tagline: "Start here",
    href: "/",
    subpages: [],
  },
  {
    title: "Founder Tools",
    tagline: "Available now on Etsy",
    href: "/",
    subpages: [
      { name: "Shop on Etsy", href: "https://entrepreneuriatools.etsy.com" },
      { name: "Business Launch OS", href: "/" },
      { name: "Strategy & Execution OS", href: "/" },
      { name: "Offer Suite", href: "/" },
    ],
  },
  {
    title: "AI Apps",
    tagline: "Coming soon",
    href: "/",
    subpages: [
      { name: "Prospra", href: "/prospra" },
      { name: "Architecta", href: "/architecta" },
      { name: "Directorium", href: "/directorium" },
      { name: "Synceri", href: "/synceri" },
    ],
  },
  {
    title: "LaunchPad",
    tagline: "Tools, resources, blog",
    href: "/launch-pad",
    subpages: [
      { name: "Tools", href: "/launch-pad/tools" },
      { name: "Resources", href: "/launch-pad/resources" },
      { name: "Blog", href: "/launch-pad/blog" },
    ],
  },
  {
    title: "Join Waitlist",
    tagline: "Get early access",
    href: "/contact",
    subpages: [
      { name: "Join the Waitlist", href: "/contact" },
      { name: "Contact", href: "/contact" },
      { name: "Pricing", href: "/pricing" },
    ],
  },
];

type Card = (typeof cards)[number];

function useMagneticHover(ref: React.RefObject<HTMLDivElement | null>) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-50, 50], [10, -10]);
  const rotateY = useTransform(x, [-50, 50], [-10, 10]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      const offsetX = e.clientX - rect.left - rect.width / 2;
      const offsetY = e.clientY - rect.top - rect.height / 2;

      x.set(offsetX);
      y.set(offsetY);
    };

    const handleLeave = () => {
      x.set(0);
      y.set(0);
    };

    node.addEventListener("mousemove", handleMouseMove);
    node.addEventListener("mouseleave", handleLeave);

    return () => {
      node.removeEventListener("mousemove", handleMouseMove);
      node.removeEventListener("mouseleave", handleLeave);
    };
  }, [ref, x, y]);

  return { rotateX, rotateY };
}

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 100, x: -80 },
  show: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: { duration: 0.5, staggerChildren: 0.1, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: 100,
    x: 80,
    transition: { duration: 0.4, ease: "easeIn" },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 40, x: 20 },
  show: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

function NavLink({
  href,
  pathname,
  onClose,
  className = "",
  children,
}: {
  href: string;
  pathname: string;
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isExternal = href.startsWith("http");
  const isActive =
    !isExternal &&
    (href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`));

  const withActiveClass = `${className} ${
    isActive ? "text-[#00D4FF]" : ""
  }`.trim();

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={onClose}
        className={withActiveClass}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onClose} className={withActiveClass}>
      {children}
    </Link>
  );
}

function NavCard({
  card,
  pathname,
  onClose,
}: {
  card: Card;
  pathname: string;
  onClose?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { rotateX, rotateY } = useMagneticHover(cardRef);

  const isCardActive =
    card.href === "/"
      ? pathname === "/" ||
        card.subpages.some(
          (sub) =>
            !sub.href.startsWith("http") &&
            sub.href !== "/" &&
            (pathname === sub.href || pathname.startsWith(`${sub.href}/`)),
        )
      : pathname === card.href ||
        pathname.startsWith(`${card.href}/`) ||
        card.subpages.some(
          (sub) =>
            !sub.href.startsWith("http") &&
            (pathname === sub.href || pathname.startsWith(`${sub.href}/`)),
        );

  return (
    <motion.div
      ref={cardRef}
      variants={cardVariants}
      style={
        { rotateX, rotateY } as {
          rotateX: MotionValue<number>;
          rotateY: MotionValue<number>;
        }
      }
      whileHover={{ scale: 1.05, y: -5 }}
      className="group relative flex min-h-[230px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a2942] via-[#0d1b33] to-[#020b1f] p-6 shadow-lg"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <NavLink
        href={card.href}
        pathname={pathname}
        onClose={onClose}
        className="relative z-10 block"
      >
        <div>
          <h3
            className={`mb-1 text-xl font-semibold drop-shadow-lg ${
              isCardActive ? "text-[#00D4FF]" : "text-white"
            }`}
          >
            {card.title}
          </h3>
          <p className="text-sm text-white/70">{card.tagline}</p>
        </div>
      </NavLink>

      {card.subpages.length > 0 && (
        <div className="relative z-10 mt-6 space-y-1">
          {card.subpages.map((sub) => (
            <NavLink
              key={sub.href}
              href={sub.href}
              pathname={pathname}
              onClose={onClose}
              className="flex items-center gap-1 text-sm text-white/80 transition-colors hover:text-[var(--brand-accent)]"
            >
              <span>↗</span>
              <span>{sub.name}</span>
            </NavLink>
          ))}
        </div>
      )}

      <div
        className={`absolute inset-0 rounded-2xl border transition duration-300 ${
          isCardActive
            ? "border-[#00D4FF]/70"
            : "border-transparent group-hover:border-[#00D4FF]/60"
        }`}
      />
    </motion.div>
  );
}

export default function CardNav({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("nav")) return;
      onClose?.();
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
      className="fixed left-0 top-[var(--header-height)] z-40 flex w-full justify-center bg-black/60 py-8 backdrop-blur-md"
    >
      <div className="grid w-full max-w-6xl grid-cols-1 gap-6 px-6 sm:grid-cols-2 md:grid-cols-5">
        {cards.map((card) => (
          <NavCard
            key={card.title}
            card={card}
            pathname={pathname}
            onClose={onClose}
          />
        ))}
      </div>
    </motion.nav>
  );
}

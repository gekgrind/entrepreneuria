import Link from "@/components/transition/TransitionLink";
import { Mail, Twitter, Linkedin, Pin } from "lucide-react";

import {
  PRODUCTS,
  PRODUCT_STATUS_LABELS,
} from "@/lib/ecosystem/products";
import { getPrimaryCta } from "@/lib/launch";

const SOCIALS = [
  { href: "https://pinterest.com/entrepreneuriaio", label: "Pinterest", Icon: Pin },
  { href: "https://x.com/entrepreneuriaio", label: "X", Icon: Twitter },
  { href: "https://linkedin.com", label: "LinkedIn", Icon: Linkedin },
  { href: "mailto:misti@entrepreneuria.io", label: "Email", Icon: Mail },
] as const;

const RESOURCES = [
  { href: "/launch-pad", label: "The Launch Pad" },
  { href: "/launch-pad/tools", label: "Free AI Tools" },
  { href: "/launch-pad/resources", label: "Resources & Templates" },
  { href: "/launch-pad/blog", label: "Blog" },
  { href: "/exchange", label: "The Exchange" },
] as const;

/**
 * Site footer — Products + Resources + Marketplace hierarchy, driven by
 * the ecosystem registry (product names/statuses can never drift here).
 * The CTA follows the launch-state flag.
 */
export default function Footer() {
  const cta = getPrimaryCta();
  const core = PRODUCTS.filter((p) => p.tier === "core");
  const standalone = PRODUCTS.filter((p) => p.tier === "standalone");

  return (
    <footer className="relative overflow-hidden border-t border-white/8 bg-void-950">
      <div className="relative mx-auto max-w-7xl px-6 py-14 sm:px-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link
              href="/"
              className="font-heading text-2xl font-bold text-white/85"
            >
              Entrepreneuria
            </Link>
            <p className="text-sm leading-relaxed text-white/60">
              Everything Entrepreneur — an ecosystem of AI-powered mentorship,
              strategy, and tools for people building a business of their own.
            </p>
            <div className="flex flex-wrap gap-2">
              {SOCIALS.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("mailto") ? undefined : "_blank"}
                  rel="noreferrer"
                  aria-label={label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/70 transition hover:border-intelligence/40 hover:text-intelligence"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Products — from the registry */}
          <div className="space-y-4">
            <h3 className="type-label text-white/60">Products</h3>
            <ul className="space-y-2.5">
              {core.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={p.link.href}
                    className="text-sm text-white/75 transition hover:text-intelligence"
                  >
                    {p.name}
                    <span className="ml-2 text-xs text-white/55">
                      {PRODUCT_STATUS_LABELS[p.status]}
                    </span>
                  </Link>
                </li>
              ))}
              {standalone.map((p) => (
                <li key={p.slug}>
                  <a
                    href={p.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/75 transition hover:text-intelligence"
                  >
                    {p.name}
                    <span className="ml-2 text-xs text-white/55">
                      From Entrepreneuria
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources + Marketplace */}
          <div className="space-y-4">
            <h3 className="type-label text-white/60">Resources</h3>
            <ul className="space-y-2.5">
              {RESOURCES.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="text-sm text-white/75 transition hover:text-intelligence"
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://entrepreneuriatools.etsy.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-white/75 transition hover:text-intelligence"
                >
                  Founder Tools on Etsy
                </a>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <h3 className="type-label text-white/60">Stay Updated</h3>
            <p className="text-sm leading-relaxed text-white/60">
              Launch updates, new founder tools, and early access as each
              product ships.
            </p>
            <Link
              href={cta.href}
              className="inline-flex h-11 items-center justify-center rounded-full bg-human px-6 text-sm font-semibold text-[#04222b] transition hover:brightness-110"
            >
              {cta.label}
            </Link>
          </div>
        </div>

        <div className="mt-12 border-t border-white/8 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-white/50">
              © 2026 Entrepreneuria. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link
                href="/privacy"
                className="text-sm text-white/60 transition hover:text-intelligence"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-white/60 transition hover:text-intelligence"
              >
                Terms of Service
              </Link>
              <Link
                href="/contact"
                className="text-sm text-white/60 transition hover:text-intelligence"
              >
                Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

import Image from "next/image";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import Link from "@/components/transition/TransitionLink";
import { Thread } from "@/components/marketing/flow/atmosphere";
import { RevealGroup } from "@/components/marketing/flow/Reveal";
import { Badge, StatusChip } from "@/components/home/scenes/shared";
import type { Product } from "@/lib/ecosystem/schema";

import styles from "./about.module.css";

/**
 * The ecosystem, indexed by the kind of intelligence rather than by
 * product — which is the argument the About page has to make and the
 * homepage's constellation grid does not. The role is the headline; the
 * product is what currently answers to it.
 *
 * Every field on the row (name, role, tagline, status, mark, link) comes
 * from the ecosystem registry, so nothing here can drift from what the
 * rest of the site says, and nothing claims to be available before the
 * registry says it is.
 *
 * A single thread runs the length of the list: five different rows, one
 * system. It draws itself as the reader descends where the browser
 * supports scroll-driven animation, and is a plain hairline otherwise.
 */
export function EcosystemIndex({ products }: { products: readonly Product[] }) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="absolute bottom-16 left-0 top-10 hidden sm:block"
      >
        <Thread />
      </span>

      <RevealGroup as="ol" distance={18} className="sm:pl-10 lg:pl-14">
        {products.map((product, i) => {
          const external = product.link.kind === "external";
          const label = external
            ? `Visit ${product.name}`
            : `Explore ${product.name}`;

          return (
            <li key={product.slug} className={styles.entry}>
              <div className="grid gap-5 py-9 sm:py-11 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
                <div className="flex items-baseline gap-4 lg:block">
                  <span className="type-label text-white/30">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3
                    className={`type-display-sm text-white/85 lg:mt-3 ${styles.entryRole}`}
                  >
                    {product.role}
                  </h3>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    {product.logo ? (
                      <Image
                        src={product.logo}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-md object-cover"
                      />
                    ) : null}
                    <p className="type-display-xs text-white">{product.name}</p>
                    {product.badge ? <Badge>{product.badge}</Badge> : null}
                    <span className="sm:ml-auto">
                      <StatusChip status={product.status} />
                    </span>
                  </div>

                  <p className="mt-4 max-w-[52ch] leading-7 text-white/65">
                    {product.tagline}
                  </p>

                  <p className="mt-5">
                    {external ? (
                      <a
                        href={product.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`no-accent-link group inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 transition hover:text-white ${styles.entryLink}`}
                      >
                        {label}
                        <ArrowUpRight
                          aria-hidden="true"
                          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                      </a>
                    ) : (
                      <Link
                        href={product.link.href}
                        className={`no-accent-link group inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 transition hover:text-white ${styles.entryLink}`}
                      >
                        {label}
                        <ArrowRight
                          aria-hidden="true"
                          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                        />
                      </Link>
                    )}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </RevealGroup>
    </div>
  );
}

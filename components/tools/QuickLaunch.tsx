import Link from "@/components/transition/TransitionLink";
import { ArrowRight } from "lucide-react";

import { FREE_TOOLS } from "@/lib/resources/tools";

import styles from "./tools.module.css";

/**
 * Hero quick-launch — the page's first action is a job, not a scroll.
 * Each chip opens its tool directly; the index matches the card below.
 */
export function QuickLaunch() {
  return (
    <nav aria-label="Open a tool directly">
      <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-white/40 [font-family:var(--font-label)]">
        I need to…
      </p>
      <ul role="list" className="grid max-w-3xl grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-3">
        {FREE_TOOLS.map((tool, index) => (
          <li key={tool.slug}>
            <Link href={tool.href} className={`${styles.launch} no-accent-link w-full`}>
              <span className={`${styles.launchKey} [font-family:var(--font-label)]`} aria-hidden="true">
                {index + 1}
              </span>
              <span className="flex-1">{tool.job}</span>
              <ArrowRight className={`${styles.arrow} hidden h-3.5 w-3.5 sm:block`} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

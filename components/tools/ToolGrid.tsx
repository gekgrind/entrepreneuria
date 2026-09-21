import Link from "@/components/transition/TransitionLink";
import { ArrowRight } from "lucide-react";

import { FREE_TOOLS } from "@/lib/resources/tools";

import { ToolPreview } from "./ToolPreview";
import styles from "./tools.module.css";

/**
 * The six tools as the page's centrepiece. Each card is one link: a
 * schematic of the output up top, then the promise, then the exchange —
 * what you bring, what you leave with. The preview moves on hover/focus.
 */
export function ToolGrid() {
  return (
    <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      {FREE_TOOLS.map((tool, index) => (
        <li key={tool.slug} id={tool.slug} className="flex scroll-mt-[calc(var(--header-height)+32px)]">
          <Link
            href={tool.href}
            aria-labelledby={`${tool.slug}-name`}
            aria-describedby={`${tool.slug}-promise`}
            className={`${styles.tool} no-accent-link group w-full`}
          >
            <div className={styles.stage}>
              <div className="flex items-center justify-between px-5 pt-4 text-[10px] uppercase tracking-[0.24em] text-white/40 [font-family:var(--font-label)]">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span className="text-[#00d4ff]/80">{tool.outputLabel}</span>
              </div>
              <div className="px-6 pb-5 pt-3">
                <ToolPreview output={tool.output} />
              </div>
            </div>

            <div className="flex flex-1 flex-col p-6 sm:p-7">
              <h3
                id={`${tool.slug}-name`}
                className="text-[1.45rem] font-medium leading-tight tracking-tight text-white"
              >
                {tool.name}
              </h3>
              <p
                id={`${tool.slug}-promise`}
                className="mt-2 text-[15px] leading-6 text-white/70"
              >
                {tool.promise}
              </p>

              <dl className="mt-6 flex-1 space-y-3 border-t border-white/[0.07] pt-5 text-sm leading-6">
                <div className="grid grid-cols-[5rem_1fr] gap-3">
                  <dt className="pt-px whitespace-nowrap text-[10px] uppercase tracking-[0.18em] text-white/35 [font-family:var(--font-label)]">
                    You bring
                  </dt>
                  <dd className="text-white/55">{tool.bring}</dd>
                </div>
                <div className="grid grid-cols-[5rem_1fr] gap-3">
                  <dt className="pt-px whitespace-nowrap text-[10px] uppercase tracking-[0.18em] text-[#00d4ff]/70 [font-family:var(--font-label)]">
                    You get
                  </dt>
                  <dd className="text-white/80">{tool.leave}</dd>
                </div>
              </dl>

              <span className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                Start now
                <ArrowRight className={`${styles.arrow} h-4 w-4`} aria-hidden="true" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import { Download } from "lucide-react";

import type { LibraryEntry } from "@/lib/resources/library";

import styles from "./library.module.css";

/**
 * Three hand-picked titles as document covers on the paper interlude —
 * the collection's editorial voice: where to begin, and why.
 */
export function StartHere({
  picks,
}: {
  picks: { entry: LibraryEntry; step: string; why: string }[];
}) {
  return (
    <ol role="list" className="grid gap-6 md:grid-cols-3 md:gap-7">
      {picks.map(({ entry, step, why }, index) => (
        <li key={entry.slug}>
          <article
            aria-labelledby={`start-${entry.slug}`}
            className={`${styles.cover} px-7 pb-7 pl-9 pt-8`}
          >
            <p className="flex items-baseline justify-between text-[11px] uppercase tracking-[0.24em] text-[#4f7ca7] [font-family:var(--font-label)]">
              <span>
                {String(index + 1).padStart(2, "0")} · {step}
              </span>
              <span className="text-[#1a2942]/40">{entry.callNumber}</span>
            </p>

            <h3
              id={`start-${entry.slug}`}
              className="mt-8 text-balance text-[1.7rem] font-medium leading-[1.15] tracking-tight text-[#1a2942]"
            >
              {entry.title}
            </h3>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#1a2942]/45 [font-family:var(--font-label)]">
              {entry.kind}
              {entry.length ? ` · ${entry.length}` : ""}
            </p>

            <p className="mt-6 flex-1 border-t border-[#1a2942]/10 pt-5 text-[15px] italic leading-7 text-[#41567a] [font-family:var(--font-heading)]">
              {why}
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              {entry.files.map((file) => (
                <a
                  key={file.url}
                  href={file.url}
                  download
                  aria-label={`Download ${entry.title} (${file.format}, ${file.size})`}
                  className={`${styles.paperFile} no-accent-link`}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  {file.format}
                </a>
              ))}
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}

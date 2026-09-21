"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import type { Shelf } from "@/lib/resources/library";

import styles from "./library.module.css";

/**
 * The full collection, shelf by shelf. Desktop gets a sticky shelf index
 * that tracks the reader's position; every viewport gets an "editable
 * files" filter for founders who want to adapt rather than print.
 * Without JavaScript this is a complete, static catalogue.
 */
export function Catalog({
  shelves,
  editableCount,
}: {
  shelves: Shelf[];
  editableCount: number;
}) {
  const [editableOnly, setEditableOnly] = useState(false);
  // Entries only re-enter after the reader filters — never on first paint.
  const [filtered, setFiltered] = useState(false);
  const [active, setActive] = useState(shelves[0]?.key);

  useEffect(() => {
    const targets = shelves
      .map((s) => document.getElementById(s.key))
      .filter((el): el is HTMLElement => el !== null);
    if (!targets.length || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id as Shelf["key"]);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [shelves]);

  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={editableOnly}
      onClick={() => {
        setFiltered(true);
        setEditableOnly((v) => !v);
      }}
      className={styles.toggle}
    >
      <span className={styles.toggleTrack} aria-hidden="true" />
      <span>
        Editable files only{" "}
        <span className="text-white/40 [font-family:var(--font-label)]">
          ({editableCount})
        </span>
      </span>
    </button>
  );

  return (
    <div className="grid gap-12 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
      <aside className="lg:sticky lg:top-[calc(var(--header-height)+40px)] lg:self-start">
        <nav aria-label="Shelves" className="hidden lg:block">
          <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-white/40 [font-family:var(--font-label)]">
            Shelves
          </p>
          <ul role="list" className="border-l border-white/10">
            {shelves.map((shelf) => (
              <li key={shelf.key}>
                <a
                  href={`#${shelf.key}`}
                  aria-current={active === shelf.key ? "true" : undefined}
                  className={`${styles.shelfNavLink} no-accent-link`}
                >
                  <span className="text-sm">{shelf.name}</span>
                  <span className="text-xs tabular-nums text-white/35 [font-family:var(--font-label)]">
                    {shelf.entries.length}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="lg:mt-8 lg:border-t lg:border-white/10 lg:pt-6">{toggle}</div>
        <p className="mt-2 max-w-xs text-xs leading-5 text-white/40">
          DOCX and XLSX files open in Word, Google Docs, Excel, or Sheets.
          PDFs are ready to print.
        </p>
      </aside>

      <div className="space-y-20 lg:space-y-24">
        {shelves.map((shelf) => {
          const entries = editableOnly
            ? shelf.entries.filter((e) => e.editable)
            : shelf.entries;
          return (
            <section
              key={shelf.key}
              id={shelf.key}
              aria-labelledby={`${shelf.key}-title`}
              className="scroll-mt-[calc(var(--header-height)+40px)]"
            >
              <header className="grid gap-x-8 gap-y-3 md:grid-cols-[4.5rem_minmax(0,1fr)]">
                <p
                  aria-hidden="true"
                  className="text-5xl font-medium leading-none text-[#d27a2c]/80 [font-family:var(--font-heading)] md:text-6xl"
                >
                  {shelf.numeral}
                </p>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/40 [font-family:var(--font-label)]">
                    {shelf.name} ·{" "}
                    {editableOnly ? `${entries.length} of ` : ""}
                    {shelf.entries.length}{" "}
                    {shelf.entries.length === 1 ? "title" : "titles"}
                  </p>
                  <h3
                    id={`${shelf.key}-title`}
                    className="mt-2 text-3xl font-medium tracking-tight text-white sm:text-4xl"
                  >
                    {shelf.title}
                  </h3>
                  <p className="mt-3 max-w-xl leading-7 text-white/55">
                    {shelf.description}
                  </p>
                </div>
              </header>

              <ul role="list" className="mt-10 border-b border-white/[0.07]">
                {entries.map((entry) => (
                  <li
                    key={`${entry.slug}-${editableOnly}`}
                    className={`${styles.entry} ${filtered ? styles.entryIn : ""}`}
                  >
                    <p className="hidden text-xs tabular-nums text-white/35 [font-family:var(--font-label)] md:block md:pt-1.5">
                      {entry.callNumber}
                    </p>
                    <div className="max-w-2xl">
                      <h4
                        className={`${styles.entryTitle} text-xl font-medium leading-snug tracking-tight text-white [font-family:var(--font-heading)]`}
                      >
                        {entry.title}
                      </h4>
                      <p className="mt-1.5 text-[11px] uppercase tracking-[0.2em] text-white/40 [font-family:var(--font-label)]">
                        <span className="text-white/30 md:hidden">
                          {entry.callNumber} ·{" "}
                        </span>
                        {entry.kind}
                        {entry.length ? ` · ${entry.length}` : ""}
                      </p>
                      {entry.description ? (
                        <p className="mt-3 text-[15px] leading-7 text-white/60">
                          {entry.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end md:pt-1">
                      {entry.files.map((file) => (
                        <a
                          key={file.url}
                          href={file.url}
                          download
                          aria-label={`Download ${entry.title} (${file.format}, ${file.size})`}
                          className={`${styles.file} no-accent-link`}
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          {file.format}
                          <span className="font-normal text-white/40">{file.size}</span>
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
                {entries.length === 0 ? (
                  <li className="border-t border-white/[0.07] py-7 text-sm text-white/45">
                    Nothing on this shelf comes in an editable format yet.
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

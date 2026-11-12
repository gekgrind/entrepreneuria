"use client";

import Image from "next/image";
import { Check, ExternalLink } from "lucide-react";
import { useCallback, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";

import type { WebsiteDemo } from "@/lib/services/websites/demos";

import { useSelection } from "./SelectionContext";
import s from "./websites.module.css";

const WIDE_QUERY = "(min-width: 1000px)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Three-design gallery: all cards side by side at 1000px and up; below
 * that, one design at a time behind an ARIA tablist (arrow keys, Home,
 * End). Server render (and no-JS) shows every card with no tab roles.
 */
export function DesignGallery({ demos }: { demos: readonly WebsiteDemo[] }) {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true
  );
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { style, setStyle } = useSelection();

  const pick = useCallback(
    (i: number, focus: boolean) => {
      const next = (i + demos.length) % demos.length;
      setActive(next);
      if (focus) tabRefs.current[next]?.focus();
    },
    [demos.length]
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const map: Record<string, number> = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: demos.length - 1 };
    const target = map[e.key];
    if (target === undefined) return;
    e.preventDefault();
    pick(target, true);
  };

  return (
    <div className={s.gallery}>
      <div className={s.gtabs} role="tablist" aria-label="Sample website designs" hidden={wide} onKeyDown={onKeyDown}>
        {demos.map((d, i) => (
          <button
            key={d.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            className={s.gtab}
            role="tab"
            type="button"
            id={`tab-${d.id}`}
            aria-controls={`dc-${d.id}`}
            aria-selected={i === active}
            tabIndex={i === active ? 0 : -1}
            onClick={() => pick(i, false)}
          >
            {d.design}
          </button>
        ))}
      </div>

      <div className={s.demoGrid}>
        {demos.map((d, i) => {
          const pressed = style === d.style;
          return (
            <article
              key={d.id}
              className={s.demo}
              id={`dc-${d.id}`}
              hidden={!wide && i !== active}
              {...(wide
                ? { "aria-labelledby": `dn-${d.id}` }
                : { role: "tabpanel", "aria-labelledby": `tab-${d.id}` })}
            >
              <div className={s.dstage}>
                <a className={s.dframe} href={d.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
                  <div className={s.laptop}>
                    <div className={s.laptopBar} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                    <Image
                      className={s.shot}
                      src={d.desktop.src}
                      alt={d.desktop.alt}
                      width={d.desktop.width}
                      height={d.desktop.height}
                      sizes="(min-width: 1000px) 380px, (min-width: 640px) 55vw, 92vw"
                    />
                  </div>
                </a>
                <div className={s.phone}>
                  <div className={s.phoneScreen}>
                    <Image
                      className={s.shot}
                      src={d.mobile.src}
                      alt={d.mobile.alt}
                      width={d.mobile.width}
                      height={d.mobile.height}
                      sizes="(min-width: 1000px) 100px, 25vw"
                    />
                  </div>
                </div>
              </div>

              <div className={s.dbody}>
                <span className={s.badge}>Fictional example</span>
                <h3 id={`dn-${d.id}`}>{d.design}</h3>
                <p className={s.dbiz}>{d.business}</p>
                <p className={s.dpos}>{d.position}</p>
                <p className={s.dstyle}>{d.description}</p>
                <div className={s.swatches} aria-hidden="true">
                  {d.palette.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </div>
                <div className={s.dact}>
                  <a
                    className={`${s.btn} ${s.btnPrimary}`}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View live demo of ${d.business}, a fictional example (opens in a new tab)`}
                  >
                    View Live Demo <ExternalLink aria-hidden="true" />
                  </a>
                  <button
                    className={`${s.btn} ${s.btnGhost} ${s.pickStyle}`}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => setStyle(pressed ? "" : d.style)}
                  >
                    <Check className={s.pickIcon} aria-hidden="true" />
                    Use this style for my preview<span className="sr-only"> ({d.design})</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Polite live note under the preview copy announcing the chosen style. */
export function StyleSelectionNote({ demos }: { demos: readonly WebsiteDemo[] }) {
  const { style } = useSelection();
  const d = demos.find((x) => x.style === style);
  return (
    <p className={s.psSel} role="status" aria-live="polite">
      {d ? `Style selected for your preview: ${d.design}. You can change it in the request form.` : ""}
    </p>
  );
}

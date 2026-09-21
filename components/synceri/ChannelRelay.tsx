import type { CSSProperties, ReactNode } from "react";

import { Stage } from "./Stage";
import styles from "./synceri.module.css";

/**
 * ChannelRelay — one day, one intelligence, four surfaces.
 *
 * The argument is continuity, so the figure is a single rail with the
 * light handed along it rather than four independent tiles.
 *
 * Earlier this leaned on the tile's own silhouette to say which surface
 * you were looking at — a tall box for the phone, a squircle for the
 * watch. That works only while the tiles sit side by side. Stacked on a
 * phone, which is the viewport this product is most about, they all
 * became the same full-width rounded rectangle and the entire
 * cross-surface idea disappeared. The surface is now said by a small
 * drawn glyph, which survives any container.
 *
 * Deliberately not device mockups: line glyphs in the page's own stroke
 * language, no photoreal chrome, no image assets, no dependency. Four
 * stops rather than five, and only the one genuinely uncommitted
 * surface carries a "planned" mark — a section headlined "it meets you
 * where the day is happening" cannot be three-fifths hypothetical.
 */

type Surface = "phone" | "watch" | "web" | "voice";

type Stop = {
  channel: string;
  surface: Surface;
  when: string;
  line: string;
  planned?: boolean;
};

const STOPS: Stop[] = [
  {
    channel: "Phone",
    surface: "phone",
    when: "7:10 AM",
    line: "Three things today. The first isn't until 11.",
  },
  {
    channel: "Watch",
    surface: "watch",
    when: "1:52 PM",
    line: "Pediatrician in 25. Leave in 10.",
  },
  {
    channel: "Web",
    surface: "web",
    when: "3:20 PM",
    line: "Here's the insurance letter you asked about, and what it says.",
  },
  {
    channel: "Voice",
    surface: "voice",
    when: "6:10 PM",
    line: "Driving home. “Remind me to sign the permission slip tonight.”",
    planned: true,
  },
];

/**
 * The surfaces, drawn rather than photographed. Hairline, cyan, one
 * size, no fill — the same stroke language as the context field, so
 * these read as part of the page rather than as stock iconography.
 */
const GLYPH: Record<Surface, ReactNode> = {
  phone: (
    <>
      <rect x="15" y="4" width="14" height="36" rx="4" />
      <line x1="19.5" y1="9" x2="24.5" y2="9" />
    </>
  ),
  watch: (
    <>
      <rect x="13" y="13" width="18" height="18" rx="6" />
      <path d="M18 13V8h8v5" />
      <path d="M18 31v5h8v-5" />
    </>
  ),
  web: (
    <>
      <rect x="4" y="9" width="36" height="26" rx="3" />
      <line x1="4" y1="16" x2="40" y2="16" />
      <circle cx="8.5" cy="12.5" r="1" />
      <circle cx="12.5" cy="12.5" r="1" />
    </>
  ),
  voice: (
    <>
      <line x1="9" y1="18" x2="9" y2="26" />
      <line x1="16" y1="13" x2="16" y2="31" />
      <line x1="23" y1="9" x2="23" y2="35" />
      <line x1="30" y1="15" x2="30" y2="29" />
      <line x1="37" y1="20" x2="37" y2="24" />
    </>
  ),
};

function SurfaceGlyph({ surface }: { surface: Surface }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 44 44"
      className="h-11 w-11 shrink-0"
      fill="none"
      stroke="#00d4ff"
      strokeOpacity="0.72"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPH[surface]}
    </svg>
  );
}

export function ChannelRelay() {
  return (
    <Stage className={`${styles.relay} ${styles.seq} relative`}>
      {/* The rail, and the light travelling down it. Desktop only:
          stacked, the stops already read top-to-bottom. */}
      <div
        aria-hidden="true"
        className="pointer-events-none relative mb-8 hidden h-px xl:block"
      >
        <div className={`${styles.bridgeX} h-px w-full`} />
        <div data-syn-pulse="" className="absolute inset-y-0 left-0 w-full">
          <span className="absolute -top-[3px] left-0 h-[7px] w-[7px] rounded-full bg-intelligence shadow-[0_0_10px_rgba(0,212,255,0.9)]" />
        </div>
      </div>

      <ol className="relative grid gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        {STOPS.map((stop, i) => (
          <li
            key={stop.channel}
            data-syn-item=""
            className="flex"
            style={{ "--syn-delay": `${i * 110}ms` } as CSSProperties}
          >
            <div
              className={`${styles.surface} flex w-full flex-col rounded-2xl border border-white/[0.09] p-6`}
            >
              <SurfaceGlyph surface={stop.surface} />

              <p className="type-label mt-5 text-white/70">{stop.channel}</p>
              <p className="type-label mt-2 text-white/35">{stop.when}</p>
              <p className="mt-3 flex-1 text-[15px] leading-7 text-white/80">
                {stop.line}
              </p>

              {stop.planned ? (
                <p className="type-label mt-5 text-white/30">Planned</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Stage>
  );
}

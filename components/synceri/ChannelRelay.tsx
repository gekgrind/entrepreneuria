import { Mic, Monitor, PhoneCall, Smartphone, Watch } from "lucide-react";
import type { CSSProperties } from "react";

import { Stage } from "./Stage";
import styles from "./synceri.module.css";

/**
 * ChannelRelay — one day, one intelligence, five surfaces.
 *
 * The argument here is continuity, so the figure is built as a single
 * rail with the light handed along it rather than five independent
 * tiles. Each stop keeps its own shape — a tall surface for the phone,
 * a squircle for the watch, a wide one for the desk — because the
 * shapes are what make "same thing, different surface" land without a
 * caption saying so.
 *
 * No fabricated device chrome and no fake screenshots: these are
 * silhouettes holding a real line of assistance, which is what we can
 * honestly show for a product still in development.
 *
 * Surfaces that don't exist yet carry a quiet "planned" mark rather
 * than a disclaimer paragraph.
 */

type Stop = {
  channel: string;
  icon: typeof Smartphone;
  when: string;
  line: string;
  /** Shape of the silhouette — the thing that says which surface. */
  shape: "tall" | "square" | "wide" | "round";
  planned?: boolean;
};

const STOPS: Stop[] = [
  {
    channel: "Phone",
    icon: Smartphone,
    when: "7:10 AM",
    line: "Three things today. The first isn't until 11.",
    shape: "tall",
  },
  {
    channel: "Voice",
    icon: Mic,
    when: "8:35 AM",
    line: "Driving. “Remind me to call the plumber when I'm home.”",
    shape: "round",
    planned: true,
  },
  {
    channel: "Watch",
    icon: Watch,
    when: "1:52 PM",
    line: "Pediatrician in 25. Leave in 10.",
    shape: "square",
    planned: true,
  },
  {
    channel: "Web",
    icon: Monitor,
    when: "3:20 PM",
    line: "Here's the insurance letter you asked about, and what it says.",
    shape: "wide",
  },
  {
    channel: "Call",
    icon: PhoneCall,
    when: "6:50 PM",
    line: "You asked me to call before evening meetings. Yours starts at 7.",
    shape: "round",
    planned: true,
  },
];

/* The silhouettes. Heights apply from `sm` up, where the stops sit side
   by side and the difference reads as "different surface"; stacked on a
   phone the same heights would just be dead space under short lines. */
const SHAPE: Record<Stop["shape"], string> = {
  tall: "rounded-[1.5rem] sm:min-h-[208px]",
  square: "rounded-[1.75rem] sm:min-h-[168px]",
  wide: "rounded-xl sm:min-h-[152px]",
  round: "rounded-[2.5rem] sm:min-h-[184px]",
};

export function ChannelRelay() {
  return (
    <Stage className={`${styles.relay} ${styles.seq} relative`}>
      {/* The rail, and the light travelling down it. Desktop only:
          stacked, the stops already read top-to-bottom. */}
      <div
        aria-hidden="true"
        className="pointer-events-none relative mb-7 hidden h-px xl:block"
      >
        <div className={`${styles.bridgeX} h-px w-full`} />
        <div data-syn-pulse="" className="absolute inset-y-0 left-0 w-full">
          <span className="absolute -top-[3px] left-0 h-[7px] w-[7px] rounded-full bg-intelligence shadow-[0_0_10px_rgba(0,212,255,0.9)]" />
        </div>
      </div>

      <ol className="relative grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-5 xl:gap-4">
        {STOPS.map((stop, i) => {
          const Icon = stop.icon;
          return (
            <li
              key={stop.channel}
              data-syn-item=""
              className="flex"
              style={{ "--syn-delay": `${i * 110}ms` } as CSSProperties}
            >
              <div
                className={`${styles.surface} flex w-full flex-col border border-white/[0.09] p-5 ${SHAPE[stop.shape]}`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    aria-hidden="true"
                    className="h-[18px] w-[18px] text-intelligence/75"
                  />
                  <span className="type-label text-white/70">
                    {stop.channel}
                  </span>
                </div>

                <p className="type-label mt-4 text-white/35">{stop.when}</p>
                <p className="mt-2 flex-1 text-[15px] leading-7 text-white/80">
                  {stop.line}
                </p>

                {stop.planned ? (
                  <p className="type-label mt-4 text-white/30">Planned</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Stage>
  );
}

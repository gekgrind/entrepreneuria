import type { CSSProperties } from "react";

import { Stage } from "./Stage";
import styles from "./synceri.module.css";

/**
 * DayThread — one commitment, followed all the way through.
 *
 * Every assistant on the market can store "Zoom, Thursday, 7pm". The
 * thing worth showing is what happens in the days after that: the
 * reminder that says there is nothing to do yet, the one that says
 * there is, and — the beat this whole section exists for — the moment
 * Synceri notices a pattern in how someone actually behaves and asks
 * permission to help differently.
 *
 * It asks. It does not decide. That distinction is the difference
 * between proactive and irritating, and it is a copy decision as much
 * as a product one.
 *
 * Rendered as a single ordered list on a warm-to-cool rail, so the
 * whole progression is legible at rest and to assistive tech. Motion
 * only staggers the arrival.
 */

type Moment = {
  when: string;
  voice: "you" | "synceri";
  line: string;
  /** The learned beat — held apart from the day's sequence. */
  learned?: boolean;
};

const MOMENTS: Moment[] = [
  {
    when: "Monday",
    voice: "you",
    line: "I have a Zoom Thursday at 7.",
  },
  {
    when: "Thursday, 7:40 AM",
    voice: "synceri",
    line: "Your Zoom is tonight at 7. Nothing you need to do for it yet.",
  },
  {
    when: "6:30 PM",
    voice: "synceri",
    line: "Your Zoom starts in 30 minutes.",
  },
  {
    when: "6:55 PM",
    voice: "synceri",
    line: "Five minutes. Ready to join?",
  },
  {
    when: "A few weeks later",
    voice: "synceri",
    learned: true,
    line: "Evening meetings seem easier to miss than the rest of your week. Want me to call you ten minutes before them?",
  },
];

export function DayThread() {
  return (
    <Stage className={`${styles.seq} relative`}>
      <span
        aria-hidden="true"
        className={`${styles.bridge} pointer-events-none absolute bottom-10 left-[7px] top-4 w-px sm:left-[9px]`}
      />

      <ol className="flex flex-col gap-9 sm:gap-11">
        {MOMENTS.map((moment, i) => {
          const isYou = moment.voice === "you";
          return (
            <li
              key={moment.when}
              data-syn-item=""
              className="relative flex gap-5 sm:gap-7"
              style={{ "--syn-delay": `${i * 90}ms` } as CSSProperties}
            >
              <span
                aria-hidden="true"
                className={`relative z-10 mt-[9px] h-[15px] w-[15px] shrink-0 rounded-full border sm:h-[19px] sm:w-[19px] ${
                  isYou
                    ? "border-human/50 bg-human/25"
                    : moment.learned
                      ? "border-intelligence/60 bg-intelligence/25"
                      : "border-white/20 bg-void-900"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="type-label flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className={isYou ? "text-human/80" : "text-intelligence/80"}>
                    {isYou ? "You" : "Synceri"}
                  </span>
                  <span className="text-white/35">{moment.when}</span>
                </p>
                <p
                  className={`mt-2.5 max-w-xl text-balance leading-8 ${
                    moment.learned
                      ? "type-display-sm text-white"
                      : "text-[17px] text-white/80"
                  }`}
                >
                  {moment.line}
                </p>
                {moment.learned ? (
                  <p className="mt-4 max-w-md leading-7 text-white/50">
                    It asks. It doesn&apos;t decide. Nothing changes about how
                    Synceri reaches you unless you say yes.
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Stage>
  );
}

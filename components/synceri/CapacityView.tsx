import type { CSSProperties } from "react";

import { Stage } from "./Stage";
import styles from "./synceri.module.css";

/**
 * CapacityView — the same Tuesday, twice.
 *
 * On the left, what a task manager does with an overloaded day: it
 * counts. Nineteen rows, every one of them equally red, which is
 * precisely as useful as zero rows. The column is deliberately dense
 * and low-contrast; it should feel like something you'd close.
 *
 * On the right, four things, each with the reason it made the cut, and
 * an explicit promise about the other fifteen. The reason is the
 * product: a shortlist without one is just a shorter list you still
 * don't trust.
 *
 * The left column recedes rather than disappearing when the figure
 * arrives — the fifteen are still there, they're just not today's
 * problem. Nothing is hidden from anyone reading this at rest or with
 * motion off.
 */

const OVERDUE = [
  "Reschedule dentist",
  "Order dog food",
  "Permission slip",
  "Call insurance about the claim",
  "Pediatrician — 2:15",
  "Electric bill",
  "Reply to Dana",
  "Book oil change",
  "Return the blue jacket",
  "Water filter",
  "Renew library books",
  "Find the warranty for the dryer",
  "RSVP — Saturday",
  "Grocery pickup, 5:30",
  "Sign up for swim lessons",
  "Update the emergency contact form",
  "Cancel the trial",
  "Photos off the phone",
  "Ask Jamie about the carpool",
];

const SHORTLIST = [
  { title: "Pediatrician, 2:15", reason: "Can't move, and it's today." },
  { title: "Electric bill", reason: "Due today. Two minutes." },
  { title: "Permission slip", reason: "Due tomorrow, and it needs a signature." },
  { title: "Reply to Dana", reason: "She's waiting on you to book the room." },
];

export function CapacityView() {
  return (
    <Stage className={`${styles.capacity} ${styles.seq}`}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] lg:gap-16">
        {/* What a list does with a hard day. Below `sm` the column is
            masked off rather than made to scroll past nineteen rows
            before the point arrives — a wall is the correct reading of
            it anyway. */}
        <div data-syn-noise="">
          <p className="type-label text-white/40">A list</p>
          <p className="type-display-sm mt-4 text-white/50">19 overdue</p>
          <p className="mt-2.5 max-w-[26ch] leading-7 text-white/40">
            All equally urgent, which is the same as none of them being
            urgent.
          </p>
          <ul
            className="mt-6 max-h-[268px] space-y-[7px] overflow-hidden border-t border-white/[0.07] pt-6 [mask-image:linear-gradient(180deg,#000_58%,transparent_100%)] sm:max-h-none sm:[mask-image:none]"
            aria-label="Nineteen overdue tasks, undifferentiated"
          >
            {OVERDUE.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 text-[13px] leading-5 text-white/35"
              >
                <span
                  aria-hidden="true"
                  className="h-1 w-1 shrink-0 rounded-full bg-white/25"
                />
                <span className="truncate">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* What Synceri does with the same day */}
        <div>
          <p className="type-label text-intelligence/80">Synceri</p>
          <p className="type-display-sm mt-4 max-w-md text-balance text-white">
            Four things actually need you today.
          </p>

          <ol className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {SHORTLIST.map((item, i) => (
              <li
                key={item.title}
                data-syn-item=""
                className="flex flex-col gap-1.5 py-5 sm:flex-row sm:items-baseline sm:gap-6"
                style={{ "--syn-delay": `${250 + i * 110}ms` } as CSSProperties}
              >
                <span className="font-semibold text-white sm:w-[13rem] sm:shrink-0">
                  {item.title}
                </span>
                <span className="leading-7 text-white/60">{item.reason}</span>
              </li>
            ))}
          </ol>

          <p
            data-syn-item=""
            className="mt-7 max-w-md leading-8 text-white/70"
            style={{ "--syn-delay": "700ms" } as CSSProperties}
          >
            The other fifteen can wait. They&apos;re not gone — Synceri brings
            them back when they actually matter.
          </p>
        </div>
      </div>
    </Stage>
  );
}

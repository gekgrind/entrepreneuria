import type { CSSProperties } from "react";

import { Stage } from "./Stage";
import styles from "./synceri.module.css";

/**
 * CirclePermissions — shared context, drawn as a permission table
 * rather than a family portrait.
 *
 * Every product in this category eventually ships something like
 * Circles, and every one of them has the same problem: shared context
 * is one design decision away from surveillance. So the figure leads
 * with the boundary, not the benefit. The most important row is the
 * last one — everything else, shared with nobody — and it is styled to
 * be the row you remember.
 *
 * Nothing here is a toggle you can actually flip: Synceri is in
 * development, and a working control would be claiming a product that
 * doesn't ship yet. It is a statement of the model, and the section
 * around it says so.
 */

type Row = {
  what: string;
  who: string;
  /** The default: not shared. */
  private?: boolean;
};

const ROWS: Row[] = [
  { what: "The shopping list", who: "Everyone in the household" },
  { what: "Appointments you mark shared", who: "Your partner" },
  { what: "School dates and pickups", who: "Your partner, your mum" },
  { what: "Who's covering what this week", who: "Everyone in the household" },
  { what: "Everything else", who: "Nobody", private: true },
];

const MEMBERS = ["You", "Sam", "Mum"];

export function CirclePermissions() {
  return (
    <Stage className={`${styles.seq}`}>
      <div
        className={`${styles.surface} overflow-hidden rounded-2xl border border-white/[0.09]`}
      >
        <div
          aria-hidden="true"
          className={`${styles.catchlight} h-px w-full`}
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-white/[0.07] px-5 py-4 sm:px-7">
          <span className="type-label text-white/70">Household</span>
          <ul className="flex items-center gap-2">
            {MEMBERS.map((member) => (
              <li
                key={member}
                className="rounded-full border border-white/12 px-3 py-1 text-xs text-white/65"
              >
                {member}
              </li>
            ))}
          </ul>
          <span className="type-label ml-auto hidden text-white/35 sm:inline">
            You control every row
          </span>
        </div>

        <dl className="divide-y divide-white/[0.07]">
          {ROWS.map((row, i) => (
            <div
              key={row.what}
              data-syn-item=""
              className="flex flex-col gap-1.5 px-5 py-5 sm:flex-row sm:items-baseline sm:gap-6 sm:px-7"
              style={{ "--syn-delay": `${i * 90}ms` } as CSSProperties}
            >
              <dt
                className={`sm:flex-1 ${
                  row.private ? "font-semibold text-white" : "text-white/80"
                }`}
              >
                {row.what}
              </dt>
              <dd
                className={`flex items-center gap-2.5 text-[15px] sm:w-[16rem] sm:shrink-0 ${
                  row.private ? "text-human" : "text-white/55"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    row.private ? "bg-human" : "bg-intelligence/60"
                  }`}
                />
                {row.who}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Stage>
  );
}

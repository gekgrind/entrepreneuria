import { spellCount } from "@/lib/resources/library";

import styles from "./about.module.css";

/**
 * The hero's figure: every job a solo founder holds, fanning back into
 * one point. It is the page's thesis stated as geometry rather than a
 * paragraph — and the reason the rest of the page exists.
 *
 * The roles are real content (a labelled list); the fan is decoration
 * and stays out of the accessibility tree. Geometry and type stay in
 * register because the rows have a fixed height and the fan stretches
 * to fill exactly that height (`preserveAspectRatio="none"`), so spoke
 * `i` always lands on row `i`'s center line at any viewport width.
 *
 * Server component — the arrival plays from CSS, so nothing about this
 * moment costs JavaScript.
 */

/** The last one is the founder's own: it is the job nothing replaces. */
const ROLES = [
  "Strategist",
  "Researcher",
  "Marketer",
  "Salesperson",
  "Product manager",
  "Analyst",
  "Operator",
  "Administrator",
  "Decision-maker",
] as const;

const UNIT = 10;
const NODE_X = 12;
const HEIGHT = ROLES.length * UNIT;

export function RoleFan() {
  return (
    <figure className="w-full max-w-md">
      <figcaption className="type-kicker mb-5 flex items-baseline justify-between gap-4 text-white/55">
        <span>One person</span>
        <span>{spellCount(ROLES.length)} jobs</span>
      </figcaption>

      <div className="flex items-stretch">
        <div className={styles.fanRail}>
          <div className={styles.fanClip}>
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox={`0 0 100 ${HEIGHT}`}
              preserveAspectRatio="none"
              className={styles.fan}
            >
              {ROLES.map((role, i) => (
                <line
                  key={role}
                  x1={NODE_X}
                  y1={HEIGHT / 2}
                  x2={100}
                  y2={i * UNIT + UNIT / 2}
                  className={`${styles.spoke} ${
                    i === ROLES.length - 1 ? styles.spokeHuman : ""
                  }`}
                />
              ))}
            </svg>
          </div>
          <span aria-hidden="true" className={styles.node} />
        </div>

        <ul aria-label="What a solo founder is expected to be" className={styles.roles}>
          {ROLES.map((role, i) => (
            <li
              key={role}
              style={{ "--row": i } as React.CSSProperties}
              className={`type-label ${styles.role} ${
                i === ROLES.length - 1 ? styles.roleHuman : ""
              }`}
            >
              {role}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 max-w-[34ch] text-sm leading-6 text-white/55">
        Every one of them lands in the same chair. The last one is the only
        one worth keeping there.
      </p>
    </figure>
  );
}

import type { ToolOutput } from "@/lib/resources/tools";

import styles from "./tools.module.css";

/**
 * A schematic of what each tool hands back — the *shape* of the output,
 * never a fake screenshot. Resting state is complete (touch devices never
 * hover); hovering or focusing the parent card (`styles.tool`) plays a
 * small, output-specific motion. Reduced motion keeps the resting state.
 */
export function ToolPreview({ output }: { output: ToolOutput }) {
  return (
    <svg
      viewBox="0 0 200 104"
      aria-hidden="true"
      focusable="false"
      className={styles.preview}
    >
      {PREVIEWS[output]}
    </svg>
  );
}

const line = (x: number, y: number, w: number, key?: string, cls = styles.ink) => (
  <rect key={key} x={x} y={y} width={w} height={3} rx={1.5} className={cls} />
);

const PREVIEWS: Record<ToolOutput, React.ReactNode> = {
  /* Canvas: six blocks fill in, one after another. */
  blueprint: (
    <g>
      {[0, 1, 2].map((col) =>
        [0, 1].map((row) => {
          const i = row * 3 + col;
          return (
            <rect
              key={i}
              x={8 + col * 63}
              y={8 + row * 47}
              width={58}
              height={42}
              rx={5}
              className={`${styles.frame} ${styles.cell}`}
              style={{ transitionDelay: `${i * 60}ms` }}
            />
          );
        }),
      )}
      {[0, 1, 2].map((col) => (
        <g key={col}>
          {line(16 + col * 63, 18, 30)}
          {line(16 + col * 63, 26, 40, undefined, styles.inkSoft)}
          {line(16 + col * 63, 65, 24)}
          {line(16 + col * 63, 73, 36, undefined, styles.inkSoft)}
        </g>
      ))}
    </g>
  ),

  /* Four research pillars converge into one report. */
  report: (
    <g>
      {[0, 1, 2, 3].map((i) => (
        <g key={i} className={styles.pillar} style={{ transitionDelay: `${i * 50}ms` }}>
          <rect x={8 + i * 30} y={10} width={24} height={84} rx={4} className={styles.frame} />
          {line(13 + i * 30, 20, 14)}
          {line(13 + i * 30, 28, 10, undefined, styles.inkSoft)}
          {line(13 + i * 30, 36, 12, undefined, styles.inkSoft)}
        </g>
      ))}
      <path d="M128 52 H140" className={styles.wire} />
      <rect x={142} y={10} width={50} height={84} rx={5} className={`${styles.frame} ${styles.focus}`} />
      {line(150, 22, 26, "r1", styles.accent)}
      {line(150, 32, 34)}
      {line(150, 40, 30, "r3", styles.inkSoft)}
      {line(150, 48, 34, "r4", styles.inkSoft)}
      {line(150, 60, 22)}
      {line(150, 68, 32, "r6", styles.inkSoft)}
      {line(150, 76, 28, "r7", styles.inkSoft)}
    </g>
  ),

  /* Bars climb past the break-even line. */
  projection: (
    <g>
      <path d="M8 94 H192" className={styles.axis} />
      {[22, 30, 36, 46, 52, 62, 70, 80].map((h, i) => (
        <rect
          key={i}
          x={14 + i * 22}
          y={94 - h}
          width={14}
          height={h}
          rx={3}
          className={`${styles.bar} ${i >= 4 ? styles.barUp : ""}`}
          style={{ transitionDelay: `${i * 40}ms` }}
        />
      ))}
      <path d="M8 48 H192" className={styles.breakeven} />
      <circle cx={102} cy={48} r={3.5} className={styles.dot} />
    </g>
  ),

  /* Three distinct people, drawn apart when compared. */
  personas: (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i} className={styles[`persona${i}` as "persona0"]}>
          <rect x={10 + i * 62} y={10} width={56} height={84} rx={6} className={`${styles.frame} ${i === 1 ? styles.focus : ""}`} />
          <circle cx={38 + i * 62} cy={32} r={10} className={i === 1 ? styles.accentFill : styles.inkFill} />
          {line(22 + i * 62, 52, 32)}
          {line(22 + i * 62, 60, 24, undefined, styles.inkSoft)}
          {line(22 + i * 62, 72, 28, undefined, styles.inkSoft)}
          {line(22 + i * 62, 80, 20, undefined, styles.inkSoft)}
        </g>
      ))}
    </g>
  ),

  /* A stack of slides fans out into a sequence. */
  deck: (
    <g>
      {[3, 2, 1, 0].map((i) => (
        <g key={i} className={styles[`slide${i}` as "slide0"]}>
          <rect x={46} y={14} width={108} height={70} rx={5} className={`${styles.frame} ${styles.slideFace} ${i === 0 ? styles.focus : ""}`} />
          {i === 0 ? (
            <>
              {line(58, 30, 54, "d1", styles.accent)}
              {line(58, 42, 80)}
              {line(58, 50, 70, "d3", styles.inkSoft)}
              {line(58, 58, 74, "d4", styles.inkSoft)}
              {line(58, 70, 30, "d5", styles.inkSoft)}
            </>
          ) : null}
        </g>
      ))}
    </g>
  ),

  /* Role → shortlist → interview: checks tick down the list. */
  hiring: (
    <g>
      <rect x={8} y={10} width={70} height={84} rx={5} className={styles.frame} />
      {line(16, 22, 40, "h1", styles.accent)}
      {line(16, 32, 52)}
      {line(16, 40, 46, "h3", styles.inkSoft)}
      {line(16, 48, 50, "h4", styles.inkSoft)}
      {line(16, 60, 36)}
      {line(16, 68, 48, "h6", styles.inkSoft)}
      {line(16, 76, 42, "h7", styles.inkSoft)}
      <path d="M82 52 H92" className={styles.wire} />
      <rect x={96} y={10} width={96} height={84} rx={5} className={`${styles.frame} ${styles.focus}`} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={106} y={20 + i * 18} width={10} height={10} rx={3} className={styles.box} />
          <path
            d={`M108.5 ${25 + i * 18} l2.2 2.2 l4 -4.4`}
            className={styles.check}
            style={{ transitionDelay: `${i * 90}ms` }}
          />
          {line(124, 23.5 + i * 18, [52, 40, 58, 34][i], `hl${i}`, styles.inkSoft)}
        </g>
      ))}
    </g>
  ),
};

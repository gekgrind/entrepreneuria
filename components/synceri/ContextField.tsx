import { Stage } from "./Stage";
import styles from "./synceri.module.css";

/**
 * ContextField — what Synceri understands about one person's life.
 *
 * The brief for this figure was "not a node graph that looks like
 * enterprise database software", and the difference is mostly
 * restraint: no boxes, no arrowheads, no edge labels, no grid. What's
 * left is a warm centre (the person), soft orbits, eight things that
 * orbit at genuinely different distances — because an even ring reads
 * as a diagram and an uneven one reads as a life — and threads that run
 * from the person's orange out to the product's cyan.
 *
 * The three faint cross-links are the actual argument: the pieces are
 * connected to each other, not just to a database row. That is the
 * whole difference between storing facts and understanding a life.
 *
 * Labels are HTML positioned over the SVG rather than <text>. SVG text
 * scales with the viewBox, which at 390px wide rendered them at about
 * 7px — unreadable on exactly the device this product is mostly for.
 * As HTML they stay at a real type size at every width, and below `sm`
 * — where eight labels around a 340px circle would collide whatever
 * size they were — they step aside for a legend beneath the figure.
 *
 * Geometry is computed from one table below, so moving a node is a data
 * edit. Ambient motion is a slow breath and light drawn inward along
 * the threads, held entirely while the figure is off-screen.
 */

const CX = 300;
const CY = 270;

/** Tight around the geometry; labels live outside the SVG box. */
const VIEW = { x: 100, y: 68, w: 400, h: 400 };

type Node = {
  label: string;
  /** Degrees, 0 = right, clockwise (SVG's y-down convention). */
  angle: number;
  radius: number;
  /** Bigger halo — the parts of a life that pull on the most others. */
  weight?: "heavy" | "light";
  /** Label sits above the node instead of below it. */
  labelAbove?: boolean;
  /** Light is drawn inward along this thread. */
  lit?: boolean;
};

const NODES: Node[] = [
  { label: "People", angle: -105, radius: 150, weight: "heavy", labelAbove: true, lit: true },
  { label: "Goals", angle: -52, radius: 178, weight: "light", labelAbove: true },
  { label: "Commitments", angle: -6, radius: 165, weight: "heavy", lit: true },
  { label: "Responsibilities", angle: 42, radius: 150 },
  { label: "Routines", angle: 90, radius: 168 },
  { label: "Places", angle: 138, radius: 155, weight: "light", lit: true },
  { label: "Documents", angle: 180, radius: 170, weight: "light" },
  { label: "Preferences", angle: -142, radius: 140, labelAbove: true },
];

const ORBITS = [112, 158, 198];

/** Relationships between the pieces themselves — the point of the figure. */
const LINKS: [string, string][] = [
  ["People", "Commitments"],
  ["Responsibilities", "Routines"],
  ["Places", "Commitments"],
];

const HALO: Record<NonNullable<Node["weight"]> | "default", number> = {
  heavy: 19,
  default: 16,
  light: 13,
};

function point(node: Node) {
  const rad = (node.angle * Math.PI) / 180;
  return {
    x: CX + node.radius * Math.cos(rad),
    y: CY + node.radius * Math.sin(rad),
  };
}

/** Centre → node, bowed slightly so nothing on the figure is a straight line. */
function thread(node: Node) {
  const { x, y } = point(node);
  const mx = (CX + x) / 2;
  const my = (CY + y) / 2;
  const dx = x - CX;
  const dy = y - CY;
  const len = Math.hypot(dx, dy) || 1;
  // perpendicular bow, alternating side by quadrant for an organic field
  const bow = node.angle > -90 && node.angle < 90 ? 16 : -16;
  return `M ${CX} ${CY} Q ${(mx + (-dy / len) * bow).toFixed(1)} ${(my + (dx / len) * bow).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
}

/** Node → node, bowed away from the centre so links read as arcs. */
function link([aLabel, bLabel]: [string, string]) {
  const a = NODES.find((n) => n.label === aLabel);
  const b = NODES.find((n) => n.label === bLabel);
  if (!a || !b) return "";
  const pa = point(a);
  const pb = point(b);
  const mx = (pa.x + pb.x) / 2;
  const my = (pa.y + pb.y) / 2;
  const ox = mx - CX;
  const oy = my - CY;
  const len = Math.hypot(ox, oy) || 1;
  return `M ${pa.x.toFixed(1)} ${pa.y.toFixed(1)} Q ${(mx + (ox / len) * 34).toFixed(1)} ${(my + (oy / len) * 34).toFixed(1)} ${pb.x.toFixed(1)} ${pb.y.toFixed(1)}`;
}

/** SVG user units → percentage of the rendered box, for the HTML labels. */
function percent({ x, y }: { x: number; y: number }) {
  return {
    left: `${(((x - VIEW.x) / VIEW.w) * 100).toFixed(2)}%`,
    top: `${(((y - VIEW.y) / VIEW.h) * 100).toFixed(2)}%`,
  };
}

export function ContextField({ className = "" }: { className?: string }) {
  const lit = NODES.filter((n) => n.lit);

  return (
    <Stage
      as="figure"
      className={`relative mx-auto w-full max-w-[680px] ${className}`}
    >
      <div
        aria-hidden="true"
        className="glow-atmosphere-radial pointer-events-none absolute inset-[-14%] opacity-70"
      />

      <div className="relative">
        <svg
          viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
          className={`${styles.field} relative h-auto w-full`}
          role="img"
          aria-labelledby="syn-field-title syn-field-desc"
        >
          <title id="syn-field-title">
            What Synceri understands about one person&apos;s life
          </title>
          <desc id="syn-field-desc">
            A person at the centre, with eight kinds of context orbiting at
            different distances — people, goals, commitments,
            responsibilities, routines, places, documents and preferences —
            connected to the person and, in three places, to each other.
          </desc>

          <defs>
            <linearGradient id="syn-thread" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#d27a2c" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#4f7ca7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.45" />
            </linearGradient>
            <radialGradient id="syn-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f0a860" stopOpacity="0.9" />
              <stop offset="55%" stopColor="#d27a2c" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#d27a2c" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* orbits — soft, uneven in opacity, never a grid */}
          <g fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1">
            {ORBITS.map((r, i) => (
              <circle
                key={r}
                className={styles.orbit}
                cx={CX}
                cy={CY}
                r={r}
                opacity={0.75 - i * 0.16}
              />
            ))}
          </g>

          {/* the pieces, related to each other */}
          <g fill="none" stroke="rgba(0,212,255,0.18)" strokeWidth="1">
            {LINKS.map((pair) => (
              <path key={pair.join("-")} d={link(pair)} />
            ))}
          </g>

          {/* person → piece */}
          <g fill="none" stroke="url(#syn-thread)" strokeWidth="1.25">
            {NODES.map((node) => (
              <path key={node.label} d={thread(node)} />
            ))}
          </g>

          {/* context being drawn in — light travelling toward the person */}
          <g
            fill="none"
            stroke="#00d4ff"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray="22 210"
            opacity="0"
          >
            {lit.map((node) => (
              <path key={node.label} className={styles.spark} d={thread(node)} />
            ))}
          </g>

          {/* the person */}
          <circle
            className={styles.core}
            cx={CX}
            cy={CY}
            r="46"
            fill="url(#syn-core)"
          />
          <circle cx={CX} cy={CY} r="7" fill="#f0a860" />
          <circle
            cx={CX}
            cy={CY}
            r="15"
            fill="none"
            stroke="rgba(240,168,96,0.45)"
            strokeWidth="1"
          />

          {/* the pieces */}
          {NODES.map((node) => {
            const { x, y } = point(node);
            const halo = HALO[node.weight ?? "default"];
            return (
              <g key={node.label}>
                <circle
                  cx={x}
                  cy={y}
                  r={halo}
                  fill="rgba(0,212,255,0.06)"
                  stroke="rgba(0,212,255,0.22)"
                  strokeWidth="1"
                />
                <circle cx={x} cy={y} r="4" fill="#00d4ff" opacity="0.85" />
              </g>
            );
          })}
        </svg>

        {/* Labels — real type, at a real size, at every viewport. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden sm:block"
        >
          {/* Clear of the core's glow, or it disappears into it. */}
          <span
            className="type-label absolute -translate-x-1/2 translate-y-[2.6rem] whitespace-nowrap text-white/75"
            style={{
              ...percent({ x: CX, y: CY }),
              letterSpacing: "0.24em",
            }}
          >
            You
          </span>

          {NODES.map((node) => {
            const p = point(node);
            return (
              <span
                key={node.label}
                className={`absolute -translate-x-1/2 whitespace-nowrap text-[13px] text-white/70 ${
                  node.labelAbove ? "-translate-y-[2.1rem]" : "translate-y-4"
                }`}
                style={percent(p)}
              >
                {node.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Below sm the labels would collide whatever size they were, so
          the constellation carries the feeling and the list carries the
          information. */}
      <ul className="mt-6 flex flex-wrap justify-center gap-x-2 gap-y-2 sm:hidden">
        {NODES.map((node) => (
          <li
            key={node.label}
            className="flex items-center gap-2 rounded-full border border-white/[0.09] px-3 py-1.5 text-[13px] text-white/65"
          >
            <span
              aria-hidden="true"
              className="h-1 w-1 shrink-0 rounded-full bg-intelligence/70"
            />
            {node.label}
          </li>
        ))}
      </ul>
    </Stage>
  );
}

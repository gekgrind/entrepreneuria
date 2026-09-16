/**
 * Council Chamber geometry — one coordinate system (a 640-unit square)
 * shared by the chamber, the Six Hats echo diagram, the seat mini-maps,
 * and the HTML label overlays. Seats sit on a hexagon, clockwise from
 * the top, matching the Directorium dashboard.
 */

export const VIEW = 640;
export const CENTER = VIEW / 2;

/** Orbit radius the six seats sit on. */
export const SEAT_ORBIT = 206;
/** Seat plinth radius. */
export const PLINTH_R = 34;
/** Decision core disc radius. */
export const CORE_R = 42;
/** Verdict confidence ring radius. */
export const VERDICT_R = 64;
/** "Seat" centre variant (final CTA) — the founder's open seat. */
export const OPEN_SEAT_R = 112;
/** Instrument tick ring. */
export const TICK_INNER = 286;
export const TICK_OUTER = 292;

export type Point = { x: number; y: number };

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Seat angle in degrees (SVG space, 0° = right, clockwise). */
export const seatAngle = (seat: number) => -90 + seat * 60;

export function polar(angleDeg: number, r: number, c = CENTER): Point {
  return {
    x: round(c + r * Math.cos(rad(angleDeg))),
    y: round(c + r * Math.sin(rad(angleDeg))),
  };
}

export const seatPoint = (seat: number, r = SEAT_ORBIT) =>
  polar(seatAngle(seat), r);

export function round(v: number) {
  return Math.round(v * 100) / 100;
}

/** SVG arc path around (cx, cy) from startDeg to endDeg (clockwise). */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const s = polar(startDeg, r, 0);
  const e = polar(endDeg, r, 0);
  const large = Math.abs(endDeg - startDeg) % 360 > 180 ? 1 : 0;
  return `M${round(cx + s.x)} ${round(cy + s.y)}A${r} ${r} 0 ${large} 1 ${round(
    cx + e.x,
  )} ${round(cy + e.y)}`;
}

/**
 * Debate curve between two opposite seats: a quadratic that bows around
 * the core (apex ≈ 95 units from centre) instead of cutting through it.
 * All three pairs bow the same rotational direction — a woven pinwheel.
 */
export function tensionPath(seatA: number, seatB: number): string {
  const a = seatPoint(seatA);
  const b = seatPoint(seatB);
  const ctrl = polar(seatAngle(seatA) + 90, 190);
  return `M${a.x} ${a.y}Q${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`;
}

/**
 * The same debate curve split at its apex into two halves, each running
 * FROM its own seat TO the point of contention (de Casteljau at t = 0.5).
 * Drawn independently, the two positions advance and meet mid-table.
 */
export function tensionHalfPaths(seatA: number, seatB: number): [string, string] {
  const a = seatPoint(seatA);
  const b = seatPoint(seatB);
  const c = polar(seatAngle(seatA) + 90, 190);
  const m = { x: round((a.x + 2 * c.x + b.x) / 4), y: round((a.y + 2 * c.y + b.y) / 4) };
  const qa = { x: round((a.x + c.x) / 2), y: round((a.y + c.y) / 2) };
  const qb = { x: round((b.x + c.x) / 2), y: round((b.y + c.y) / 2) };
  return [
    `M${a.x} ${a.y}Q${qa.x} ${qa.y} ${m.x} ${m.y}`,
    `M${b.x} ${b.y}Q${qb.x} ${qb.y} ${m.x} ${m.y}`,
  ];
}

/** Apex of a tension curve (the quadratic midpoint). */
export function tensionApex(seatA: number): Point {
  return polar(seatAngle(seatA) + 90, 95);
}

/** Instrument ticks as ONE path (72 ticks; seat ticks drawn separately). */
export function tickRingPath(count = 72): string {
  let d = "";
  for (let i = 0; i < count; i += 1) {
    if (i % 12 === 0) continue; // seat positions get their own ticks
    const angle = -90 + (360 / count) * i;
    const inner = polar(angle, TICK_INNER);
    const outer = polar(angle, TICK_OUTER);
    d += `M${inner.x} ${inner.y}L${outer.x} ${outer.y}`;
  }
  return d;
}

/** Label anchor for a seat: above the upper three, below the lower three. */
export function labelAnchor(seat: number): Point & { side: "above" | "below" } {
  const p = seatPoint(seat);
  const upper = seat === 0 || seat === 1 || seat === 5;
  return {
    x: p.x,
    y: upper ? p.y - PLINTH_R - 18 : p.y + PLINTH_R + 18,
    side: upper ? "above" : "below",
  };
}

export const pct = (v: number) => `${round((v / VIEW) * 100)}%`;

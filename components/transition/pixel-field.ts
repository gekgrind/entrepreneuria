/**
 * The pixel field — the geometry layer of the route transition.
 *
 * A grid of opaque squares that assembles over the viewport to mask the route
 * swap, then disassembles to reveal the incoming page. Built imperatively
 * rather than through React for three reasons:
 *
 *   1. Cell count depends on the viewport, which the server cannot know. A
 *      React-rendered grid would either hydrate-mismatch or need a post-mount
 *      state flush that renders several hundred elements.
 *   2. The transition needs a stable array of element references to hand to
 *      GSAP; going through React to obtain it buys nothing.
 *   3. Rebuilds happen on resize only, never during an animation, so there is
 *      no reconciliation work worth paying for.
 *
 * The module owns the DOM inside the grid root and the cached geometry. It
 * owns no animation state — RouteTransition drives every property.
 */

/* Cells stay near-square: the target edge length picks the column/row counts,
   then 1fr tracks divide the viewport exactly. The small aspect drift that
   remains is well under a cell's own size and never reads as distortion. */
const CELL_TARGET_MOBILE = 58;
const CELL_TARGET_TABLET = 72;
const CELL_TARGET_DESKTOP = 88;

/* Ceiling on tween count. Large desktops coarsen the grid rather than pay for
   more cells — at these sizes a slightly larger block is indistinguishable in
   motion, and the per-frame cost is not. */
const MAX_CELLS = 460;

/* Covered cells overlap their track by 2% on each edge, so the sub-pixel
   rounding of 1fr tracks can never leave a hairline between neighbours.
   The overlap is only safe because cells are never translucent — see below. */
export const COVERED_SCALE = 1.04;

/* Cells are always fully opaque; only `scale` is ever animated.
 *
 * Fading them is the obvious thing to reach for and it is wrong here. A cell
 * scaled past 1 overlaps its neighbours, and two *translucent* cells stacked
 * over the page compose to a different effective alpha than a single one — so
 * every overlap strip paints itself in, and the field reads as a bright
 * lattice laid over the viewport instead of a mask covering it. Widening the
 * overlap only widens the strips. Holding opacity at 1 removes the artefact at
 * its source, and costs nothing: an opaque square over an opaque neighbour is
 * invisible, so the overlap does its job silently.
 *
 * Scaling from zero, rather than from a small visible seed, is what keeps the
 * wave front clean: a cell has no presence at all until its own delay comes
 * up, so nothing pops into view across the viewport when the run begins. */
export const SEED_SCALE = 0;

export type PixelField = {
  cells: HTMLDivElement[];
  cols: number;
  rows: number;
};

function resolveGrid(vw: number, vh: number): { cols: number; rows: number } {
  let target =
    vw < 640
      ? CELL_TARGET_MOBILE
      : vw < 1024
        ? CELL_TARGET_TABLET
        : CELL_TARGET_DESKTOP;

  let cols = Math.max(4, Math.ceil(vw / target));
  let rows = Math.max(4, Math.ceil(vh / target));

  while (cols * rows > MAX_CELLS) {
    target += 8;
    cols = Math.max(4, Math.ceil(vw / target));
    rows = Math.max(4, Math.ceil(vh / target));
  }

  return { cols, rows };
}

/**
 * Two deterministic tonal tiers over the void base. Both use coprime strides
 * against the column and row counts, so the pattern reads as scattered rather
 * than as a repeating checkerboard, while staying identical between runs — a
 * random field would flicker differently on every navigation and look noisy.
 *
 * Cyan is the ecosystem's own light (see the accent grammar in globals.css),
 * so the accent tier is a 1px inset hairline, not a fill: the grid reads as an
 * instrument surface, and the geometry stays the subject.
 */
function paintCell(cell: HTMLDivElement, col: number, row: number): void {
  const tonal = (col * 7 + row * 3) % 11 === 0;
  cell.style.backgroundColor = tonal
    ? "var(--color-void-900)"
    : "var(--color-void-950)";

  if ((col * 3 + row * 5) % 13 === 0) {
    // Zero blur radius: an inset hairline, with none of the cost of a shadow.
    cell.style.boxShadow = "inset 0 0 0 1px rgba(0, 212, 255, 0.16)";
  }
}

/**
 * Rebuilds the grid inside `root` for the current viewport. Returns the
 * existing field untouched when the resolved dimensions have not changed —
 * which is what makes this safe to call from a resize listener on mobile,
 * where showing and hiding the URL bar fires resize constantly without ever
 * changing the grid.
 */
export function buildPixelField(
  root: HTMLDivElement,
  previous: PixelField | null,
): PixelField {
  const { cols, rows } = resolveGrid(window.innerWidth, window.innerHeight);
  if (previous && previous.cols === cols && previous.rows === rows) {
    return previous;
  }

  root.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  root.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  const fragment = document.createDocumentFragment();
  const cells: HTMLDivElement[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = document.createElement("div");
      /* No transform here. GSAP composes every transform it writes with the
         element's existing base transform, so seeding one in CSS would offset
         the whole field by that amount for the life of the page.
         No `will-change` here either: the field animates for under a second
         per navigation and sits idle the rest of the time, so reserving
         compositor layers for several hundred cells over the life of the page
         is waste. RouteTransition sets it for the length of a run. */
      paintCell(cell, col, row);
      cells.push(cell);
      fragment.appendChild(cell);
    }
  }

  root.replaceChildren(fragment);
  return { cells, cols, rows };
}

/**
 * Grid index nearest a viewport point — the seed GSAP's grid stagger measures
 * every other cell's distance from. Cells are near-square, so distance in grid
 * units tracks distance in pixels closely enough for the wave to read as
 * radial.
 */
export function indexFromPoint(
  field: PixelField,
  x: number,
  y: number,
): number {
  const col = Math.min(
    field.cols - 1,
    Math.max(0, Math.floor((x / window.innerWidth) * field.cols)),
  );
  const row = Math.min(
    field.rows - 1,
    Math.max(0, Math.floor((y / window.innerHeight) * field.rows)),
  );
  return row * field.cols + col;
}

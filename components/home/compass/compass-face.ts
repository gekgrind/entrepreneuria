/**
 * Canvas-generated compass face — the cyan blueprint dial sampled by the
 * raymarcher as an emissive texture. Drawn once at init (~5ms), 1024px POT
 * so mipmaps work everywhere. Matches the reference renders: bold outer
 * ticks, fine ruler bands, concentric circles, an eight-point rose, and
 * faint schematic scraps in the lower-right quadrant.
 */

const CYAN_BRIGHT = "rgba(150, 235, 255,";
const CYAN = "rgba(0, 212, 255,";
const CYAN_DIM = "rgba(58, 158, 196,";

export function createCompassFace(size = 1024): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const R = size * 0.5 * 0.985; // face radius in px

  /* Base — near-black navy, slightly lighter center */
  const base = ctx.createRadialGradient(c, c, 0, c, c, R);
  base.addColorStop(0, "#0c1626");
  base.addColorStop(0.62, "#091220");
  base.addColorStop(1, "#060d18");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  ctx.translate(c, c);
  ctx.lineCap = "round";

  const glow = (blur: number, color: string) => {
    ctx.shadowBlur = blur;
    ctx.shadowColor = color;
  };
  const noGlow = () => {
    ctx.shadowBlur = 0;
  };

  /* --- Concentric circles ------------------------------------------- */
  const circles: Array<[number, number, number]> = [
    [0.865, 0.5, 2.4],
    [0.7, 0.24, 1.6],
    [0.56, 0.2, 1.4],
    [0.43, 0.26, 1.6],
    [0.3, 0.17, 1.2],
    [0.175, 0.34, 1.6],
  ];
  noGlow();
  for (const [r, a, w] of circles) {
    ctx.strokeStyle = `${CYAN_DIM}${a})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(0, 0, r * R, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* --- Fine ruler tick bands ---------------------------------------- */
  // Outer fine band: every 2°, between the majors
  ctx.strokeStyle = `${CYAN}0.5)`;
  ctx.lineWidth = size * 0.0016;
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    const long = i % 5 === 0;
    tick(ctx, a, R * (long ? 0.895 : 0.906), R * 0.932);
  }
  // Inner fine band around the 0.7 circle: every 5°
  ctx.strokeStyle = `${CYAN_DIM}0.4)`;
  ctx.lineWidth = size * 0.0014;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    tick(ctx, a, R * 0.7, R * 0.722);
  }

  /* --- Major ticks — the bold glowing marks every 30° ---------------- */
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const cardinal = i % 3 === 0;
    glow(size * 0.012, `${CYAN}0.9)`);
    ctx.strokeStyle = cardinal ? `${CYAN_BRIGHT}0.98)` : `${CYAN}0.92)`;
    ctx.lineWidth = size * (cardinal ? 0.011 : 0.009);
    tick(ctx, a, R * (cardinal ? 0.945 : 0.952), R * 0.995);
  }
  // Half-way medium ticks (every 15°, between majors)
  glow(size * 0.006, `${CYAN}0.5)`);
  ctx.strokeStyle = `${CYAN}0.55)`;
  ctx.lineWidth = size * 0.004;
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * Math.PI * 2;
    tick(ctx, a, R * 0.958, R * 0.99);
  }
  noGlow();

  /* --- Eight-point compass rose (faint linework) --------------------- */
  const rosePoint = (angle: number, len: number, halfW: number) => {
    const tipX = Math.cos(angle) * len;
    const tipY = Math.sin(angle) * len;
    const perp = angle + Math.PI / 2;
    const bx = Math.cos(perp) * halfW;
    const by = Math.sin(perp) * halfW;
    const baseR = R * 0.1;
    const cx = Math.cos(angle) * baseR;
    const cy = Math.sin(angle) * baseR;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(cx + bx, cy + by);
    ctx.lineTo(cx - bx, cy - by);
    ctx.closePath();
    ctx.stroke();
    // spine
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  };
  ctx.strokeStyle = `${CYAN_DIM}0.34)`;
  ctx.lineWidth = size * 0.0016;
  ctx.fillStyle = `${CYAN_DIM}0.05)`;
  for (let i = 0; i < 4; i++) rosePoint((i / 4) * Math.PI * 2, R * 0.64, R * 0.052);
  ctx.strokeStyle = `${CYAN_DIM}0.26)`;
  for (let i = 0; i < 4; i++)
    rosePoint((i / 4) * Math.PI * 2 + Math.PI / 4, R * 0.45, R * 0.04);

  /* --- Blueprint scraps — lower-right quadrant ----------------------- */
  ctx.save();
  ctx.strokeStyle = `${CYAN_DIM}0.2)`;
  ctx.lineWidth = size * 0.0014;
  // schematic rectangles with dimension ticks
  schematicRect(ctx, R * 0.3, R * 0.34, R * 0.26, R * 0.16, size);
  schematicRect(ctx, R * 0.48, R * 0.16, R * 0.14, R * 0.1, size);
  // rows of "text" dashes
  ctx.strokeStyle = `${CYAN_DIM}0.17)`;
  ctx.lineWidth = size * 0.0022;
  dashRow(ctx, R * 0.18, R * 0.56, R * 0.3, size);
  dashRow(ctx, R * 0.18, R * 0.6, R * 0.22, size);
  // dashed arc upper-left + crosshair
  ctx.setLineDash([size * 0.008, size * 0.011]);
  ctx.strokeStyle = `${CYAN_DIM}0.22)`;
  ctx.lineWidth = size * 0.0014;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.78, Math.PI * 0.95, Math.PI * 1.45);
  ctx.stroke();
  ctx.setLineDash([]);
  const chX = -R * 0.44;
  const chY = -R * 0.36;
  ctx.beginPath();
  ctx.arc(chX, chY, R * 0.045, 0, Math.PI * 2);
  ctx.moveTo(chX - R * 0.07, chY);
  ctx.lineTo(chX + R * 0.07, chY);
  ctx.moveTo(chX, chY - R * 0.07);
  ctx.lineTo(chX, chY + R * 0.07);
  ctx.stroke();
  ctx.restore();

  /* --- Center rings --------------------------------------------------- */
  ctx.strokeStyle = `${CYAN_DIM}0.5)`;
  ctx.lineWidth = size * 0.002;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `${CYAN}0.4)`;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.155, 0, Math.PI * 2);
  ctx.stroke();

  /* Vignette so the face darkens toward the rim, like the render */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const vig = ctx.createRadialGradient(c, c, R * 0.55, c, c, R);
  vig.addColorStop(0, "rgba(4, 9, 18, 0)");
  vig.addColorStop(1, "rgba(4, 9, 18, 0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size, size);

  return canvas;
}

function tick(
  ctx: CanvasRenderingContext2D,
  angle: number,
  r0: number,
  r1: number,
) {
  ctx.beginPath();
  ctx.moveTo(Math.cos(angle) * r0, Math.sin(angle) * r0);
  ctx.lineTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
  ctx.stroke();
}

function schematicRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
) {
  ctx.strokeRect(x, y, w, h);
  // dimension line with end ticks below the rect
  const dy = y + h + size * 0.012;
  ctx.beginPath();
  ctx.moveTo(x, dy);
  ctx.lineTo(x + w, dy);
  ctx.moveTo(x, dy - size * 0.006);
  ctx.lineTo(x, dy + size * 0.006);
  ctx.moveTo(x + w, dy - size * 0.006);
  ctx.lineTo(x + w, dy + size * 0.006);
  ctx.stroke();
}

function dashRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  size: number,
) {
  let cx = x;
  // deterministic pseudo-random dash widths so renders are stable
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  while (cx < x + w) {
    const dw = size * (0.01 + rand() * 0.022);
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(Math.min(cx + dw, x + w), y);
    ctx.stroke();
    cx += dw + size * 0.008;
  }
}

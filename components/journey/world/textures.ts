/**
 * Procedural textures for the journey world — everything is painted in
 * code (deterministic, no asset downloads, on-brand). The chaos artifacts
 * sample a single atlas so all of them render in one instanced draw call.
 */
import * as THREE from "three";

/* Brand palette (mirrors app/globals.css @theme tokens) */
const VOID_800 = "#0b1d33";
const VOID_700 = "#122843";
const HAIRLINE = "rgba(255,255,255,0.14)";
const TEXT_SOFT = "rgba(255,255,255,0.72)";
const TEXT_FAINT = "rgba(255,255,255,0.34)";
const CYAN = "#00d4ff";
const ORANGE = "#d27a2c";

const CELL_W = 256;
const CELL_H = 170;
const COLS = 4;
const ROWS = 2;

function roundedCard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const r = 14;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 5, y + 5, CELL_W - 10, CELL_H - 10, r);
  ctx.fillStyle = VOID_800;
  ctx.fill();
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();
}

function titleBar(ctx: CanvasRenderingContext2D, x: number, y: number, accent = CYAN) {
  ctx.fillStyle = accent;
  ctx.fillRect(x + 18, y + 18, 34, 6);
  ctx.fillStyle = TEXT_FAINT;
  ctx.fillRect(x + 58, y + 18, 52, 6);
}

function drawSpreadsheet(ctx: CanvasRenderingContext2D, x: number, y: number) {
  titleBar(ctx, x, y);
  const gx = x + 18;
  const gy = y + 38;
  const cw = 44;
  const ch = 22;
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      ctx.fillStyle = r === 0 ? "rgba(0,212,255,0.28)" : "rgba(255,255,255,0.07)";
      ctx.fillRect(gx + c * cw, gy + r * ch, cw - 3, ch - 3);
    }
  }
  ctx.fillStyle = "rgba(210,122,44,0.75)";
  ctx.fillRect(gx + 3 * cw, gy + 3 * ch, cw - 3, ch - 3);
}

function drawBarChart(ctx: CanvasRenderingContext2D, x: number, y: number) {
  titleBar(ctx, x, y);
  const base = y + 142;
  const heights = [38, 62, 48, 84, 66, 100];
  heights.forEach((h, i) => {
    ctx.fillStyle = i === heights.length - 1 ? CYAN : "rgba(0,212,255,0.35)";
    ctx.fillRect(x + 22 + i * 36, base - h, 24, h);
  });
  ctx.strokeStyle = TEXT_FAINT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 16, base);
  ctx.lineTo(x + 240, base);
  ctx.stroke();
}

function drawLineChart(ctx: CanvasRenderingContext2D, x: number, y: number) {
  titleBar(ctx, x, y, ORANGE);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 38 + i * 28);
    ctx.lineTo(x + 238, y + 38 + i * 28);
    ctx.stroke();
  }
  const pts = [
    [20, 128], [58, 108], [96, 118], [134, 84], [172, 92], [210, 56], [236, 64],
  ];
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(x + px, y + py) : ctx.lineTo(x + px, y + py)));
  ctx.stroke();
  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.arc(x + 210, y + 56, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawInvoice(ctx: CanvasRenderingContext2D, x: number, y: number) {
  titleBar(ctx, x, y, ORANGE);
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x + 18, y + 44 + i * 20, 150, 7);
    ctx.fillStyle = TEXT_SOFT;
    ctx.fillRect(x + 196, y + 44 + i * 20, 42, 7);
  }
  ctx.fillStyle = "rgba(210,122,44,0.18)";
  ctx.fillRect(x + 16, y + 128, 222, 26);
  ctx.fillStyle = ORANGE;
  ctx.fillRect(x + 18, y + 136, 60, 9);
  ctx.fillStyle = TEXT_SOFT;
  ctx.fillRect(x + 186, y + 136, 52, 9);
}

function drawCalendar(ctx: CanvasRenderingContext2D, x: number, y: number) {
  titleBar(ctx, x, y);
  const gx = x + 18;
  const gy = y + 38;
  const s = 26;
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const hot = r === 1 && c === 4;
      ctx.fillStyle = hot ? ORANGE : "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.roundRect(gx + c * (s + 4), gy + r * (s + 4), s, s, 5);
      ctx.fill();
    }
  }
}

function drawKanban(ctx: CanvasRenderingContext2D, x: number, y: number) {
  titleBar(ctx, x, y);
  const colW = 68;
  for (let c = 0; c < 3; c += 1) {
    const cx = x + 16 + c * (colW + 8);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.roundRect(cx, y + 36, colW, 118, 7);
    ctx.fill();
    const cards = c === 0 ? 3 : c === 1 ? 2 : 1;
    for (let i = 0; i < cards; i += 1) {
      ctx.fillStyle = i === 0 && c === 0 ? "rgba(0,212,255,0.3)" : VOID_700;
      ctx.beginPath();
      ctx.roundRect(cx + 7, y + 46 + i * 34, colW - 14, 26, 5);
      ctx.fill();
    }
  }
}

function drawInbox(ctx: CanvasRenderingContext2D, x: number, y: number) {
  titleBar(ctx, x, y);
  for (let i = 0; i < 4; i += 1) {
    const ry = y + 42 + i * 28;
    ctx.fillStyle = i === 0 ? CYAN : "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(x + 26, ry + 6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x + 42, ry, 130, 6);
    ctx.fillStyle = TEXT_FAINT;
    ctx.fillRect(x + 42, ry + 11, 92, 5);
  }
}

function drawPalette(ctx: CanvasRenderingContext2D, x: number, y: number) {
  titleBar(ctx, x, y, ORANGE);
  ctx.strokeStyle = TEXT_SOFT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + 52, y + 84, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = CYAN;
  ctx.beginPath();
  ctx.arc(x + 52, y + 84, 26, -0.6, 1.4);
  ctx.stroke();
  const swatches = [CYAN, ORANGE, "#4f7ca7", "#f7f4ee", "#122843"];
  swatches.forEach((s, i) => {
    ctx.fillStyle = s;
    ctx.beginPath();
    ctx.roundRect(x + 100 + i * 28, y + 70, 22, 34, 5);
    ctx.fill();
  });
  ctx.fillStyle = TEXT_FAINT;
  ctx.fillRect(x + 100, y + 118, 130, 7);
}

const PAINTERS = [
  drawSpreadsheet,
  drawBarChart,
  drawLineChart,
  drawInvoice,
  drawCalendar,
  drawKanban,
  drawInbox,
  drawPalette,
];

export const ATLAS_COUNT = PAINTERS.length;

/**
 * The chaos-artifact atlas: 8 stylized "business UI" cards
 * (4×2 grid). Recognizable at small sizes without being fake
 * product screenshots.
 */
export function createArtifactAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CELL_W * COLS;
  canvas.height = CELL_H * ROWS;
  const ctx = canvas.getContext("2d")!;
  PAINTERS.forEach((paint, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H;
    roundedCard(ctx, x, y);
    paint(ctx, x, y);
    ctx.restore();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** Soft radial glow (white core → transparent; tinted via material color). */
export function createGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2, size / 2, 0, size / 2, size / 2, size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.32)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

import { CanvasTexture, LinearSRGBColorSpace, SRGBColorSpace } from 'three';
import { BOARD, RING_WIRES, SECTORS, SECTOR_ANGLE } from '../../engine/board/geometry';

export type BoardPalette = 'classic' | 'contrast';

const CLASSIC = {
  board: '#151413',
  dark: '#1d1c1a',
  light: '#e8dbb6',
  red: '#b8202b',
  green: '#137a3c',
  number: '#e9e9e9',
};
/** Colour-blind-safe variant: blue/orange rings, which stay distinct for red-green deficiencies. */
const CONTRAST = { ...CLASSIC, red: '#1f6fd1', green: '#f08a1c' };

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Clock angle (clockwise from 12) -> canvas angle (clockwise from +x). */
const canvasAngle = (clockDeg: number) => rad(clockDeg - 90);

/** Deterministic noise so the board looks the same every load. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sisal is a mat of bristle ends facing out: a dense field of tiny light/dark
 * specks with a faint grain. Painted over a finished board, at low alpha.
 */
function sisalSpeckle(ctx: CanvasRenderingContext2D, size: number, strength: number, seed: number) {
  const rand = rng(seed);
  const count = Math.round(size * size * 0.09);
  for (let i = 0; i < count; i++) {
    const light = rand() < 0.5;
    ctx.fillStyle = light
      ? `rgba(255,248,230,${rand() * strength})`
      : `rgba(0,0,0,${rand() * strength * 1.3})`;
    const r = 0.6 + rand() * 1.4;
    ctx.fillRect(rand() * size, rand() * size, r, r * (1 + rand()));
  }
}

/**
 * Paint the board face from the shared geometry. Canvas up = world up, so the
 * texture maps directly onto a CircleGeometry in the XY plane. Wires are real
 * 3D geometry (BoardWires); here we only paint the grooves they sit in.
 */
export function createBoardTexture(palette: BoardPalette = 'classic', size = 2048): CanvasTexture {
  const COLORS = palette === 'contrast' ? CONTRAST : CLASSIC;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const s = c / BOARD.boardRadius; // px per mm

  ctx.fillStyle = COLORS.board;
  ctx.beginPath();
  ctx.arc(c, c, BOARD.boardRadius * s, 0, Math.PI * 2);
  ctx.fill();

  const band = (r0: number, r1: number, a0: number, a1: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(c, c, r1 * s, canvasAngle(a0), canvasAngle(a1));
    ctx.arc(c, c, r0 * s, canvasAngle(a1), canvasAngle(a0), true);
    ctx.closePath();
    ctx.fill();
  };

  SECTORS.forEach((_, i) => {
    const a0 = i * SECTOR_ANGLE - SECTOR_ANGLE / 2;
    const a1 = a0 + SECTOR_ANGLE;
    const even = i % 2 === 0;
    const single = even ? COLORS.dark : COLORS.light;
    const ring = even ? COLORS.red : COLORS.green;
    band(BOARD.outerBull, BOARD.trebleInner, a0, a1, single);
    band(BOARD.trebleInner, BOARD.trebleOuter, a0, a1, ring);
    band(BOARD.trebleOuter, BOARD.doubleInner, a0, a1, single);
    band(BOARD.doubleInner, BOARD.doubleOuter, a0, a1, ring);
  });

  ctx.fillStyle = COLORS.green;
  ctx.beginPath();
  ctx.arc(c, c, BOARD.outerBull * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.arc(c, c, BOARD.innerBull * s, 0, Math.PI * 2);
  ctx.fill();

  // Fibre texture over everything, then a soft vignette toward the rim (boards are
  // compressed and darker at the edge).
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, BOARD.boardRadius * s, 0, Math.PI * 2);
  ctx.clip();
  sisalSpeckle(ctx, size, 0.22, 7);
  const vignette = ctx.createRadialGradient(
    c,
    c,
    BOARD.doubleOuter * s * 0.6,
    c,
    c,
    BOARD.boardRadius * s,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // Dark grooves/contact shadow under the wires.
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2.2 * s;
  for (const r of RING_WIRES) {
    ctx.beginPath();
    ctx.arc(c, c, r * s, 0, Math.PI * 2);
    ctx.stroke();
  }
  SECTORS.forEach((_, i) => {
    const a = rad(i * SECTOR_ANGLE - SECTOR_ANGLE / 2);
    ctx.beginPath();
    ctx.moveTo(c + Math.sin(a) * BOARD.outerBull * s, c - Math.cos(a) * BOARD.outerBull * s);
    ctx.lineTo(c + Math.sin(a) * BOARD.doubleOuter * s, c - Math.cos(a) * BOARD.doubleOuter * s);
    ctx.stroke();
  });

  // Numbers: brushed-metal look with a drop shadow, like the wire number ring.
  ctx.font = `800 ${Math.round(29 * s)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const numberRadius = (BOARD.doubleOuter + BOARD.boardRadius) / 2;
  SECTORS.forEach((n, i) => {
    const a = rad(i * SECTOR_ANGLE);
    const x = c + Math.sin(a) * numberRadius * s;
    const y = c - Math.cos(a) * numberRadius * s;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(String(n), x + 1.2 * s, y + 1.6 * s);
    const g = ctx.createLinearGradient(x, y - 14 * s, x, y + 14 * s);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, COLORS.number);
    g.addColorStop(1, '#9a9a9a');
    ctx.fillStyle = g;
    ctx.fillText(String(n), x, y);
  });

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Height map for the sisal surface (bristle ends) — used as a bump map. */
export function createSisalBump(size = 1024): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  const rand = rng(11);
  const count = Math.round(size * size * 0.35);
  for (let i = 0; i < count; i++) {
    const v = Math.round(60 + rand() * 140);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = LinearSRGBColorSpace;
  return tex;
}

import { CanvasTexture, SRGBColorSpace } from 'three';
import { BOARD, RING_WIRES, SECTORS, SECTOR_ANGLE } from '../../engine/board/geometry';

export type BoardPalette = 'classic' | 'contrast';

const CLASSIC = {
  board: '#121212',
  dark: '#1b1b1b',
  light: '#efe2bf',
  red: '#c41e2a',
  green: '#11823b',
  wire: '#c8c8c8',
  number: '#f5f5f5',
};

/**
 * Paint the board face from the shared geometry. Canvas up = world up, so the
 * texture maps directly onto a CircleGeometry in the XY plane.
 */
/** Colour-blind-safe variant: blue/orange rings, which stay distinct for red-green deficiencies. */
const CONTRAST = { ...CLASSIC, red: '#1f6fd1', green: '#f08a1c' };

export function createBoardTexture(palette: BoardPalette = 'classic', size = 2048): CanvasTexture {
  const COLORS = palette === 'contrast' ? CONTRAST : CLASSIC;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const s = c / BOARD.boardRadius; // px per mm
  const rad = (deg: number) => (deg * Math.PI) / 180;
  // Clock angle (clockwise from 12) -> canvas angle (clockwise from +x).
  const canvasAngle = (clockDeg: number) => rad(clockDeg - 90);

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

  // Wires
  ctx.strokeStyle = COLORS.wire;
  ctx.lineWidth = 1.1 * s;
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

  // Numbers
  ctx.fillStyle = COLORS.number;
  ctx.font = `700 ${Math.round(30 * s)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const numberRadius = (BOARD.doubleOuter + BOARD.boardRadius) / 2;
  SECTORS.forEach((n, i) => {
    const a = rad(i * SECTOR_ANGLE);
    ctx.fillText(String(n), c + Math.sin(a) * numberRadius * s, c - Math.cos(a) * numberRadius * s);
  });

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

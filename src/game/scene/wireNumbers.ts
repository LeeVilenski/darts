import { BOARD, SECTORS, SECTOR_ANGLE } from '../../engine/board/geometry';

/** A stroke is a polyline; arcs are pre-sampled into points. Units: digit height = 1. */
export type Stroke = [number, number][];

const DIGIT_WIDTH = 0.56;

function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fromDeg: number,
  toDeg: number,
  n = 14,
): Stroke {
  const pts: Stroke = [];
  for (let i = 0; i <= n; i++) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / n) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}
const quad = (p0: [number, number], c: [number, number], p1: [number, number], n = 10): Stroke =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [
      u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
      u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
    ];
  });

const W = DIGIT_WIDTH;
const H = W / 2;

/** Single-stroke wire digits, the way bent-wire board numbers are made. */
export const DIGITS: Record<string, Stroke[]> = {
  '0': [arc(H, 0.5, H, 0.5, 0, 360, 28)],
  '1': [
    [
      [H + 0.04, 0],
      [H + 0.04, 1],
      [H - 0.16, 0.8],
    ],
  ],
  '2': [[...arc(H, 0.72, H, 0.28, 165, -20, 12), [0, 0], [W, 0]]],
  '3': [arc(H, 0.74, H * 0.9, 0.26, 150, -90, 12), arc(H, 0.26, H, 0.26, 90, -155, 12)],
  '4': [
    [
      [W * 0.74, 0],
      [W * 0.74, 1],
      [0, 0.33],
      [W, 0.33],
    ],
  ],
  '5': [[[W * 0.92, 1], [W * 0.08, 1], [W * 0.04, 0.56], ...arc(H, 0.31, H, 0.31, 120, -150, 14)]],
  '6': [quad([W * 0.85, 0.97], [0, 0.85], [0.01, 0.31]), arc(H, 0.3, H, 0.3, 180, -180, 22)],
  '7': [
    [
      [0, 1],
      [W, 1],
      [W * 0.3, 0],
    ],
  ],
  '8': [arc(H, 0.76, H * 0.82, 0.24, -90, 270, 20), arc(H, 0.27, H, 0.27, 90, 450, 22)],
  '9': [quad([W * 0.15, 0.03], [W, 0.15], [W - 0.01, 0.69]), arc(H, 0.7, H, 0.3, 0, 360, 22)],
};

/** Height of the number digits on the board (mm). */
export const NUMBER_HEIGHT_MM = 20;
const DIGIT_GAP = 0.18; // fraction of the height between two digits
/** Radius at which the numbers are centred (mm): the black ring outside the doubles. */
export const NUMBER_RADIUS_MM = (BOARD.doubleOuter + BOARD.boardRadius) / 2;

/**
 * Every number's strokes in board-local millimetres (x right, y up), upright
 * and centred on its sector, as on a real board.
 */
export function numberStrokesMm(): Stroke[] {
  const strokes: Stroke[] = [];
  SECTORS.forEach((n, i) => {
    const a = (i * SECTOR_ANGLE * Math.PI) / 180;
    const cx = Math.sin(a) * NUMBER_RADIUS_MM;
    const cy = Math.cos(a) * NUMBER_RADIUS_MM;
    const chars = String(n).split('');
    const total = chars.length * W + (chars.length - 1) * DIGIT_GAP;
    chars.forEach((ch, k) => {
      const x0 = -total / 2 + k * (W + DIGIT_GAP);
      for (const s of DIGITS[ch]!) {
        strokes.push(
          s.map(([x, y]) => [cx + (x0 + x) * NUMBER_HEIGHT_MM, cy + (y - 0.5) * NUMBER_HEIGHT_MM]),
        );
      }
    });
  });
  return strokes;
}

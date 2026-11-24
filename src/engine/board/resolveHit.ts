import type { Rng } from '../rng';
import { BOARD, RING_WIRES, SECTORS, SECTOR_ANGLE, clockAngle, sectorIndexAt } from './geometry';

export type Ring = 'innerBull' | 'outerBull' | 'innerSingle' | 'treble' | 'outerSingle' | 'double';

export type HitResult =
  | {
      kind: 'score';
      /** e.g. "T20", "D16", "S5", "25", "BULL" */
      label: string;
      base: number;
      multiplier: 1 | 2 | 3;
      points: number;
      ring: Ring;
      sector: number | null;
      r: number;
      angle: number;
    }
  | { kind: 'bounce'; r: number; angle: number }
  /** Lodged in the back of a dart already in the board: sticks, but scores nothing. */
  | { kind: 'robinHood'; r: number; angle: number }
  | { kind: 'miss'; r: number; angle: number };

/** Probability of a bounce-out when the dart tip lands dead-centre on a wire. */
export type BounceSetting = 'realistic' | 'low' | 'off';
const BOUNCE_PEAK: Record<BounceSetting, number> = { realistic: 0.25, low: 0.1, off: 0 };

function ringAt(r: number): Ring | null {
  if (r <= BOARD.innerBull) return 'innerBull';
  if (r <= BOARD.outerBull) return 'outerBull';
  if (r <= BOARD.trebleInner) return 'innerSingle';
  if (r <= BOARD.trebleOuter) return 'treble';
  if (r <= BOARD.doubleInner) return 'outerSingle';
  if (r <= BOARD.doubleOuter) return 'double';
  return null;
}

/** Pure scoring of a board-local point (mm), ignoring wires. */
export function scorePoint(xMm: number, yMm: number): HitResult {
  const r = Math.hypot(xMm, yMm);
  const angle = clockAngle(xMm, yMm);
  const ring = ringAt(r);
  if (!ring) return { kind: 'miss', r, angle };
  if (ring === 'innerBull')
    return {
      kind: 'score',
      label: 'BULL',
      base: 25,
      multiplier: 2,
      points: 50,
      ring,
      sector: null,
      r,
      angle,
    };
  if (ring === 'outerBull')
    return {
      kind: 'score',
      label: '25',
      base: 25,
      multiplier: 1,
      points: 25,
      ring,
      sector: null,
      r,
      angle,
    };
  const sector = SECTORS[sectorIndexAt(angle)]!;
  const multiplier = ring === 'treble' ? 3 : ring === 'double' ? 2 : 1;
  const prefix = multiplier === 3 ? 'T' : multiplier === 2 ? 'D' : 'S';
  return {
    kind: 'score',
    label: `${prefix}${sector}`,
    base: sector,
    multiplier,
    points: sector * multiplier,
    ring,
    sector,
    r,
    angle,
  };
}

/**
 * Distance (mm) from the point to the nearest wire. Radial (spider) wires run
 * from the outer bull to the double ring at every sector boundary.
 */
export function distanceToWire(xMm: number, yMm: number): number {
  const r = Math.hypot(xMm, yMm);
  let d = Infinity;
  for (const w of RING_WIRES) d = Math.min(d, Math.abs(r - w));
  if (r >= BOARD.outerBull - BOARD.wireContact && r <= BOARD.doubleOuter + BOARD.wireContact) {
    const angle = clockAngle(xMm, yMm);
    const offset = (angle + SECTOR_ANGLE / 2) % SECTOR_ANGLE; // 0 at a boundary
    const toBoundaryDeg = Math.min(offset, SECTOR_ANGLE - offset);
    d = Math.min(d, r * Math.sin((toBoundaryDeg * Math.PI) / 180));
  }
  return d;
}

/**
 * Resolve where a dart tip landed. Wire contact may bounce the dart out
 * (seeded), otherwise the dart scores in the segment its tip centre is in.
 */
export function resolveHit(xMm: number, yMm: number, rng: Rng, bounce: BounceSetting): HitResult {
  const base = scorePoint(xMm, yMm);
  const peak = BOUNCE_PEAK[bounce];
  if (peak > 0 && base.r <= BOARD.doubleOuter + BOARD.wireContact) {
    const d = distanceToWire(xMm, yMm);
    if (d < BOARD.wireContact) {
      const centredness = 1 - d / BOARD.wireContact; // 1 dead centre -> 0 at edge
      if (rng.next() < peak * centredness) return { kind: 'bounce', r: base.r, angle: base.angle };
    }
  }
  return base;
}

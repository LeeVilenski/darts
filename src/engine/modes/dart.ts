import type { HitResult } from '../board/resolveHit';

/** A dart as the rules engines see it. Misses and bounce-outs score 0 with multiplier 0. */
export interface DartScore {
  points: number;
  multiplier: 0 | 1 | 2 | 3;
  /** "T20", "D16", "S5", "25", "BULL", "MISS", "BOUNCE" */
  label: string;
}

export function toDartScore(hit: HitResult): DartScore {
  if (hit.kind === 'score')
    return { points: hit.points, multiplier: hit.multiplier, label: hit.label };
  return { points: 0, multiplier: 0, label: hit.kind === 'bounce' ? 'BOUNCE' : 'MISS' };
}

export const isDouble = (d: DartScore) => d.multiplier === 2; // includes the inner bull

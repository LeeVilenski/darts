import type { DartScore } from './dart';

/** Build a DartScore from a label like "T20", "D16", "S5", "25", "BULL" or "MISS" (tests only). */
export function dart(label: string): DartScore {
  if (label === 'MISS') return { label, points: 0, multiplier: 0 };
  if (label === 'BULL') return { label, points: 50, multiplier: 2 };
  if (label === '25') return { label, points: 25, multiplier: 1 };
  const m = ({ S: 1, D: 2, T: 3 } as const)[label[0] as 'S' | 'D' | 'T'];
  return { label, points: Number(label.slice(1)) * m, multiplier: m };
}

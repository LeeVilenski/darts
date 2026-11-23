import { BOARD, pointInSector } from '../board/geometry';
import { suggestCheckout } from '../modes/checkouts';
import { DARTS_PER_TURN, type X01State } from '../modes/x01';

export interface AiTarget {
  /** Segment label, e.g. "T20", "D16", "S5", "25", "BULL". */
  label: string;
  /** Aim point in board-local mm. */
  point: { x: number; y: number };
}

const RADIUS = {
  S: (BOARD.trebleOuter + BOARD.doubleInner) / 2, // fat outer single
  T: (BOARD.trebleInner + BOARD.trebleOuter) / 2,
  D: (BOARD.doubleInner + BOARD.doubleOuter) / 2,
} as const;

/** Board-local aim point (mm) at the centre of a segment. */
export function aimPointFor(label: string): { x: number; y: number } {
  if (label === 'BULL') return { x: 0, y: 0 };
  if (label === '25') return { x: 0, y: (BOARD.innerBull + BOARD.outerBull) / 2 };
  const ring = label[0] as 'S' | 'T' | 'D';
  return pointInSector(Number(label.slice(1)), RADIUS[ring]);
}

const value = (label: string) =>
  label === 'BULL'
    ? 50
    : label === '25'
      ? 25
      : Number(label.slice(1)) * { S: 1, D: 2, T: 3 }[label[0] as 'S' | 'D' | 'T'];

/** Set-up targets in order of preference when no checkout is on. */
const SCORING = [
  'T20',
  'T19',
  'T18',
  'T17',
  'S20',
  'S19',
  'S18',
  'S17',
  'S16',
  'S15',
  'S14',
  'S13',
  'S12',
  'S11',
  'S10',
  'S9',
  'S8',
  'S7',
  'S6',
  'S5',
  'S4',
  'S3',
  'S2',
  'S1',
];
/** Leaves we like to set up: a single dart at a favourite double. */
const GOOD_LEAVES = new Set([40, 32, 36, 24, 16, 20, 8, 12, 4, 2, 50]);

/**
 * Pick the AI's next target. Mirrors common match play:
 * open with a double (double-in), follow the checkout route when one is on,
 * otherwise score on T20 while avoiding busts and steering toward a good leave.
 */
export function chooseTarget(state: X01State): AiTarget {
  const p = state.players[state.current]!;
  const dartsLeft = DARTS_PER_TURN - state.turn.darts.length;
  const rem = p.remaining;
  const pick = (label: string): AiTarget => ({ label, point: aimPointFor(label) });

  if (!p.opened) return pick('D20');

  if (state.options.doubleOut) {
    const route = suggestCheckout(rem, dartsLeft);
    if (route) return pick(route[0]!);
    if (rem > 170 + 60) return pick('T20');
    // No finish this turn: score without busting and aim for a tidy leave.
    const safe = SCORING.filter((l) => rem - value(l) >= 2);
    const good = safe.find((l) => GOOD_LEAVES.has(rem - value(l)));
    const finishable = safe.find((l) => suggestCheckout(rem - value(l), 3));
    return pick(good ?? finishable ?? safe[0] ?? 'S1');
  }

  // Straight out: finish with any single segment if possible, else score.
  for (const l of [
    'T20',
    'T19',
    'T18',
    'T17',
    'T16',
    'T15',
    'BULL',
    'D20',
    'D19',
    'D18',
    'D17',
    'D16',
    '25',
    ...SCORING,
  ]) {
    if (value(l) === rem) return pick(l);
  }
  if (rem <= 20) return pick(`S${rem}`);
  const safe = SCORING.filter((l) => rem - value(l) >= 0);
  return pick(safe[0] ?? 'S1');
}

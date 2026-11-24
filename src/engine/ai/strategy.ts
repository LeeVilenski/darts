import type { StuckDart } from '../board/collision';
import { BOARD, pointInSector } from '../board/geometry';
import { suggestCheckout } from '../modes/checkouts';
import { atcTarget, type AtcState } from '../modes/aroundTheClock';
import { CRICKET_TARGETS, type CricketState } from '../modes/cricket';
import type { MatchState } from '../modes/match';
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

/** Points a segment label is worth. */
export const labelValue = (label: string) =>
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
export function chooseTarget(state: X01State, favouriteDouble?: number): AiTarget {
  const fav = favouriteDouble ? `D${favouriteDouble}` : undefined;
  const p = state.players[state.current]!;
  const dartsLeft = DARTS_PER_TURN - state.turn.darts.length;
  const rem = p.remaining;
  const pick = (label: string): AiTarget => ({ label, point: aimPointFor(label) });

  if (!p.opened) return pick('D20');

  if (state.options.doubleOut) {
    const route = suggestCheckout(rem, dartsLeft, fav);
    if (route) return pick(route[0]!);
    if (rem > 170 + 60) return pick('T20');
    // No finish this turn: score without busting and aim for a tidy leave.
    const safe = SCORING.filter((l) => rem - labelValue(l) >= 2);
    const loved = favouriteDouble
      ? safe.find((l) => rem - labelValue(l) === 2 * favouriteDouble)
      : undefined;
    const good = loved ?? safe.find((l) => GOOD_LEAVES.has(rem - labelValue(l)));
    const finishable = safe.find((l) => suggestCheckout(rem - labelValue(l), 3));
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
    if (labelValue(l) === rem) return pick(l);
  }
  if (rem <= 20) return pick(`S${rem}`);
  const safe = SCORING.filter((l) => rem - labelValue(l) >= 0);
  return pick(safe[0] ?? 'S1');
}

const pickLabel = (label: string): AiTarget => ({ label, point: aimPointFor(label) });
const cricketLabel = (t: number) => (t === 25 ? 'BULL' : `T${t}`);

/**
 * Cricket: if behind on points and holding a number an opponent hasn't
 * closed, score on it; otherwise close the highest number still open.
 */
export function chooseCricketTarget(state: CricketState): AiTarget {
  const me = state.players[state.current]!;
  const others = state.players.filter((_, i) => i !== state.current);
  const open = (marks: Record<number, number>, t: number) => (marks[t] ?? 0) < 3;
  const leader = Math.max(0, ...others.map((o) => o.points));
  const scoring = CRICKET_TARGETS.find(
    (t) => !open(me.marks, t) && others.some((o) => open(o.marks, t)),
  );
  if (scoring && me.points < leader) return pickLabel(cricketLabel(scoring));
  const toClose = CRICKET_TARGETS.find((t) => open(me.marks, t));
  if (toClose) return pickLabel(cricketLabel(toClose));
  return pickLabel(cricketLabel(scoring ?? 20));
}

/** Around the Clock: the fat single of the next number (or the bull). */
export function chooseAtcTarget(state: AtcState): AiTarget {
  const t = atcTarget(state.players[state.current]!);
  return pickLabel(t === 25 ? 'BULL' : `S${t}`);
}

export function chooseTargetFor(match: MatchState, favouriteDouble?: number): AiTarget {
  switch (match.mode) {
    case 'x01':
      return chooseTarget(match, favouriteDouble);
    case 'cricket':
      return chooseCricketTarget(match);
    case 'atc':
      return chooseAtcTarget(match);
  }
}

/** A stuck dart this close (mm) to the aim point blocks it. */
const BLOCK_MM = 5;
/** How far (mm) along the treble bed to move the aim to get around a blocker. */
const AROUND_MM = 8;

const clearance = (p: { x: number; y: number }, stuck: readonly StuckDart[]) =>
  Math.min(Infinity, ...stuck.map((s) => Math.hypot(p.x - s.x, p.y - s.y)));

/**
 * What a good player does when their own darts cover the treble: aim at the
 * open side of the bed, or, scoring from distance in x01 with both sides
 * covered, switch to T19.
 */
export function aimAround(
  target: AiTarget,
  stuck: readonly StuckDart[],
  match: MatchState,
): AiTarget {
  if (!stuck.length || target.label[0] !== 'T' || clearance(target.point, stuck) >= BLOCK_MM)
    return target;
  const r = Math.hypot(target.point.x, target.point.y);
  const turn = AROUND_MM / r;
  const sides = [turn, -turn].map((a) => ({
    x: target.point.x * Math.cos(a) + target.point.y * Math.sin(a),
    y: -target.point.x * Math.sin(a) + target.point.y * Math.cos(a),
  }));
  const best = sides.reduce((a, b) => (clearance(b, stuck) > clearance(a, stuck) ? b : a));
  if (clearance(best, stuck) >= BLOCK_MM) return { label: target.label, point: best };
  const scoringFromDistance =
    match.mode === 'x01' && match.players[match.current]!.remaining >= 230;
  if (target.label === 'T20' && scoringFromDistance) {
    const t19 = pickLabel('T19');
    if (clearance(t19.point, stuck) >= BLOCK_MM) return t19;
  }
  return target;
}

import type { StuckDart } from '../board/collision';
import { BOARD, pointInSector } from '../board/geometry';
import { suggestCheckout } from '../modes/checkouts';
import { atcTarget, type AtcState } from '../modes/aroundTheClock';
import { CRICKET_TARGETS, type CricketState } from '../modes/cricket';
import type { MatchState } from '../modes/match';
import { bobs27Target, type Bobs27State } from '../modes/bobs27';
import { halveItTarget, type HalveItState } from '../modes/halveIt';
import type { KillerState } from '../modes/killer';
import type { LadderState } from '../modes/ladder';
import type { ShanghaiState } from '../modes/shanghai';
import { baseOf } from '../modes/types';
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

const pickLabel = (label: string): AiTarget => ({ label, point: aimPointFor(label) });

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
  const p = state.players[state.current]!;
  if (!p.opened) return pickLabel('D20');
  const dartsLeft = DARTS_PER_TURN - state.turn.darts.length;
  return x01Target(p.remaining, dartsLeft, state.options.doubleOut, favouriteDouble);
}

/** Target for `rem` left with `dartsLeft` darts this visit (x01 rules). */
export function x01Target(
  rem: number,
  dartsLeft: number,
  doubleOut: boolean,
  favouriteDouble?: number,
): AiTarget {
  const fav = favouriteDouble ? `D${favouriteDouble}` : undefined;
  const pick = pickLabel;

  if (doubleOut) {
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
  const lowest = Math.min(...others.map((o) => o.points));
  const scoring = CRICKET_TARGETS.find(
    (t) => !open(me.marks, t) && others.some((o) => open(o.marks, t)),
  );
  // Cut-throat: pile points on opponents unless they're already behind (higher).
  const behind = state.options.cutThroat ? me.points > lowest : me.points < leader;
  if (scoring && behind) return pickLabel(cricketLabel(scoring));
  const toClose = CRICKET_TARGETS.find((t) => open(me.marks, t));
  if (toClose) return pickLabel(cricketLabel(toClose));
  return pickLabel(cricketLabel(scoring ?? 20));
}

/** Around the Clock: the fat single of the next number (or the bull). */
export function chooseAtcTarget(state: AtcState): AiTarget {
  const t = atcTarget(state.players[state.current]!);
  return pickLabel(t === 25 ? 'BULL' : `S${t}`);
}

/** Shanghai: the treble of the round's number, or whichever bed completes a Shanghai. */
export function chooseShanghaiTarget(state: ShanghaiState): AiTarget {
  const n = state.round;
  const got = new Set(state.turn.darts.filter((d) => baseOf(d) === n).map((d) => d.multiplier));
  if (state.turn.darts.length === 2 && got.size === 2) {
    const missing = ([1, 2, 3] as const).find((m) => !got.has(m))!;
    return pickLabel(`${{ 1: 'S', 2: 'D', 3: 'T' }[missing]}${n}`);
  }
  return pickLabel(`T${n}`);
}

/** Killer: earn your stripes on your own double, then hunt the weakest opponent. */
export function chooseKillerTarget(state: KillerState): AiTarget {
  const me = state.players[state.current]!;
  if (!me.killer) return pickLabel(`D${me.number}`);
  const prey = state.players
    .filter((p, j) => j !== state.current && p.lives > 0)
    .sort((a, b) => Number(b.killer) - Number(a.killer) || a.lives - b.lives)[0];
  return pickLabel(`D${(prey ?? me).number}`);
}

/** Bob's 27: the round's double. */
export const chooseBobs27Target = (state: Bobs27State): AiTarget => {
  const t = bobs27Target(state.round);
  return pickLabel(t === 25 ? 'BULL' : `D${t}`);
};

/** Halve-It: the safe fat single until the round is saved, then go for the treble. */
export function chooseHalveItTarget(state: HalveItState): AiTarget {
  const t = halveItTarget(state.round);
  if (t === 'D') return pickLabel('D20');
  if (t === 'T') return pickLabel('T20');
  if (t === 'B') return pickLabel('25');
  return pickLabel(state.turn.hits ? `T${t}` : `S${t}`);
}

export function chooseLadderTarget(state: LadderState, favouriteDouble?: number): AiTarget {
  const p = state.players[state.current]!;
  return x01Target(p.remaining, DARTS_PER_TURN - state.turn.darts.length, true, favouriteDouble);
}

export function chooseTargetFor(match: MatchState, favouriteDouble?: number): AiTarget {
  switch (match.mode) {
    case 'x01':
      return chooseTarget(match, favouriteDouble);
    case 'cricket':
      return chooseCricketTarget(match);
    case 'atc':
      return chooseAtcTarget(match);
    case 'shanghai':
      return chooseShanghaiTarget(match);
    case 'killer':
      return chooseKillerTarget(match);
    case 'bobs27':
      return chooseBobs27Target(match);
    case 'halveit':
      return chooseHalveItTarget(match);
    case 'ladder':
      return chooseLadderTarget(match, favouriteDouble);
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

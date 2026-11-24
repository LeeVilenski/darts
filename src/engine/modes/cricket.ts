import type { DartScore } from './dart';
import { awardLeg, baseOf, nextTurn, type MatchFormat, type TurnStatus } from './types';

/** Numbers in play, in the order they are usually shown and chased. 25 = bull. */
export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const;
export type CricketTarget = (typeof CRICKET_TARGETS)[number];

export interface CricketOptions extends MatchFormat {
  legsToWin: number;
  /** Cut-throat: extra marks give points to opponents still open; lowest score wins. */
  cutThroat?: boolean;
}
export const DEFAULT_CRICKET: CricketOptions = { legsToWin: 1, cutThroat: false };

export interface CricketPlayer {
  name: string;
  /** Marks per target, capped at 3 (closed). */
  marks: Record<CricketTarget, number>;
  points: number;
  legsWon: number;
  setsWon: number;
  stats: { darts: number; marks: number };
}

export interface CricketState {
  mode: 'cricket';
  options: CricketOptions;
  players: CricketPlayer[];
  current: number;
  legStarter: number;
  setStarter?: number;
  set?: number;
  legWinner?: number | null;
  leg: number;
  turn: { player: number; darts: DartScore[]; marks: number; points: number };
  status: TurnStatus;
  winner: number | null;
}

const DARTS_PER_TURN = 3;
const emptyMarks = (): Record<CricketTarget, number> => ({
  20: 0,
  19: 0,
  18: 0,
  17: 0,
  16: 0,
  15: 0,
  25: 0,
});
const newTurn = (player: number) => ({ player, darts: [], marks: 0, points: 0 });
const isTarget = (n: number): n is CricketTarget =>
  (CRICKET_TARGETS as readonly number[]).includes(n);
export const allClosed = (p: CricketPlayer) => CRICKET_TARGETS.every((t) => p.marks[t] >= 3);

export function createCricket(
  names: string[],
  options: CricketOptions = DEFAULT_CRICKET,
): CricketState {
  if (names.length < 1) throw new Error('At least one player required');
  return {
    mode: 'cricket',
    options,
    players: names.map((name) => ({
      name,
      marks: emptyMarks(),
      points: 0,
      legsWon: 0,
      setsWon: 0,
      stats: { darts: 0, marks: 0 },
    })),
    current: 0,
    legStarter: 0,
    leg: 1,
    turn: newTurn(0),
    status: 'open',
    winner: null,
  };
}

/**
 * Standard cricket: hitting a target adds marks (single 1, double 2, treble 3;
 * outer bull 1, bull 2). Three marks close it; further marks score its value
 * while any opponent still has it open. Win by closing everything with at
 * least as many points as every opponent.
 */
export function applyCricketDart(s: CricketState, dart: DartScore): CricketState {
  if (s.status !== 'open') return s;
  const i = s.current;
  const me = s.players[i]!;
  const base = baseOf(dart);
  let marks = me.marks;
  let points = me.points;
  let hits = 0;
  let scored = 0;
  const cutThroat = !!s.options.cutThroat;

  if (isTarget(base)) {
    hits = dart.multiplier;
    const before = me.marks[base];
    const closing = Math.min(hits, 3 - before);
    const extra = hits - closing;
    const othersOpen = s.players.some((o, j) => j !== i && o.marks[base] < 3);
    scored = othersOpen ? extra * base : 0;
    marks = { ...me.marks, [base]: Math.min(3, before + hits) };
    if (!cutThroat) points = me.points + scored;
  }

  const player: CricketPlayer = {
    ...me,
    marks,
    points,
    stats: { darts: me.stats.darts + 1, marks: me.stats.marks + hits },
  };
  // Cut-throat: the points land on every opponent who still has the number open.
  const players = s.players.map((p, j) =>
    j === i
      ? player
      : cutThroat && scored && p.marks[base as CricketTarget] < 3
        ? { ...p, points: p.points + scored }
        : p,
  );
  const darts = [...s.turn.darts, dart];
  const turn = { ...s.turn, darts, marks: s.turn.marks + hits, points: s.turn.points + scored };

  const ahead = (o: CricketPlayer) =>
    cutThroat ? player.points <= o.points : player.points >= o.points;
  const won = allClosed(player) && players.every((o, j) => j === i || ahead(o));
  if (won) {
    const { player: winner, matchWon } = awardLeg(player, s.options);
    return {
      ...s,
      players: players.map((p, j) => (j === i ? winner : p)),
      turn,
      status: matchWon ? 'matchWon' : 'legWon',
      winner: matchWon ? i : null,
    };
  }
  return { ...s, players, turn, status: darts.length >= DARTS_PER_TURN ? 'complete' : 'open' };
}

export function endCricketTurn(s: CricketState): CricketState {
  return nextTurn(s, newTurn, (p) => ({ ...p, marks: emptyMarks(), points: 0 }));
}

/** Marks per round (3 darts). */
export const marksPerRound = (p: CricketPlayer) =>
  p.stats.darts ? (p.stats.marks / p.stats.darts) * 3 : 0;

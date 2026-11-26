import type { DartScore } from './dart';
import { endsRound, leader, nextActive } from './rounds';
import { baseOf, concludeLeg, nextTurn, type MatchFormat, type TurnStatus } from './types';

/**
 * Bob's 27: a doubles workout. Start on 27 and go round D1–D20 then the
 * bull, three darts at each. Every hit adds the double's value; a round with
 * no hits takes it away. Drop to zero or below and you're out. Highest score
 * at the end wins (ties: most hits, then whoever threw first).
 */
export type Bobs27Options = MatchFormat & { legsToWin: number };
export const DEFAULT_BOBS27: Bobs27Options = { legsToWin: 1 };
export const BOBS27_START = 27;
/** Targets by round: doubles 1–20, then the bull (25 = D-bull). */
export const BOBS27_TARGETS = [...Array.from({ length: 20 }, (_, i) => i + 1), 25] as const;

export interface Bobs27Player {
  name: string;
  score: number;
  out: boolean;
  legsWon: number;
  setsWon: number;
  stats: { darts: number; hits: number };
}

export interface Bobs27State {
  mode: 'bobs27';
  options: Bobs27Options;
  players: Bobs27Player[];
  current: number;
  legStarter: number;
  setStarter?: number;
  set?: number;
  legWinner?: number | null;
  leg: number;
  /** 1-based index into BOBS27_TARGETS. */
  round: number;
  turn: { player: number; darts: DartScore[]; hits: number; points: number };
  status: TurnStatus;
  winner: number | null;
}

const DARTS_PER_TURN = 3;
const newTurn = (player: number) => ({ player, darts: [], hits: 0, points: 0 });
export const bobs27Target = (round: number) => BOBS27_TARGETS[Math.min(round, 21) - 1]!;
/** Points a double is worth (D-bull = 50). */
export const bobs27Value = (round: number) => bobs27Target(round) * 2;

export function createBobs27(
  names: string[],
  options: Bobs27Options = DEFAULT_BOBS27,
): Bobs27State {
  if (names.length < 1) throw new Error('At least one player required');
  return {
    mode: 'bobs27',
    options,
    players: names.map((name) => ({
      name,
      score: BOBS27_START,
      out: false,
      legsWon: 0,
      setsWon: 0,
      stats: { darts: 0, hits: 0 },
    })),
    current: 0,
    legStarter: 0,
    leg: 1,
    round: 1,
    turn: newTurn(0),
    status: 'open',
    winner: null,
  };
}

export function applyBobs27Dart(s: Bobs27State, dart: DartScore): Bobs27State {
  if (s.status !== 'open') return s;
  const i = s.current;
  const me = s.players[i]!;
  const hit = dart.multiplier === 2 && baseOf(dart) === bobs27Target(s.round);
  const value = bobs27Value(s.round);
  const darts = [...s.turn.darts, dart];
  const turn = {
    ...s.turn,
    darts,
    hits: s.turn.hits + (hit ? 1 : 0),
    points: s.turn.points + (hit ? value : 0),
  };
  let player: Bobs27Player = {
    ...me,
    score: me.score + (hit ? value : 0),
    stats: { darts: me.stats.darts + 1, hits: me.stats.hits + (hit ? 1 : 0) },
  };
  if (darts.length < DARTS_PER_TURN) {
    return { ...s, players: s.players.map((p, j) => (j === i ? player : p)), turn };
  }
  if (turn.hits === 0) {
    const score = player.score - value;
    player = { ...player, score, out: score <= 0 };
    turn.points = -value;
  }
  const players = s.players.map((p, j) => (j === i ? player : p));
  const active = players.map((p) => !p.out);
  const over =
    active.every((a) => !a) ||
    (s.round >= BOBS27_TARGETS.length && endsRound(i, s.legStarter, active));
  if (over) {
    const w = leader(
      players.map((p) => p.score),
      players.map((p) => p.stats.hits),
      s.legStarter,
    );
    return concludeLeg(s, players, turn, w);
  }
  return { ...s, players, turn, status: 'complete' };
}

export function endBobs27Turn(s: Bobs27State): Bobs27State {
  if (s.status === 'complete') {
    const { next, newRound } = nextActive(
      s.current,
      s.legStarter,
      s.players.map((p) => !p.out),
    );
    return {
      ...s,
      current: next,
      round: s.round + (newRound ? 1 : 0),
      turn: newTurn(next),
      status: 'open',
    };
  }
  const next = nextTurn(s, newTurn, (p) => ({ ...p, score: BOBS27_START, out: false }));
  return next === s ? s : { ...next, round: 1 };
}

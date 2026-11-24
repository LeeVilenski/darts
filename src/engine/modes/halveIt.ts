import type { DartScore } from './dart';
import { endsRound, leader, nextActive } from './rounds';
import { baseOf, concludeLeg, nextTurn, type MatchFormat, type TurnStatus } from './types';

/**
 * Halve-It: a fixed list of targets, one per round. Hits on the target add
 * their points; a round without a single hit halves your score (rounded
 * down). Highest score after the last round wins.
 */
export type HalveItTarget = number | 'D' | 'T' | 'B';
/** 15, 16, any double, 17, 18, any treble, 19, 20, bull. */
export const HALVE_IT_TARGETS: readonly HalveItTarget[] = [15, 16, 'D', 17, 18, 'T', 19, 20, 'B'];
export const HALVE_IT_START = 40;

export type HalveItOptions = MatchFormat & { legsToWin: number };
export const DEFAULT_HALVE_IT: HalveItOptions = { legsToWin: 1 };

export interface HalveItPlayer {
  name: string;
  score: number;
  legsWon: number;
  setsWon: number;
  stats: { darts: number; hits: number; halved: number };
}

export interface HalveItState {
  mode: 'halveit';
  options: HalveItOptions;
  players: HalveItPlayer[];
  current: number;
  legStarter: number;
  setStarter?: number;
  set?: number;
  legWinner?: number | null;
  leg: number;
  round: number;
  turn: { player: number; darts: DartScore[]; hits: number; points: number; halved: boolean };
  status: TurnStatus;
  winner: number | null;
}

const DARTS_PER_TURN = 3;
const newTurn = (player: number) => ({ player, darts: [], hits: 0, points: 0, halved: false });
export const halveItTarget = (round: number) =>
  HALVE_IT_TARGETS[Math.min(round, HALVE_IT_TARGETS.length) - 1]!;
export const halveItLabel = (t: HalveItTarget) =>
  t === 'D' ? 'Any double' : t === 'T' ? 'Any treble' : t === 'B' ? 'Bull' : String(t);

export function hitsHalveIt(t: HalveItTarget, d: DartScore): boolean {
  if (t === 'D') return d.multiplier === 2;
  if (t === 'T') return d.multiplier === 3;
  if (t === 'B') return baseOf(d) === 25;
  return baseOf(d) === t;
}

export function createHalveIt(
  names: string[],
  options: HalveItOptions = DEFAULT_HALVE_IT,
): HalveItState {
  if (names.length < 1) throw new Error('At least one player required');
  return {
    mode: 'halveit',
    options,
    players: names.map((name) => ({
      name,
      score: HALVE_IT_START,
      legsWon: 0,
      setsWon: 0,
      stats: { darts: 0, hits: 0, halved: 0 },
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

export function applyHalveItDart(s: HalveItState, dart: DartScore): HalveItState {
  if (s.status !== 'open') return s;
  const i = s.current;
  const me = s.players[i]!;
  const hit = hitsHalveIt(halveItTarget(s.round), dart);
  const darts = [...s.turn.darts, dart];
  let turn = {
    ...s.turn,
    darts,
    hits: s.turn.hits + (hit ? 1 : 0),
    points: s.turn.points + (hit ? dart.points : 0),
  };
  let player: HalveItPlayer = {
    ...me,
    score: me.score + (hit ? dart.points : 0),
    stats: { ...me.stats, darts: me.stats.darts + 1, hits: me.stats.hits + (hit ? 1 : 0) },
  };
  if (darts.length >= DARTS_PER_TURN && turn.hits === 0) {
    const score = Math.floor(player.score / 2);
    turn = { ...turn, halved: true, points: score - player.score };
    player = { ...player, score, stats: { ...player.stats, halved: player.stats.halved + 1 } };
  }
  const players = s.players.map((p, j) => (j === i ? player : p));
  if (darts.length < DARTS_PER_TURN) return { ...s, players, turn };
  const everyone = players.map(() => true);
  if (s.round >= HALVE_IT_TARGETS.length && endsRound(i, s.legStarter, everyone)) {
    const w = leader(
      players.map((p) => p.score),
      players.map((p) => p.stats.hits),
      s.legStarter,
    );
    return concludeLeg(s, players, turn, w);
  }
  return { ...s, players, turn, status: 'complete' };
}

export function endHalveItTurn(s: HalveItState): HalveItState {
  if (s.status === 'complete') {
    const { next, newRound } = nextActive(
      s.current,
      s.legStarter,
      s.players.map(() => true),
    );
    return {
      ...s,
      current: next,
      round: s.round + (newRound ? 1 : 0),
      turn: newTurn(next),
      status: 'open',
    };
  }
  const next = nextTurn(s, newTurn, (p) => ({ ...p, score: HALVE_IT_START }));
  return next === s ? s : { ...next, round: 1 };
}

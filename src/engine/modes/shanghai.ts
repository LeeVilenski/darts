import type { DartScore } from './dart';
import { endsRound, leader, nextActive } from './rounds';
import { baseOf, concludeLeg, nextTurn, type MatchFormat, type TurnStatus } from './types';

/**
 * Shanghai: round N is played on number N. Only that number scores (its
 * points as thrown). Single, double and treble of it in one turn is a
 * "Shanghai" and wins the leg outright; otherwise the highest total after the
 * last round wins (ties: most hits, then whoever threw first).
 */
export interface ShanghaiOptions extends MatchFormat {
  legsToWin: number;
  rounds: 7 | 20;
}
export const DEFAULT_SHANGHAI: ShanghaiOptions = { legsToWin: 1, rounds: 7 };

export interface ShanghaiPlayer {
  name: string;
  score: number;
  legsWon: number;
  setsWon: number;
  stats: { darts: number; hits: number; shanghais: number };
}

export interface ShanghaiState {
  mode: 'shanghai';
  options: ShanghaiOptions;
  players: ShanghaiPlayer[];
  current: number;
  legStarter: number;
  setStarter?: number;
  set?: number;
  legWinner?: number | null;
  leg: number;
  /** 1-based; also the target number. */
  round: number;
  turn: { player: number; darts: DartScore[]; hits: number; points: number; shanghai: boolean };
  status: TurnStatus;
  winner: number | null;
}

const DARTS_PER_TURN = 3;
const newTurn = (player: number) => ({ player, darts: [], hits: 0, points: 0, shanghai: false });

export function createShanghai(
  names: string[],
  options: ShanghaiOptions = DEFAULT_SHANGHAI,
): ShanghaiState {
  if (names.length < 1) throw new Error('At least one player required');
  return {
    mode: 'shanghai',
    options,
    players: names.map((name) => ({
      name,
      score: 0,
      legsWon: 0,
      setsWon: 0,
      stats: { darts: 0, hits: 0, shanghais: 0 },
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

export function applyShanghaiDart(s: ShanghaiState, dart: DartScore): ShanghaiState {
  if (s.status !== 'open') return s;
  const i = s.current;
  const me = s.players[i]!;
  const hit = baseOf(dart) === s.round;
  const darts = [...s.turn.darts, dart];
  const mults = new Set(darts.filter((d) => baseOf(d) === s.round).map((d) => d.multiplier));
  const shanghai = mults.has(1) && mults.has(2) && mults.has(3);
  const player: ShanghaiPlayer = {
    ...me,
    score: me.score + (hit ? dart.points : 0),
    stats: {
      darts: me.stats.darts + 1,
      hits: me.stats.hits + (hit ? 1 : 0),
      shanghais: me.stats.shanghais + (shanghai ? 1 : 0),
    },
  };
  const players = s.players.map((p, j) => (j === i ? player : p));
  const turn = {
    ...s.turn,
    darts,
    hits: s.turn.hits + (hit ? 1 : 0),
    points: s.turn.points + (hit ? dart.points : 0),
    shanghai,
  };
  if (shanghai) return concludeLeg(s, players, turn, i);
  if (darts.length < DARTS_PER_TURN) return { ...s, players, turn };
  const everyone = players.map(() => true);
  if (s.round >= s.options.rounds && endsRound(i, s.legStarter, everyone)) {
    const w = leader(
      players.map((p) => p.score),
      players.map((p) => p.stats.hits),
      s.legStarter,
    );
    return concludeLeg(s, players, turn, w);
  }
  return { ...s, players, turn, status: 'complete' };
}

export function endShanghaiTurn(s: ShanghaiState): ShanghaiState {
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
  const next = nextTurn(s, newTurn, (p) => ({ ...p, score: 0 }));
  return next === s ? s : { ...next, round: 1 };
}

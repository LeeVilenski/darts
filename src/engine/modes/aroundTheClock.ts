import type { DartScore } from './dart';
import { baseOf, nextTurn, type TurnStatus } from './types';

/** Targets in order: 1–20, then the bull (outer or inner). */
export const ATC_SEQUENCE = [...Array.from({ length: 20 }, (_, i) => i + 1), 25] as const;

export interface AtcOptions {
  legsToWin: number;
  /** Doubles advance two numbers and trebles three. */
  multiplierAdvance: boolean;
}
export const DEFAULT_ATC: AtcOptions = { legsToWin: 1, multiplierAdvance: false };

export interface AtcPlayer {
  name: string;
  /** Index into ATC_SEQUENCE of the number this player needs next. */
  next: number;
  legsWon: number;
  stats: { darts: number; hits: number };
}

export interface AtcState {
  mode: 'atc';
  options: AtcOptions;
  players: AtcPlayer[];
  current: number;
  legStarter: number;
  leg: number;
  turn: { player: number; darts: DartScore[]; hits: number };
  status: TurnStatus;
  winner: number | null;
}

const DARTS_PER_TURN = 3;
const BULL_INDEX = ATC_SEQUENCE.length - 1;
const newTurn = (player: number) => ({ player, darts: [], hits: 0 });

export const atcTarget = (p: AtcPlayer) => ATC_SEQUENCE[Math.min(p.next, BULL_INDEX)]!;

export function createAtc(names: string[], options: AtcOptions = DEFAULT_ATC): AtcState {
  if (names.length < 1) throw new Error('At least one player required');
  return {
    mode: 'atc',
    options,
    players: names.map((name) => ({ name, next: 0, legsWon: 0, stats: { darts: 0, hits: 0 } })),
    current: 0,
    legStarter: 0,
    leg: 1,
    turn: newTurn(0),
    status: 'open',
    winner: null,
  };
}

export function applyAtcDart(s: AtcState, dart: DartScore): AtcState {
  if (s.status !== 'open') return s;
  const i = s.current;
  const me = s.players[i]!;
  const target = atcTarget(me);
  const hit = baseOf(dart) === target;
  const finished = hit && me.next >= BULL_INDEX;
  // Multipliers can skip numbers, but never skip the bull.
  const step = hit ? (s.options.multiplierAdvance ? dart.multiplier : 1) : 0;
  const next = finished ? ATC_SEQUENCE.length : Math.min(me.next + step, BULL_INDEX);

  const player: AtcPlayer = {
    ...me,
    next,
    stats: { darts: me.stats.darts + 1, hits: me.stats.hits + (hit ? 1 : 0) },
  };
  const darts = [...s.turn.darts, dart];
  const turn = { ...s.turn, darts, hits: s.turn.hits + (hit ? 1 : 0) };

  if (finished) {
    const legsWon = player.legsWon + 1;
    const matchWon = legsWon >= s.options.legsToWin;
    return {
      ...s,
      players: s.players.map((p, j) => (j === i ? { ...player, legsWon } : p)),
      turn,
      status: matchWon ? 'matchWon' : 'legWon',
      winner: matchWon ? i : null,
    };
  }
  const players = s.players.map((p, j) => (j === i ? player : p));
  return { ...s, players, turn, status: darts.length >= DARTS_PER_TURN ? 'complete' : 'open' };
}

export function endAtcTurn(s: AtcState): AtcState {
  return nextTurn(s, newTurn, (p) => ({ ...p, next: 0 }));
}

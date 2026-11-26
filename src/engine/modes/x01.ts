import { isDouble, type DartScore } from './dart';
import { awardLeg, nextTurn, type MatchFormat, type TurnStatus } from './types';

export interface X01Options extends MatchFormat {
  startScore: 301 | 501 | 701;
  doubleIn: boolean;
  doubleOut: boolean;
  /** First to this many legs wins the match (or the set, when playing sets). */
  legsToWin: number;
}

export const DEFAULT_X01: X01Options = {
  startScore: 501,
  doubleIn: false,
  doubleOut: true,
  legsToWin: 1,
};

export interface PlayerStats {
  darts: number;
  /** Points that counted (bust turns score 0). */
  points: number;
  tons: number; // 100–139
  ton40s: number; // 140–179
  oneEighties: number;
  bestCheckout: number;
}

export interface X01Player {
  name: string;
  remaining: number;
  /** False until the player hits a double when double-in is on. */
  opened: boolean;
  legsWon: number;
  setsWon: number;
  stats: PlayerStats;
}

export interface X01Turn {
  player: number;
  startRemaining: number;
  darts: DartScore[];
  /** Points scored so far this turn (reverted to 0 on bust). */
  points: number;
}

export type { TurnStatus } from './types';

export interface X01State {
  mode: 'x01';
  options: X01Options;
  players: X01Player[];
  current: number;
  /** Player who threw first in the current leg (rotates each leg). */
  legStarter: number;
  setStarter?: number;
  set?: number;
  legWinner?: number | null;
  leg: number;
  turn: X01Turn;
  status: TurnStatus;
  winner: number | null;
}

export const DARTS_PER_TURN = 3;

const emptyStats = (): PlayerStats => ({
  darts: 0,
  points: 0,
  tons: 0,
  ton40s: 0,
  oneEighties: 0,
  bestCheckout: 0,
});

const newTurn = (player: number, remaining: number): X01Turn => ({
  player,
  startRemaining: remaining,
  darts: [],
  points: 0,
});

export function createX01(names: string[], options: X01Options = DEFAULT_X01): X01State {
  if (names.length < 1) throw new Error('At least one player required');
  const players = names.map((name) => ({
    name,
    remaining: options.startScore,
    opened: !options.doubleIn,
    legsWon: 0,
    setsWon: 0,
    stats: emptyStats(),
  }));
  return {
    mode: 'x01',
    options,
    players,
    current: 0,
    legStarter: 0,
    leg: 1,
    turn: newTurn(0, options.startScore),
    status: 'open',
    winner: null,
  };
}

function withPlayer(s: X01State, i: number, p: X01Player): X01Player[] {
  return s.players.map((q, j) => (j === i ? p : q));
}

function recordTurnStats(stats: PlayerStats, turnPoints: number, checkout: boolean): PlayerStats {
  return {
    ...stats,
    points: stats.points + turnPoints,
    tons: stats.tons + (turnPoints >= 100 && turnPoints < 140 ? 1 : 0),
    ton40s: stats.ton40s + (turnPoints >= 140 && turnPoints < 180 ? 1 : 0),
    oneEighties: stats.oneEighties + (turnPoints === 180 ? 1 : 0),
    bestCheckout: checkout ? Math.max(stats.bestCheckout, turnPoints) : stats.bestCheckout,
  };
}

/** Apply one dart for the current player. No-op unless the turn is open. */
export function applyDart(s: X01State, dart: DartScore): X01State {
  if (s.status !== 'open') return s;
  const i = s.current;
  const p = s.players[i]!;
  const darts = [...s.turn.darts, dart];
  const stats = { ...p.stats, darts: p.stats.darts + 1 };

  const opens = !p.opened && isDouble(dart);
  const counts = p.opened || opens;
  const scored = counts ? dart.points : 0;
  const remaining = p.remaining - scored;
  const { doubleOut } = s.options;

  const bust =
    remaining < 0 ||
    (doubleOut && remaining === 1) ||
    (remaining === 0 && doubleOut && !isDouble(dart));
  if (bust) {
    const player = {
      ...p,
      remaining: s.turn.startRemaining,
      stats: recordTurnStats(stats, 0, false),
    };
    return {
      ...s,
      players: withPlayer(s, i, player),
      turn: { ...s.turn, darts, points: 0 },
      status: 'bust',
    };
  }

  const turnPoints = s.turn.points + scored;
  const turn = { ...s.turn, darts, points: turnPoints };

  if (remaining === 0) {
    const { player, matchWon } = awardLeg(
      { ...p, remaining: 0, opened: true, stats: recordTurnStats(stats, turnPoints, true) },
      s.options,
    );
    return {
      ...s,
      players: withPlayer(s, i, player),
      turn,
      status: matchWon ? 'matchWon' : 'legWon',
      winner: matchWon ? i : null,
    };
  }

  const done = darts.length >= DARTS_PER_TURN;
  const player = {
    ...p,
    remaining,
    opened: p.opened || opens,
    stats: done ? recordTurnStats(stats, turnPoints, false) : stats,
  };
  return { ...s, players: withPlayer(s, i, player), turn, status: done ? 'complete' : 'open' };
}

/** Finish the current turn: next player, or next leg after a leg win. */
export function endTurn(s: X01State): X01State {
  const next = nextTurn(
    s,
    (player) => newTurn(player, s.players[player]!.remaining),
    (p) => ({ ...p, remaining: s.options.startScore, opened: !s.options.doubleIn }),
  );
  // A new leg resets everyone's score, so the new turn must start from the reset score.
  return next.status === 'open' && next.leg !== s.leg
    ? { ...next, turn: newTurn(next.current, s.options.startScore) }
    : next;
}

/** Three-dart average. */
export function threeDartAverage(stats: PlayerStats): number {
  return stats.darts ? (stats.points / stats.darts) * 3 : 0;
}

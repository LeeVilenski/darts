import { isDouble, type DartScore } from './dart';
import { leader, nextActive } from './rounds';
import { concludeLeg, type MatchFormat, type TurnStatus } from './types';

/**
 * 121 checkout ladder: check out the target (double out) within three visits.
 * Make it and the next target is one higher; miss and it drops one (never
 * below 121). After the set number of attempts, the highest target checked
 * out wins (ties: most checkouts).
 */
export interface LadderOptions extends MatchFormat {
  legsToWin: 1;
  attempts: 5 | 10;
}
export const DEFAULT_LADDER: LadderOptions = { legsToWin: 1, attempts: 10 };
export const LADDER_START = 121;
export const LADDER_MAX = 170;
export const VISITS_PER_ATTEMPT = 3;

export interface LadderPlayer {
  name: string;
  /** Checkout being attempted. */
  target: number;
  /** What's left of it this attempt. */
  remaining: number;
  /** 1-based attempt number; > attempts once done. */
  attempt: number;
  /** 1-based visit within the attempt. */
  visit: number;
  best: number;
  checkouts: number;
  legsWon: number;
  setsWon: number;
  stats: { darts: number };
}

export interface LadderState {
  mode: 'ladder';
  options: LadderOptions;
  players: LadderPlayer[];
  current: number;
  legStarter: number;
  setStarter?: number;
  set?: number;
  legWinner?: number | null;
  leg: number;
  turn: {
    player: number;
    darts: DartScore[];
    startRemaining: number;
    points: number;
    bust: boolean;
    checkedOut: boolean;
  };
  status: TurnStatus;
  winner: number | null;
}

const DARTS_PER_TURN = 3;
const newTurn = (player: number, remaining: number) => ({
  player,
  darts: [],
  startRemaining: remaining,
  points: 0,
  bust: false,
  checkedOut: false,
});
const playing = (o: LadderOptions) => (p: LadderPlayer) => p.attempt <= o.attempts;

export function createLadder(
  names: string[],
  options: LadderOptions = DEFAULT_LADDER,
): LadderState {
  if (names.length < 1) throw new Error('At least one player required');
  return {
    mode: 'ladder',
    options,
    players: names.map((name) => ({
      name,
      target: LADDER_START,
      remaining: LADDER_START,
      attempt: 1,
      visit: 1,
      best: 0,
      checkouts: 0,
      legsWon: 0,
      setsWon: 0,
      stats: { darts: 0 },
    })),
    current: 0,
    legStarter: 0,
    leg: 1,
    turn: newTurn(0, LADDER_START),
    status: 'open',
    winner: null,
  };
}

/** Move on to the next attempt with a new target. */
const nextAttempt = (p: LadderPlayer, target: number): LadderPlayer => ({
  ...p,
  target,
  remaining: target,
  attempt: p.attempt + 1,
  visit: 1,
});

export function applyLadderDart(s: LadderState, dart: DartScore): LadderState {
  if (s.status !== 'open') return s;
  const i = s.current;
  const me = s.players[i]!;
  const darts = [...s.turn.darts, dart];
  const remaining = me.remaining - dart.points;
  const bust = remaining < 0 || remaining === 1 || (remaining === 0 && !isDouble(dart));
  const checkedOut = remaining === 0 && !bust;
  const visitOver = bust || checkedOut || darts.length >= DARTS_PER_TURN;

  let player: LadderPlayer = {
    ...me,
    remaining: bust ? s.turn.startRemaining : remaining,
    stats: { darts: me.stats.darts + 1 },
  };
  const turn = {
    ...s.turn,
    darts,
    bust,
    checkedOut,
    points: bust ? 0 : s.turn.points + dart.points,
  };
  if (!visitOver) return { ...s, players: s.players.map((p, j) => (j === i ? player : p)), turn };

  if (checkedOut) {
    player = nextAttempt(
      { ...player, best: Math.max(player.best, player.target), checkouts: player.checkouts + 1 },
      Math.min(LADDER_MAX, player.target + 1),
    );
  } else if (player.visit >= VISITS_PER_ATTEMPT) {
    player = nextAttempt(player, Math.max(LADDER_START, player.target - 1));
  } else {
    player = { ...player, visit: player.visit + 1 };
  }
  const players = s.players.map((p, j) => (j === i ? player : p));
  if (!players.some(playing(s.options))) {
    const w = leader(
      players.map((p) => p.best),
      players.map((p) => p.checkouts),
      s.legStarter,
    );
    return concludeLeg(s, players, turn, w);
  }
  return { ...s, players, turn, status: 'complete' };
}

export function endLadderTurn(s: LadderState): LadderState {
  if (s.status !== 'complete') return s;
  const { next } = nextActive(s.current, s.legStarter, s.players.map(playing(s.options)));
  return { ...s, current: next, turn: newTurn(next, s.players[next]!.remaining), status: 'open' };
}

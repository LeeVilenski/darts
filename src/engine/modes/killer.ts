import type { DartScore } from './dart';
import { nextActive } from './rounds';
import { baseOf, concludeLeg, nextTurn, type MatchFormat, type TurnStatus } from './types';

/**
 * Killer (2+ players): everyone has their own number and a few lives. Hit
 * your own double to become a killer; then every double of an opponent's
 * number takes one of their lives. Careful: a killer who hits their own
 * double loses a life. Last player standing wins.
 */
export interface KillerOptions extends MatchFormat {
  legsToWin: number;
  lives: 3 | 5;
}
export const DEFAULT_KILLER: KillerOptions = { legsToWin: 1, lives: 3 };

export interface KillerPlayer {
  name: string;
  number: number;
  lives: number;
  killer: boolean;
  legsWon: number;
  setsWon: number;
  stats: { darts: number; kills: number };
}

export interface KillerState {
  mode: 'killer';
  options: KillerOptions;
  players: KillerPlayer[];
  current: number;
  legStarter: number;
  setStarter?: number;
  set?: number;
  legWinner?: number | null;
  leg: number;
  turn: { player: number; darts: DartScore[]; lifeChanges: number };
  status: TurnStatus;
  winner: number | null;
}

const DARTS_PER_TURN = 3;
const newTurn = (player: number) => ({ player, darts: [], lifeChanges: 0 });
const alive = (p: KillerPlayer) => p.lives > 0;

/** Distinct numbers for each player, picked by a stable shuffle of their names. */
export function killerNumbers(names: string[]): number[] {
  let h = 0x811c9dc5;
  for (const c of names.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  const pool = Array.from({ length: 20 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    const j = h % (i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return names.map((_, i) => pool[i]!);
}

export function createKiller(
  names: string[],
  options: KillerOptions = DEFAULT_KILLER,
): KillerState {
  if (names.length < 2) throw new Error('Killer needs at least two players');
  const numbers = killerNumbers(names);
  return {
    mode: 'killer',
    options,
    players: names.map((name, i) => ({
      name,
      number: numbers[i]!,
      lives: options.lives,
      killer: false,
      legsWon: 0,
      setsWon: 0,
      stats: { darts: 0, kills: 0 },
    })),
    current: 0,
    legStarter: 0,
    leg: 1,
    turn: newTurn(0),
    status: 'open',
    winner: null,
  };
}

export function applyKillerDart(s: KillerState, dart: DartScore): KillerState {
  if (s.status !== 'open') return s;
  const i = s.current;
  const darts = [...s.turn.darts, dart];
  let players = s.players.map((p, j) =>
    j === i ? { ...p, stats: { ...p.stats, darts: p.stats.darts + 1 } } : p,
  );
  let lifeChanges = 0;
  if (dart.multiplier === 2) {
    const n = baseOf(dart);
    const me = players[i]!;
    players = players.map((p, j) => {
      if (p.number !== n || !alive(p)) return p;
      if (j === i) {
        if (!me.killer) return { ...p, killer: true };
        lifeChanges++;
        return { ...p, lives: p.lives - 1 };
      }
      if (!me.killer) return p;
      lifeChanges++;
      return { ...p, lives: p.lives - 1 };
    });
    const killed = players.filter((p, j) => j !== i && s.players[j]!.lives > 0 && p.lives === 0);
    if (killed.length)
      players = players.map((p, j) =>
        j === i ? { ...p, stats: { ...p.stats, kills: p.stats.kills + killed.length } } : p,
      );
  }
  const turn = { ...s.turn, darts, lifeChanges: s.turn.lifeChanges + lifeChanges };
  const standing = players.flatMap((p, j) => (alive(p) ? [j] : []));
  if (standing.length <= 1) return concludeLeg(s, players, turn, standing[0] ?? i);
  // A player who knocks themselves out stops throwing at once.
  const done = darts.length >= DARTS_PER_TURN || !alive(players[i]!);
  return { ...s, players, turn, status: done ? 'complete' : 'open' };
}

export function endKillerTurn(s: KillerState): KillerState {
  if (s.status === 'complete') {
    const { next } = nextActive(s.current, s.legStarter, s.players.map(alive));
    return { ...s, current: next, turn: newTurn(next), status: 'open' };
  }
  return nextTurn(s, newTurn, (p) => ({ ...p, lives: s.options.lives, killer: false }));
}

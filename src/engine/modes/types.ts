import type { DartScore } from './dart';

export type ModeId =
  'x01' | 'cricket' | 'atc' | 'shanghai' | 'killer' | 'bobs27' | 'halveit' | 'ladder';

/**
 * open: player is still throwing this turn.
 * bust / complete / legWon / matchWon: turn finished; call endTurn() to move on
 * (matchWon is terminal). Only x01 can bust.
 */
export type TurnStatus = 'open' | 'bust' | 'complete' | 'legWon' | 'matchWon';

/** Shape every mode's match state shares, so UI, AI driver and store can stay generic. */
/** How a match is won: first to `legsToWin` legs, or (with sets) first to `setsToWin` sets of `legsToWin` legs. */
export interface MatchFormat {
  legsToWin: number;
  /** 0 / absent = no sets. */
  setsToWin?: number;
}

export interface BaseMatch {
  mode: ModeId;
  options: MatchFormat;
  /** legsWon counts legs in the current set when playing sets. */
  players: { name: string; legsWon: number; setsWon: number; stats: { darts: number } }[];
  current: number;
  legStarter: number;
  /** Player who threw first in the current set (sets play only). */
  setStarter?: number;
  leg: number;
  /** Current set number, from 1 (sets play only). */
  set?: number;
  /** Who won the leg just finished, when that isn't the player who threw last. */
  legWinner?: number | null;
  turn: { player: number; darts: DartScore[] };
  status: TurnStatus;
  winner: number | null;
}

/** Base number of a dart (bull = 25), or 0 for a miss. */
export const baseOf = (d: DartScore) => (d.multiplier ? d.points / d.multiplier : 0);

export const playsSets = (o: MatchFormat) => (o.setsToWin ?? 0) > 0;

/** Credit a leg to a player; says whether that also won the set and the match. */
export function awardLeg<P extends { legsWon: number; setsWon: number }>(
  p: P,
  o: MatchFormat,
): { player: P; setWon: boolean; matchWon: boolean } {
  const legsWon = p.legsWon + 1;
  if (!playsSets(o))
    return { player: { ...p, legsWon }, setWon: false, matchWon: legsWon >= o.legsToWin };
  const setWon = legsWon >= o.legsToWin;
  const setsWon = p.setsWon + (setWon ? 1 : 0);
  return { player: { ...p, legsWon, setsWon }, setWon, matchWon: setsWon >= o.setsToWin! };
}

/** The leg just won finished a set (sets play only). */
export const setJustWon = (s: BaseMatch) =>
  playsSets(s.options) &&
  s.status !== 'open' &&
  s.players.some((p) => p.legsWon >= s.options.legsToWin);

/** Make player `i` throw first (after a bull-up). Only valid before the first dart. */
export function withStarter<S extends BaseMatch>(s: S, i: number): S {
  return { ...s, current: i, legStarter: i, setStarter: i, turn: { ...s.turn, player: i } };
}

/** Advance a finished turn to the next player, or start the next leg after a leg win. */
export function nextTurn<S extends BaseMatch>(
  s: S,
  newTurn: (player: number) => S['turn'],
  resetForLeg: (p: S['players'][number]) => S['players'][number],
): S {
  if (s.status === 'open' || s.status === 'matchWon') return s;
  if (s.status === 'legWon') {
    // Throw alternates every leg; with sets, the first leg of each set alternates too.
    const n = s.players.length;
    const setOver = setJustWon(s);
    const setStarter = setOver ? ((s.setStarter ?? 0) + 1) % n : (s.setStarter ?? 0);
    const legStarter = setOver ? setStarter : (s.legStarter + 1) % n;
    return {
      ...s,
      players: s.players.map((p) => resetForLeg(setOver ? { ...p, legsWon: 0 } : p)),
      leg: s.leg + 1,
      set: (s.set ?? 1) + (setOver ? 1 : 0),
      setStarter,
      legStarter,
      legWinner: null,
      current: legStarter,
      turn: newTurn(legStarter),
      status: 'open',
    };
  }
  const next = (s.current + 1) % s.players.length;
  return { ...s, current: next, turn: newTurn(next), status: 'open' };
}

/** Finish the leg in favour of player `w` (who need not be the one throwing). */
export function concludeLeg<S extends BaseMatch>(
  s: S,
  players: S['players'],
  turn: S['turn'],
  w: number,
): S {
  const { player, matchWon } = awardLeg(players[w]!, s.options);
  return {
    ...s,
    players: players.map((p, j) => (j === w ? player : p)) as S['players'],
    turn,
    status: matchWon ? 'matchWon' : 'legWon',
    winner: matchWon ? w : null,
    legWinner: w,
  };
}

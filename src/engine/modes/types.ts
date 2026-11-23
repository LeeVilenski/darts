import type { DartScore } from './dart';

export type ModeId = 'x01' | 'cricket' | 'atc';

/**
 * open: player is still throwing this turn.
 * bust / complete / legWon / matchWon: turn finished; call endTurn() to move on
 * (matchWon is terminal). Only x01 can bust.
 */
export type TurnStatus = 'open' | 'bust' | 'complete' | 'legWon' | 'matchWon';

/** Shape every mode's match state shares, so UI, AI driver and store can stay generic. */
export interface BaseMatch {
  mode: ModeId;
  options: { legsToWin: number };
  players: { name: string; legsWon: number; stats: { darts: number } }[];
  current: number;
  legStarter: number;
  leg: number;
  turn: { player: number; darts: DartScore[] };
  status: TurnStatus;
  winner: number | null;
}

/** Base number of a dart (bull = 25), or 0 for a miss. */
export const baseOf = (d: DartScore) => (d.multiplier ? d.points / d.multiplier : 0);

/** Advance a finished turn to the next player, or start the next leg after a leg win. */
export function nextTurn<S extends BaseMatch>(
  s: S,
  newTurn: (player: number) => S['turn'],
  resetForLeg: (p: S['players'][number]) => S['players'][number],
): S {
  if (s.status === 'open' || s.status === 'matchWon') return s;
  if (s.status === 'legWon') {
    const legStarter = (s.legStarter + 1) % s.players.length;
    return {
      ...s,
      players: s.players.map(resetForLeg),
      leg: s.leg + 1,
      legStarter,
      current: legStarter,
      turn: newTurn(legStarter),
      status: 'open',
    };
  }
  const next = (s.current + 1) % s.players.length;
  return { ...s, current: next, turn: newTurn(next), status: 'open' };
}

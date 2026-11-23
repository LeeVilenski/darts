import { suggestCheckout } from '../engine/modes/checkouts';
import type { MatchState } from '../engine/modes/match';

export interface TurnCall {
  /** Caller line keys, spoken in order. */
  keys: string[];
  /** Crowd reaction 0–1 (0 = none). */
  cheer: number;
}

/** What the caller says (and how loudly the crowd reacts) when a turn ends. */
export function callForTurnEnd(m: MatchState): TurnCall {
  if (m.status === 'matchWon') return { keys: ['game_shot_match'], cheer: 1 };
  if (m.status === 'legWon') {
    const big = m.mode === 'x01' && m.turn.points >= 100;
    return { keys: ['game_shot'], cheer: big ? 1 : 0.6 };
  }
  if (m.mode !== 'x01') return { keys: [], cheer: 0 };
  if (m.status === 'bust') return { keys: ['no_score'], cheer: 0 };
  const pts = m.turn.points;
  return { keys: [`score_${pts}`], cheer: pts === 180 ? 1 : pts >= 140 ? 0.45 : 0 };
}

/** "You require 40" at the start of an x01 turn when a finish is on. */
export function callForTurnStart(m: MatchState): string[] {
  if (m.mode !== 'x01' || m.status !== 'open' || m.turn.darts.length > 0 || !m.options.doubleOut)
    return [];
  const p = m.players[m.current]!;
  if (!p.opened || !suggestCheckout(p.remaining, 3)) return [];
  return ['you_require', `num_${p.remaining}`];
}

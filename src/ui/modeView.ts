import { atcTarget } from '../engine/modes/aroundTheClock';
import { suggestCheckout } from '../engine/modes/checkouts';
import { marksPerRound } from '../engine/modes/cricket';
import type { MatchState } from '../engine/modes/match';
import { DARTS_PER_TURN, threeDartAverage } from '../engine/modes/x01';

export const MODE_NAMES = { x01: 'x01', cricket: 'Cricket', atc: 'Around the Clock' } as const;

/** Big number on a player's card. */
export function primaryValue(m: MatchState, i: number): string {
  switch (m.mode) {
    case 'x01':
      return String(m.players[i]!.remaining);
    case 'cricket':
      return String(m.players[i]!.points);
    case 'atc': {
      const p = m.players[i]!;
      return p.next > 20 ? '✓' : atcTarget(p) === 25 ? 'Bull' : String(atcTarget(p));
    }
  }
}

/** Small stat under the big number. */
export function secondaryValue(m: MatchState, i: number): string {
  switch (m.mode) {
    case 'x01':
      return `Avg ${threeDartAverage(m.players[i]!.stats).toFixed(1)}`;
    case 'cricket':
      return `MPR ${marksPerRound(m.players[i]!).toFixed(2)}`;
    case 'atc': {
      const s = m.players[i]!.stats;
      return `Hits ${s.darts ? Math.round((s.hits / s.darts) * 100) : 0}%`;
    }
  }
}

/** Running total for the current turn, shown after the dart chips. */
export function turnTotal(m: MatchState): string {
  switch (m.mode) {
    case 'x01':
      return m.status === 'bust' ? 'Bust' : String(m.turn.points);
    case 'cricket':
      return `${m.turn.marks} mk`;
    case 'atc':
      return `${m.turn.hits} hit${m.turn.hits === 1 ? '' : 's'}`;
  }
}

/** Hint line under the turn strip (checkout route, next target). */
export function turnHint(m: MatchState): string | null {
  if (m.status !== 'open') return null;
  if (m.mode === 'x01') {
    const p = m.players[m.current]!;
    if (!m.options.doubleOut || !p.opened) return null;
    const route = suggestCheckout(p.remaining, DARTS_PER_TURN - m.turn.darts.length);
    return route ? `Checkout: ${route.map((l) => (l === 'BULL' ? 'Bull' : l)).join(' · ')}` : null;
  }
  if (m.mode === 'atc') {
    const t = atcTarget(m.players[m.current]!);
    return `Target: ${t === 25 ? 'Bull' : t}`;
  }
  return null;
}

/** "Player scored …" line at the end of a turn. */
export function turnResult(m: MatchState, name: string): string {
  switch (m.mode) {
    case 'x01':
      return `${name} scored ${m.turn.points}`;
    case 'cricket':
      return `${name}: ${m.turn.marks} mark${m.turn.marks === 1 ? '' : 's'}${m.turn.points ? `, ${m.turn.points} points` : ''}`;
    case 'atc':
      return `${name} hit ${m.turn.hits} of ${m.turn.darts.length}`;
  }
}

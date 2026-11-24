import { atcTarget } from '../engine/modes/aroundTheClock';
import { bobs27Target } from '../engine/modes/bobs27';
import { suggestCheckout } from '../engine/modes/checkouts';
import { marksPerRound } from '../engine/modes/cricket';
import { HALVE_IT_TARGETS, halveItLabel, halveItTarget } from '../engine/modes/halveIt';
import { VISITS_PER_ATTEMPT } from '../engine/modes/ladder';
import type { MatchState } from '../engine/modes/match';
import { DARTS_PER_TURN, threeDartAverage } from '../engine/modes/x01';

export const MODE_NAMES = {
  x01: 'x01',
  cricket: 'Cricket',
  atc: 'Around the Clock',
  shanghai: 'Shanghai',
  killer: 'Killer',
  bobs27: "Bob's 27",
  halveit: 'Halve-It',
  ladder: '121 Ladder',
} as const;

const bull = (n: number) => (n === 25 ? 'Bull' : String(n));
const checkoutHint = (remaining: number, dartsLeft: number) => {
  const route = suggestCheckout(remaining, dartsLeft);
  return route ? `Checkout: ${route.map((l) => (l === 'BULL' ? 'Bull' : l)).join(' · ')}` : null;
};

/** Big number on a player's card. */
export function primaryValue(m: MatchState, i: number): string {
  switch (m.mode) {
    case 'x01':
      return String(m.players[i]!.remaining);
    case 'cricket':
      return String(m.players[i]!.points);
    case 'atc': {
      const p = m.players[i]!;
      return p.next > 20 ? '✓' : bull(atcTarget(p));
    }
    case 'shanghai':
    case 'halveit':
      return String(m.players[i]!.score);
    case 'bobs27': {
      const p = m.players[i]!;
      return p.out ? 'Out' : String(p.score);
    }
    case 'killer': {
      const p = m.players[i]!;
      return p.lives > 0 ? '♥'.repeat(p.lives) : '✕';
    }
    case 'ladder':
      return String(m.players[i]!.remaining);
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
    case 'shanghai':
    case 'bobs27':
    case 'halveit':
      return `Hits ${m.players[i]!.stats.hits}`;
    case 'killer': {
      const p = m.players[i]!;
      return `No. ${p.number}${p.killer ? ' · Killer' : ''}`;
    }
    case 'ladder': {
      const p = m.players[i]!;
      const done = p.attempt > m.options.attempts;
      return done
        ? `Best ${p.best || '–'}`
        : `${p.target} · try ${p.attempt}/${m.options.attempts}`;
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
    case 'shanghai':
    case 'bobs27':
      return m.mode === 'bobs27' && m.turn.points < 0
        ? String(m.turn.points)
        : `${m.turn.hits} hit${m.turn.hits === 1 ? '' : 's'}`;
    case 'halveit':
      return m.turn.halved ? 'Halved' : String(m.turn.points);
    case 'killer':
      return m.turn.lifeChanges
        ? `${m.turn.lifeChanges} li${m.turn.lifeChanges === 1 ? 'fe' : 'ves'}`
        : '–';
    case 'ladder':
      return m.turn.bust ? 'Bust' : String(m.turn.points);
  }
}

/** Hint line under the turn strip (checkout route, next target). */
export function turnHint(m: MatchState): string | null {
  if (m.status !== 'open') return null;
  const dartsLeft = DARTS_PER_TURN - m.turn.darts.length;
  switch (m.mode) {
    case 'x01': {
      const p = m.players[m.current]!;
      if (!m.options.doubleOut || !p.opened) return null;
      return checkoutHint(p.remaining, dartsLeft);
    }
    case 'atc':
      return `Target: ${bull(atcTarget(m.players[m.current]!))}`;
    case 'cricket':
      return m.options.cutThroat ? 'Cut-throat: lowest score wins' : null;
    case 'shanghai':
      return `Round ${m.round}/${m.options.rounds} · target ${m.round} · S+D+T wins outright`;
    case 'bobs27': {
      const t = bobs27Target(m.round);
      return `Round ${m.round}/21 · ${t === 25 ? 'Bull' : `D${t}`}`;
    }
    case 'halveit':
      return `Round ${m.round}/${HALVE_IT_TARGETS.length} · ${halveItLabel(halveItTarget(m.round))} · miss them all and you're halved`;
    case 'killer': {
      const me = m.players[m.current]!;
      return me.killer
        ? `You're a killer · hit opponents' doubles (not D${me.number}!)`
        : `Hit D${me.number} to become a killer`;
    }
    case 'ladder': {
      const p = m.players[m.current]!;
      const route = checkoutHint(p.remaining, dartsLeft);
      return `${p.target} · visit ${p.visit}/${VISITS_PER_ATTEMPT}${route ? ` · ${route}` : ''}`;
    }
  }
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
    case 'shanghai':
      return `${name} scored ${m.turn.points}`;
    case 'bobs27':
      return m.turn.hits
        ? `${name} +${m.turn.points}`
        : `${name} ${m.turn.points}${m.players[m.current]!.out ? ' · out!' : ''}`;
    case 'halveit':
      return m.turn.halved ? `${name} is halved!` : `${name} scored ${m.turn.points}`;
    case 'killer': {
      const me = m.players[m.current]!;
      if (me.lives === 0) return `${name} is out!`;
      return m.turn.lifeChanges
        ? `${name} took ${m.turn.lifeChanges} li${m.turn.lifeChanges === 1 ? 'fe' : 'ves'}`
        : me.killer
          ? `${name} is a killer`
          : `${name} is still looking for D${me.number}`;
    }
    case 'ladder':
      return m.turn.checkedOut
        ? `${name} checked out ${m.turn.startRemaining}!`
        : m.turn.bust
          ? `${name} bust`
          : `${name} scored ${m.turn.points}`;
  }
}

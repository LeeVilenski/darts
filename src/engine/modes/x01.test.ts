import { describe, expect, it } from 'vitest';
import type { DartScore } from './dart';
import {
  applyDart,
  createX01,
  endTurn,
  threeDartAverage,
  type X01Options,
  type X01State,
} from './x01';

const d = (label: string): DartScore => {
  if (label === 'MISS') return { label, points: 0, multiplier: 0 };
  if (label === 'BULL') return { label, points: 50, multiplier: 2 };
  if (label === '25') return { label, points: 25, multiplier: 1 };
  const m = ({ S: 1, D: 2, T: 3 } as const)[label[0] as 'S' | 'D' | 'T'];
  return { label, points: Number(label.slice(1)) * m, multiplier: m };
};
const throwAll = (s: X01State, labels: string[]) =>
  labels.reduce((acc, l) => applyDart(acc, d(l)), s);
const opts = (o: Partial<X01Options> = {}): X01Options => ({
  startScore: 501,
  doubleIn: false,
  doubleOut: true,
  legsToWin: 1,
  ...o,
});
/** Start a game where player 0 is on `rem`. */
const at = (rem: number, o: Partial<X01Options> = {}, names = ['A', 'B']) => {
  const s = createX01(names, opts(o));
  return {
    ...s,
    players: s.players.map((p, i) => (i === 0 ? { ...p, remaining: rem } : p)),
    turn: { ...s.turn, startRemaining: rem },
  };
};

describe('x01', () => {
  it('scores a normal turn and passes to the next player', () => {
    let s = throwAll(createX01(['A', 'B']), ['T20', 'T20', 'T20']);
    expect(s.status).toBe('complete');
    expect(s.players[0]!.remaining).toBe(321);
    expect(s.players[0]!.stats.oneEighties).toBe(1);
    s = endTurn(s);
    expect(s.current).toBe(1);
    expect(s.turn.startRemaining).toBe(501);
  });

  it('busts when going below zero and reverts the turn', () => {
    const s = throwAll(at(40), ['S20', 'S20', 'S5'].slice(0, 2).concat('T20'));
    // 40 -> 20 -> 0 via single = bust on second dart already
    expect(s.status).toBe('bust');
    expect(s.players[0]!.remaining).toBe(40);
    expect(s.turn.darts).toHaveLength(2);
  });

  it('busts when leaving 1 with double-out', () => {
    const s = throwAll(at(41), ['S20', 'S20']);
    expect(s.status).toBe('bust');
    expect(s.players[0]!.remaining).toBe(41);
  });

  it('busts when reaching zero on a non-double', () => {
    expect(throwAll(at(20), ['S20']).status).toBe('bust');
  });

  it('wins on a double and on the bull', () => {
    expect(throwAll(at(40), ['D20']).status).toBe('matchWon');
    const s = throwAll(at(50), ['BULL']);
    expect(s.status).toBe('matchWon');
    expect(s.winner).toBe(0);
    expect(s.players[0]!.stats.bestCheckout).toBe(50);
  });

  it('allows straight-out finishes when double-out is off', () => {
    expect(throwAll(at(20, { doubleOut: false }), ['S20']).status).toBe('matchWon');
    expect(throwAll(at(1, { doubleOut: false }), ['S1']).status).toBe('matchWon');
  });

  it('requires a double to start with double-in', () => {
    let s = throwAll(createX01(['A'], opts({ doubleIn: true })), ['T20', 'S20', 'D10']);
    expect(s.players[0]!.remaining).toBe(481);
    expect(s.players[0]!.opened).toBe(true);
    s = throwAll(endTurn(s), ['T20']);
    expect(s.players[0]!.remaining).toBe(421);
  });

  it('plays multiple legs and rotates the starting player', () => {
    let s = throwAll(at(40, { legsToWin: 2 }), ['D20']);
    expect(s.status).toBe('legWon');
    expect(s.players[0]!.legsWon).toBe(1);
    s = endTurn(s);
    expect(s.leg).toBe(2);
    expect(s.current).toBe(1);
    expect(s.players.every((p) => p.remaining === 501)).toBe(true);
  });

  it('counts darts in a bust turn toward the average but no points', () => {
    let s = throwAll(createX01(['A']), ['T20', 'T20', 'T20']);
    s = endTurn(s);
    s = {
      ...s,
      players: [{ ...s.players[0]!, remaining: 10 }],
      turn: { ...s.turn, startRemaining: 10 },
    };
    s = throwAll(s, ['S20']);
    expect(s.status).toBe('bust');
    expect(s.players[0]!.stats.darts).toBe(4);
    expect(threeDartAverage(s.players[0]!.stats)).toBeCloseTo(135);
  });

  it('ignores darts after the turn is over', () => {
    const s = throwAll(at(40), ['D20']);
    expect(applyDart(s, d('T20'))).toBe(s);
  });
});

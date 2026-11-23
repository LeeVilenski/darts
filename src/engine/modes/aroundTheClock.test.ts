import { describe, expect, it } from 'vitest';
import { applyAtcDart, atcTarget, createAtc, type AtcState } from './aroundTheClock';
import { dart } from './testDarts';

const play = (s: AtcState, labels: string[]) =>
  labels.reduce((acc, l) => applyAtcDart(acc, dart(l)), s);

describe('around the clock', () => {
  it('advances one number per hit, in order', () => {
    const s = play(createAtc(['A']), ['S1', 'S5', 'T2']);
    expect(atcTarget(s.players[0]!)).toBe(3);
    expect(s.turn.hits).toBe(2);
    expect(s.status).toBe('complete');
  });

  it('advances by the multiplier when enabled', () => {
    const s = play(createAtc(['A'], { legsToWin: 1, multiplierAdvance: true }), ['T1', 'D4']);
    expect(atcTarget(s.players[0]!)).toBe(6);
  });

  it('never skips the bull', () => {
    let s = createAtc(['A'], { legsToWin: 1, multiplierAdvance: true });
    s = { ...s, players: [{ ...s.players[0]!, next: 19 }] };
    s = play(s, ['T20']);
    expect(atcTarget(s.players[0]!)).toBe(25);
    expect(s.status).toBe('open');
  });

  it('finishes on either bull', () => {
    let s = createAtc(['A', 'B']);
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, next: 20 } : p)) };
    expect(play(s, ['25']).status).toBe('matchWon');
    expect(play(s, ['BULL']).winner).toBe(0);
    expect(play(s, ['S20']).status).toBe('open');
  });
});

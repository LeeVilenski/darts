import { describe, expect, it } from 'vitest';
import { applyAtcDart, createAtc } from '../modes/aroundTheClock';
import { applyCricketDart, createCricket } from '../modes/cricket';
import { dart } from '../modes/testDarts';
import { applyDart, createX01 } from '../modes/x01';
import { emptyLifetime, lifetimeAverage, mergeLifetime, recordMatchInto } from './lifetime';

describe('lifetime stats', () => {
  it('records an x01 win for humans only', () => {
    let m = createX01(['Me', 'Bot']);
    m = {
      ...m,
      players: m.players.map((p, i) => (i === 0 ? { ...p, remaining: 40 } : p)),
      turn: { ...m.turn, startRemaining: 40 },
    };
    m = applyDart(m, dart('D20'));
    const stats = recordMatchInto({}, m, (i) => i === 0, 1);
    expect(Object.keys(stats)).toEqual(['Me']);
    expect(stats.Me).toMatchObject({
      matches: 1,
      wins: 1,
      x01: { matches: 1, darts: 1, bestCheckout: 40 },
    });
    expect(lifetimeAverage(stats.Me!)).toBe(120);
  });

  it('accumulates cricket and around-the-clock records', () => {
    let c = createCricket(['Me']);
    c = {
      ...c,
      players: [{ ...c.players[0]!, marks: { 20: 3, 19: 3, 18: 3, 17: 3, 16: 3, 15: 3, 25: 1 } }],
    };
    c = applyCricketDart(c, dart('BULL'));
    let a = createAtc(['Me']);
    a = { ...a, players: [{ ...a.players[0]!, next: 20 }] };
    a = applyAtcDart(a, dart('25'));
    let stats = recordMatchInto({}, c, () => true, 1);
    stats = recordMatchInto(stats, a, () => true, 2);
    expect(stats.Me).toMatchObject({
      matches: 2,
      wins: 2,
      cricket: { matches: 1, bestMpr: 6 },
      atc: { completed: 1, bestDarts: 1 },
    });
  });

  it('merges by most recent update per player', () => {
    const older = { ...emptyLifetime(), matches: 1, updatedAt: 1 };
    const newer = { ...emptyLifetime(), matches: 5, updatedAt: 2 };
    expect(mergeLifetime({ A: older, B: newer }, { A: newer, B: older })).toEqual({
      A: newer,
      B: newer,
    });
  });
});

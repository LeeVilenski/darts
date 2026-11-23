import { describe, expect, it } from 'vitest';
import { scorePoint } from '../board/resolveHit';
import { createX01, DEFAULT_X01, type X01State } from '../modes/x01';
import { createAtc } from '../modes/aroundTheClock';
import { createCricket } from '../modes/cricket';
import { aimPointFor, chooseAtcTarget, chooseCricketTarget, chooseTarget } from './strategy';

const on = (remaining: number, dartsThrown = 0, opts = DEFAULT_X01): X01State => {
  const s = createX01(['AI'], opts);
  const darts = Array.from({ length: dartsThrown }, () => ({
    label: 'S1',
    points: 1,
    multiplier: 1 as const,
  }));
  return { ...s, players: [{ ...s.players[0]!, remaining }], turn: { ...s.turn, darts } };
};

describe('aimPointFor', () => {
  it.each(['T20', 'D16', 'S5', 'T19', 'D1', '25', 'BULL'])(
    '%s aims inside its own segment',
    (label) => {
      const p = aimPointFor(label);
      expect(scorePoint(p.x, p.y)).toMatchObject({ label });
    },
  );
});

describe('chooseTarget', () => {
  it('scores on T20 from distance', () => expect(chooseTarget(on(501)).label).toBe('T20'));
  it('follows the checkout route', () => {
    expect(chooseTarget(on(170)).label).toBe('T20');
    expect(chooseTarget(on(40)).label).toBe('D20');
    expect(chooseTarget(on(50)).label).toBe('BULL');
  });
  it('sets up a finish rather than busting', () => {
    // 3 darts gone isn't possible mid-turn; with 1 dart left on 99 there is no checkout.
    const t = chooseTarget(on(99, 2));
    expect(['T20', 'S19', 'S20', 'T19', 'S3']).toContain(t.label);
    const v = t.label[0] === 'T' ? Number(t.label.slice(1)) * 3 : Number(t.label.slice(1));
    expect(99 - v).toBeGreaterThan(1);
  });
  it('never sets up a bust on low scores', () => {
    for (let rem = 2; rem <= 60; rem++) {
      const t = chooseTarget(on(rem, 2));
      const v =
        t.label === 'BULL'
          ? 50
          : t.label === '25'
            ? 25
            : Number(t.label.slice(1)) * { S: 1, D: 2, T: 3 }[t.label[0] as 'S'];
      expect(rem - v === 0 || rem - v >= 2).toBe(true);
    }
  });
  it('opens with a double when double-in is on', () => {
    expect(chooseTarget(on(501, 0, { ...DEFAULT_X01, doubleIn: true })).label).toBe('D20');
  });
  it('finishes straight-out on a single segment', () => {
    expect(chooseTarget(on(19, 0, { ...DEFAULT_X01, doubleOut: false })).label).toBe('S19');
    expect(chooseTarget(on(57, 0, { ...DEFAULT_X01, doubleOut: false })).label).toBe('T19');
  });
});

describe('cricket AI', () => {
  it('closes the highest open number first', () => {
    expect(chooseCricketTarget(createCricket(['AI', 'B'])).label).toBe('T20');
    const s = createCricket(['AI', 'B']);
    const closed20 = {
      ...s,
      players: s.players.map((p, i) => (i === 0 ? { ...p, marks: { ...p.marks, 20: 3 } } : p)),
    };
    expect(chooseCricketTarget(closed20).label).toBe('T19');
  });
  it('scores when behind on a number the opponent still has open', () => {
    const s = createCricket(['AI', 'B']);
    const behind = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, marks: { ...p.marks, 20: 3 } } : { ...p, points: 40 },
      ),
    };
    expect(chooseCricketTarget(behind).label).toBe('T20');
  });
  it('goes for the bull last', () => {
    const s = createCricket(['AI', 'B']);
    const onlyBull = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, marks: { 20: 3, 19: 3, 18: 3, 17: 3, 16: 3, 15: 3, 25: 0 } } : p,
      ),
    };
    expect(chooseCricketTarget(onlyBull).label).toBe('BULL');
  });
});

describe('around the clock AI', () => {
  it('aims at the next number, then the bull', () => {
    const s = createAtc(['AI']);
    expect(chooseAtcTarget(s).label).toBe('S1');
    expect(chooseAtcTarget({ ...s, players: [{ ...s.players[0]!, next: 20 }] }).label).toBe('BULL');
  });
});

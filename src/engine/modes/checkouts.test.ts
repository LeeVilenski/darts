import { describe, expect, it } from 'vitest';
import { suggestCheckout } from './checkouts';

const value = (l: string) =>
  l === 'BULL'
    ? 50
    : l === '25'
      ? 25
      : Number(l.slice(1)) * ({ S: 1, D: 2, T: 3 } as Record<string, number>)[l[0]!]!;

describe('suggestCheckout', () => {
  it.each([
    [170, ['T20', 'T20', 'BULL']],
    [164, ['T20', 'T18', 'BULL']],
    [141, ['T20', 'T19', 'D12']],
    [100, ['T20', 'D20']],
    [40, ['D20']],
    [32, ['D16']],
    [50, ['BULL']],
    [2, ['D1']],
  ])('%i -> %j', (rem, route) => {
    expect(suggestCheckout(rem, 3)).toEqual(route);
  });

  it('returns null for bogey numbers and out-of-range scores', () => {
    for (const n of [169, 168, 166, 165, 163, 162, 159, 171, 1, 0])
      expect(suggestCheckout(n, 3)).toBeNull();
  });

  it('respects the number of darts left', () => {
    expect(suggestCheckout(170, 2)).toBeNull();
    expect(suggestCheckout(110, 2)).toEqual(['T20', 'BULL']);
    expect(suggestCheckout(61, 1)).toBeNull();
  });

  it('every route for 2..170 adds up and ends on a double', () => {
    for (let n = 2; n <= 170; n++) {
      const r = suggestCheckout(n, 3);
      if (!r) continue;
      expect(r.reduce((s, l) => s + value(l), 0)).toBe(n);
      expect(r[r.length - 1]!.startsWith('D') || r[r.length - 1] === 'BULL').toBe(true);
    }
  });
});

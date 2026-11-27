import { describe, expect, it } from 'vitest';
import {
  enterEvent,
  newCareer,
  nextMatch,
  recordResult,
  weekEvents,
  type CareerState,
} from './career';
import { careerAverage, form } from './stats';

const stats = (darts: number, points: number, extra = {}) => ({
  darts,
  points,
  tons: 0,
  ton40s: 0,
  oneEighties: 0,
  bestCheckout: 0,
  ...extra,
});
const entered = (): CareerState => {
  const c = newCareer('Sam', 7);
  return enterEvent(c, weekEvents(c).find((e) => e.circuit === 'pub')!.id);
};

describe('career stats', () => {
  it('records each of your matches with the opponent, round and average', () => {
    let c = entered();
    const opp = nextMatch(c)!.opponent;
    c = recordResult(c, true, [1, 0], {
      legs: [1, 0],
      stats: stats(18, 501, { oneEighties: 1, bestCheckout: 81 }),
    });
    const s = c.stats;
    expect(s.matches).toBe(1);
    expect(s.wins).toBe(1);
    expect(careerAverage(s)).toBeCloseTo(83.5);
    expect(s.oneEighties).toBe(1);
    expect(s.tons).toBe(1);
    expect(s.highestCheckout).toBe(81);
    expect(s.h2h[opp.id]).toEqual([1, 0]);
    expect(s.log[0]).toMatchObject({
      round: 0,
      roundName: 'Quarter-final',
      opponent: opp.id,
      opponentName: opp.name,
      won: true,
      season: 1,
    });

    c = recordResult(c, false, [0, 2], { legs: [0, 2], stats: stats(30, 450) });
    expect(c.stats.legsWon).toBe(1);
    expect(c.stats.legsLost).toBe(2);
    expect(form(c.stats)).toEqual(['W', 'L']);
  });

  it('works without a summary', () => {
    const c = recordResult(entered(), true, [1, 0]);
    expect(c.stats.matches).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { newCareer, nextMatch, promotionRace, recordResult, seasonSchedule } from './career';
import { careerAverage, emptyCareerStats, form } from './stats';
import { EVENTS_PER_SEASON, PROMOTION_PLACES } from './tiers';

const stats = (darts: number, points: number, extra = {}) => ({
  darts,
  points,
  tons: 0,
  ton40s: 0,
  oneEighties: 0,
  bestCheckout: 0,
  ...extra,
});

describe('career stats', () => {
  it('records each of your matches with the opponent, round and average', () => {
    let c = newCareer('Sam', 7);
    const opp = nextMatch(c)!.opponent.id;
    c = recordResult(c, true, [1, 0], {
      legs: [1, 0],
      stats: stats(18, 501, { oneEighties: 1, bestCheckout: 81 }),
    });
    const s = c.stats!;
    expect(s.matches).toBe(1);
    expect(s.wins).toBe(1);
    expect(careerAverage(s)).toBeCloseTo(83.5);
    expect(s.oneEighties).toBe(1);
    expect(s.tons).toBe(1);
    expect(s.highestCheckout).toBe(81);
    expect(s.h2h[opp]).toEqual([1, 0]);
    expect(s.log[0]).toMatchObject({ round: 0, opponent: opp, won: true, season: 1 });

    c = recordResult(c, false, [0, 2], { legs: [0, 2], stats: stats(30, 450) });
    expect(c.stats!.legsWon).toBe(1);
    expect(c.stats!.legsLost).toBe(2);
    expect(form(c.stats!)).toEqual(['W', 'L']);
  });

  it('works without a summary (older callers) and from an empty record', () => {
    const c = recordResult(newCareer('Sam', 7), true, [1, 0]);
    expect(c.stats).toEqual(emptyCareerStats());
  });
});

describe('season schedule and promotion race', () => {
  it('lists the season with results for events played', () => {
    let c = newCareer('Sam', 7);
    expect(seasonSchedule(c).map((e) => e.status)).toEqual([
      'current',
      ...Array(EVENTS_PER_SEASON - 1).fill('upcoming'),
    ]);
    c = recordResult(c, false, [0, 1]);
    const sched = seasonSchedule(c);
    expect(sched[0]).toMatchObject({ status: 'done', result: { reached: 'QF' } });
    expect(sched[1]!.status).toBe('current');
  });

  it('reports your place and the gap to promotion', () => {
    const c = newCareer('Sam', 7);
    const race = promotionRace(c);
    expect(race.eventsLeft).toBe(EVENTS_PER_SEASON);
    expect(race.position).toBeLessThanOrEqual(PROMOTION_PLACES); // everyone on 0, you listed first
    expect(race.gap).toBe(0);
  });
});

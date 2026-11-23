import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { AI_LEVELS, AI_SKILL } from './skill';
import { simulateLeg } from './simulate';

const LEGS = Number(import.meta.env.CALIBRATION_LEGS ?? 120);

describe('AI calibration (simulated 501 legs)', () => {
  it.each(AI_LEVELS)('%s averages close to its target', (level) => {
    const rng = createRng(1234);
    let darts = 0;
    let avgSum = 0;
    for (let i = 0; i < LEGS; i++) {
      const leg = simulateLeg(level, rng);
      expect(leg.finished).toBe(true);
      darts += leg.darts;
      avgSum += leg.average;
    }
    const average = avgSum / LEGS;
    if (import.meta.env.CALIBRATION_LEGS)
      console.log(`${level}: avg ${average.toFixed(1)}, ${(darts / LEGS).toFixed(1)} darts/leg`);
    expect(Math.abs(average - AI_SKILL[level].targetAverage)).toBeLessThan(6);
  });

  it('stronger levels finish legs in fewer darts', () => {
    const dartsFor = (level: (typeof AI_LEVELS)[number]) => {
      const rng = createRng(99);
      let d = 0;
      for (let i = 0; i < 40; i++) d += simulateLeg(level, rng).darts;
      return d / 40;
    };
    const [pub, club, county, pro] = AI_LEVELS.map(dartsFor);
    expect(pub!).toBeGreaterThan(club!);
    expect(club!).toBeGreaterThan(county!);
    expect(county!).toBeGreaterThan(pro!);
  });
});

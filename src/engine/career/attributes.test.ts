import { describe, expect, it } from 'vitest';
import { pressureOn } from '../ai/pressure';
import { chooseTargetFor } from '../ai/strategy';
import type { StuckDart } from '../board/collision';
import { toDartScore } from '../modes/dart';
import { applyDart, createX01, DEFAULT_X01, endTurn } from '../modes/x01';
import { resolveDart, stuckDartOf } from '../physics/resolveDart';
import { ASSIST, computeLaunch, PERFECT_FLICK } from '../physics/throwModel';
import { createRng } from '../rng';
import {
  applyXp,
  ATTRS,
  attrCost,
  careerTuning,
  newAttributes,
  spendPoint,
  TIER_CAPS,
  xpFromDarts,
  type Ratings,
} from './attributes';

const all = (n: number): Ratings => ({ scoring: n, finishing: n, nerve: n, rhythm: n });
const LEGS = Number(import.meta.env.CALIBRATION_LEGS ?? 80);

/** Perfect technique at standard assist, with career attributes. */
function averageAt(r: Ratings | null, seed: number) {
  const rng = createRng(seed);
  let sum = 0;
  let darts = 0;
  for (let i = 0; i < LEGS; i++) {
    let s = createX01(['You'], DEFAULT_X01);
    let stuck: StuckDart[] = [];
    while (s.status !== 'matchWon' && s.players[0]!.stats.darts < 300) {
      if (s.status !== 'open') {
        s = endTurn(s);
        stuck = [];
      }
      const target = chooseTargetFor(s);
      const tuning = r
        ? careerTuning(ASSIST.standard, r, target.point, pressureOn(s, target), rng).tuning
        : ASSIST.standard;
      const d = resolveDart(
        computeLaunch(target.point, PERFECT_FLICK, tuning, rng),
        stuck,
        rng,
        'realistic',
      );
      const left = stuckDartOf(d);
      if (left) stuck = [...stuck, left];
      s = applyDart(s, toDartScore(d.result));
    }
    const st = s.players[0]!.stats;
    sum += (st.points / st.darts) * 3;
    darts += st.darts;
  }
  return { average: sum / LEGS, darts: darts / LEGS };
}

describe('career attributes: calibration', () => {
  it('a rating-1 thrower with perfect technique plays at pub-to-club level, 99 plays like the normal game', () => {
    const low = averageAt(all(1), 5);
    const start = averageAt(all(10), 5);
    const high = averageAt(all(99), 5);
    const normal = averageAt(null, 5);
    if (import.meta.env.CALIBRATION_LEGS) console.log({ low, start, high, normal });
    expect(low.average).toBeGreaterThan(45);
    expect(low.average).toBeLessThan(62);
    expect(start.average).toBeGreaterThan(low.average);
    expect(Math.abs(high.average - normal.average)).toBeLessThan(5);
  });
});

describe('career attributes: progression', () => {
  it('XP raises a rating, carrying the remainder', () => {
    const a = newAttributes();
    const cost = attrCost(a.ratings.finishing);
    const { attrs, raised } = applyXp(
      a,
      { attrs: { scoring: 0, finishing: cost + 3, nerve: 0, rhythm: 0 }, player: 0 },
      0,
    );
    expect(attrs.ratings.finishing).toBe(a.ratings.finishing + 1);
    expect(attrs.progress.finishing).toBe(3);
    expect(raised).toEqual([{ attr: 'finishing', from: 10, to: 11 }]);
  });

  it('ratings stop at the tier cap until you move up', () => {
    const huge = { attrs: all(1e6), player: 0 };
    const pub = applyXp(newAttributes(), huge, 0).attrs;
    for (const k of ATTRS) expect(pub.ratings[k]).toBe(TIER_CAPS[0]);
    const county = applyXp(pub, { attrs: all(0), player: 0 }, 1).attrs;
    expect(county.ratings.scoring).toBe(TIER_CAPS[0]! + 1); // the banked XP buys one more
  });

  it('levelling up gives skill points to spend, capped too', () => {
    const { attrs, levelsGained } = applyXp(newAttributes(), { attrs: all(0), player: 1000 }, 0);
    expect(levelsGained).toBeGreaterThan(0);
    expect(attrs.points).toBe(levelsGained * 2);
    const spent = spendPoint(attrs, 'nerve', 0);
    expect(spent.ratings.nerve).toBe(attrs.ratings.nerve + 1);
    expect(spent.points).toBe(attrs.points - 1);
    const capped = { ...attrs, ratings: { ...attrs.ratings, nerve: TIER_CAPS[0]! } };
    expect(spendPoint(capped, 'nerve', 0)).toBe(capped);
  });

  it('darts earn XP for what they show', () => {
    const hit = (label: string, ring: 'double' | 'treble', base: number, m: 2 | 3) => ({
      kind: 'score' as const,
      label,
      base,
      multiplier: m,
      points: base * m,
      ring,
      sector: base,
      r: 0,
      angle: 0,
    });
    const gain = xpFromDarts([
      { aim: { x: 0, y: 103 }, result: hit('T20', 'treble', 20, 3), pressure: 0, unsteadiness: 0 },
      {
        aim: { x: 0, y: 166 },
        result: hit('D20', 'double', 20, 2),
        pressure: 0.8,
        unsteadiness: 0.9,
      },
    ]);
    expect(gain.scoring).toBeGreaterThan(0);
    expect(gain.finishing).toBeGreaterThan(0);
    expect(gain.nerve).toBeGreaterThan(0);
    expect(gain.rhythm).toBeCloseTo(0.6);
  });
});

describe('career XP from matches and training', () => {
  const t20 = {
    aim: { x: 0, y: 103 },
    result: {
      kind: 'score' as const,
      label: 'T20',
      base: 20,
      multiplier: 3 as const,
      points: 60,
      ring: 'treble' as const,
      sector: 20,
      r: 103,
      angle: 0,
    },
    pressure: 0,
    unsteadiness: 0.1,
  };
  const stats = { darts: 15, points: 501, tons: 2, ton40s: 1, oneEighties: 1, bestCheckout: 41 };

  it('a career match banks XP into your attributes and reports it', async () => {
    const { newCareer, recordResult } = await import('./career');
    const c0 = newCareer('Sam', 3);
    const c = recordResult(c0, true, [1, 0], { legs: [1, 0], stats, darts: Array(15).fill(t20) });
    expect(c.lastGain?.source).toBe('match');
    expect(c.lastGain!.player).toBeGreaterThan(0);
    expect(c.lastGain!.attrs.scoring).toBeGreaterThan(0);
    expect(c.attributes!.ratings.scoring).toBeGreaterThan(c0.attributes!.ratings.scoring);
  });

  it('one training session per event, focused on its attribute', async () => {
    const { canTrain, newCareer, recordTraining, recordResult } = await import('./career');
    let c = newCareer('Sam', 3);
    expect(canTrain(c)).toBe(true);
    c = recordTraining(c, 'finishing', Array(30).fill(t20));
    expect(c.lastGain?.source).toBe('training');
    expect(c.lastGain!.attrs.finishing).toBeGreaterThan(c.lastGain!.attrs.nerve);
    expect(canTrain(c)).toBe(false);
    expect(recordTraining(c, 'finishing', [t20])).toBe(c);
    // Knocked out: the event finishes and the next one can be trained for.
    c = recordResult(c, false, [0, 1]);
    expect(canTrain(c)).toBe(true);
  });
});

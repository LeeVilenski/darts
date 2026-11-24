import { describe, expect, it } from 'vitest';
import { aiTuning } from '../ai/skill';
import { toDartScore } from '../modes/dart';
import { resolveDart, stuckDartOf } from '../physics/resolveDart';
import { computeLaunch, PERFECT_FLICK } from '../physics/throwModel';
import { createRng } from '../rng';
import { checkCollision, DART_PROTRUSION, ROBIN_HOOD_CHANCE, type StuckDart } from './collision';

// A dart in T20 as it sits after a typical throw: tail ~0.23 mm higher per mm out.
const SLOPE = { x: 0, y: 0.23 };
const inT20: StuckDart = { x: 0, y: 103, depth: 0, sx: SLOPE.x, sy: SLOPE.y };

const tally = (offset: { x: number; y: number }, n = 2000, bounce = 'realistic' as const) => {
  const rng = createRng(7);
  const out = { none: 0, robinHood: 0, rigid: 0, soft: 0, bounce: 0 };
  for (let i = 0; i < n; i++) {
    const c = checkCollision(
      { x: inT20.x + offset.x, y: inT20.y + offset.y },
      SLOPE,
      [inT20],
      rng,
      bounce,
    );
    if (!c) out.none++;
    else if (c.kind === 'robinHood') out.robinHood++;
    else {
      out[c.soft ? 'soft' : 'rigid']++;
      if (c.bounce) out.bounce++;
    }
  }
  return out;
};

describe('checkCollision', () => {
  it('flies clean with nothing in the board', () => {
    expect(checkCollision({ x: 0, y: 103 }, SLOPE, [], createRng(1), 'realistic')).toBeNull();
  });

  it('ignores darts well clear of the line', () => {
    expect(tally({ x: 40, y: 0 }, 200).none).toBe(200);
  });

  it('can bury a dead-centre dart in the back of the other (a Robin Hood)', () => {
    const t = tally({ x: 0, y: 0 });
    expect(t.robinHood / 2000).toBeCloseTo(ROBIN_HOOD_CHANCE, 1);
    // Otherwise it glances hard off the shaft.
    expect(t.robinHood + t.rigid).toBe(2000);
  });

  it('pushes a dart that clips a barrel away from it', () => {
    const rng = createRng(3);
    const c = checkCollision({ x: 4, y: 103 }, SLOPE, [inT20], rng, 'off');
    expect(c).toMatchObject({ kind: 'deflect', soft: false, bounce: false, target: 0 });
    if (c?.kind !== 'deflect') throw new Error('expected a deflection');
    expect(c.dir.x).toBeGreaterThan(0.9); // away from the stuck dart, which is to its left
    expect(c.shift).toBeGreaterThan(0);
    expect(c.angle).toBeGreaterThan(0);
  });

  it('only brushes the flights when the barrels clear each other', () => {
    const t = tally({ x: 10, y: 0 });
    expect(t.rigid).toBe(0);
    expect(t.soft).toBeGreaterThan(0);
    expect(t.none).toBeGreaterThan(0);
  });

  it('square hits sometimes knock the dart out, never with bounce-outs off', () => {
    expect(tally({ x: 2, y: 0 }).bounce).toBeGreaterThan(0);
    expect(tally({ x: 2, y: 0 }, 2000, 'off' as never).bounce).toBe(0);
  });
});

describe('resolveDart', () => {
  const launchAt = (aim: { x: number; y: number }, seed: number) =>
    computeLaunch(aim, PERFECT_FLICK, aiTuning(0), createRng(seed));

  it('throws the first dart exactly as before', () => {
    const d = resolveDart(launchAt({ x: 0, y: 103 }, 1), [], createRng(1), 'off');
    expect(d.collision).toBeNull();
    expect(d.result).toMatchObject({ kind: 'score', label: 'T20' });
  });

  it('a second dart down the identical line hits the first', () => {
    let robin = 0;
    let deflect = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const first = resolveDart(launchAt({ x: 0, y: 103 }, seed), [], createRng(seed), 'off');
      const stuck = stuckDartOf(first)!;
      expect(stuck.depth).toBeCloseTo(0, 6);
      const second = resolveDart(launchAt({ x: 0, y: 103 }, seed), [stuck], createRng(seed), 'off');
      expect(second.collision).not.toBeNull();
      if (second.collision!.kind === 'robinHood') {
        robin++;
        expect(second.result.kind).toBe('robinHood');
        expect(toDartScore(second.result)).toEqual({ points: 0, multiplier: 0, label: 'ROBIN' });
        // It stops at the first dart's tail, out in front of the board.
        expect(second.flight.impact!.z * 1000).toBeCloseTo(DART_PROTRUSION, 0);
        expect(second.flight.duration).toBeLessThan(first.flight.duration);
        // ...and becomes an obstacle itself, out at that height.
        expect(stuckDartOf(second)!.depth).toBeCloseTo(DART_PROTRUSION, 0);
      } else {
        deflect++;
        const a = first.flight.impact!;
        const b = second.flight.impact!;
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(0.001);
      }
    }
    expect(robin).toBeGreaterThan(5);
    expect(deflect).toBeGreaterThan(5);
  });

  it('bounce-outs leave nothing in the board', () => {
    expect(
      stuckDartOf({
        flight: resolveDart(launchAt({ x: 0, y: 0 }, 1), [], createRng(1), 'off').flight,
        result: { kind: 'bounce', r: 0, angle: 0 },
      }),
    ).toBeNull();
  });
});

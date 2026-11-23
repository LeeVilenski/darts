import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { simulateFlight, worldToBoardMm } from './ballistics';
import { analyzeFlick, type PointerSample } from './gesture';
import { computeLaunch, IDEAL_FLICK_SPEED, type FlickMetrics } from './throwModel';

const land = (flick: FlickMetrics, seed = 1, aim = { x: 0, y: 0 }) => {
  const l = computeLaunch(aim, flick, 'standard', createRng(seed));
  return worldToBoardMm(simulateFlight(l.p0, l.v0).impact!);
};
const perfect: FlickMetrics = { speed: IDEAL_FLICK_SPEED, angle: 0, unsteadiness: 0, curvature: 0 };

describe('computeLaunch', () => {
  it('a perfect flick lands near the aim point', () => {
    let sum = 0;
    for (let s = 0; s < 200; s++) {
      const p = land(perfect, s, { x: 0, y: 103 });
      sum += Math.hypot(p.x, p.y - 103);
    }
    expect(sum / 200).toBeLessThan(15); // mean radial error
  });

  it('too much power lands high, too little lands low', () => {
    const hi = land({ ...perfect, speed: IDEAL_FLICK_SPEED * 2 });
    const lo = land({ ...perfect, speed: IDEAL_FLICK_SPEED * 0.4 });
    const ok = land(perfect);
    expect(hi.y).toBeGreaterThan(ok.y + 20);
    expect(lo.y).toBeLessThan(ok.y - 20);
  });

  it('a flick tilted right drifts right', () => {
    const right = land({ ...perfect, angle: 0.5 });
    const left = land({ ...perfect, angle: -0.5 });
    expect(right.x).toBeGreaterThan(left.x + 10);
  });
});

describe('analyzeFlick', () => {
  const trail = (vxPerMs: number, vyPerMs: number, n = 12, step = 8): PointerSample[] =>
    Array.from({ length: n }, (_, i) => ({
      x: 400 + vxPerMs * i * step,
      y: 600 + vyPerMs * i * step,
      t: i * step,
    }));

  it('detects a fast upward flick as a throw', () => {
    const a = analyzeFlick(trail(0, -2), 800); // 2 px/ms up = 2.5 vh/s
    expect(a.isThrow).toBe(true);
    expect(a.speed).toBeCloseTo(2.5, 1);
    expect(a.angle).toBeCloseTo(0, 3);
  });

  it('ignores slow or downward releases', () => {
    expect(analyzeFlick(trail(0, -0.2), 800).isThrow).toBe(false);
    expect(analyzeFlick(trail(0, 2), 800).isThrow).toBe(false);
  });

  it('reports tilt and finds the flick start after a pause', () => {
    const pause: PointerSample[] = Array.from({ length: 10 }, (_, i) => ({
      x: 400,
      y: 600,
      t: i * 10,
    }));
    const flick = trail(1, -2).map((s) => ({ ...s, t: s.t + 100 }));
    const a = analyzeFlick([...pause, ...flick], 800);
    expect(a.isThrow).toBe(true);
    expect(a.angle).toBeGreaterThan(0.3);
    expect(a.flickStart).toBeGreaterThanOrEqual(90);
    expect(a.flickStart).toBeLessThanOrEqual(110);
  });

  it('finds the flick start when the release repeats the last position', () => {
    const pause: PointerSample[] = Array.from({ length: 10 }, (_, i) => ({
      x: 400,
      y: 600,
      t: i * 10,
    }));
    const flick = trail(0, -2).map((s) => ({ ...s, t: s.t + 100 }));
    const end = flick[flick.length - 1]!;
    const a = analyzeFlick([...pause, ...flick, { ...end, t: end.t + 1 }], 800);
    expect(a.isThrow).toBe(true);
    expect(a.flickStart).toBeLessThanOrEqual(110);
  });
});

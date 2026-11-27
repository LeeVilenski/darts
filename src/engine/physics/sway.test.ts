import { describe, expect, it } from 'vitest';
import { SWAY_FROM, SWAY_MM, swayAmplitude, swayOffset } from './sway';

describe('swayAmplitude', () => {
  it('is still when nothing is riding on the dart', () => {
    expect(swayAmplitude(0, 'standard')).toBe(0);
    expect(swayAmplitude(SWAY_FROM, 'standard')).toBe(0);
  });

  it('grows with the pressure, up to the level for the assist setting', () => {
    const leg = swayAmplitude(0.45, 'standard');
    const match = swayAmplitude(0.75, 'standard');
    expect(leg).toBeGreaterThan(0);
    expect(match).toBeGreaterThan(leg);
    expect(swayAmplitude(1, 'standard')).toBeCloseTo(SWAY_MM.standard, 6);
    expect(swayAmplitude(2, 'standard')).toBeCloseTo(SWAY_MM.standard, 6);
  });

  it('is gentler on casual and wilder on pro', () => {
    expect(swayAmplitude(0.75, 'casual')).toBeLessThan(swayAmplitude(0.75, 'standard'));
    expect(swayAmplitude(0.75, 'pro')).toBeGreaterThan(swayAmplitude(0.75, 'standard'));
  });

  it('settles a little when you hold a steady aim', () => {
    const moving = swayAmplitude(0.75, 'standard', 0);
    const settled = swayAmplitude(0.75, 'standard', 2);
    expect(settled).toBeLessThan(moving * 0.7);
    expect(settled).toBeGreaterThan(moving * 0.5);
  });

  it('builds up over the first moments of aiming a dart', () => {
    expect(swayAmplitude(0.75, 'standard', 0, 0)).toBe(0);
    expect(swayAmplitude(0.75, 'standard', 0, 0.3)).toBeLessThan(
      swayAmplitude(0.75, 'standard', 0, 1),
    );
  });
});

describe('swayOffset', () => {
  it('stays within the sway radius', () => {
    for (let t = 0; t < 20; t += 0.01) {
      const o = swayOffset(t, 6, 3);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(6 + 1e-9);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(6 + 1e-9);
    }
  });

  it('moves smoothly (no jumps from frame to frame)', () => {
    let prev = swayOffset(0, 6, 1);
    for (let t = 1 / 60; t < 10; t += 1 / 60) {
      const o = swayOffset(t, 6, 1);
      expect(Math.hypot(o.x - prev.x, o.y - prev.y)).toBeLessThan(1);
      prev = o;
    }
  });

  it('is the same for the same dart and different for the next', () => {
    expect(swayOffset(1.234, 6, 7)).toEqual(swayOffset(1.234, 6, 7));
    expect(swayOffset(1.234, 6, 7)).not.toEqual(swayOffset(1.234, 6, 8));
    expect(swayOffset(1.234, 0, 7)).toEqual({ x: 0, y: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import { meterLevel, METER_HALF_PERIOD_MS, sweetBand } from './meterMath';

describe('power meter', () => {
  it('sweeps up and back down', () => {
    expect(meterLevel(0)).toBe(0);
    expect(meterLevel(METER_HALF_PERIOD_MS / 2)).toBeCloseTo(0.5);
    expect(meterLevel(METER_HALF_PERIOD_MS * 0.99)).toBeCloseTo(0.99);
    expect(meterLevel(METER_HALF_PERIOD_MS * 1.5)).toBeCloseTo(0.5);
    expect(meterLevel(METER_HALF_PERIOD_MS * 2)).toBeCloseTo(0);
  });
  it('centres the sweet spot', () => {
    const [lo, hi] = sweetBand(0.18);
    expect((lo + hi) / 2).toBeCloseTo(0.5);
    expect(hi - lo).toBeGreaterThan(0.2);
  });
});

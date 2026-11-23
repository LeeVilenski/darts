import { describe, expect, it } from 'vitest';
import {
  boardMmToWorld,
  idealLaunch,
  sampleFlight,
  simulateFlight,
  worldToBoardMm,
} from './ballistics';
import { NOMINAL_FLIGHT_TIME, RELEASE_POINT } from './throwModel';

describe('ballistics', () => {
  it('ideal launch lands on target within 0.5 mm', () => {
    for (const [x, y] of [
      [0, 0],
      [0, 103],
      [-120, -40],
      [80, 166],
    ] as const) {
      const target = boardMmToWorld(x, y);
      const flight = simulateFlight(
        RELEASE_POINT,
        idealLaunch(RELEASE_POINT, target, NOMINAL_FLIGHT_TIME),
      );
      expect(flight.impact).not.toBeNull();
      const hit = worldToBoardMm(flight.impact!);
      expect(Math.abs(hit.x - x)).toBeLessThan(0.5);
      expect(Math.abs(hit.y - y)).toBeLessThan(0.5);
      expect(flight.duration).toBeCloseTo(NOMINAL_FLIGHT_TIME, 2);
    }
  });

  it('a realistic throw has a visible arc (apex above release and target)', () => {
    const v0 = idealLaunch(RELEASE_POINT, boardMmToWorld(0, 0), NOMINAL_FLIGHT_TIME);
    const flight = simulateFlight(RELEASE_POINT, v0);
    const apex = Math.max(...flight.samples.map((s) => s.p.y));
    expect(apex).toBeGreaterThan(1.73 + 0.05);
    expect(Math.hypot(v0.x, v0.y, v0.z)).toBeGreaterThan(4);
    expect(Math.hypot(v0.x, v0.y, v0.z)).toBeLessThan(8);
  });

  it('a weak throw falls short of the board', () => {
    const flight = simulateFlight(RELEASE_POINT, { x: 0, y: 0, z: -1 });
    expect(flight.impact).toBeNull();
  });

  it('samples interpolate between steps', () => {
    const flight = simulateFlight(
      RELEASE_POINT,
      idealLaunch(RELEASE_POINT, boardMmToWorld(0, 0), 0.38),
    );
    const s = sampleFlight(flight, 0.19);
    expect(s.p.z).toBeLessThan(RELEASE_POINT.z);
    expect(s.p.z).toBeGreaterThan(0);
  });
});

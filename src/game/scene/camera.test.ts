import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { WORLD } from '../../engine/board/geometry';
import { breathOffset, CLOSE_DIR, kickOffset, LANE_CAM, shouldChase } from './camera';

const deg = (rad: number) => (rad * 180) / Math.PI;

describe('shouldChase', () => {
  const t20 = { x: 0, y: 103 };
  it('watches the first two scoring darts from the oche', () => {
    expect(shouldChase(0, t20, false)).toBe(false);
    expect(shouldChase(1, t20, false)).toBe(false);
  });
  it('chases the last dart of a turn', () => {
    expect(shouldChase(2, t20, false)).toBe(true);
  });
  it('chases finishing darts and darts at a double or the bull', () => {
    expect(shouldChase(0, t20, true)).toBe(true);
    expect(shouldChase(0, { x: 0, y: 166 }, false)).toBe(true); // D20
    expect(shouldChase(0, { x: 0, y: 3 }, false)).toBe(true); // bull
    expect(shouldChase(0, { x: 0, y: 140 }, false)).toBe(false); // outer single
  });
});

describe('camera angles', () => {
  it('close-ups sit well off the board axis so stuck darts show in profile', () => {
    const offAxis = deg(CLOSE_DIR.angleTo(new Vector3(0, 0, 1)));
    expect(offAxis).toBeGreaterThan(30);
    expect(offAxis).toBeLessThan(45);
    expect(CLOSE_DIR.y).toBeLessThan(0); // looking up from below, like TV coverage
  });
  it('the replay lane cam is behind the oche, above eye height, inside the room', () => {
    expect(LANE_CAM.pos.z).toBeGreaterThan(WORLD.ocheDistance);
    expect(LANE_CAM.pos.y).toBeGreaterThan(1.8);
    expect(LANE_CAM.pos.y).toBeLessThan(3);
  });
});

describe('breathOffset', () => {
  it('stays within a few millimetres', () => {
    for (let t = 0; t < 30; t += 0.05) {
      const b = breathOffset(t);
      expect(Math.hypot(b.x, b.y)).toBeLessThan(0.003);
    }
  });
});

describe('kickOffset', () => {
  it('jolts on impact and dies away', () => {
    expect(Math.abs(kickOffset(0, 0.14))).toBeGreaterThan(0.001);
    expect(kickOffset(1, 0.14)).toBe(0);
    expect(kickOffset(-0.1, 0.14)).toBe(0);
    expect(kickOffset(Number.NaN, 0.14)).toBe(0);
    expect(kickOffset(0.05, 0)).toBe(0);
  });
});

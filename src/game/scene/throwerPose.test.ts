import { describe, expect, it } from 'vitest';
import { RELEASE_POINT } from '../../engine/physics/throwModel';
import {
  ANGLE,
  armAt,
  AVERAGE_BUILD,
  blendRest,
  shoulderWorld,
  ELBOW,
  elbowAt,
  FOREARM,
  gripAt,
  holdsDart,
  JOINTS,
  tipAt,
  WINDUP_S,
} from './throwerPose';

describe('throw', () => {
  it('puts the dart tip exactly at the release point when it leaves the hand', () => {
    const p = tipAt(0);
    expect(p.x).toBeCloseTo(RELEASE_POINT.x, 6);
    expect(p.y).toBeCloseTo(RELEASE_POINT.y, 6);
    expect(p.z).toBeCloseTo(RELEASE_POINT.z, 6);
  });

  it('rests at the aim pose before the wind-up and after the reset', () => {
    for (const tl of [-WINDUP_S - 0.5, 5, Infinity, -Infinity, Number.NaN]) {
      expect(armAt(tl)).toEqual({ angle: ANGLE.aim, lift: 0 });
    }
  });

  it('draws back toward the face, then drives forward and follows through', () => {
    expect(armAt(-0.12).angle).toBeCloseTo(ANGLE.cock, 6); // fully drawn back
    expect(gripAt(-0.12).z).toBeGreaterThan(gripAt(5).z); // hand nearer the face than when aiming
    expect(armAt(0.3).angle).toBeCloseTo(ANGLE.follow, 6);
    expect(tipAt(0.3).z).toBeLessThan(RELEASE_POINT.z); // pointing on toward the board
  });

  it('keeps the elbow still through the wind-up and lifts it on the follow-through', () => {
    for (let tl = -WINDUP_S; tl <= 0; tl += 0.01) {
      expect(elbowAt(tl).distanceTo(ELBOW)).toBeLessThan(1e-9);
    }
    expect(elbowAt(0.4).y).toBeGreaterThan(ELBOW.y + 0.03);
  });

  it('keeps the forearm its own length', () => {
    for (let tl = -0.5; tl <= 1.5; tl += 0.05) {
      expect(gripAt(tl).distanceTo(elbowAt(tl))).toBeCloseTo(FOREARM, 6);
    }
  });

  it('has an upper arm of human length from the shoulder', () => {
    const upper = JOINTS.shoulderR.distanceTo(ELBOW);
    expect(upper).toBeGreaterThan(0.22);
    expect(upper).toBeLessThan(0.34);
    expect(ELBOW.y).toBeLessThan(JOINTS.shoulderR.y); // elbow a little below the shoulder
    expect(ELBOW.z).toBeLessThan(JOINTS.shoulderR.z); // and out in front of it
  });

  it('moves continuously (no jumps between keyframes)', () => {
    let prev = tipAt(-1);
    for (let t = -1; t <= 1.5; t += 0.002) {
      const p = tipAt(t);
      expect(p.distanceTo(prev)).toBeLessThan(0.02);
      prev = p;
    }
  });

  it('moves fastest around release, at roughly dart speed', () => {
    const dt = 0.002;
    const speed = tipAt(-dt).distanceTo(tipAt(0)) / dt;
    expect(speed).toBeGreaterThan(3);
    expect(speed).toBeLessThan(9);
  });

  it('holds a dart until release and picks the next one up afterwards', () => {
    expect(holdsDart(-0.1)).toBe(true);
    expect(holdsDart(0.1)).toBe(false);
    expect(holdsDart(2)).toBe(true);
  });
});

describe('builds and resting arm', () => {
  it('the throwing arm reaches the still elbow for every build', () => {
    for (const height of [0.95, 1, 1.05])
      for (const girth of [0.92, 1, 1.22]) {
        const upper = shoulderWorld({ height, girth }).distanceTo(ELBOW);
        expect(upper).toBeGreaterThan(0.2);
        expect(upper).toBeLessThan(0.36);
      }
  });

  it('resting keeps both bones their length and drops the hand to chest height', () => {
    const shoulder = shoulderWorld(AVERAGE_BUILD);
    const elbow = elbowAt(5);
    const grip = gripAt(5);
    const upper = shoulder.distanceTo(elbow);
    blendRest(shoulder, elbow, grip, 1);
    expect(elbow.distanceTo(shoulder)).toBeCloseTo(upper, 6);
    expect(grip.distanceTo(elbow)).toBeCloseTo(FOREARM, 6);
    expect(grip.y).toBeLessThan(shoulder.y - 0.1);
  });

  it('a zero blend leaves the throw pose alone', () => {
    const shoulder = shoulderWorld(AVERAGE_BUILD);
    const elbow = elbowAt(-0.1);
    const grip = gripAt(-0.1);
    const before = grip.clone();
    blendRest(shoulder, elbow, grip, 0);
    expect(grip.distanceTo(before)).toBe(0);
  });
});

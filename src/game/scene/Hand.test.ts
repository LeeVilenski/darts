import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { DART } from '../../engine/board/geometry';
import { BARREL_R, FINGERS, fingerJoints, gripQuaternion, PINCH_POINT, POSES, THUMB } from './Hand';

const mm = (v: number) => v / 1000;
const TIP = mm(DART.tipLength);
const BARREL = mm(DART.barrelLength);
const SHAFT = mm(DART.shaftLength);
const FLIGHT = mm(DART.flightLength);
const FLIGHT_HALF = mm(DART.flightHalfSpan);
/** The dart is held at the middle of its barrel. */
const GRIP_FROM_TIP = TIP + BARREL / 2;

/** Distance from point p to segment ab. */
function segDist(p: Vector3, a: Vector3, b: Vector3) {
  const ab = b.clone().sub(a);
  const t = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

/** Finger segments in hand space, with their radii (spread applied about the knuckle). */
function fingerSegments() {
  const segs: { a: Vector3; b: Vector3; r: number; finger: number }[] = [];
  FINGERS.forEach((f, i) => {
    const { points } = fingerJoints(f, POSES.pinch.curls[i]!);
    const spread = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), POSES.pinch.spread[i]!);
    const knuckle = points[0]!;
    const pts = points.map((p) => p.clone().sub(knuckle).applyQuaternion(spread).add(knuckle));
    for (let k = 0; k < 3; k++)
      segs.push({ a: pts[k]!, b: pts[k + 1]!, r: f.r * (1 - k * 0.06), finger: i });
  });
  return segs;
}

/** Points on the dart's surface (hand space), with how far from the grip they are along it. */
function dartSurface() {
  const out: { p: Vector3; s: number }[] = [];
  const axis = new Vector3(-1, 0, 0); // tip out past the thumb
  for (let s = -(TIP + BARREL + SHAFT + FLIGHT - GRIP_FROM_TIP); s <= GRIP_FROM_TIP; s += 0.002) {
    const fromTip = GRIP_FROM_TIP - s;
    const r =
      fromTip < TIP
        ? mm(1.2)
        : fromTip < TIP + BARREL
          ? BARREL_R
          : fromTip < TIP + BARREL + SHAFT
            ? mm(DART.shaftRadius)
            : FLIGHT_HALF;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      out.push({
        p: PINCH_POINT.clone()
          .addScaledVector(axis, s)
          .add(new Vector3(0, Math.cos(a) * r, Math.sin(a) * r)),
        s,
      });
    }
  }
  return out;
}

describe('the throwing grip', () => {
  it('pinches the barrel between the forefinger pad and the thumb pad', () => {
    const index = fingerSegments()
      .filter((g) => g.finger === 0)
      .at(-1)!;
    const toIndex = segDist(PINCH_POINT, index.a, index.b) - index.r;
    const toThumb = PINCH_POINT.distanceTo(THUMB.tip) - THUMB.r * 0.9;
    // Both pads touch the barrel (within a millimetre or so), one from each side.
    expect(Math.abs(toIndex - BARREL_R)).toBeLessThan(0.0025);
    expect(Math.abs(toThumb - BARREL_R)).toBeLessThan(0.0025);
    expect(THUMB.tip.y).toBeLessThan(PINCH_POINT.y); // thumb underneath
  });

  it('holds the dart clear of the palm and the other fingers', () => {
    const segs = fingerSegments();
    for (const { p, s } of dartSurface()) {
      // The palm: an ellipsoid at (0, 0.048, 0.002) with radii (0.04, 0.045, 0.017).
      const e = p.clone().sub(new Vector3(0, 0.048, 0.002));
      const inPalm = (e.x / 0.04) ** 2 + (e.y / 0.045) ** 2 + (e.z / 0.017) ** 2 < 1;
      expect(inPalm).toBe(false);
      for (const g of segs) {
        // The forefinger's last joint holds the barrel, so it may touch it there.
        const pinching = g.finger === 0 && Math.abs(s) < BARREL / 2;
        if (pinching) continue;
        expect(segDist(p, g.a, g.b)).toBeGreaterThan(g.r * 0.8);
      }
    }
  });

  it('points the dart out past the thumb, across the fingers, whatever the forearm angle', () => {
    const q = new Quaternion();
    const held = new Vector3();
    for (const along of [
      new Vector3(0, 1, 0),
      new Vector3(0, 0.7, -0.7),
      new Vector3(0.1, 0.9, 0.3),
    ]) {
      const dart = new Vector3(0, 0.15, -1).normalize();
      gripQuaternion(along, dart, q, held);
      expect(held.dot(along.clone().normalize())).toBeCloseTo(0, 6); // across the fingers
      expect(new Vector3(-1, 0, 0).applyQuaternion(q).distanceTo(held)).toBeLessThan(1e-6);
      expect(held.dot(dart)).toBeGreaterThan(0.5); // still pointing the right way
    }
  });
});

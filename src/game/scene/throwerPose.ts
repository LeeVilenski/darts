import { Vector3 } from 'three';
import { RELEASE_POINT } from '../../engine/physics/throwModel';

/**
 * The thrower figure seen on AI turns and in replays: a right-handed player
 * standing side-on at the oche. The body is static; the throwing arm follows a
 * keyframed path for the dart tip so that, at release, the tip is exactly at
 * RELEASE_POINT, where the simulated flight starts.
 */

/** Body placement: where the hips stand on the floor (world m), and its turn toward the board. */
export const BODY = { x: -0.03, z: 2.56, yaw: 0.49 } as const;

/** Body-local (x along the shoulders toward the throwing arm, +y up, -z forward) to world. */
export function bodyToWorld(x: number, y: number, z: number): Vector3 {
  const c = Math.cos(BODY.yaw);
  const s = Math.sin(BODY.yaw);
  return new Vector3(BODY.x + x * c + z * s, y, BODY.z - x * s + z * c);
}

/** World to body-local (the inverse of bodyToWorld). */
export function worldToBody(w: Vector3): Vector3 {
  const c = Math.cos(BODY.yaw);
  const s = Math.sin(BODY.yaw);
  const dx = w.x - BODY.x;
  const dz = w.z - BODY.z;
  return new Vector3(dx * c - dz * s, w.y, dx * s + dz * c);
}

/** How tall and how wide a player is (multipliers around 1). */
export interface Build {
  height: number;
  girth: number;
}
export const AVERAGE_BUILD: Build = { height: 1, girth: 1 };

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * Body joints in body-local coordinates for a build. Feet are planted where
 * a darts player stands (front foot at the oche); height scales everything
 * above them and girth scales widths.
 */
export function bodyJoints({ height: h, girth: g }: Build) {
  const footR = worldToBody(v(0.1, 0.05, 2.43));
  const footL = worldToBody(v(-0.24, 0.05, 2.86));
  return {
    head: v(0.05, 1.665 * h, -0.065),
    neck: v(0.02, 1.52 * h, -0.04),
    shoulderR: v(0.17 * g, 1.44 * h, -0.05),
    shoulderL: v(-0.17 * g, 1.42 * h, 0),
    waist: v(0, 0.93 * h, 0),
    hipR: v(0.085 * g, 0.93 * h, 0),
    hipL: v(-0.085 * g, 0.93 * h, 0),
    kneeR: footR
      .clone()
      .lerp(v(0.085 * g, 0.93 * h, 0), 0.47)
      .add(v(0, 0, -0.04)),
    kneeL: footL
      .clone()
      .lerp(v(-0.085 * g, 0.93 * h, 0), 0.47)
      .add(v(0, 0, -0.02)),
    footR,
    footL,
    elbowL: v(-0.2 * g, 1.15 * h, -0.04),
    handL: v(-0.19 * g, 0.91 * h, -0.08),
  };
}
export type BodyJoints = ReturnType<typeof bodyJoints>;

/** Throwing shoulder in world space for a build (where the upper arm hangs from). */
export function shoulderWorld(build: Build): Vector3 {
  const s = bodyJoints(build).shoulderR;
  return bodyToWorld(s.x, s.y, s.z);
}

/** Joints for an average build, in world space (used by tests and as a reference). */
export const JOINTS = {
  shoulderR: shoulderWorld(AVERAGE_BUILD),
  head: (() => {
    const hd = bodyJoints(AVERAGE_BUILD).head;
    return bodyToWorld(hd.x, hd.y, hd.z);
  })(),
} as const;

/** Elbow to the dart grip (the pinch between thumb and fingers), m: forearm plus hand. */
export const FOREARM = 0.34;
/** The dart is held this far behind its tip (m), at the barrel. */
export const GRIP_BACK = 0.055;
/** Roughly where a held dart points (toward the board, lofted); used to place the tip. */
const NOMINAL_DIR = new Vector3(0, 0.15, -1).normalize();

const deg = (d: number) => (d * Math.PI) / 180;
/**
 * Forearm angle from vertical (rad), positive toward the board. Darts is thrown
 * from a still elbow: the forearm swings back toward the face, drives forward
 * through release just past vertical, then follows through toward the board.
 */
export const ANGLE = {
  aim: deg(-10),
  cock: deg(-45),
  release: deg(16),
  follow: deg(70),
} as const;
/** The elbow lifts this much (m) on the follow-through. */
const ELBOW_LIFT = 0.05;

const forearmDir = (angle: number, out = new Vector3()) =>
  out.set(0, Math.cos(angle), -Math.sin(angle));

/**
 * The elbow (still while throwing), placed so that at release the dart tip is
 * exactly at RELEASE_POINT, where the simulated flight starts.
 */
export const ELBOW = new Vector3(RELEASE_POINT.x, RELEASE_POINT.y, RELEASE_POINT.z)
  .addScaledVector(NOMINAL_DIR, -GRIP_BACK)
  .addScaledVector(forearmDir(ANGLE.release), -FOREARM);

/** Wind-up before release (s): draw back, then drive forward. */
export const WINDUP_S = 0.32;
const DRAW_S = 0.2; // aim → cock
const DRIVE_S = WINDUP_S - DRAW_S; // cock → release
const FOLLOW_S = 0.22;
const HOLD_UNTIL_S = 0.6;
const RESET_UNTIL_S = 1.1;

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** The throw at `tl` seconds relative to release: forearm angle and elbow lift (0–1). */
export function armAt(tl: number): { angle: number; lift: number } {
  if (!Number.isFinite(tl) || tl < -WINDUP_S || tl >= RESET_UNTIL_S)
    return { angle: ANGLE.aim, lift: 0 };
  if (tl < -DRIVE_S)
    return { angle: mix(ANGLE.aim, ANGLE.cock, smooth((tl + WINDUP_S) / DRAW_S)), lift: 0 };
  if (tl < 0) {
    // Accelerate through release (ease-in): fastest as the dart leaves the hand.
    const k = clamp01((tl + DRIVE_S) / DRIVE_S);
    return { angle: mix(ANGLE.cock, ANGLE.release, k * k), lift: 0 };
  }
  if (tl < FOLLOW_S) {
    const k = 1 - (1 - tl / FOLLOW_S) ** 2;
    return { angle: mix(ANGLE.release, ANGLE.follow, k), lift: k };
  }
  if (tl < HOLD_UNTIL_S) return { angle: ANGLE.follow, lift: 1 };
  const k = smooth((tl - HOLD_UNTIL_S) / (RESET_UNTIL_S - HOLD_UNTIL_S));
  return { angle: mix(ANGLE.follow, ANGLE.aim, k), lift: 1 - k };
}

/** Elbow position at `tl`. */
export function elbowAt(tl: number, out = new Vector3()): Vector3 {
  return out.copy(ELBOW).add(new Vector3(0, ELBOW_LIFT * armAt(tl).lift, 0));
}

/** Grip (hand) position at `tl`. */
export function gripAt(tl: number, out = new Vector3()): Vector3 {
  const { angle } = armAt(tl);
  return elbowAt(tl, out).addScaledVector(forearmDir(angle), FOREARM);
}

/** Dart-tip position at `tl` (for a dart pointing the usual way). */
export function tipAt(tl: number, out = new Vector3()): Vector3 {
  return gripAt(tl, out).addScaledVector(NOMINAL_DIR, GRIP_BACK);
}

/** Is a dart in the thrower's hand at `tl`? (Gone from release until it picks up the next.) */
export function holdsDart(tl: number): boolean {
  return !Number.isFinite(tl) || tl < 0 || tl >= RESET_UNTIL_S - 0.2;
}

/** Resting arm while stepping up: upper arm hanging, forearm across the body, darts at chest height. */
const REST_UPPER = new Vector3(0.02, -0.97, -0.14).normalize();
/** Across the front of the body, toward the other hip (world: body-left with a little forward). */
const REST_FORE = new Vector3(-0.91, 0.12, -0.05).normalize();

/**
 * Blend the throwing arm toward the resting pose by `rest` (0 = the throw pose
 * given, 1 = fully at rest). The elbow stays on its circle round the shoulder,
 * so the upper arm keeps its length.
 */
export function blendRest(shoulder: Vector3, elbow: Vector3, grip: Vector3, rest: number): void {
  if (rest <= 0) return;
  const upperLen = elbow.distanceTo(shoulder);
  const upperDir = new Vector3()
    .subVectors(elbow, shoulder)
    .normalize()
    .lerp(REST_UPPER, rest)
    .normalize();
  const foreDir = new Vector3()
    .subVectors(grip, elbow)
    .normalize()
    .lerp(REST_FORE, rest)
    .normalize();
  elbow.copy(shoulder).addScaledVector(upperDir, upperLen);
  grip.copy(elbow).addScaledVector(foreDir, FOREARM);
}

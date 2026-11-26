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

/** Body-local (x along the shoulders, +y up, -z forward) to world. */
export function bodyToWorld(x: number, y: number, z: number): Vector3 {
  const c = Math.cos(BODY.yaw);
  const s = Math.sin(BODY.yaw);
  return new Vector3(BODY.x + x * c + z * s, y, BODY.z - x * s + z * c);
}

export const JOINTS = {
  head: bodyToWorld(0.05, 1.69, -0.07),
  hairOffset: new Vector3(0, 0.012, 0.012),
  neck: bodyToWorld(0.02, 1.53, -0.04),
  shoulderR: bodyToWorld(0.18, 1.44, -0.05),
  shoulderL: bodyToWorld(-0.18, 1.42, 0),
  chest: bodyToWorld(0, 1.3, -0.03),
  hips: bodyToWorld(0, 0.97, 0),
  hipR: bodyToWorld(0.09, 0.95, 0),
  hipL: bodyToWorld(-0.09, 0.95, 0),
  kneeR: new Vector3(0.09, 0.5, 2.45),
  kneeL: new Vector3(-0.2, 0.5, 2.74),
  footR: new Vector3(0.1, 0.05, 2.43),
  footL: new Vector3(-0.24, 0.05, 2.86),
  toeR: new Vector3(0.07, 0.04, 2.26),
  toeL: new Vector3(-0.18, 0.04, 2.7),
  elbowL: bodyToWorld(-0.2, 1.15, -0.03),
  handL: bodyToWorld(-0.19, 0.9, -0.06),
} as const;

/** Which way the head faces: at the board, from the head. */
export const FACING = new Vector3(0, 1.73, 0).sub(JOINTS.head).normalize();
/** Face features, placed on the head relative to where it faces. */
const sideways = new Vector3().crossVectors(FACING, new Vector3(0, 1, 0)).normalize();
export const FACE = {
  nose: JOINTS.head
    .clone()
    .addScaledVector(FACING, 0.1)
    .add(new Vector3(0, -0.012, 0)),
  earR: JOINTS.head.clone().addScaledVector(sideways, 0.094).addScaledVector(FACING, -0.01),
  earL: JOINTS.head.clone().addScaledVector(sideways, -0.094).addScaledVector(FACING, -0.01),
} as const;

/** Forearm length, elbow → grip (m). */
export const FOREARM = 0.28;
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

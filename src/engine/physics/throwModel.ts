import { WORLD } from '../board/geometry';
import type { Rng } from '../rng';
import { boardMmToWorld, idealLaunch, type Vec3 } from './ballistics';

export type AssistLevel = 'casual' | 'standard' | 'pro';

export interface AssistTuning {
  /** Fractional flick-speed error ignored around the sweet spot. */
  powerDeadZone: number;
  /** Launch-speed change per unit of (out-of-dead-zone) flick-speed error. */
  powerGain: number;
  /** Launch yaw (rad) per radian of flick tilt from vertical. */
  lateralGain: number;
  /** Base scatter at the board (mm, 1σ). */
  scatterMm: number;
  /** Extra scatter for a fully unsteady release (mm, 1σ). */
  unsteadyScatterMm: number;
}

export const ASSIST: Record<AssistLevel, AssistTuning> = {
  casual: {
    powerDeadZone: 0.35,
    powerGain: 0.03,
    lateralGain: 0.01,
    scatterMm: 4,
    unsteadyScatterMm: 4,
  },
  standard: {
    powerDeadZone: 0.18,
    powerGain: 0.06,
    lateralGain: 0.02,
    scatterMm: 7,
    unsteadyScatterMm: 8,
  },
  pro: {
    powerDeadZone: 0.08,
    powerGain: 0.09,
    lateralGain: 0.03,
    scatterMm: 9,
    unsteadyScatterMm: 12,
  },
};

/** Where the dart leaves the hand (world metres). */
export const RELEASE_POINT: Vec3 = { x: 0.03, y: 1.6, z: WORLD.ocheDistance - 0.3 };
/** Flight time of a perfectly weighted throw. */
export const NOMINAL_FLIGHT_TIME = 0.38;
/** Flick speed (viewport heights per second) that produces a perfectly weighted throw. */
export const IDEAL_FLICK_SPEED = 2.4;

export interface FlickMetrics {
  /** Flick speed in viewport heights / second. */
  speed: number;
  /** Tilt of the flick from straight up, radians (positive = to the right). */
  angle: number;
  /** 0 = perfectly smooth release, 1 = very jerky. */
  unsteadiness: number;
  /** 0 = straight flick, 1 = strongly curved. */
  curvature: number;
}

export interface LaunchParams {
  p0: Vec3;
  v0: Vec3;
  /** Initial wobble amplitude (rad), frequency (Hz) and damping (1/s). */
  wobble: { amplitude: number; frequency: number; damping: number };
  /** Roll rate around the dart axis (rad/s); cosmetic. */
  spin: number;
  /** Normalised flick power: 1 = sweet spot. */
  power: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Convert an aim point (board mm) and a flick into launch parameters. */
export function computeLaunch(
  aimMm: { x: number; y: number },
  flick: FlickMetrics,
  assist: AssistLevel,
  rng: Rng,
): LaunchParams {
  const tune = ASSIST[assist];
  const sigma = tune.scatterMm + tune.unsteadyScatterMm * clamp(flick.unsteadiness, 0, 1);
  const target = boardMmToWorld(aimMm.x + rng.gaussian() * sigma, aimMm.y + rng.gaussian() * sigma);
  const ideal = idealLaunch(RELEASE_POINT, target, NOMINAL_FLIGHT_TIME);

  const power = flick.speed / IDEAL_FLICK_SPEED;
  const err = clamp(power - 1, -0.8, 1.5);
  const outside = Math.sign(err) * Math.max(0, Math.abs(err) - tune.powerDeadZone);
  const scale = 1 + outside * tune.powerGain;

  const yaw = -clamp(flick.angle, -1, 1) * tune.lateralGain; // tilt right -> rotate velocity toward +x
  const vx = ideal.x * scale;
  const vz = ideal.z * scale;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const v0 = { x: vx * cos + vz * sin, y: ideal.y * scale, z: -vx * sin + vz * cos };

  return {
    p0: { ...RELEASE_POINT },
    v0,
    wobble: { amplitude: 0.04 + 0.25 * clamp(flick.curvature, 0, 1), frequency: 14, damping: 7 },
    spin: 8 + rng.next() * 10,
    power,
  };
}

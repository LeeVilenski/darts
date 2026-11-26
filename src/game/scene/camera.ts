import { Vector3 } from 'three';
import { BOARD, WORLD } from '../../engine/board/geometry';

/** Oche-view camera: just behind the throw line at eye height. */
export const CAMERA_POS = { x: 0, y: 1.68, z: WORLD.ocheDistance + 0.18 };
const DISTANCE = Math.hypot(CAMERA_POS.z, CAMERA_POS.y - WORLD.bullHeight);
/** Half-extent (m) of board-plane we want visible along the narrower screen axis. */
const FRAME_HALF = 0.3;
/** Board-plane half-extent framed at the oche. */
export const OCHE_HALF = FRAME_HALF;

/**
 * Close-ups look at the board from low and to the right (~35° off the board's
 * axis), so stuck darts read in profile instead of as end-on crosses.
 */
export const CLOSE_DIR = new Vector3(0.5, -0.42, 1).normalize();

/**
 * TV "board cam": just off the board's right side and slightly below, framed on
 * the target bed, so you see darts fly in and strike.
 */
export const BOARD_CAM = {
  dir: new Vector3(0.6, -0.12, 1).normalize(),
  dist: 0.55,
  half: 0.115,
} as const;

/**
 * Replay "lane cam": high and behind the thrower's right shoulder, looking down
 * the lane. It pans with the dart but keeps the board in frame (works in portrait).
 */
export const LANE_CAM = {
  pos: { x: 0.42, y: 2.05, z: WORLD.ocheDistance + 1.05 },
  /** How far the look point is pulled from the dart toward the bull (0–1). */
  boardBias: 0.45,
  half: 0.42,
} as const;

/** Chase cam riding just behind and above the dart. */
export const CHASE = {
  offset: new Vector3(0, 0.05, 0.3),
  /** Fraction of the way from the dart to its landing point the camera looks at release. */
  lookStart: 0.35,
  half: 0.2,
} as const;

/** Vertical FOV (deg) that fits `halfExtent` metres at `distance` along the narrower screen axis. */
export function fovToFrame(halfExtent: number, distance: number, aspect: number): number {
  const halfHeight = aspect >= 1 ? halfExtent : halfExtent / aspect;
  return (2 * Math.atan(halfHeight / distance) * 180) / Math.PI;
}

/** Vertical FOV (deg) so the board + surround fits whichever screen axis is narrower. */
export function fovForAspect(aspect: number): number {
  return fovToFrame(FRAME_HALF, DISTANCE, aspect);
}

/** Visible half-height (m) on the board plane for a given aspect at the oche. */
export function visibleHalfHeight(aspect: number): number {
  return Math.tan(((fovForAspect(aspect) / 2) * Math.PI) / 180) * DISTANCE;
}

const isDoubleOrBull = (aim: { x: number; y: number }) => {
  const r = Math.hypot(aim.x, aim.y);
  return r <= BOARD.outerBull || (r >= BOARD.doubleInner && r <= BOARD.doubleOuter);
};

/**
 * Whether a player's dart gets the chase cam. Following every throw gets
 * repetitive, so it's saved for the last dart of a turn and for finishing darts
 * (on a finish, or aimed at a double or the bull). Other darts are watched from the oche.
 */
export function shouldChase(
  dartIndex: number,
  aimMm: { x: number; y: number },
  onFinish: boolean,
): boolean {
  return dartIndex >= 2 || onFinish || isDoubleOrBull(aimMm);
}

/**
 * Slow, slightly irregular drift of the eye while aiming (metres on the board
 * plane): breathing plus a little hand-held wander. Around 2 mm at most.
 */
export function breathOffset(t: number): { x: number; y: number } {
  return {
    x: 0.0011 * Math.sin(t * 0.83 + 1.3) + 0.0006 * Math.sin(t * 1.97),
    y: 0.0013 * Math.sin(t * 1.25) + 0.0005 * Math.sin(t * 2.71 + 0.4),
  };
}

/** Jolt length (s). */
const KICK_S = 0.35;

/**
 * Vertical camera jolt `age` seconds after a dart strikes: a quick damped
 * shudder whose size is `scale` × 1.2% (scale is usually the framed half-extent).
 * Returns 0 once it has died away.
 */
export function kickOffset(age: number, scale: number): number {
  if (!(age >= 0) || age > KICK_S || scale === 0) return 0;
  return -0.012 * scale * Math.exp(-age * 14) * Math.cos(age * 2 * Math.PI * 11);
}

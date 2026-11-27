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

/** One framing of the opponent's view. */
export interface OpponentFraming {
  pos: { x: number; y: number; z: number };
  /** Look point: this far from the release point toward the bull (0–1)… */
  lookToBoard: number;
  /** …lowered this much (m) so the thrower's body is in frame too. */
  lookDrop: number;
  half: number;
  /** Replays: framed tighter and following the dart more closely. */
  replayHalf: number;
}

/**
 * AI turns: you're the opponent, standing beside the oche, watching the
 * thrower wind up and let go and the dart fly down the lane and strike.
 * Landscape screens get a true side-on view; portrait is too narrow to hold the
 * thrower and the board side by side, so it stands further behind their right
 * shoulder, looking down the lane.
 */
export const OPPONENT = {
  landscape: {
    pos: { x: 1.2, y: 1.6, z: WORLD.ocheDistance + 1.15 },
    lookToBoard: 0.3,
    lookDrop: 0.12,
    half: 0.74,
    replayHalf: 0.46,
  } satisfies OpponentFraming,
  portrait: {
    pos: { x: 0.62, y: 1.62, z: WORLD.ocheDistance + 1.6 },
    lookToBoard: 0.3,
    lookDrop: 0.22,
    half: 0.72,
    replayHalf: 0.5,
  } satisfies OpponentFraming,
  /** How much the camera turns to follow the dart (0–1), live and in replays. */
  track: 0.22,
  replayTrack: 0.55,
  /** Easing rate for those small pans (1/s). */
  panRate: 3,
  /** Stay wide this long after the dart lands before cutting to the board cam (s). */
  holdAfterImpact: 0.5,
} as const;

/**
 * Player cam: before an AI player's first dart, a front three-quarter shot of
 * them stepping up, from between the board and the oche, off to their left
 * (the side away from the throwing hand, so it doesn't hide their face).
 * Slowly pushes in, like TV coverage of a player settling.
 */
export const PLAYER_CAM = {
  /** Direction from the player's face to the camera. */
  dir: new Vector3(-0.62, -0.06, -1).normalize(),
  dist: 1.25,
  /** Look this far below the eyes, to take in head and shoulders. */
  drop: 0.12,
  /** Framing at the start, and the slow push-in it eases toward. */
  half: 0.4,
  pushHalf: 0.33,
  pushRate: 0.9,
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

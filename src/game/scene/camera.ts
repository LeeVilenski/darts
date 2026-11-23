import { WORLD } from '../../engine/board/geometry';

/** Oche-view camera: just behind the throw line at eye height. */
export const CAMERA_POS = { x: 0, y: 1.68, z: WORLD.ocheDistance + 0.18 };
const DISTANCE = Math.hypot(CAMERA_POS.z, CAMERA_POS.y - WORLD.bullHeight);
/** Half-extent (m) of board-plane we want visible along the narrower screen axis. */
const FRAME_HALF = 0.3;

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

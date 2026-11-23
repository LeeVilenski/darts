import { WORLD } from '../../engine/board/geometry';

/** Oche-view camera: just behind the throw line at eye height. */
export const CAMERA_POS = { x: 0, y: 1.68, z: WORLD.ocheDistance + 0.18 };
const DISTANCE = Math.hypot(CAMERA_POS.z, CAMERA_POS.y - WORLD.bullHeight);
/** Half-extent (m) of board-plane we want visible along the narrower screen axis. */
const FRAME_HALF = 0.3;

/** Vertical FOV (deg) so the board + surround fits whichever screen axis is narrower. */
export function fovForAspect(aspect: number): number {
  const halfHeight = aspect >= 1 ? FRAME_HALF : FRAME_HALF / aspect;
  return (2 * Math.atan(halfHeight / DISTANCE) * 180) / Math.PI;
}

/** Visible half-height (m) on the board plane for a given aspect. */
export function visibleHalfHeight(aspect: number): number {
  return Math.tan(((fovForAspect(aspect) / 2) * Math.PI) / 180) * DISTANCE;
}

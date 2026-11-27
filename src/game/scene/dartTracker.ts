import { Quaternion, Vector3 } from 'three';

/** Live position of the dart currently in flight, written by FlyingDart and read by the camera. */
export const dartTracker = {
  id: -1,
  position: new Vector3(),
  /** Flight time (s) of that dart; negative during a replay's lead-in before release. */
  time: 0,
};

/** When the current live AI dart leaves (or left) the thrower's hand (performance.now() ms). */
export const throwerClock = {
  releaseAt: -Infinity,
  /** Until when the player cam (a front shot of the thrower stepping up) is on (performance.now() ms). */
  playerCamUntil: -Infinity,
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __throwerClock: typeof throwerClock }).__throwerClock = throwerClock;
}

/**
 * World pose of the dart held in the player's hand, written every frame by HeldDart.
 * A freshly thrown dart starts its flight from here so it visibly leaves the hand.
 */
export const handTracker = {
  /** True while the held dart is on screen. */
  visible: false,
  /** performance.now() of the last update. */
  time: 0,
  position: new Vector3(),
  quaternion: new Quaternion(),
};

/** Short-lived camera impulse (a jolt when a dart strikes), read by the camera director. */
export const cameraKick = { time: -Infinity, strength: 0 };

export function kickCamera(strength: number) {
  cameraKick.time = performance.now();
  cameraKick.strength = strength;
}

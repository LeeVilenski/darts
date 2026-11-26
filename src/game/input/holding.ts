import { create } from 'zustand';
import { SteadyTracker } from '../../engine/physics/gesture';
import { useCharge } from './powerMeter';

/** Set by the flick gesture while a finger/mouse is down on the throw layer. */
export const pointerHold = { down: false };

/** Steadiness of the current aiming drag (fed by the flick gesture). */
export const steadyAim = new SteadyTracker();

/** True while the player is holding a dart (pointer down or charging the meter). */
export function isHolding(): boolean {
  return pointerHold.down || useCharge.getState().start !== null;
}

/**
 * True when a throw would go now: charging the power meter, or holding a steady
 * aim so a flick will count. While the aim is being moved this is false.
 */
export function isReadyToThrow(now = performance.now()): boolean {
  return useCharge.getState().start !== null || (pointerHold.down && steadyAim.armed(now));
}

/** How long the "hold still, then flick" hint shows after an ignored release (ms). */
const AIM_HINT_MS = 2200;

/** Shown for a moment after a fast release was ignored because the aim was still moving. */
export const useAimHint = create<{ visible: boolean }>(() => ({ visible: false }));
let hintTimer: ReturnType<typeof setTimeout> | undefined;

export function flashAimHint() {
  useAimHint.setState({ visible: true });
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => useAimHint.setState({ visible: false }), AIM_HINT_MS);
}

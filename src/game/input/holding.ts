import { useCharge } from './powerMeter';

/** Set by the flick gesture while a finger/mouse is down on the throw layer. */
export const pointerHold = { down: false };

/** True while the player is holding a dart ready to throw (pointer down or charging the meter). */
export function isHolding(): boolean {
  return pointerHold.down || useCharge.getState().start !== null;
}

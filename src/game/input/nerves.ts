import { pressureFor } from '../../engine/ai/pressure';
import type { MatchState } from '../../engine/modes/match';
import { swayAmplitude, swayOffset } from '../../engine/physics/sway';
import { careerSwayScale, currentAi, setAimSway, useGameStore } from '../../store/useGameStore';
import { pointerHold, steadyAim } from './holding';

/**
 * Pressure on the player at the oche, and the sway it puts on their aim.
 * Read every frame by the aim marker and camera, and at release by the throw.
 */

let memo: { match: MatchState | null; pressure: number } = { match: null, pressure: 0 };
/** When the player started aiming this dart (performance.now() ms). */
let aimingSince = 0;

/** Pressure (0–1) on the human player whose turn it is; 0 for the AI, practice or with sway off. */
export function currentPressure(): number {
  const s = useGameStore.getState();
  if (s.screen !== 'game' || !s.match || !s.nerves || currentAi(s) || s.bullUp) return 0;
  if (memo.match !== s.match) memo = { match: s.match, pressure: pressureFor(s.match) };
  return memo.pressure;
}

/** The sway on the player's aim right now (board mm). */
export function currentSway(now = performance.now()): { x: number; y: number } {
  const s = useGameStore.getState();
  if (s.phase !== 'aiming') return { x: 0, y: 0 };
  const pressure = currentPressure();
  if (pressure <= 0) return { x: 0, y: 0 };
  const steadyFor = pointerHold.down ? steadyAim.steadyFor(now) / 1000 : 0;
  const amp =
    swayAmplitude(pressure, s.assist, steadyFor, (now - aimingSince) / 1000) * careerSwayScale(s);
  const m = s.match!;
  const seed = m.leg * 101 + m.current * 13 + s.darts.length + (m.set ?? 0) * 977;
  return swayOffset(now / 1000, amp, seed);
}

// Restart the build-up each time a new dart is aimed, and let the throw use the sway.
useGameStore.subscribe((s, prev) => {
  if (s.phase === 'aiming' && (prev.phase !== 'aiming' || s.darts.length !== prev.darts.length))
    aimingSince = performance.now();
});
setAimSway(() => currentSway());

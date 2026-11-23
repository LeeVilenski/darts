import { create } from 'zustand';
import { IDEAL_FLICK_SPEED } from '../../engine/physics/throwModel';
import { currentAi, useGameStore } from '../../store/useGameStore';
import { meterLevel, SPEED_SPAN } from './meterMath';

export { METER_HALF_PERIOD_MS, meterLevel, sweetBand } from './meterMath';

export const useCharge = create<{ start: number | null }>(() => ({ start: null }));

export function startCharge() {
  const s = useGameStore.getState();
  if (
    s.screen !== 'game' ||
    s.phase !== 'aiming' ||
    currentAi(s) ||
    useCharge.getState().start !== null
  )
    return;
  useCharge.setState({ start: performance.now() });
}

export function releaseCharge() {
  const start = useCharge.getState().start;
  if (start === null) return;
  useCharge.setState({ start: null });
  const level = meterLevel(performance.now() - start);
  const s = useGameStore.getState();
  s.throwDart(s.aim, {
    speed: IDEAL_FLICK_SPEED * (0.3 + SPEED_SPAN * level),
    angle: 0,
    unsteadiness: 0,
    curvature: 0,
  });
}

export function cancelCharge() {
  useCharge.setState({ start: null });
}

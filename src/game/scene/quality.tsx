import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { useGameStore } from '../../store/useGameStore';

export type Tier = 'high' | 'low';

/** Effective render tier (setting, or what auto-detection settled on). */
export const useQualityTier = create<{ auto: Tier }>(() => ({ auto: 'high' }));

export function useTier(): Tier {
  const setting = useGameStore((s) => s.quality);
  const auto = useQualityTier((s) => s.auto);
  return setting === 'auto' ? auto : setting;
}

const WINDOW_S = 2;
const LOW_FPS = 40;

/**
 * Watches frame rate and drops to the low tier (1× pixel ratio, no shadows)
 * after two consecutive slow windows. Never steps back up within a session, to
 * avoid flip-flopping.
 */
export function QualityGovernor() {
  const tier = useTier();
  const setDpr = useThree((s) => s.setDpr);
  const acc = useRef({ time: 0, frames: 0, slow: 0 });

  useEffect(() => {
    setDpr(tier === 'low' ? 1 : Math.min(window.devicePixelRatio, 2));
  }, [tier, setDpr]);

  useFrame((_, delta) => {
    if (useGameStore.getState().quality !== 'auto' || useQualityTier.getState().auto === 'low')
      return;
    const a = acc.current;
    a.time += delta;
    a.frames += 1;
    if (a.time < WINDOW_S) return;
    const fps = a.frames / a.time;
    a.slow = fps < LOW_FPS ? a.slow + 1 : 0;
    a.time = 0;
    a.frames = 0;
    if (a.slow >= 2) useQualityTier.setState({ auto: 'low' });
  });
  return null;
}

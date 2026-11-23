import { useEffect } from 'react';
import { currentAi, useGameStore } from '../../store/useGameStore';
import { cancelCharge, releaseCharge, startCharge } from './powerMeter';

const STEP_MM = 4;
const FINE_STEP_MM = 1;
const isThrowKey = (k: string) => k === ' ' || k === 'Enter';

/** Keyboard play: arrows aim (Shift for fine), hold Space/Enter to charge and release to throw. */
export function useKeyboardControls() {
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return (
        !!el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'BUTTON' ||
          el.isContentEditable)
      );
    };
    const down = (e: KeyboardEvent) => {
      const s = useGameStore.getState();
      if (s.screen !== 'game' || typing(e)) return;
      const step = e.shiftKey ? FINE_STEP_MM : STEP_MM;
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      const d = arrows[e.key];
      if (d) {
        if (s.phase === 'aiming' && !currentAi(s))
          s.setAim({ x: s.aim.x + d[0], y: s.aim.y + d[1] });
        e.preventDefault();
        return;
      }
      if (!isThrowKey(e.key) || e.repeat) return;
      e.preventDefault();
      if (s.phase === 'replay') s.finishReplay();
      else if (s.phase === 'turnOver') s.collectDarts();
      else {
        if (s.phase === 'impact') s.finishImpact();
        startCharge();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (isThrowKey(e.key)) releaseCharge();
      if (e.key === 'Escape') cancelCharge();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
}

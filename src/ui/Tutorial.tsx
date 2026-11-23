import { useEffect, useRef, useState } from 'react';
import { currentAi, useGameStore } from '../store/useGameStore';

const KEY = 'darts.tutorial.v1';
const seen = () => {
  try {
    return localStorage.getItem(KEY) === 'done';
  } catch {
    return false;
  }
};
export function resetTutorial() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * First-run coaching that advances as the player does each step:
 * aim → throw → read the feedback.
 */
export function Tutorial() {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(() => (seen() ? 3 : 0));
  const meter = useGameStore((s) => s.throwControl === 'meter');
  const aiTurn = useGameStore((s) => currentAi(s) !== null);
  const startAim = useRef(useGameStore.getState().aim);

  function done() {
    try {
      localStorage.setItem(KEY, 'done');
    } catch {
      /* ignore */
    }
    setStep(3);
  }

  // The last step clears itself on the next throw, or after a few seconds.
  useEffect(() => {
    if (step !== 2) return;
    const darts = useGameStore.getState().darts.length;
    const t = window.setTimeout(done, 8000);
    const unsub = useGameStore.subscribe((s) => {
      if (s.darts.length !== darts) done();
    });
    return () => {
      window.clearTimeout(t);
      unsub();
    };
  }, [step]);

  useEffect(() => {
    if (step >= 2) return;
    return useGameStore.subscribe((s) => {
      const moved = Math.hypot(s.aim.x - startAim.current.x, s.aim.y - startAim.current.y) > 15;
      if (step === 0 && moved) setStep(1);
      if (s.darts.some((d) => d.landed)) setStep(2);
    });
  }, [step]);

  if (step === 3 || aiTurn) return null;
  const text = [
    'Drag anywhere to move the aim marker. It moves slower than your finger for fine control. (Keyboard: arrow keys.)',
    meter
      ? 'Hold the Throw button and release when the bar is in the green zone.'
      : 'Now flick up and let go. Flick speed is the weight: too hard lands high, too soft lands low. (Keyboard: hold Space, release in the green.)',
    'Nice! The note under the score tells you whether the weight was right. Tilting a flick pushes the dart sideways.',
  ][step];

  return (
    <div className="tutorial" role="status" data-testid="tutorial">
      <div className="tutorial-step">Step {step + 1} of 3</div>
      <p>{text}</p>
      <button
        type="button"
        className="ghost-btn"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={done}
      >
        {step === 2 ? 'Got it' : 'Skip tutorial'}
      </button>
    </div>
  );
}

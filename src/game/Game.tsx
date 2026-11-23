import { Canvas } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { AI_SKILL } from '../engine/ai/skill';
import { currentAi, useGameStore } from '../store/useGameStore';
import { Hud } from '../ui/Hud';
import { Menu } from '../ui/Menu';
import { useThrowGesture } from './input/useThrowGesture';
import { Board } from './scene/Board';
import { CameraDirector } from './scene/CameraDirector';
import { FlyingDart } from './scene/Dart';
import { Heatmap } from './scene/Heatmap';
import { Reticle } from './scene/Reticle';
import { Room } from './scene/Room';

/** How long the camera holds on a landed dart before returning to the oche (ms). */
const IMPACT_HOLD = { cinematic: 1100, reduced: 700, fast: 250 } as const;
/** Pause on an AI turn's result before collecting automatically (ms). */
const AI_TURN_END_HOLD = { normal: 1700, fast: 350 } as const;
const AI_FAST_THINK_MS = 120;

function Darts() {
  const darts = useGameStore((s) => s.darts);
  return darts.map((d) => <FlyingDart key={d.id} dart={d} />);
}

function useImpactHold() {
  const phase = useGameStore((s) => s.phase);
  const camera = useGameStore((s) => s.camera);
  const aiFast = useGameStore((s) => s.aiFast);
  const finishImpact = useGameStore((s) => s.finishImpact);
  useEffect(() => {
    if (phase !== 'impact') return;
    const t = window.setTimeout(finishImpact, aiFast ? IMPACT_HOLD.fast : IMPACT_HOLD[camera]);
    return () => window.clearTimeout(t);
  }, [phase, camera, aiFast, finishImpact]);
}

/** Plays AI turns: think, throw, and collect the darts once the turn is over. */
function useAiTurns() {
  const phase = useGameStore((s) => s.phase);
  const match = useGameStore((s) => s.match);
  const screen = useGameStore((s) => s.screen);
  const aiFast = useGameStore((s) => s.aiFast);
  const level = useGameStore(currentAi);
  useEffect(() => {
    if (screen !== 'game' || !match || !level) return;
    let t: number | undefined;
    if (phase === 'aiming' && match.status === 'open') {
      const [lo, hi] = AI_SKILL[level].thinkMs;
      const delay = aiFast ? AI_FAST_THINK_MS : lo + Math.random() * (hi - lo);
      t = window.setTimeout(() => useGameStore.getState().aiThrow(), delay);
    } else if (phase === 'turnOver' && match.status !== 'matchWon') {
      t = window.setTimeout(
        () => useGameStore.getState().collectDarts(),
        aiFast ? AI_TURN_END_HOLD.fast : AI_TURN_END_HOLD.normal,
      );
    }
    return () => window.clearTimeout(t);
  }, [phase, match, screen, level, aiFast]);
}

export default function Game() {
  const screen = useGameStore((s) => s.screen);
  const input = useRef<HTMLDivElement>(null);
  useThrowGesture(input);
  useImpactHold();
  useAiTurns();
  return (
    <div className="game">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }} camera={{ fov: 20 }}>
        <CameraDirector />
        <Room />
        <Board />
        {screen === 'game' && (
          <>
            <Reticle />
            <Darts />
            <Heatmap />
          </>
        )}
      </Canvas>
      <div ref={input} className="input-layer" data-testid="input-layer" />
      {screen === 'game' ? <Hud /> : <Menu />}
    </div>
  );
}

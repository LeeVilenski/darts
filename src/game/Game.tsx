import { Canvas } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Hud } from '../ui/Hud';
import { Menu } from '../ui/Menu';
import { useThrowGesture } from './input/useThrowGesture';
import { Board } from './scene/Board';
import { CameraDirector } from './scene/CameraDirector';
import { FlyingDart } from './scene/Dart';
import { Reticle } from './scene/Reticle';
import { Room } from './scene/Room';

/** How long the camera holds on a landed dart before returning to the oche (ms). */
const IMPACT_HOLD = { cinematic: 1100, reduced: 700 } as const;

function Darts() {
  const darts = useGameStore((s) => s.darts);
  return darts.map((d) => <FlyingDart key={d.id} dart={d} />);
}

function useImpactHold() {
  const phase = useGameStore((s) => s.phase);
  const camera = useGameStore((s) => s.camera);
  const finishImpact = useGameStore((s) => s.finishImpact);
  useEffect(() => {
    if (phase !== 'impact') return;
    const t = window.setTimeout(finishImpact, IMPACT_HOLD[camera]);
    return () => window.clearTimeout(t);
  }, [phase, camera, finishImpact]);
}

export default function Game() {
  const screen = useGameStore((s) => s.screen);
  const input = useRef<HTMLDivElement>(null);
  useThrowGesture(input);
  useImpactHold();
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
          </>
        )}
      </Canvas>
      <div ref={input} className="input-layer" data-testid="input-layer" />
      {screen === 'game' ? <Hud /> : <Menu />}
    </div>
  );
}

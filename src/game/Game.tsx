import { Canvas } from '@react-three/fiber';
import { useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Hud } from '../ui/Hud';
import { useThrowGesture } from './input/useThrowGesture';
import { Board } from './scene/Board';
import { CameraRig } from './scene/CameraRig';
import { FlyingDart } from './scene/Dart';
import { Reticle } from './scene/Reticle';
import { Room } from './scene/Room';

function Darts() {
  const darts = useGameStore((s) => s.darts);
  return darts.map((d) => <FlyingDart key={d.id} dart={d} />);
}

export default function Game() {
  const input = useRef<HTMLDivElement>(null);
  useThrowGesture(input);
  return (
    <div className="game">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }} camera={{ fov: 20 }}>
        <CameraRig />
        <Room />
        <Board />
        <Reticle />
        <Darts />
      </Canvas>
      <div ref={input} className="input-layer" data-testid="input-layer" />
      <Hud />
    </div>
  );
}

import { useEffect, useMemo } from 'react';
import { BOARD, STICK_RADIUS, WORLD } from '../../engine/board/geometry';
import { useGameStore } from '../../store/useGameStore';
import { createBoardTexture, createSisalBump } from './boardTexture';
import { BoardWires } from './BoardWires';

const R = BOARD.boardRadius / 1000;
const DEPTH = 0.038;

/** Procedural board: textured face at z = 0 plus a sisal-coloured edge and a foam surround. */
export function Board() {
  const palette = useGameStore((s) => s.palette);
  const texture = useMemo(() => createBoardTexture(palette), [palette]);
  useEffect(() => () => texture.dispose(), [texture]);
  const bump = useMemo(() => createSisalBump(), []);
  useEffect(() => () => bump.dispose(), [bump]);

  return (
    <group position={[0, WORLD.bullHeight, 0]}>
      <mesh receiveShadow position={[0, 0, 0]}>
        <circleGeometry args={[R, 128]} />
        <meshStandardMaterial
          map={texture}
          bumpMap={bump}
          bumpScale={3}
          roughness={0.92}
          metalness={0}
        />
      </mesh>
      <BoardWires />
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -DEPTH / 2]}>
        <cylinderGeometry args={[R, R, DEPTH, 128, 1, true]} />
        <meshStandardMaterial color="#0f0f0f" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Foam surround: darts outside the board stick here. */}
      <mesh receiveShadow position={[0, 0, -0.012]}>
        <circleGeometry args={[0.42, 96]} />
        <meshStandardMaterial color="#141418" roughness={1} />
      </mesh>
    </group>
  );
}

export { STICK_RADIUS };

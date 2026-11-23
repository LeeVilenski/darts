import { useEffect, useMemo } from 'react';
import { BOARD, WORLD } from '../../engine/board/geometry';
import { createBoardTexture } from './boardTexture';

const R = BOARD.boardRadius / 1000;
const DEPTH = 0.038;

/** Procedural board: textured face at z = 0 plus a sisal-coloured edge and a foam surround. */
export function Board() {
  const texture = useMemo(() => createBoardTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group position={[0, WORLD.bullHeight, 0]}>
      <mesh receiveShadow position={[0, 0, 0]}>
        <circleGeometry args={[R, 128]} />
        <meshStandardMaterial map={texture} roughness={0.85} metalness={0} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -DEPTH / 2]}>
        <cylinderGeometry args={[R, R, DEPTH, 128, 1, true]} />
        <meshStandardMaterial color="#1a1612" roughness={0.9} />
      </mesh>
      {/* Foam surround: darts outside the board stick here. */}
      <mesh receiveShadow position={[0, 0, -0.012]}>
        <circleGeometry args={[0.42, 96]} />
        <meshStandardMaterial color="#141418" roughness={1} />
      </mesh>
    </group>
  );
}

/** Radius (m) from bull within which a dart sticks on the board plane (board + surround). */
export const STICK_RADIUS = 0.42;

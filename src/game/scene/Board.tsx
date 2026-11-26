import { useEffect, useMemo } from 'react';
import { LatheGeometry, Vector2 } from 'three';
import { BOARD, STICK_RADIUS, WORLD } from '../../engine/board/geometry';
import { useGameStore } from '../../store/useGameStore';
import { createBoardTexture, createSisalBump } from './boardTexture';
import { BoardWires } from './BoardWires';

const R = BOARD.boardRadius / 1000;
const DEPTH = 0.038;
/** Outer radius of the surround (m): darts stick anywhere on it (engine STICK_RADIUS). */
const SURROUND_R = STICK_RADIUS;

/**
 * Surround as a lathed, cushioned ring: it rises from just behind the board's
 * edge, rolls over a rounded lip, and tucks back toward the cabinet, so the
 * lamp shades it and it reads as a raised object rather than a flat disc.
 */
const surroundGeometry = (() => {
  const pts: Vector2[] = [];
  const inner = R - 0.002;
  const lip = 0.012; // radius of the rounded inner and outer edges
  const top = 0.006; // face height relative to the board face
  pts.push(new Vector2(inner, -0.02));
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI - (i / 8) * (Math.PI / 2); // inner roll: 180° -> 90°
    pts.push(new Vector2(inner + lip + Math.cos(a) * lip, top - lip + Math.sin(a) * lip));
  }
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI / 2 - (i / 8) * (Math.PI / 2); // outer roll: 90° -> 0°
    pts.push(new Vector2(SURROUND_R - lip + Math.cos(a) * lip, top - lip + Math.sin(a) * lip));
  }
  pts.push(new Vector2(SURROUND_R, -0.03));
  // Outer-to-inner order makes the lathe's faces point toward the viewer.
  const g = new LatheGeometry(pts.reverse(), 128);
  g.rotateX(Math.PI / 2); // lathe axis Y -> board normal Z
  return g;
})();

/** Procedural board: textured face at z = 0, a dark rim, and a cushioned surround. */
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
      {/* Cushioned surround: darts outside the board stick here. */}
      <mesh geometry={surroundGeometry} receiveShadow castShadow>
        <meshStandardMaterial color="#45111a" roughness={0.82} bumpMap={bump} bumpScale={0.6} />
      </mesh>
    </group>
  );
}

export { STICK_RADIUS };

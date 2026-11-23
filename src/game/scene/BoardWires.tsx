import { useEffect, useMemo } from 'react';
import { CylinderGeometry, TorusGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BOARD, RING_WIRES, SECTORS, SECTOR_ANGLE } from '../../engine/board/geometry';

/** Round wire, ~1.2 mm thick, half proud of the board face. */
const WIRE_RADIUS = 0.0006;
const mm = (v: number) => v / 1000;

/**
 * The metal spider as real geometry, from the same dimensions the scoring uses:
 * ring wires (bulls, treble, double) and the 20 radial wires. Catches the lamp
 * and the environment, and casts tiny shadows, which is most of what makes a
 * board read as 3D.
 */
export function BoardWires() {
  const geometry = useMemo(() => {
    const parts: BufferGeometry[] = [];
    for (const r of RING_WIRES) {
      parts.push(new TorusGeometry(mm(r), WIRE_RADIUS, 6, Math.max(48, Math.round(r * 2))));
    }
    const len = mm(BOARD.doubleOuter - BOARD.outerBull);
    const mid = mm((BOARD.doubleOuter + BOARD.outerBull) / 2);
    SECTORS.forEach((_, i) => {
      const a = ((i * SECTOR_ANGLE - SECTOR_ANGLE / 2) * Math.PI) / 180;
      const g = new CylinderGeometry(WIRE_RADIUS, WIRE_RADIUS, len, 6, 1, true);
      // Cylinder runs along +Y; rotate to the sector boundary (clock angle, clockwise from 12).
      g.rotateZ(-a);
      g.translate(Math.sin(a) * mid, Math.cos(a) * mid, 0);
      parts.push(g);
    });
    const merged = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    merged.translate(0, 0, WIRE_RADIUS * 0.4);
    return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#d6d6d6" metalness={1} roughness={0.28} envMapIntensity={1.4} />
    </mesh>
  );
}

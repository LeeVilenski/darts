import { useEffect, useMemo } from 'react';
import { CylinderGeometry, SphereGeometry, TorusGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BOARD, RING_WIRES, SECTORS, SECTOR_ANGLE } from '../../engine/board/geometry';
import { numberStrokesMm } from './wireNumbers';

/** Round wire, ~1.2 mm thick, half proud of the board face. */
const WIRE_RADIUS = 0.0006;
const mm = (v: number) => v / 1000;
/** Number wire is a little heavier than the spider. */
const NUMBER_WIRE_RADIUS = 0.001;

/** A bent-wire stroke: a cylinder per segment plus a ball at each joint so bends are rounded. */
function strokeGeometry(points: [number, number][], radius: number): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i]!;
    const joint = new SphereGeometry(radius, 6, 4);
    joint.translate(mm(x), mm(y), 0);
    parts.push(joint);
    if (i === 0) continue;
    const [px, py] = points[i - 1]!;
    const len = mm(Math.hypot(x - px, y - py));
    if (len < 1e-6) continue;
    const seg = new CylinderGeometry(radius, radius, len, 6, 1, true);
    seg.rotateZ(-Math.atan2(x - px, y - py));
    seg.translate(mm((x + px) / 2), mm((y + py) / 2), 0);
    parts.push(seg);
  }
  return parts;
}

/**
 * The metal spider as real geometry, from the same dimensions the scoring uses:
 * ring wires (bulls, treble, double) and the 20 radial wires. Catches the lamp
 * and the environment, and casts tiny shadows, which is most of what makes a
 * board read as 3D. The numbers are bent wire too, as on a real board.
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
    for (const stroke of numberStrokesMm())
      parts.push(...strokeGeometry(stroke, NUMBER_WIRE_RADIUS));
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

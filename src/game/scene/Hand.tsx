import { CapsuleGeometry, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import type { MeshStandardMaterial } from 'three';
import { DART } from '../../engine/board/geometry';

/**
 * A right hand: palm, four jointed fingers and a thumb. (Mirror it in x for a
 * left hand.)
 *
 * Hand-local frame, right-handed, origin at the wrist: +Y runs toward the
 * knuckles, +Z is the way the palm faces, and +X = Y × Z is the thumb side —
 * as for a real right hand held up with its palm away from you. Fingers curl in
 * their own Y–Z plane, toward the palm.
 *
 * The throwing grip is a darts player's: palm toward the board, the dart
 * pointing forward (+Z) alongside the forefinger, its barrel pinched between
 * the side of the forefinger and the thumb, above the palm so nothing passes
 * through the hand. The middle finger curls under, the ring and little fingers
 * tuck away.
 */

export type HandPose = 'pinch' | 'relaxed';
type Curl = readonly [number, number, number];

export interface FingerSpec {
  /** Knuckle position (hand-local). */
  x: number;
  y: number;
  z: number;
  /** Segment lengths, base → tip. */
  len: readonly [number, number, number];
  r: number;
}
/** Forefinger nearest the thumb (+X), little finger furthest (-X). */
export const FINGERS: readonly FingerSpec[] = [
  { x: 0.0175, y: 0.082, z: 0.004, len: [0.027, 0.019, 0.017], r: 0.0082 }, // fore
  { x: 0.0058, y: 0.085, z: 0.004, len: [0.03, 0.021, 0.018], r: 0.0084 }, // middle
  { x: -0.0058, y: 0.083, z: 0.004, len: [0.028, 0.02, 0.017], r: 0.008 }, // ring
  { x: -0.0168, y: 0.077, z: 0.004, len: [0.022, 0.016, 0.015], r: 0.0072 }, // little
];

export const POSES: Record<HandPose, { curls: readonly Curl[]; spread: readonly number[] }> = {
  pinch: {
    curls: [
      [0.4, 0.6, 0.4], // forefinger forward along the barrel
      [0.8, 1.0, 0.65], // middle finger curled under
      [1.35, 1.4, 0.9], // ring and little fingers tucked away
      [1.45, 1.4, 0.95],
    ],
    // Rotation about Z: positive splays a finger away from the thumb (toward -X).
    spread: [0, 0, 0.05, 0.12],
  },
  relaxed: {
    curls: [
      [0.28, 0.32, 0.2],
      [0.32, 0.36, 0.22],
      [0.38, 0.4, 0.25],
      [0.45, 0.45, 0.28],
    ],
    spread: [-0.05, 0, 0.04, 0.09],
  },
};

/** Joint positions of an unspread finger (hand-local), knuckle first, and its last segment's angle. */
export function fingerJoints(f: FingerSpec, c: Curl): { points: Vector3[]; angle: number } {
  let y = f.y;
  let z = f.z;
  let angle = 0;
  const points = [new Vector3(f.x, y, z)];
  for (let i = 0; i < 3; i++) {
    angle += c[i]!;
    y += f.len[i]! * Math.cos(angle);
    z += f.len[i]! * Math.sin(angle);
    points.push(new Vector3(f.x, y, z));
  }
  return { points, angle };
}

export const BARREL_R = DART.barrelRadius / 1000;

/**
 * Where the dart's barrel is pinched (hand-local): against the thumb side of
 * the forefinger's middle joint, the dart pointing along +Z. Derived from the
 * finger geometry, so the barrel rests on the finger rather than in it.
 */
export const PINCH_POINT = (() => {
  const fore = FINGERS[0]!;
  const { points } = fingerJoints(fore, POSES.pinch.curls[0]!);
  const mid = points[1]!.clone().lerp(points[2]!, 0.5);
  return mid.add(new Vector3(fore.r * 0.92 + BARREL_R, 0, 0));
})();

/** Thumb: from the heel of the hand round to the barrel's outer side, opposite the forefinger. */
export const THUMB = (() => {
  const base = new Vector3(0.025, 0.034, 0.016);
  const r = 0.0105;
  const tip = PINCH_POINT.clone().add(new Vector3(BARREL_R + r * 0.8, -0.003, 0.004));
  const dir = tip.clone().sub(base);
  const len = dir.length();
  return {
    base,
    tip,
    r,
    seg: [len * 0.55, len * 0.45] as const,
    quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()),
  };
})();

const geoCache = new Map<string, CapsuleGeometry>();
/** A capsule growing from its base along +Y, `len` metres end to end. */
const capsule = (r: number, len: number) => {
  const k = `${r}:${len}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new CapsuleGeometry(r, Math.max(0.001, len - r), 6, 10);
    g.translate(0, len / 2, 0);
    geoCache.set(k, g);
  }
  return g;
};
const palmGeo = new SphereGeometry(1, 20, 14);

function Finger({
  f,
  curls,
  material,
}: {
  f: FingerSpec;
  curls: Curl;
  material: MeshStandardMaterial;
}) {
  // Nested joints: each segment bends toward the palm (+Z) about X.
  const [a, b, c] = f.len;
  return (
    <group rotation={[curls[0], 0, 0]}>
      <mesh geometry={capsule(f.r, a)} material={material} />
      <group position={[0, a, 0]} rotation={[curls[1], 0, 0]}>
        <mesh geometry={capsule(f.r * 0.94, b)} material={material} />
        <group position={[0, b, 0]} rotation={[curls[2], 0, 0]}>
          <mesh geometry={capsule(f.r * 0.88, c)} material={material} />
        </group>
      </group>
    </group>
  );
}

export function Hand({ pose, material }: { pose: HandPose; material: MeshStandardMaterial }) {
  const p = POSES[pose];
  return (
    <>
      {/* Wrist and palm */}
      <mesh geometry={capsule(0.024, 0.03)} material={material} scale={[1.25, 1, 0.8]} />
      <mesh
        geometry={palmGeo}
        material={material}
        position={[0, 0.048, 0.002]}
        scale={[0.04, 0.045, 0.017]}
      />
      {/* Fingers */}
      {FINGERS.map((f, i) => (
        <group key={i} position={[f.x, f.y, f.z]} rotation={[0, 0, p.spread[i]!]}>
          <Finger f={f} curls={p.curls[i]!} material={material} />
        </group>
      ))}
      {/* Thumb (on +X) */}
      {pose === 'pinch' ? (
        <group position={THUMB.base} quaternion={THUMB.quaternion}>
          <mesh geometry={capsule(THUMB.r, THUMB.seg[0])} material={material} />
          <group position={[0, THUMB.seg[0], 0]}>
            <mesh geometry={capsule(THUMB.r * 0.9, THUMB.seg[1])} material={material} />
          </group>
        </group>
      ) : (
        <group position={[0.024, 0.03, 0.01]} rotation={[0.35, 0.25, -0.15]} rotation-order="YXZ">
          <mesh geometry={capsule(0.0105, 0.032)} material={material} />
          <group position={[0, 0.032, 0]} rotation={[0.25, 0, 0]}>
            <mesh geometry={capsule(0.0095, 0.026)} material={material} />
          </group>
        </group>
      )}
    </>
  );
}

/** Right-handed basis → quaternion (x = y × z). */
function basis(y: Vector3, z: Vector3, out: Quaternion) {
  const x = new Vector3().crossVectors(y, z);
  return out.setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}

/**
 * Orientation for a hand whose fingers run along `along` with the palm facing
 * `palm` (both world directions; `palm` needn't be exactly perpendicular).
 */
export function handQuaternion(along: Vector3, palm: Vector3, out = new Quaternion()): Quaternion {
  const y = along.clone().normalize();
  const z = palm.clone().addScaledVector(y, -palm.dot(y));
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(y, -y.z);
  return basis(y, z.normalize(), out);
}

/**
 * Orientation for the throwing hand: fingers along the forearm (`along`), palm
 * toward where the dart points (`dart`). The dart is held square to the
 * forearm, along the palm's facing; that direction is written into `held`.
 */
export function gripQuaternion(
  along: Vector3,
  dart: Vector3,
  out: Quaternion,
  held: Vector3,
): Quaternion {
  const y = along.clone().normalize();
  held.copy(dart).addScaledVector(y, -dart.dot(y));
  if (held.lengthSq() < 1e-8) held.set(0, 0, -1).addScaledVector(y, y.z);
  held.normalize();
  return basis(y, held, out);
}

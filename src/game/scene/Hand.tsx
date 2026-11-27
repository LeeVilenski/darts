import { CapsuleGeometry, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import type { MeshStandardMaterial } from 'three';

/**
 * A hand: palm, four jointed fingers and a thumb. Hand-local frame, origin at
 * the wrist: +Y runs toward the knuckles, +Z is the way the palm faces, and the
 * thumb is on -X (a right hand; mirror x for a left hand).
 */

/** Finger joint curls toward the palm (rad), base → tip, for index, middle, ring, little. */
type Curls = [number, number, number][];
export type HandPose = 'pinch' | 'relaxed';

const FINGERS = [
  // x at the knuckle, knuckle height, segment lengths (base → tip), radius
  { x: -0.0175, y: 0.082, len: [0.027, 0.019, 0.017], r: 0.0082 },
  { x: -0.0058, y: 0.085, len: [0.03, 0.021, 0.018], r: 0.0084 },
  { x: 0.0058, y: 0.083, len: [0.028, 0.02, 0.017], r: 0.008 },
  { x: 0.0168, y: 0.077, len: [0.022, 0.016, 0.015], r: 0.0072 },
] as const;

const POSES: Record<HandPose, { curls: Curls; spread: number[]; thumb: [number, number, number] }> =
  {
    // Index and middle reach forward over the barrel, the others tuck in;
    // the thumb comes round underneath to pinch.
    pinch: {
      curls: [
        [0.55, 0.75, 0.45],
        [0.6, 0.7, 0.45],
        [1.25, 1.35, 0.85],
        [1.35, 1.4, 0.9],
      ],
      spread: [-0.06, 0, 0.05, 0.12],
      thumb: [0.4, 0, -0.15],
    },
    relaxed: {
      curls: [
        [0.28, 0.32, 0.2],
        [0.32, 0.36, 0.22],
        [0.38, 0.4, 0.25],
        [0.45, 0.45, 0.28],
      ],
      spread: [-0.05, 0, 0.04, 0.09],
      thumb: [0.35, -0.25, 0.15],
    },
  };

/** Where a pinched dart sits, between the thumb and index fingertips (hand-local). */
export const PINCH_POINT = new Vector3(-0.014, 0.1, 0.002);

const geoCache = new Map<string, CapsuleGeometry | SphereGeometry>();
const capsule = (r: number, len: number) => {
  const k = `c${r}:${len}`;
  let g = geoCache.get(k) as CapsuleGeometry | undefined;
  if (!g) {
    g = new CapsuleGeometry(r, Math.max(0.001, len - r), 6, 10);
    g.translate(0, len / 2, 0); // grows from its base along +Y
    geoCache.set(k, g);
  }
  return g;
};
const palmGeo = new SphereGeometry(1, 20, 14);

function Finger({
  len,
  r,
  curls,
  material,
}: {
  len: readonly number[];
  r: number;
  curls: [number, number, number];
  material: MeshStandardMaterial;
}) {
  // Nested joints: each segment bends toward the palm (+Z) about X.
  const [a, b, c] = len;
  return (
    <group rotation={[curls[0], 0, 0]}>
      <mesh geometry={capsule(r, a!)} material={material} />
      <group position={[0, a!, 0]} rotation={[curls[1], 0, 0]}>
        <mesh geometry={capsule(r * 0.94, b!)} material={material} />
        <group position={[0, b!, 0]} rotation={[curls[2], 0, 0]}>
          <mesh geometry={capsule(r * 0.88, c!)} material={material} />
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
        <group key={i} position={[f.x, f.y, 0.004]} rotation={[0, 0, p.spread[i]!]}>
          <Finger len={f.len} r={f.r} curls={p.curls[i]!} material={material} />
        </group>
      ))}
      {/* Thumb: from the heel of the hand, round toward the fingertips */}
      <group position={[-0.024, 0.03, 0.01]} rotation={p.thumb} rotation-order="YXZ">
        <mesh geometry={capsule(0.0105, 0.032)} material={material} />
        <group position={[0, 0.032, 0]} rotation={[0.25, 0, 0]}>
          <mesh geometry={capsule(0.0095, 0.026)} material={material} />
        </group>
      </group>
    </>
  );
}

/**
 * Orientation for a hand whose fingers run along `along` with the palm facing
 * `palm` (both world directions; `palm` needn't be exactly perpendicular).
 */
export function handQuaternion(along: Vector3, palm: Vector3, out = new Quaternion()): Quaternion {
  const y = along.clone().normalize();
  const z = palm.clone().addScaledVector(y, -palm.dot(y));
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(y, -y.z);
  z.normalize();
  const x = new Vector3().crossVectors(y, z);
  return out.setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}

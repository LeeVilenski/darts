import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  CylinderGeometry,
  ConeGeometry,
  DoubleSide,
  Group,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three';
import { WORLD } from '../../engine/board/geometry';
import { GRAVITY, sampleFlight, type Vec3 } from '../../engine/physics/ballistics';
import { useGameStore, type ThrownDart } from '../../store/useGameStore';
import { STICK_RADIUS } from './Board';
import { dartTracker } from './dartTracker';

// Shared geometry/materials. Dart tip at local origin, body along -Z.
const TIP_LEN = 0.032;
const BARREL_LEN = 0.045;
const SHAFT_LEN = 0.035;
const FLIGHT_LEN = 0.036;

const along = <T extends CylinderGeometry | ConeGeometry>(g: T, centerZ: number) => {
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, centerZ);
  return g;
};
const tipGeo = along(new ConeGeometry(0.0012, TIP_LEN, 12), -TIP_LEN / 2);
const barrelGeo = along(
  new CylinderGeometry(0.0034, 0.0028, BARREL_LEN, 20),
  -TIP_LEN - BARREL_LEN / 2,
);
const shaftGeo = along(
  new CylinderGeometry(0.0017, 0.0017, SHAFT_LEN, 12),
  -TIP_LEN - BARREL_LEN - SHAFT_LEN / 2,
);
const flightGeo = (() => {
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(0.014, 0.012);
  s.lineTo(0.014, FLIGHT_LEN);
  s.lineTo(0, FLIGHT_LEN - 0.004);
  s.lineTo(-0.014, FLIGHT_LEN);
  s.lineTo(-0.014, 0.012);
  s.closePath();
  const g = new ShapeGeometry(s);
  g.rotateX(Math.PI / 2); // shape +Y -> -Z (toward the tail)
  g.translate(0, 0, -TIP_LEN - BARREL_LEN - SHAFT_LEN + 0.012);
  return g;
})();

const steel = new MeshStandardMaterial({ color: '#d8d8d8', metalness: 1, roughness: 0.25 });
const tungsten = new MeshStandardMaterial({ color: '#6c7076', metalness: 0.9, roughness: 0.35 });
const shaftMat = new MeshStandardMaterial({ color: '#111', roughness: 0.4 });
const flightMat = new MeshStandardMaterial({ color: '#ff6a00', side: DoubleSide, roughness: 0.6 });

export function DartModel() {
  return (
    <>
      <mesh geometry={tipGeo} material={steel} castShadow />
      <mesh geometry={barrelGeo} material={tungsten} castShadow />
      <mesh geometry={shaftGeo} material={shaftMat} castShadow />
      <mesh geometry={flightGeo} material={flightMat} castShadow />
      <mesh geometry={flightGeo} material={flightMat} rotation={[0, 0, Math.PI / 2]} castShadow />
    </>
  );
}

const FORWARD = new Vector3(0, 0, 1);
const tmpDir = new Vector3();
const tmpQ = new Quaternion();
const axisX = new Vector3(1, 0, 0);
const axisZ = new Vector3(0, 0, 1);
const EMBED = 0.007;

type After = 'stick' | 'bounce' | 'floor';

interface FlyingDartProps {
  dart: ThrownDart;
  /** Playback speed (slow-motion replays use < 1). */
  timeScale?: number;
  /** Called once when the flight reaches the board/floor. Defaults to reporting the landing to the store. */
  onLanded?: () => void;
  /** Id written to the camera tracker while flying (replays use their own). */
  trackerId?: number;
  hidden?: boolean;
  /** Start from the beginning even if the dart already landed (replays). */
  replay?: boolean;
}

/** One thrown dart: plays its precomputed flight, then sticks, bounces out or lies on the floor. */
export function FlyingDart({
  dart,
  timeScale = 1,
  onLanded,
  trackerId,
  hidden,
  replay,
}: FlyingDartProps) {
  const ref = useRef<Group>(null);
  const clock = useRef(dart.landed && !replay ? Infinity : 0);
  const reported = useRef(dart.landed && !replay);
  const landDart = useGameStore((s) => s.landDart);

  const after: After = useMemo(() => {
    const imp = dart.flight.impact;
    if (!imp) return 'floor';
    if (dart.result.kind === 'bounce') return 'bounce';
    const r = Math.hypot(imp.x, imp.y - WORLD.bullHeight);
    return r <= STICK_RADIUS ? 'stick' : 'floor';
  }, [dart]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    clock.current += Math.min(delta, 1 / 20) * timeScale;
    const t = clock.current;
    const { flight, launch } = dart;
    const T = flight.duration;

    if (t < T) {
      const s = sampleFlight(flight, t);
      orient(
        g,
        s.p,
        s.v,
        launch.wobble.amplitude *
          Math.exp(-launch.wobble.damping * t) *
          Math.sin(2 * Math.PI * launch.wobble.frequency * t),
        launch.spin * t,
      );
      dartTracker.id = trackerId ?? dart.id;
      dartTracker.position.set(s.p.x, s.p.y, s.p.z);
      return;
    }

    if (!reported.current) {
      reported.current = true;
      if (onLanded) onLanded();
      else landDart(dart.id);
    }

    const end = flight.samples[flight.samples.length - 1]!;
    if (after === 'stick') {
      const v = flight.impactVelocity ?? end.v;
      const len = Math.hypot(v.x, v.y, v.z);
      const p = {
        x: end.p.x + (v.x / len) * EMBED,
        y: end.p.y + (v.y / len) * EMBED,
        z: end.p.z + (v.z / len) * EMBED,
      };
      orient(g, p, v, 0, launch.spin * T);
      return;
    }

    // Bounce-out or a dart that missed everything: drop to the floor.
    const tb = Math.min(t - T, 1.2);
    const v0 =
      after === 'bounce'
        ? { x: end.v.x * 0.05, y: 0.3, z: 0.6 }
        : { x: end.v.x * 0.3, y: end.v.y * 0.3, z: 0.2 };
    const y = Math.max(0.01, end.p.y + v0.y * tb - 0.5 * GRAVITY * tb * tb);
    const p = { x: end.p.x + v0.x * tb, y, z: end.p.z + v0.z * tb + 0.02 };
    if (y <= 0.01) {
      g.position.set(p.x, 0.004, p.z);
      g.quaternion.setFromAxisAngle(axisX, Math.PI / 2 - 0.05);
    } else {
      orient(g, p, { x: v0.x, y: v0.y - GRAVITY * tb, z: v0.z }, tb * 12, 0);
    }
  });

  return (
    <group
      ref={ref}
      visible={!hidden}
      position={[dart.launch.p0.x, dart.launch.p0.y, dart.launch.p0.z]}
    >
      <DartModel />
    </group>
  );
}

function orient(g: Group, p: Vec3, v: Vec3, wobble: number, roll: number) {
  g.position.set(p.x, p.y, p.z);
  tmpDir.set(v.x, v.y, v.z).normalize();
  g.quaternion.setFromUnitVectors(FORWARD, tmpDir);
  g.quaternion.multiply(tmpQ.setFromAxisAngle(axisX, wobble));
  g.quaternion.multiply(tmpQ.setFromAxisAngle(axisZ, roll));
}

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { WORLD } from '../../engine/board/geometry';
import { currentAi, currentAiIntent, useGameStore } from '../../store/useGameStore';
import { DartModel } from './Dart';
import { dartTracker, throwerClock } from './dartTracker';
import { useTier } from './quality';
import {
  ELBOW,
  elbowAt,
  FACE,
  FOREARM,
  gripAt,
  GRIP_BACK,
  holdsDart,
  JOINTS,
  WINDUP_S,
} from './throwerPose';

/** Shirt colour per seat at the oche. */
const SHIRTS = ['#2a5db0', '#b8322a', '#2f7d4f', '#7a3fa0'] as const;
/** Replays start this far (sim seconds) before release, so you see the throw. */
export const REPLAY_LEAD_S = WINDUP_S * 0.75;
/** The dart points this much above the line to its target (rad). */
const LOFT = 0.09;

const UP = new Vector3(0, 1, 0);
const HAIR_POS = JOINTS.head.clone().add(JOINTS.hairOffset);
const FORWARD = new Vector3(0, 0, 1);
const skin = new MeshStandardMaterial({ color: '#d29b78', roughness: 0.75 });
const hair = new MeshStandardMaterial({ color: '#2a1c12', roughness: 0.9 });
const trousers = new MeshStandardMaterial({ color: '#1c1d24', roughness: 0.85 });
const shoes = new MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.5 });
const shirtMats = SHIRTS.map((c) => new MeshStandardMaterial({ color: c, roughness: 0.8 }));

/** A capsule (along +Y) spanning `len` metres end to end. */
const capsule = (r: number, len: number) =>
  new CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 6, 14);
const headGeo = new SphereGeometry(0.098, 24, 18);
const hairGeo = new SphereGeometry(0.104, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
const handGeo = new SphereGeometry(0.036, 14, 10);
const noseGeo = new SphereGeometry(0.018, 10, 8);
const earGeo = new SphereGeometry(0.022, 10, 8);

/** Point a capsule mesh from a to b (its geometry already has the right length). */
function placeLimb(m: Mesh, a: Vector3, b: Vector3) {
  m.position.lerpVectors(a, b, 0.5);
  m.quaternion.setFromUnitVectors(UP, new Vector3().subVectors(b, a).normalize());
}

function Limb({
  a,
  b,
  r,
  material,
  shadow,
}: {
  a: Vector3;
  b: Vector3;
  r: number;
  material: MeshStandardMaterial;
  shadow: boolean;
}) {
  const geo = useMemo(() => capsule(r, a.distanceTo(b) + 2 * r * 0.6), [a, b, r]);
  return (
    <mesh
      ref={(m) => {
        if (m) placeLimb(m, a, b);
      }}
      geometry={geo}
      material={material}
      castShadow={shadow}
    />
  );
}

const tip = new Vector3();
const grip = new Vector3();
const elbow = new Vector3();
const dir = new Vector3();
const right = new Vector3();
const target = new Vector3();
const loftQ = new Quaternion();
const rollQ = new Quaternion();

/**
 * The player at the oche, seen on AI turns (from the opponent's spot beside the
 * oche) and in replays. The throwing arm animates a draw-back, drive and
 * follow-through timed so the dart leaves the hand exactly as its flight starts.
 * Hidden on your own live turns: you're the one throwing.
 */
export function Thrower() {
  const root = useRef<Group>(null);
  const upper = useRef<Mesh>(null);
  const fore = useRef<Mesh>(null);
  const hand = useRef<Mesh>(null);
  const dart = useRef<Group>(null);
  const torso = useRef<Mesh>(null);
  const shoulders = useRef<Mesh>(null);
  const shadows = useTier() === 'high';
  const seat = useRef(-1);

  const J = JOINTS;
  const geo = useMemo(() => {
    const torsoTop = J.chest.clone().lerp(J.neck, 0.4);
    return {
      torsoTop,
      torso: capsule(0.14, J.hips.distanceTo(torsoTop) + 0.2),
      shoulders: capsule(0.075, J.shoulderL.distanceTo(J.shoulderR) + 0.09),
      upper: capsule(0.046, J.shoulderR.distanceTo(ELBOW) + 0.05),
      fore: capsule(0.038, FOREARM + 0.03),
    };
  }, [J]);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const s = useGameStore.getState();
    let tl: number | null = null;
    target.set(0, WORLD.bullHeight, 0);
    if (s.screen === 'game') {
      const replayDart =
        s.phase === 'replay' && s.replay ? s.darts.find((d) => d.id === s.replay!.dartId) : null;
      if (replayDart) {
        tl = dartTracker.id === -replayDart.id ? dartTracker.time : -REPLAY_LEAD_S;
        const imp = replayDart.flight.impact;
        if (imp) target.set(imp.x, imp.y, 0);
      } else if (currentAi(s)) {
        tl = (performance.now() - throwerClock.releaseAt) / 1000;
        const intent = currentAiIntent(s);
        if (intent)
          target.set(
            intent.target.point.x / 1000,
            WORLD.bullHeight + intent.target.point.y / 1000,
            0,
          );
      }
    }
    g.visible = tl !== null;
    if (tl === null) return;

    // Shirt colour of whoever is throwing.
    const who = s.match?.current ?? 0;
    if (who !== seat.current) {
      seat.current = who;
      const mat = shirtMats[who % shirtMats.length]!;
      for (const m of [upper.current, torso.current, shoulders.current]) if (m) m.material = mat;
    }

    // Still elbow, swinging forearm; the dart points (lofted) at the target.
    elbowAt(tl, elbow);
    gripAt(tl, grip);
    dir.subVectors(target, grip).normalize();
    right.crossVectors(dir, UP).normalize();
    dir.applyQuaternion(loftQ.setFromAxisAngle(right, LOFT)).normalize();
    tip.copy(grip).addScaledVector(dir, GRIP_BACK);
    if (upper.current) placeLimb(upper.current, J.shoulderR, elbow);
    if (fore.current) placeLimb(fore.current, elbow, grip);
    hand.current?.position.copy(grip);

    const d = dart.current;
    if (d) {
      d.visible = holdsDart(tl) && (tl < 0 || s.darts.length < 3 || s.phase === 'replay');
      d.position.copy(tip);
      d.quaternion.setFromUnitVectors(FORWARD, dir);
      d.quaternion.multiply(rollQ.setFromAxisAngle(FORWARD, Math.PI / 4));
    }
  });

  const shirt = shirtMats[0]!;
  return (
    <group ref={root} visible={false}>
      {/* Head and hair */}
      <mesh
        geometry={headGeo}
        material={skin}
        position={J.head}
        scale={[1, 1.15, 1.05]}
        castShadow={shadows}
      />
      <mesh
        geometry={hairGeo}
        material={hair}
        position={HAIR_POS}
        rotation={[0.35, 0.49, 0]}
        scale={[1, 1.15, 1.05]}
      />
      <mesh geometry={noseGeo} material={skin} position={FACE.nose} scale={[0.8, 1.2, 1]} />
      <mesh geometry={earGeo} material={skin} position={FACE.earR} scale={[0.5, 1.3, 0.9]} />
      <mesh geometry={earGeo} material={skin} position={FACE.earL} scale={[0.5, 1.3, 0.9]} />
      <Limb a={J.neck} b={J.head} r={0.045} material={skin} shadow={shadows} />
      {/* Torso: a broad tube from hips to chest, plus a shoulder yoke for width */}
      <mesh
        ref={(m) => {
          torso.current = m;
          if (m) placeLimb(m, J.hips, geo.torsoTop);
        }}
        geometry={geo.torso}
        material={shirt}
        castShadow={shadows}
      />
      <mesh
        ref={(m) => {
          shoulders.current = m;
          if (m) placeLimb(m, J.shoulderL, J.shoulderR);
        }}
        geometry={geo.shoulders}
        material={shirt}
        castShadow={shadows}
      />
      {/* Legs and shoes */}
      <Limb a={J.hipR} b={J.kneeR} r={0.068} material={trousers} shadow={shadows} />
      <Limb a={J.kneeR} b={J.footR} r={0.058} material={trousers} shadow={shadows} />
      <Limb a={J.hipL} b={J.kneeL} r={0.068} material={trousers} shadow={shadows} />
      <Limb a={J.kneeL} b={J.footL} r={0.058} material={trousers} shadow={shadows} />
      <Limb a={J.footR} b={J.toeR} r={0.04} material={shoes} shadow={shadows} />
      <Limb a={J.footL} b={J.toeL} r={0.04} material={shoes} shadow={shadows} />
      {/* Relaxed left arm */}
      <Limb a={J.shoulderL} b={J.elbowL} r={0.046} material={shirt} shadow={shadows} />
      <Limb a={J.elbowL} b={J.handL} r={0.038} material={skin} shadow={shadows} />
      <mesh geometry={handGeo} material={skin} position={J.handL} />
      {/* Throwing arm (posed every frame) */}
      <mesh ref={upper} geometry={geo.upper} material={shirt} castShadow={shadows} />
      <mesh ref={fore} geometry={geo.fore} material={skin} castShadow={shadows} />
      <mesh ref={hand} geometry={handGeo} material={skin} />
      <group ref={dart}>
        <DartModel />
      </group>
    </group>
  );
}

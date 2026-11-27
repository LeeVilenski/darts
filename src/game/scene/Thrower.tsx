import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { WORLD } from '../../engine/board/geometry';
import { currentAi, currentAiIntent, useGameStore } from '../../store/useGameStore';
import { appearanceFor, type Appearance } from './appearance';
import { DartModel } from './Dart';
import { gripQuaternion, Hand, handQuaternion, PINCH_POINT } from './Hand';
import { dartTracker, throwerClock } from './dartTracker';
import { useTier } from './quality';
import { shirtTexture } from './shirtTexture';
import {
  blendRest,
  BODY,
  bodyJoints,
  type BodyJoints,
  ELBOW,
  elbowAt,
  FOREARM,
  gripAt,
  GRIP_BACK,
  holdsDart,
  shoulderWorld,
  WINDUP_S,
  worldToBody,
} from './throwerPose';

/** Replays start this far (sim seconds) before release, so you see the throw. */
export const REPLAY_LEAD_S = WINDUP_S * 0.75;
/** The dart points this much above the line to its target (rad). */
const LOFT = 0.09;
/** Where the player looks: the board. */
const LOOK_AT = new Vector3(0, WORLD.bullHeight, 0);

const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, 1);

/** A capsule (along +Y) spanning `len` metres end to end. */
const capsule = (r: number, len: number) =>
  new CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 8, 16);

/** Point a mesh (built along +Y) from a to b, centred between them. */
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
  extend = 1.2,
}: {
  a: Vector3;
  b: Vector3;
  r: number;
  material: MeshStandardMaterial;
  shadow: boolean;
  /** Overlap into the joints, in radii, so limbs meet without gaps. */
  extend?: number;
}) {
  const geo = useMemo(() => capsule(r, a.distanceTo(b) + r * extend), [a, b, r, extend]);
  useEffect(() => () => geo.dispose(), [geo]);
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

/** Per-look materials (shirt texture with the name on the back, skin, hair…). */
function useMaterials(look: Appearance) {
  const mats = useMemo(() => {
    const m = (color: string, roughness = 0.75, extra: Partial<MeshStandardMaterial> = {}) =>
      Object.assign(new MeshStandardMaterial({ color, roughness }), extra);
    const stubble = new Color(look.skin).lerp(new Color(look.hair), 0.32).getStyle();
    return {
      skin: m(look.skin, 0.62),
      jaw: m(look.facialHair === 'stubble' ? stubble : look.skin, 0.65),
      hair: m(look.hair, 0.85),
      shirtBody: m('#ffffff', 0.7, { map: shirtTexture(look) }),
      shirt: m(look.shirt, 0.7),
      trim: m(look.trim, 0.6, { side: DoubleSide }),
      trousers: m(look.trousers, 0.85),
      shoes: m(look.shoes, 0.35),
      eyeWhite: m('#f3efe8', 0.3),
      iris: m('#2a1d14', 0.2),
      lips: m(new Color(look.skin).lerp(new Color('#7a2e2a'), 0.45).getStyle(), 0.5),
      frame: m('#18181a', 0.35, { metalness: 0.4 }),
    };
  }, [look]);
  useEffect(
    () => () => {
      for (const mat of Object.values(mats)) {
        mat.map?.dispose();
        mat.dispose();
      }
    },
    [mats],
  );
  return mats;
}
type Mats = ReturnType<typeof useMaterials>;

/**
 * Torso: a lathe from waist to neck, flattened front-to-back and widened
 * across the shoulders, with an optional belly pushed out at the front.
 */
function torsoGeometry(look: Appearance): BufferGeometry {
  const h = look.height;
  const profile: [number, number][] = [
    [0.132, 0.9],
    [0.138, 0.98],
    [0.143, 1.07],
    [0.146, 1.17],
    [0.152, 1.27],
    [0.155, 1.35],
    [0.145, 1.42],
    [0.112, 1.47],
    [0.062, 1.505],
    [0.044, 1.52],
  ];
  // Back of the body (+z) at texture u = 0.5, front on the seam.
  const g = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y * h)),
    40,
    Math.PI,
  );
  g.scale(1.2 * look.girth, 1, 0.8 * look.girth);
  if (look.belly > 0) {
    const pos = g.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const y = pos.getY(i) / h;
      if (z >= 0) continue; // only the front
      const bump = Math.exp(-(((y - 1.08) / 0.11) ** 2));
      pos.setZ(i, z - look.belly * bump * (-z / 0.12));
    }
    g.computeVertexNormals();
  }
  return g;
}

/**
 * A head from one sphere: taller than wide, the lower half narrowed into a jaw
 * and chin, the face slightly flattened. Head-local: +z is the face, +y up.
 */
function headGeometry(r: number, from = 0, to = Math.PI): BufferGeometry {
  const g = new SphereGeometry(r, 36, 28, 0, Math.PI * 2, from, to - from);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const t = y / r; // -1 (chin) … 1 (crown)
    y *= 1.16;
    if (t < 0) {
      // Jaw: narrow toward the chin, and bring the chin forward.
      const k = -t;
      x *= 1 - 0.32 * k * k;
      z *= 1 - 0.18 * k * k;
      if (z > 0) z += 0.012 * k;
      y -= 0.012 * k;
    }
    if (z > 0) z *= 0.9; // flatter face
    x *= 0.93;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Hair, built on the head (head-local: +z is the face, +y up). */
function Hair({ look, mat }: { look: Appearance; mat: MeshStandardMaterial }) {
  const geo = useMemo(() => {
    const cap = (r: number, theta: number) =>
      new SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, theta);
    return {
      cap: cap(0.1, Math.PI * 0.5),
      buzz: cap(0.097, Math.PI * 0.47),
      // Horseshoe round the back and sides, bare on top.
      // Round the back and over the ears only, down to the nape; bare crown and temples.
      fringe: new SphereGeometry(
        0.098,
        28,
        10,
        Math.PI * 0.95,
        Math.PI * 1.1,
        Math.PI * 0.4,
        Math.PI * 0.3,
      ),
      curl: new SphereGeometry(0.032, 10, 8),
      quiff: capsule(0.03, 0.11),
      tail: capsule(0.028, 0.16),
      long: new SphereGeometry(
        0.104,
        28,
        16,
        Math.PI * 0.2,
        Math.PI * 1.6,
        Math.PI * 0.3,
        Math.PI * 0.45,
      ),
    };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  // The cap sits on the skull, tipped back so it covers the crown and back of the head.
  const capProps = {
    material: mat,
    rotation: [-0.42, 0, 0] as [number, number, number],
    scale: [0.95, 1.14, 1.06] as [number, number, number],
  };
  switch (look.hairStyle) {
    case 'bald':
      return null;
    case 'balding':
      return <mesh geometry={geo.fringe} material={mat} scale={[0.95, 1.16, 1.04]} />;
    case 'buzz':
      return <mesh geometry={geo.buzz} {...capProps} />;
    case 'short':
      return <mesh geometry={geo.cap} {...capProps} position={[0, 0.006, -0.004]} />;
    case 'quiff':
      return (
        <>
          <mesh geometry={geo.cap} {...capProps} position={[0, 0.006, -0.004]} />
          <mesh
            geometry={geo.quiff}
            material={mat}
            position={[0, 0.1, 0.045]}
            rotation={[1.2, 0, 0]}
          />
        </>
      );
    case 'curly': {
      const curls: [number, number, number][] = [];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const ring = i % 3;
        const el = 0.25 + ring * 0.32;
        curls.push([
          Math.cos(a) * Math.cos(el) * 0.092,
          0.035 + Math.sin(el) * 0.09,
          Math.sin(a) * Math.cos(el) * 0.092 - 0.01,
        ]);
      }
      return (
        <>
          <mesh geometry={geo.cap} {...capProps} />
          {curls
            .filter((p) => p[2] < 0.06)
            .map((p, i) => (
              <mesh key={i} geometry={geo.curl} material={mat} position={p} />
            ))}
        </>
      );
    }
    case 'long':
      return (
        <>
          <mesh geometry={geo.cap} {...capProps} position={[0, 0.006, -0.004]} />
          <mesh
            geometry={geo.long}
            material={mat}
            position={[0, -0.03, -0.004]}
            rotation={[0, Math.PI, 0]}
            scale={[0.98, 1.3, 1.08]}
          />
        </>
      );
    case 'ponytail':
      return (
        <>
          <mesh geometry={geo.cap} {...capProps} position={[0, 0.006, -0.004]} />
          <mesh
            geometry={geo.tail}
            material={mat}
            position={[0, -0.075, -0.098]}
            rotation={[0.25, 0, 0]}
          />
        </>
      );
  }
}

/** Head: skull and jaw, ears, face, hair, facial hair and glasses. Head-local: +z is the face. */
function Head({ look, mats }: { look: Appearance; mats: Mats }) {
  const geo = useMemo(
    () => ({
      skull: headGeometry(0.093),
      // Lower-face shells for stubble and beards, just outside the skin.
      jawShell: headGeometry(0.0955, Math.PI * 0.56, Math.PI),
      beard: headGeometry(0.101, Math.PI * 0.54, Math.PI),
      ear: new SphereGeometry(0.021, 12, 10),
      nose: new SphereGeometry(0.016, 16, 12),
      eye: new SphereGeometry(0.0135, 16, 12),
      iris: new SphereGeometry(0.0075, 14, 10),
      brow: capsule(0.0058, 0.034),
      lip: new SphereGeometry(0.016, 16, 10),
      tache: capsule(0.0085, 0.05),
      goatee: new SphereGeometry(0.02, 12, 10),
      lens: new TorusGeometry(0.02, 0.0028, 8, 24),
      bridge: capsule(0.0025, 0.022),
      arm: capsule(0.0022, 0.09),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const sides = [-1, 1] as const;
  const face = 0.083; // z of the face surface around the eyes
  return (
    <>
      <mesh geometry={geo.skull} material={mats.skin} castShadow />
      {look.facialHair === 'stubble' && <mesh geometry={geo.jawShell} material={mats.jaw} />}
      {look.facialHair === 'beard' && <mesh geometry={geo.beard} material={mats.hair} />}
      {sides.map((s) => (
        <mesh
          key={`ear${s}`}
          geometry={geo.ear}
          material={mats.skin}
          position={[s * 0.083, -0.004, -0.008]}
          scale={[0.42, 1.35, 0.85]}
        />
      ))}
      {/* Face: eyes under brows, nose, lips */}
      {sides.map((s) => (
        <group key={`eye${s}`} position={[s * 0.031, 0.018, face - 0.008]}>
          <mesh geometry={geo.eye} material={mats.eyeWhite} scale={[1.15, 0.75, 0.7]} />
          <mesh geometry={geo.iris} material={mats.iris} position={[0, 0, 0.0075]} />
          <mesh
            geometry={geo.brow}
            material={mats.hair}
            position={[0, 0.019, 0.006]}
            rotation={[0, 0, Math.PI / 2 + s * 0.14]}
          />
        </group>
      ))}
      <mesh
        geometry={geo.nose}
        material={mats.skin}
        position={[0, -0.012, face + 0.004]}
        scale={[0.75, 1.25, 1.05]}
        rotation={[0.25, 0, 0]}
      />
      <mesh
        geometry={geo.lip}
        material={mats.lips}
        position={[0, -0.05, face - 0.004]}
        scale={[1.15, 0.32, 0.55]}
      />
      {(look.facialHair === 'moustache' || look.facialHair === 'beard') && (
        <mesh
          geometry={geo.tache}
          material={mats.hair}
          position={[0, -0.036, face + 0.002]}
          rotation={[0, 0, Math.PI / 2]}
        />
      )}
      {look.facialHair === 'goatee' && (
        <mesh
          geometry={geo.goatee}
          material={mats.hair}
          position={[0, -0.092, 0.07]}
          scale={[1, 1.3, 0.8]}
        />
      )}
      {/* Glasses */}
      {look.glasses && (
        <group position={[0, 0.018, face + 0.012]}>
          {sides.map((s) => (
            <mesh
              key={`lens${s}`}
              geometry={geo.lens}
              material={mats.frame}
              position={[s * 0.031, 0, 0]}
            />
          ))}
          <mesh geometry={geo.bridge} material={mats.frame} rotation={[0, 0, Math.PI / 2]} />
          {sides.map((s) => (
            <mesh
              key={`arm${s}`}
              geometry={geo.arm}
              material={mats.frame}
              position={[s * 0.05, 0, -0.045]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          ))}
        </group>
      )}
      <Hair look={look} mat={mats.hair} />
    </>
  );
}

/** Everything but the throwing arm, in body-local coordinates (x toward the throwing arm, -z forward). */
function Body({
  look,
  mats,
  J,
  shadow,
}: {
  look: Appearance;
  mats: Mats;
  J: BodyJoints;
  shadow: boolean;
}) {
  const torso = useMemo(() => torsoGeometry(look), [look]);
  useEffect(() => () => torso.dispose(), [torso]);
  const extra = useMemo(
    () => ({
      shoulder: new SphereGeometry(0.06 * look.girth, 20, 14),
      collar: new CylinderGeometry(0.056, 0.064, 0.028, 28, 1, true),
      belt: new TorusGeometry(1, 0.018, 8, 40),
    }),
    [look.girth],
  );
  useEffect(() => () => Object.values(extra).forEach((g) => g.dispose()), [extra]);

  // Face the board (head-local +z toward the bull).
  const headRot = useMemo(() => {
    const t = worldToBody(LOOK_AT).sub(J.head);
    return [-Math.atan2(t.y, Math.hypot(t.x, t.z)) + 0.08, Math.atan2(t.x, t.z), 0] as [
      number,
      number,
      number,
    ];
  }, [J]);
  const toe = (foot: Vector3, dx: number, dz: number) =>
    foot.clone().add(new Vector3(dx, -0.01, dz));
  const feet = useMemo(
    () => ({
      toeR: toe(J.footR, -0.02, -0.19),
      toeL: toe(J.footL, 0.07, -0.16),
      sleeveL: J.shoulderL.clone().lerp(J.elbowL, 0.5),
      neckBase: J.neck.clone().add(new Vector3(0, -0.05, 0.01)),
      headBase: J.head.clone().add(new Vector3(0, -0.05, 0)),
      belt: J.waist.clone().add(new Vector3(0, 0.01, 0)),
      handLQ: handQuaternion(J.handL.clone().sub(J.elbowL), new Vector3(1, 0, 0.3)),
    }),
    [J],
  );

  return (
    <group position={[BODY.x, 0, BODY.z]} rotation={[0, BODY.yaw, 0]}>
      <mesh geometry={torso} material={mats.shirtBody} castShadow={shadow} />
      {/* Shoulders, collar and belt */}
      <mesh
        geometry={extra.shoulder}
        material={mats.shirt}
        position={J.shoulderR}
        castShadow={shadow}
      />
      <mesh
        geometry={extra.shoulder}
        material={mats.shirt}
        position={J.shoulderL}
        castShadow={shadow}
      />
      <mesh
        geometry={extra.collar}
        material={mats.trim}
        position={[J.neck.x - 0.005, J.neck.y - 0.012, J.neck.z + 0.008]}
        rotation={[-0.12, 0, 0]}
        scale={[1.05, 1, 0.92]}
      />
      <mesh
        geometry={extra.belt}
        material={mats.trousers}
        position={feet.belt}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.135 * 1.2 * look.girth, 0.133 * 0.8 * look.girth, 1]}
      />
      {/* Neck and head */}
      <Limb a={feet.neckBase} b={feet.headBase} r={0.053} material={mats.skin} shadow={shadow} />
      <group position={J.head} rotation={headRot} rotation-order="YXZ">
        <Head look={look} mats={mats} />
      </group>
      {/* Legs and shoes */}
      <Limb
        a={J.hipR}
        b={J.kneeR}
        r={0.072 * look.girth}
        material={mats.trousers}
        shadow={shadow}
      />
      <Limb a={J.kneeR} b={J.footR} r={0.06} material={mats.trousers} shadow={shadow} />
      <Limb
        a={J.hipL}
        b={J.kneeL}
        r={0.072 * look.girth}
        material={mats.trousers}
        shadow={shadow}
      />
      <Limb a={J.kneeL} b={J.footL} r={0.06} material={mats.trousers} shadow={shadow} />
      <Limb a={J.footR} b={feet.toeR} r={0.045} material={mats.shoes} shadow={shadow} />
      <Limb a={J.footL} b={feet.toeL} r={0.045} material={mats.shoes} shadow={shadow} />
      {/* Relaxed arm: short sleeve, bare forearm */}
      <Limb a={J.shoulderL} b={feet.sleeveL} r={0.052} material={mats.shirt} shadow={shadow} />
      <Limb a={J.shoulderL} b={J.elbowL} r={0.042} material={mats.skin} shadow={shadow} />
      <Limb a={J.elbowL} b={J.handL} r={0.036} material={mats.skin} shadow={shadow} />
      {/* Relaxed left hand: fingers down, palm toward the thigh (mirrored right hand) */}
      <group position={J.handL} quaternion={feet.handLQ} scale={[-1, 1, 1]}>
        <Hand pose="relaxed" material={mats.skin} />
      </group>
    </group>
  );
}

const tip = new Vector3();
const grip = new Vector3();
const elbow = new Vector3();
const dir = new Vector3();
const right = new Vector3();
const target = new Vector3();
const foreDir = new Vector3();
const wrist = new Vector3();
const handQ = new Quaternion();
const held = new Vector3();
const loftQ = new Quaternion();
const rollQ = new Quaternion();

/** Name of whoever is at the oche (the current player), for their look. */
const throwerName = (s: ReturnType<typeof useGameStore.getState>) =>
  s.match?.players[s.match.current]?.name ?? '';
/** Seconds to raise the dart from rest to the aim at the end of the step-up. */
const RAISE_S = 0.45;

/**
 * The player at the oche, seen on AI turns (from the opponent's spot) and in
 * replays. Each player has their own look (shirt, hair, build, name on the
 * back), derived from their name. The throwing arm keeps a still elbow and
 * swings the forearm, timed so the dart leaves the hand exactly as its flight
 * starts. Hidden on your own live turns: you're the one throwing.
 */
export function Thrower() {
  const name = useGameStore(throwerName);
  const look = useMemo(() => {
    const l = appearanceFor(name);
    // Dev only: preview a look (window.__lookPatch = { hairStyle: 'quiff', ... }).
    if (import.meta.env.DEV && typeof window !== 'undefined')
      Object.assign(l, (window as unknown as { __lookPatch?: Partial<Appearance> }).__lookPatch);
    return l;
  }, [name]);
  const mats = useMaterials(look);
  const J = useMemo(() => bodyJoints(look), [look]);
  const shoulder = useMemo(() => shoulderWorld(look), [look]);
  const shadow = useTier() === 'high';

  const root = useRef<Group>(null);
  const upper = useRef<Mesh>(null);
  const sleeve = useRef<Mesh>(null);
  const fore = useRef<Mesh>(null);
  const hand = useRef<Group>(null);
  const dart = useRef<Group>(null);

  const geo = useMemo(
    () => ({
      upper: capsule(0.043, shoulder.distanceTo(ELBOW) + 0.05),
      sleeve: capsule(0.053, shoulder.distanceTo(ELBOW) * 0.55),
      // Elbow to wrist; the hand carries on to the pinch point.
      fore: capsule(0.036, FOREARM - PINCH_POINT.length() + 0.04),
    }),
    [shoulder],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const s = useGameStore.getState();
    let tl: number | null = null;
    target.copy(LOOK_AT);
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

    // Still elbow, swinging forearm; the dart points (lofted) at the target.
    elbowAt(tl, elbow);
    gripAt(tl, grip);
    // Stepping up (player cam): darts held at chest height, raised to the aim at the end.
    const rest = Math.min(
      1,
      Math.max(0, (throwerClock.playerCamUntil - performance.now()) / (RAISE_S * 1000)),
    );
    blendRest(shoulder, elbow, grip, rest);
    dir.subVectors(target, grip).normalize();
    right.crossVectors(dir, UP).normalize();
    dir.applyQuaternion(loftQ.setFromAxisAngle(right, LOFT)).normalize();
    // Hand: fingers along the forearm, the dart across the fingertips pointing out past
    // the thumb, its barrel pinched at the grip. The wrist is set back from the pinch.
    foreDir.subVectors(grip, elbow).normalize();
    gripQuaternion(foreDir, dir, handQ, held);
    tip.copy(grip).addScaledVector(held, GRIP_BACK);
    wrist.copy(PINCH_POINT).applyQuaternion(handQ).negate().add(grip);
    if (upper.current) placeLimb(upper.current, shoulder, elbow);
    if (sleeve.current) placeLimb(sleeve.current, shoulder, shoulder.clone().lerp(elbow, 0.5));
    if (fore.current) placeLimb(fore.current, elbow, wrist);
    const h = hand.current;
    if (h) {
      h.position.copy(wrist);
      h.quaternion.copy(handQ);
    }

    const d = dart.current;
    if (d) {
      d.visible = holdsDart(tl) && (tl < 0 || s.darts.length < 3 || s.phase === 'replay');
      d.position.copy(tip);
      d.quaternion.setFromUnitVectors(FORWARD, held);
      d.quaternion.multiply(rollQ.setFromAxisAngle(FORWARD, Math.PI / 4));
    }
  });

  return (
    <group ref={root} visible={false}>
      <Body look={look} mats={mats} J={J} shadow={shadow} />
      {/* Throwing arm (posed every frame, world space) */}
      <mesh ref={sleeve} geometry={geo.sleeve} material={mats.shirt} castShadow={shadow} />
      <mesh ref={upper} geometry={geo.upper} material={mats.skin} castShadow={shadow} />
      <mesh ref={fore} geometry={geo.fore} material={mats.skin} castShadow={shadow} />
      <group ref={hand}>
        <Hand pose="pinch" material={mats.skin} />
      </group>
      <group ref={dart}>
        <DartModel />
      </group>
    </group>
  );
}

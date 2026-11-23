import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import { WORLD } from '../../engine/board/geometry';
import { currentAi, useGameStore, type ThrownDart } from '../../store/useGameStore';
import { STICK_RADIUS } from './Board';
import { CAMERA_POS, fovToFrame } from './camera';
import { dartTracker } from './dartTracker';

const BULL = new Vector3(0, WORLD.bullHeight, 0);
const OCHE = new Vector3(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z);
/** Camera offset behind/above the dart while following it. */
const FOLLOW_OFFSET = new Vector3(0.0, 0.08, 0.5);
/** Close-up direction from the impact point (slightly to the side so the dart reads in profile). */
const CLOSE_DIR = new Vector3(0.17, 0.12, 1).normalize();
/** Board-plane half-extent framed at the oche. */
const OCHE_HALF = 0.3;
/** How quickly the camera converges on each shot (1/s). */
const RATE = { aiming: 4.5, flight: 9, impact: 5, replay: 7, turnOver: 4 } as const;
/** Side-on "TV" camera: off to the right of the throwing lane, tracking the dart. */
const SIDE_X = 0.95;
const SIDE_Y = 1.6;

/**
 * A camera shot. Instead of a field of view we keep the half-extent to frame
 * around `look`; the FOV is derived each frame from the camera's actual
 * distance, so zoom never runs ahead of the camera's movement.
 */
interface Shot {
  pos: Vector3;
  look: Vector3;
  half: number;
}

const stuckImpact = (d: ThrownDart): Vector3 | null => {
  const imp = d.flight.impact;
  if (!imp || d.result.kind === 'bounce') return null;
  if (Math.hypot(imp.x, imp.y - WORLD.bullHeight) > STICK_RADIUS) return null;
  return new Vector3(imp.x, imp.y, imp.z);
};

/**
 * Chooses a shot for the current phase and eases the camera toward it:
 * oche view while aiming, chase cam in flight, close-up on impact, and a
 * framing of all darts at turn end. Reduced motion cuts between oche and
 * close-ups and never follows the dart.
 */
export function CameraDirector() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const current = useRef<Shot | null>(null);
  const desired = useRef<Shot>({ pos: new Vector3(), look: new Vector3(), half: OCHE_HALF });
  const lastShotKind = useRef<'side' | 'other'>('other');

  useFrame((_, delta) => {
    const s = useGameStore.getState();
    const aspect = size.width / size.height;
    const reduced = s.camera === 'reduced';
    const want = desired.current;

    const oche = () => {
      want.pos.copy(OCHE);
      want.look.copy(BULL);
      want.half = OCHE_HALF;
    };
    /** Frame `half` metres around `focus`; distance chosen for a ~34° view along the narrow axis. */
    const closeUp = (focus: Vector3, half: number) => {
      const dist = half / Math.tan((17 * Math.PI) / 180);
      want.pos.copy(focus).addScaledVector(CLOSE_DIR, dist);
      want.look.copy(focus);
      want.half = half;
    };

    /** Broadcast side-on tracking shot of a dart in flight. */
    const side = (tip: Vector3, end: Vector3) => {
      want.pos.set(SIDE_X, SIDE_Y, tip.z + 0.25);
      want.look.copy(tip).lerp(end, 0.2);
      want.half = 0.24;
    };

    const phase = s.screen === 'menu' ? 'aiming' : s.phase;
    const last = s.darts[s.darts.length - 1];
    let shotKind: 'side' | 'other' = 'other';
    const replayDart = s.replay ? s.darts.find((d) => d.id === s.replay!.dartId) : undefined;
    if (phase === 'replay' && replayDart) {
      const end = replayDart.flight.samples[replayDart.flight.samples.length - 1]!.p;
      const p0 = replayDart.launch.p0;
      const tip =
        dartTracker.id === -replayDart.id ? dartTracker.position : new Vector3(p0.x, p0.y, p0.z);
      side(tip, new Vector3(end.x, end.y, end.z));
      shotKind = 'side';
    } else if (phase === 'flight' && last && !reduced && currentAi(s)) {
      // AI throws are shown like television coverage, from the side.
      const end = last.flight.samples[last.flight.samples.length - 1]!.p;
      const p0 = last.launch.p0;
      const tip = dartTracker.id === last.id ? dartTracker.position : new Vector3(p0.x, p0.y, p0.z);
      side(tip, new Vector3(end.x, end.y, end.z));
      shotKind = 'side';
    } else if (phase === 'flight' && last && !reduced) {
      const end = last.flight.samples[last.flight.samples.length - 1]!.p;
      const tip = dartTracker.id === last.id ? dartTracker.position : OCHE;
      want.pos.copy(tip).add(FOLLOW_OFFSET);
      want.pos.z = Math.min(want.pos.z, OCHE.z);
      // Over-the-shoulder chase: look mostly at where the dart will land so the board stays big
      // and the dart flies into it in the foreground.
      want.look.copy(tip).lerp(new Vector3(end.x, end.y, end.z), 0.9);
      want.half = 0.2;
    } else if (phase === 'impact' && last) {
      const focus =
        stuckImpact(last) ??
        (last.flight.impact ? new Vector3(last.flight.impact.x, last.flight.impact.y, 0) : null);
      // Darts protrude ~15 cm toward the camera, so frame generously around the tip.
      if (focus) closeUp(focus, 0.14);
      else oche();
    } else if (phase === 'turnOver') {
      const stuck = s.darts.map(stuckImpact).filter((v): v is Vector3 => v !== null);
      if (stuck.length) {
        const centre = stuck.reduce((a, v) => a.add(v), new Vector3()).divideScalar(stuck.length);
        const spread = Math.max(0.15, ...stuck.map((v) => v.distanceTo(centre) + 0.1));
        closeUp(centre, spread);
      } else oche();
    } else {
      oche();
    }

    // Cut (rather than fly) into and out of the side camera, like a TV director.
    const cut = shotKind !== lastShotKind.current;
    lastShotKind.current = shotKind;
    if (!current.current) {
      current.current = { pos: want.pos.clone(), look: want.look.clone(), half: want.half };
    }
    const cur = current.current;
    // Exponential smoothing (frame-rate independent); reduced motion and cuts snap.
    const snap = reduced || cut || s.screen === 'menu'; // the menu renders on demand, so never ease there
    const a = snap ? 1 : 1 - Math.exp(-RATE[phase] * Math.min(delta, 0.1));
    cur.pos.lerp(want.pos, a);
    cur.look.lerp(want.look, a);
    cur.half += (want.half - cur.half) * a;

    camera.position.copy(cur.pos);
    camera.lookAt(cur.look);
    const fov = fovToFrame(cur.half, Math.max(0.05, cur.pos.distanceTo(cur.look)), aspect);
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

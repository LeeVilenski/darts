import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import { WORLD } from '../../engine/board/geometry';
import {
  currentAi,
  currentAiIntent,
  useGameStore,
  type ThrownDart,
} from '../../store/useGameStore';
import { isHolding } from '../input/holding';
import { STICK_RADIUS } from './Board';
import {
  BOARD_CAM,
  breathOffset,
  CAMERA_POS,
  CLOSE_DIR,
  CHASE,
  fovToFrame,
  kickOffset,
  LANE_CAM,
  OCHE_HALF,
  shouldChase,
} from './camera';
import { cameraKick, dartTracker } from './dartTracker';

const BULL = new Vector3(0, WORLD.bullHeight, 0);
const OCHE = new Vector3(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z);
const LANE_POS = new Vector3(LANE_CAM.pos.x, LANE_CAM.pos.y, LANE_CAM.pos.z);
/** How quickly the camera converges on each shot (1/s). */
const RATE = { aiming: 4.5, flight: 9, impact: 5, replay: 7, turnOver: 4 } as const;
/** The board-cam operator pans more gently than the other shots (1/s). */
const BOARD_PAN_RATE = 3.2;
/** Menu hero shots: camera direction and distance from the look point, look offset from the bull, framing. */
const MENU_SHOT = {
  portrait: {
    dir: new Vector3(0.34, 0.1, 1).normalize(),
    dist: 1.25,
    look: new Vector3(0, -0.16, 0),
    half: 0.3,
  },
  landscape: {
    dir: new Vector3(-0.38, 0.06, 1).normalize(),
    dist: 1.25,
    look: new Vector3(-0.4, 0.02, 0),
    half: 0.36,
  },
};
/** In replays, cut from the lane shot to the board cam this close to the board (m). */
const REPLAY_BOARD_CAM_Z = 0.6;
/** How quickly the aiming sway fades in/out (1/s). */
const SWAY_RATE = 2.5;

/** Where a dart ends up on the board plane, or null if it never reached the board. */
const landingPoint = (d: ThrownDart): Vector3 | null => {
  const imp = d.flight.impact;
  return imp ? new Vector3(imp.x, imp.y, 0) : null;
};

const stuckImpact = (d: ThrownDart): Vector3 | null => {
  const imp = d.flight.impact;
  if (!imp || d.result.kind === 'bounce') return null;
  if (Math.hypot(imp.x, imp.y - WORLD.bullHeight) > STICK_RADIUS) return null;
  return new Vector3(imp.x, imp.y, imp.z);
};

const boardMm = (mm: { x: number; y: number }) =>
  new Vector3(mm.x / 1000, WORLD.bullHeight + mm.y / 1000, 0);

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

/** Broadcast shots are cut to; the rest (oche, chase, close-ups) are flown between. */
type ShotKind = 'lane' | 'board' | 'other';

/**
 * Chooses a shot for the current phase and eases the camera toward it.
 *
 * - Aiming: the player's eye at the oche, breathing slightly, pushing in while a dart is held.
 * - Flight: the eye follows the dart in; on the last dart of a turn or a finishing dart a
 *   chase cam rides behind it instead.
 * - Impact / turn over: an angled close-up, low and to the side, so stuck darts show in profile.
 * - AI turns: the TV board cam holds on the target bed for the whole turn and pans as darts land.
 * - Replays: a high lane shot from behind the thrower, cutting to the board cam for the strike.
 *
 * Reduced motion cuts between oche and close-ups and never follows, sways or shakes.
 */
export function CameraDirector() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const current = useRef<Shot | null>(null);
  const desired = useRef<Shot>({ pos: new Vector3(), look: new Vector3(), half: OCHE_HALF });
  const lastShotKind = useRef<ShotKind>('other');
  const sway = useRef(0);
  const elapsed = useRef(0);
  const scratch = useRef({ pos: new Vector3(), look: new Vector3() });

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    elapsed.current += delta;
    const s = useGameStore.getState();
    const aspect = size.width / size.height;
    const reduced = s.camera === 'reduced';
    const want = desired.current;
    /** Per-shot easing rate override (1/s); null uses the phase's rate. */
    const ease: { rate: number | null } = { rate: null };

    const oche = (half = OCHE_HALF) => {
      want.pos.copy(OCHE);
      want.look.copy(BULL);
      want.half = half;
    };
    /** Frame `half` metres around `focus`; distance chosen for a ~34° view along the narrow axis. */
    const closeUp = (focus: Vector3, half: number) => {
      const dist = half / Math.tan((17 * Math.PI) / 180);
      want.pos.copy(focus).addScaledVector(CLOSE_DIR, dist);
      want.look.copy(focus);
      want.half = half;
    };
    const boardCam = (focus: Vector3) => {
      want.pos.copy(focus).addScaledVector(BOARD_CAM.dir, BOARD_CAM.dist);
      want.look.copy(focus);
      want.half = BOARD_CAM.half;
      ease.rate = BOARD_PAN_RATE;
    };
    /** High and behind the thrower, panning with the dart so it and the board share the frame. */
    const laneCam = (tip: Vector3) => {
      want.pos.copy(LANE_POS);
      want.look.copy(tip).lerp(BULL, LANE_CAM.boardBias);
      want.half = LANE_CAM.half;
    };

    /**
     * Menu backdrop: an angled hero shot of the board with darts in it, placed
     * where the menu leaves room (above the tiles in portrait, right of the
     * menu column in landscape).
     */
    const menuShot = () => {
      const landscape = aspect >= 1.25;
      const m = landscape ? MENU_SHOT.landscape : MENU_SHOT.portrait;
      want.look.copy(BULL).add(m.look);
      want.pos.copy(BULL).add(m.look).addScaledVector(m.dir, m.dist);
      want.half = m.half;
    };

    const phase = s.screen === 'menu' ? 'aiming' : s.phase;
    const last = s.darts[s.darts.length - 1];
    const ai = s.screen === 'game' ? currentAi(s) : null;
    const aiCam = !reduced && ai !== null && s.match !== null;
    let kind: ShotKind = 'other';
    const replayDart = s.replay ? s.darts.find((d) => d.id === s.replay!.dartId) : undefined;

    if (s.screen === 'menu') {
      menuShot();
    } else if (phase === 'replay' && replayDart) {
      const p0 = replayDart.launch.p0;
      const tip =
        dartTracker.id === -replayDart.id ? dartTracker.position : new Vector3(p0.x, p0.y, p0.z);
      const land = landingPoint(replayDart);
      if (land && tip.z < REPLAY_BOARD_CAM_Z) {
        boardCam(land);
        kind = 'board';
      } else {
        laneCam(tip);
        kind = 'lane';
      }
    } else if (aiCam && phase !== 'turnOver') {
      // Hold the board cam on the target bed for the whole AI turn, like TV coverage.
      // The AI's exact next target (personality, blockers); between legs fall back to the bull.
      const intent = currentAiIntent(s);
      const target = intent ? boardMm(intent.target.point) : BULL.clone();
      const land = last && phase !== 'aiming' ? landingPoint(last) : null;
      if (land && (phase === 'impact' || land.distanceTo(target) > BOARD_CAM.half * 0.6))
        boardCam(land);
      else if (land) boardCam(target.lerp(land, 0.5));
      else if (phase === 'aiming' || !last) boardCam(target);
      else oche(); // a dart that never reached the board
      kind = ease.rate !== null ? 'board' : 'other';
    } else if (phase === 'flight' && last && !reduced) {
      const end = last.flight.samples[last.flight.samples.length - 1]!.p;
      const endV = new Vector3(end.x, end.y, end.z);
      if (shouldChase(s.darts.length - 1, s.aim, onAFinish(s))) {
        const tip = dartTracker.id === last.id ? dartTracker.position : OCHE;
        const z0 = last.launch.p0.z;
        const progress = Math.min(1, Math.max(0, 1 - tip.z / z0));
        want.pos.copy(tip).add(CHASE.offset);
        want.pos.z = Math.min(want.pos.z, OCHE.z);
        // Look at the dart early on, then increasingly at where it will land.
        want.look.copy(tip).lerp(endV, CHASE.lookStart + (1 - CHASE.lookStart) * progress);
        want.half = CHASE.half;
      } else {
        // The thrower's eye stays at the oche and follows the dart in.
        want.pos.copy(OCHE);
        want.look.copy(BULL).lerp(endV, 0.7);
        want.half = 0.24;
      }
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
      // Aiming: push in a touch while a dart is held, like focusing on the target.
      const holding = s.screen === 'game' && !reduced && isHolding();
      oche(holding ? OCHE_HALF * 0.9 : OCHE_HALF);
    }

    // Cut (rather than fly) between broadcast shots, like a TV director.
    const cut = kind !== lastShotKind.current;
    lastShotKind.current = kind;
    if (!current.current) {
      current.current = { pos: want.pos.clone(), look: want.look.clone(), half: want.half };
    }
    const cur = current.current;
    // Exponential smoothing (frame-rate independent); reduced motion and cuts snap.
    const snap = reduced || cut || s.screen === 'menu'; // the menu renders on demand, so never ease there
    const a = snap ? 1 : 1 - Math.exp(-(ease.rate ?? RATE[phase]) * delta);
    cur.pos.lerp(want.pos, a);
    cur.look.lerp(want.look, a);
    cur.half += (want.half - cur.half) * a;

    // Layered on top of the smoothed shot: a little breathing while aiming, a jolt on impact.
    const pos = scratch.current.pos.copy(cur.pos);
    const look = scratch.current.look.copy(cur.look);
    if (!reduced && s.screen === 'game') {
      const swayOn = phase === 'aiming' && ai === null ? 1 : 0;
      sway.current += (swayOn - sway.current) * (1 - Math.exp(-SWAY_RATE * delta));
      if (sway.current > 1e-3) {
        const b = breathOffset(elapsed.current);
        look.x += b.x * sway.current;
        look.y += b.y * sway.current;
        pos.y += b.y * 0.3 * sway.current;
      }
      const age = (performance.now() - cameraKick.time) / 1000;
      const kick = kickOffset(age, cameraKick.strength * cur.half);
      if (kick) {
        look.y += kick;
        pos.y += kick * 0.4;
      }
    }

    camera.position.copy(pos);
    camera.lookAt(look);
    const fov = fovToFrame(cur.half, Math.max(0.05, pos.distanceTo(look)), aspect);
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

/** Is the current x01 thrower on a finish (so the dart in the air could win the leg)? */
function onAFinish(s: ReturnType<typeof useGameStore.getState>): boolean {
  const m = s.match;
  if (!m || m.mode !== 'x01') return false;
  return m.players[m.current]!.remaining <= 170;
}

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Group, Quaternion, Vector3, type PerspectiveCamera } from 'three';
import { WORLD } from '../../engine/board/geometry';
import { currentAi, DARTS_PER_TURN, useGameStore } from '../../store/useGameStore';
import { isHolding } from '../input/holding';
import { CAMERA_POS } from './camera';
import { DartModel, DART_LENGTH } from './Dart';
import { handTracker } from './dartTracker';

const OCHE = new Vector3(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z);
/** Distance in front of the eye where the dart's tail sits (m). */
const DEPTH = 0.6;
/**
 * Tail position as a fraction of the half-view: right of centre and low. In portrait
 * there's room below the board; in landscape it moves out beside the board instead.
 */
const SCREEN = { portrait: { x: 0.5, y: -0.74 }, landscape: { x: 0.66, y: -0.6 } } as const;
/** How far the dart is drawn back toward the eye while held (m), and lifted. */
const COCK = { back: 0.035, up: 0.006 } as const;
/** The dart points this much above the aim line (rad): darts are thrown on an arc. */
const LOFT = 0.09;
/** Seconds to bring the next dart up into view. */
const RAISE_S = 0.35;
/** Only show the dart once the camera is back near the oche (m). */
const NEAR_OCHE = 0.25;

const FORWARD = new Vector3(0, 0, 1);
const anchor = new Vector3();
const aimW = new Vector3();
const dir = new Vector3();
const right = new Vector3();
const up = new Vector3();
const roll = new Quaternion();
const loft = new Quaternion();

/**
 * The next dart, held in the player's throwing hand at the bottom of the oche
 * view and pointed at the aim marker. It draws back while the dart is held
 * (pointer down or charging), and hands its pose to the thrown dart so the
 * flight visibly starts from the hand.
 */
export function HeldDart() {
  const ref = useRef<Group>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const state = useRef({ shown: false, raise: 0, cock: 0 });

  useFrame((_, rawDelta) => {
    const g = ref.current;
    if (!g) return;
    const delta = Math.min(rawDelta, 0.1);
    const s = useGameStore.getState();
    const st = state.current;
    const reduced = s.camera === 'reduced';
    const want =
      s.screen === 'game' &&
      s.phase === 'aiming' &&
      !currentAi(s) &&
      s.darts.length < DARTS_PER_TURN &&
      (st.shown || camera.position.distanceTo(OCHE) < NEAR_OCHE);
    if (!want) {
      st.shown = false;
      st.raise = 0;
      st.cock = 0;
      g.visible = false;
      handTracker.visible = false;
      return;
    }
    st.shown = true;
    st.raise = reduced ? 1 : Math.min(1, st.raise + delta / RAISE_S);
    const cockTarget = isHolding() ? 1 : 0;
    st.cock += (cockTarget - st.cock) * (1 - Math.exp(-12 * delta));
    const ease = 1 - (1 - st.raise) ** 3;

    // Tail position in camera space, scaled to the current view so it sits in the same
    // place on screen whatever the aspect ratio or zoom.
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const tanH = tanV * camera.aspect;
    const at = camera.aspect >= 1 ? SCREEN.landscape : SCREEN.portrait;
    anchor.set(
      at.x * tanH * DEPTH,
      at.y * tanV * DEPTH - (1 - ease) * tanV * DEPTH * 0.8 + st.cock * COCK.up,
      -DEPTH + st.cock * COCK.back,
    );
    camera.localToWorld(anchor);

    // Point the dart from the hand at the aim marker, lofted a little.
    aimW.set(s.aim.x / 1000, WORLD.bullHeight + s.aim.y / 1000, 0);
    dir.subVectors(aimW, anchor).normalize();
    right.crossVectors(dir, camera.up).normalize();
    up.crossVectors(right, dir);
    dir.applyQuaternion(loft.setFromAxisAngle(right, LOFT)).normalize();

    g.visible = true;
    g.position.copy(anchor).addScaledVector(dir, DART_LENGTH);
    g.quaternion.setFromUnitVectors(FORWARD, dir);
    g.quaternion.multiply(roll.setFromAxisAngle(FORWARD, Math.PI / 4)); // flights as an X

    handTracker.visible = ease > 0.9;
    handTracker.time = performance.now();
    handTracker.position.copy(g.position);
    handTracker.quaternion.copy(g.quaternion);
  });

  return (
    <group ref={ref} visible={false}>
      <DartModel />
    </group>
  );
}

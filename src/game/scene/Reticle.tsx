import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Color, type Group, type MeshBasicMaterial } from 'three';
import { WORLD } from '../../engine/board/geometry';
import { useGameStore } from '../../store/useGameStore';
import { isReadyToThrow, pointerHold } from '../input/holding';
import { currentPressure, currentSway } from '../input/nerves';

/** Ring scale and brightness while the aim is being moved (vs. steady and ready to throw). */
const MOVING = { scale: 1.45, opacity: 0.5 } as const;
/** How quickly the marker settles between the two looks (1/s). */
const RATE = 14;
const CALM = new Color('#ffffff');
/** The marker warms toward this as the pressure rises. */
const NERVY = new Color('#ff9a7a');
const tint = new Color();

/**
 * Aim marker on the board face. Hidden while a dart is in the air.
 *
 * While you drag it, it opens up and dims: a flick now won't throw. Once you
 * hold still it tightens and brightens, telling you a flick will throw.
 * Under pressure it sways (the dart goes where it is when you let go) and
 * warms in colour.
 */
export function Reticle() {
  const aim = useGameStore((s) => s.aim);
  const phase = useGameStore((s) => s.phase);
  const assist = useGameStore((s) => s.assist);
  const ring = useRef<Group>(null);
  const swayed = useRef<Group>(null);
  const ringMat = useRef<MeshBasicMaterial>(null);
  const dotMat = useRef<MeshBasicMaterial>(null);
  const k = useRef(0); // 0 = ready/idle, 1 = moving

  const opacity = assist === 'pro' ? 0.45 : 0.9;
  useFrame((_, delta) => {
    const moving = pointerHold.down && !isReadyToThrow() ? 1 : 0;
    k.current += (moving - k.current) * (1 - Math.exp(-RATE * Math.min(delta, 0.1)));
    const m = k.current;
    ring.current?.scale.setScalar(1 + (MOVING.scale - 1) * m);
    const o = opacity * (1 - (1 - MOVING.opacity) * m);
    if (ringMat.current) ringMat.current.opacity = o;
    if (dotMat.current) dotMat.current.opacity = o;
    const off = currentSway();
    swayed.current?.position.set(off.x / 1000, off.y / 1000, 0);
    tint.copy(CALM).lerp(NERVY, Math.min(1, currentPressure() * 1.2));
    ringMat.current?.color.copy(tint);
    dotMat.current?.color.copy(tint);
  });

  if (phase !== 'aiming') return null;
  return (
    <group position={[aim.x / 1000, WORLD.bullHeight + aim.y / 1000, 0.002]}>
      <group ref={swayed}>
        <group ref={ring}>
          <mesh>
            <ringGeometry args={[0.007, 0.0095, 40]} />
            <meshBasicMaterial
              ref={ringMat}
              color="#ffffff"
              transparent
              opacity={opacity}
              depthWrite={false}
            />
          </mesh>
        </group>
        <mesh>
          <circleGeometry args={[0.0018, 16]} />
          <meshBasicMaterial
            ref={dotMat}
            color="#ffffff"
            transparent
            opacity={opacity}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

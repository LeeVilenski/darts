import { WORLD } from '../../engine/board/geometry';
import { useGameStore } from '../../store/useGameStore';

/** Aim marker on the board face. Hidden while a dart is in the air. */
export function Reticle() {
  const aim = useGameStore((s) => s.aim);
  const phase = useGameStore((s) => s.phase);
  const assist = useGameStore((s) => s.assist);
  if (phase !== 'aiming') return null;
  const opacity = assist === 'pro' ? 0.45 : 0.9;
  return (
    <group position={[aim.x / 1000, WORLD.bullHeight + aim.y / 1000, 0.002]}>
      <mesh>
        <ringGeometry args={[0.007, 0.0095, 40]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.0018, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacity} depthWrite={false} />
      </mesh>
    </group>
  );
}

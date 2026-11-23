import { useLayoutEffect, useRef } from 'react';
import type { Object3D, SpotLight } from 'three';
import { WORLD } from '../../engine/board/geometry';

export function Room() {
  const spot = useRef<SpotLight>(null);
  const target = useRef<Object3D>(null);
  useLayoutEffect(() => {
    if (spot.current && target.current) spot.current.target = target.current;
  }, []);

  return (
    <>
      <color attach="background" args={['#0d0f14']} />
      <hemisphereLight args={['#c9d4ff', '#2a1d12', 0.35]} />
      <ambientLight intensity={0.08} />
      <spotLight
        ref={spot}
        position={[0.25, 3.1, 1.1]}
        angle={0.42}
        penumbra={0.7}
        intensity={9}
        distance={8}
        decay={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-near={0.5}
        shadow-camera-far={5}
      />
      <object3D ref={target} position={[0, WORLD.bullHeight, 0]} />
      {/* Back wall */}
      <mesh position={[0, 1.6, -0.04]} receiveShadow>
        <planeGeometry args={[8, 4]} />
        <meshStandardMaterial color="#2b3442" roughness={0.95} />
      </mesh>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#3a2a1e" roughness={0.8} />
      </mesh>
    </>
  );
}

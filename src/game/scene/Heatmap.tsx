import { useLayoutEffect, useRef } from 'react';
import { Object3D, type InstancedMesh } from 'three';
import { WORLD } from '../../engine/board/geometry';
import { useGameStore } from '../../store/useGameStore';

const MAX = 400;
const dummy = new Object3D();

/** Practice heatmap: a soft glowing disc for every dart landed this session, on the board face. */
export function Heatmap() {
  const hits = useGameStore((s) => s.practice.hits);
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    hits.slice(-MAX).forEach((h, i) => {
      dummy.position.set(h.x / 1000, WORLD.bullHeight + h.y / 1000, 0.003 + i * 1e-6);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = Math.min(hits.length, MAX);
    mesh.instanceMatrix.needsUpdate = true;
  }, [hits]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, MAX]}
      visible={hits.length > 0}
      frustumCulled={false}
    >
      <circleGeometry args={[0.006, 20]} />
      <meshBasicMaterial color="#38d0ff" transparent opacity={0.55} depthWrite={false} />
    </instancedMesh>
  );
}

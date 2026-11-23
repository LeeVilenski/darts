import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import type { PerspectiveCamera } from 'three';
import { WORLD } from '../../engine/board/geometry';
import { CAMERA_POS, fovForAspect } from './camera';

/** Static oche camera for M1; the broadcast camera director replaces this later. */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z);
    camera.fov = fovForAspect(size.width / size.height);
    camera.near = 0.02;
    camera.far = 50;
    camera.lookAt(0, WORLD.bullHeight, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

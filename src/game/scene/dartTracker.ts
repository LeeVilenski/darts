import { Vector3 } from 'three';

/** Live position of the dart currently in flight, written by FlyingDart and read by the camera. */
export const dartTracker = {
  id: -1,
  position: new Vector3(),
};

import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PMREMGenerator, type Object3D, type SpotLight } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WORLD } from '../../engine/board/geometry';
import type { Venue } from '../../engine/career/circuits';
import { useGameStore } from '../../store/useGameStore';
import { useTier } from './quality';
import { ChalkBoard } from './ChalkBoard';
import { paintingTexture, planksTexture } from './textures';

const ROOM = { halfWidth: 2.2, height: 3, back: -0.04, front: 4.2 } as const;
const WAINSCOT = 1.05;
/** Cabinet: half-width (m), depth from the wall (m), wall thickness (m). */
const CAB = { half: 0.47, depth: 0.1, wall: 0.022 } as const;
const DOOR_ANGLE = 0.26; // radians the cabinet doors sit away from the wall

type RGB = [number, number, number];
interface VenueStyle {
  background: string;
  wall: string;
  panel: RGB;
  floor: RGB;
  cabinet: RGB;
  ceiling: string;
  /** Sconces and their light. */
  sconce: string;
  spot: string;
  spotIntensity: number;
  hemi: [string, string, number];
  fill: string;
  /** Pictures on the wall (the pub only). */
  pictures: boolean;
}

/** Career venues: the pub, a county hall, a floor event, the TV stage. */
const VENUES: Record<Venue, VenueStyle> = {
  pub: {
    background: '#0b0c10',
    wall: '#1f3a33',
    panel: [92, 54, 32],
    floor: [110, 72, 44],
    cabinet: [70, 38, 22],
    ceiling: '#141210',
    sconce: '#ffb066',
    spot: '#fff4e0',
    spotIntensity: 3.2,
    hemi: ['#ffe2c0', '#2a1d12', 0.5],
    fill: '#ffe6cc',
    pictures: true,
  },
  hall: {
    background: '#101114',
    wall: '#bdb49c',
    panel: [140, 118, 88],
    floor: [96, 94, 90],
    cabinet: [96, 70, 44],
    ceiling: '#d8d4c8',
    sconce: '#e9f0ff',
    spot: '#f4f7ff',
    spotIntensity: 3,
    hemi: ['#eef2ff', '#3a3832', 0.6],
    fill: '#eef2ff',
    pictures: false,
  },
  floor: {
    background: '#05060a',
    wall: '#141a2e',
    panel: [30, 36, 58],
    floor: [34, 34, 42],
    cabinet: [24, 26, 34],
    ceiling: '#07080c',
    sconce: '#7aa2ff',
    spot: '#eef3ff',
    spotIntensity: 3.6,
    hemi: ['#cfd8ff', '#0c0d14', 0.4],
    fill: '#dbe4ff',
    pictures: false,
  },
  stage: {
    background: '#020203',
    wall: '#08080c',
    panel: [18, 16, 24],
    floor: [14, 12, 18],
    cabinet: [12, 12, 16],
    ceiling: '#030304',
    sconce: '#ffc94a',
    spot: '#fff1d6',
    spotIntensity: 4.4,
    hemi: ['#ffe9c0', '#050508', 0.35],
    fill: '#ffe2b0',
    pictures: false,
  },
};

/** Reflections for metal darts from three's built-in procedural room (no download). */
function useEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.35;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
}

/** A small pub: panelled walls, floorboards, a dartboard cabinet, lamp, oche and a few props. */
export function Room() {
  useEnvironment();
  const venue = useGameStore((s) =>
    s.screen === 'game' && s.setup.kind !== 'practice' ? (s.setup.venue ?? 'pub') : 'pub',
  );
  const v = VENUES[venue];
  const tier = useTier();
  const spot = useRef<SpotLight>(null);
  const target = useRef<Object3D>(null);
  useLayoutEffect(() => {
    if (spot.current && target.current) spot.current.target = target.current;
  }, []);

  const tex = useMemo(
    () => ({
      panel: planksTexture(v.panel, 8, true, [6, 1]),
      sidePanel: planksTexture(v.panel, 8, true, [5, 1]),
      floor: planksTexture(v.floor, 6, false, [4, 6]),
      cabinet: planksTexture(v.cabinet, 4, true, [1, 1]),
      art: [paintingTexture(20), paintingTexture(200), paintingTexture(120)],
    }),
    [v],
  );
  useEffect(
    () => () =>
      [tex.panel, tex.sidePanel, tex.floor, tex.cabinet, ...tex.art].forEach((t) => t.dispose()),
    [tex],
  );

  const depth = ROOM.front - ROOM.back;
  const midZ = (ROOM.front + ROOM.back) / 2;
  const shadows = tier === 'high';

  return (
    <>
      <color attach="background" args={[v.background]} />
      <hemisphereLight args={v.hemi} />
      <ambientLight intensity={0.06} />

      {/* Lamp over the board */}
      <group position={[0, 2.45, 0.62]}>
        <mesh rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.16, 0.16, 24, 1, true]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} side={2} />
        </mesh>
        <mesh position={[0, -0.03, 0.02]}>
          <sphereGeometry args={[0.035, 16, 12]} />
          <meshStandardMaterial emissive="#fff1d6" emissiveIntensity={3} color="#fff" />
        </mesh>
      </group>
      <spotLight
        ref={spot}
        position={[0, 2.42, 0.64]}
        angle={0.5}
        penumbra={0.75}
        intensity={v.spotIntensity}
        distance={8}
        decay={2}
        color={v.spot}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-near={0.3}
        shadow-camera-far={4}
      />
      <object3D ref={target} position={[0, WORLD.bullHeight, 0]} />
      {/* Warm wall sconces */}
      {[-1.5, 1.5].map((x) => (
        <group key={x} position={[x, 2.05, ROOM.back + 0.06]}>
          <mesh>
            <sphereGeometry args={[0.05, 16, 12]} />
            <meshStandardMaterial emissive={v.sconce} emissiveIntensity={2.5} color={v.sconce} />
          </mesh>
          <pointLight intensity={0.9} distance={3} decay={2} color={v.sconce} />
        </group>
      ))}

      {/* Back wall: paint above, wood panelling below */}
      <mesh position={[0, (ROOM.height + WAINSCOT) / 2, ROOM.back]} receiveShadow>
        <planeGeometry args={[ROOM.halfWidth * 2, ROOM.height - WAINSCOT]} />
        <meshStandardMaterial color={v.wall} roughness={0.95} />
      </mesh>
      <mesh position={[0, WAINSCOT / 2, ROOM.back + 0.002]} receiveShadow>
        <planeGeometry args={[ROOM.halfWidth * 2, WAINSCOT]} />
        <meshStandardMaterial map={tex.panel} roughness={0.7} />
      </mesh>
      <mesh position={[0, WAINSCOT, ROOM.back + 0.02]}>
        <boxGeometry args={[ROOM.halfWidth * 2, 0.04, 0.04]} />
        <meshStandardMaterial map={tex.cabinet} roughness={0.6} />
      </mesh>

      {/* Side walls */}
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * ROOM.halfWidth, 0, midZ]}
          rotation={[0, -side * (Math.PI / 2), 0]}
        >
          <mesh position={[0, (ROOM.height + WAINSCOT) / 2, 0]} receiveShadow>
            <planeGeometry args={[depth, ROOM.height - WAINSCOT]} />
            <meshStandardMaterial color={v.wall} roughness={0.95} />
          </mesh>
          <mesh position={[0, WAINSCOT / 2, 0.002]} receiveShadow>
            <planeGeometry args={[depth, WAINSCOT]} />
            <meshStandardMaterial map={tex.sidePanel} roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Soft fill from the board end, so the player's face reads in the player cam */}
      <pointLight
        position={[-0.7, 1.9, 1.4]}
        intensity={0.5}
        distance={3.2}
        decay={2}
        color={v.fill}
      />

      {/* Front wall (behind the player), seen in the player cam: panelling, a door, pictures */}
      <group position={[0, 0, ROOM.front]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, (ROOM.height + WAINSCOT) / 2, 0]} receiveShadow>
          <planeGeometry args={[ROOM.halfWidth * 2, ROOM.height - WAINSCOT]} />
          <meshStandardMaterial color={v.wall} roughness={0.95} />
        </mesh>
        <mesh position={[0, WAINSCOT / 2, 0.002]} receiveShadow>
          <planeGeometry args={[ROOM.halfWidth * 2, WAINSCOT]} />
          <meshStandardMaterial map={tex.panel} roughness={0.7} />
        </mesh>
        <mesh position={[0, WAINSCOT, 0.02]}>
          <boxGeometry args={[ROOM.halfWidth * 2, 0.04, 0.04]} />
          <meshStandardMaterial map={tex.cabinet} roughness={0.6} />
        </mesh>
        {/* Door, to the thrower's left as you face them */}
        <group position={[0.95, 0, 0.01]}>
          <mesh position={[0, 1.02, 0.025]} castShadow receiveShadow>
            <boxGeometry args={[0.86, 2.04, 0.05]} />
            <meshStandardMaterial map={tex.cabinet} roughness={0.55} />
          </mesh>
          {[0.55, 1.45].map((y) => (
            <mesh key={y} position={[0, y, 0.052]}>
              <boxGeometry args={[0.62, 0.62, 0.012]} />
              <meshStandardMaterial map={tex.cabinet} roughness={0.5} color="#c9b39a" />
            </mesh>
          ))}
          <mesh position={[-0.34, 1.0, 0.07]}>
            <sphereGeometry args={[0.028, 16, 12]} />
            <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Frame */}
          {[-0.46, 0.46].map((x) => (
            <mesh key={x} position={[x, 1.07, 0.03]}>
              <boxGeometry args={[0.07, 2.14, 0.07]} />
              <meshStandardMaterial map={tex.cabinet} roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, 2.12, 0.03]}>
            <boxGeometry args={[0.99, 0.07, 0.07]} />
            <meshStandardMaterial map={tex.cabinet} roughness={0.6} />
          </mesh>
        </group>
        {/* Pictures and a warm sconce */}
        {(v.pictures
          ? [
              [-0.7, 1.85, 0.5, 0.62, 1],
              [-1.55, 1.75, 0.34, 0.44, 0],
            ]
          : []
        ).map(([x, y, w, h, art]) => (
          <group key={x} position={[x!, y!, 0.015]}>
            <mesh>
              <boxGeometry args={[w! + 0.05, h! + 0.05, 0.02]} />
              <meshStandardMaterial color="#2a1a0e" roughness={0.5} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0.011]}>
              <planeGeometry args={[w!, h!]} />
              <meshStandardMaterial map={tex.art[art!]} roughness={0.8} />
            </mesh>
          </group>
        ))}
        <group position={[0.2, 2.1, 0.06]}>
          <mesh>
            <sphereGeometry args={[0.05, 16, 12]} />
            <meshStandardMaterial emissive={v.sconce} emissiveIntensity={2.5} color={v.sconce} />
          </mesh>
          <pointLight intensity={0.8} distance={3} decay={2} color={v.sconce} />
        </group>
      </group>

      {/* Floor and ceiling */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]} receiveShadow>
        <planeGeometry args={[ROOM.halfWidth * 2, depth]} />
        <meshStandardMaterial map={tex.floor} roughness={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM.height, midZ]}>
        <planeGeometry args={[ROOM.halfWidth * 2, depth]} />
        <meshStandardMaterial color={v.ceiling} roughness={1} />
      </mesh>

      {/* Oche: a raised throw line at regulation distance */}
      <mesh position={[0, 0.019, WORLD.ocheDistance + 0.025]} castShadow receiveShadow>
        <boxGeometry args={[0.61, 0.038, 0.05]} />
        <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Dartboard cabinet: a real box with depth, so the board sits inside a frame */}
      <mesh position={[0, WORLD.bullHeight, ROOM.back + 0.005]} receiveShadow>
        <boxGeometry args={[CAB.half * 2, CAB.half * 2, 0.01]} />
        <meshStandardMaterial map={tex.cabinet} roughness={0.6} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={`walls${side}`}>
          {/* left/right walls */}
          <mesh
            position={[
              side * (CAB.half - CAB.wall / 2),
              WORLD.bullHeight,
              ROOM.back + CAB.depth / 2,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[CAB.wall, CAB.half * 2, CAB.depth]} />
            <meshStandardMaterial map={tex.cabinet} roughness={0.55} />
          </mesh>
          {/* top/bottom walls */}
          <mesh
            position={[
              0,
              WORLD.bullHeight + side * (CAB.half - CAB.wall / 2),
              ROOM.back + CAB.depth / 2,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[CAB.half * 2, CAB.wall, CAB.depth]} />
            <meshStandardMaterial map={tex.cabinet} roughness={0.55} />
          </mesh>
        </group>
      ))}
      {/* Doors, hinged on the front edge and swung open almost flat */}
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * CAB.half, WORLD.bullHeight, ROOM.back + CAB.depth]}
          rotation={[0, -side * DOOR_ANGLE, 0]}
        >
          <mesh position={[side * (CAB.half / 2), 0, -0.01]} castShadow receiveShadow>
            <boxGeometry args={[CAB.half, CAB.half * 2, 0.02]} />
            <meshStandardMaterial map={tex.cabinet} roughness={0.6} />
          </mesh>
          {/* Chalk scoreboard on the inside of the left door */}
          {side === -1 && (
            <group position={[side * (CAB.half / 2), 0, 0.001]}>
              <ChalkBoard width={CAB.half * 0.82} height={CAB.half * 1.7} />
            </group>
          )}
        </group>
      ))}

      {/* Framed pictures (the pub only) */}
      {(v.pictures
        ? [
            [-1.35, 1.85, 0.42, 0.52, 0],
            [1.35, 1.9, 0.36, 0.46, 1],
            [1.85, 1.6, 0.3, 0.38, 2],
          ]
        : []
      ).map(([x, y, w, h, art]) => (
        <group key={x} position={[x!, y!, ROOM.back + 0.015]}>
          <mesh>
            <boxGeometry args={[w! + 0.05, h! + 0.05, 0.02]} />
            <meshStandardMaterial color="#2a1a0e" roughness={0.5} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.011]}>
            <planeGeometry args={[w!, h!]} />
            <meshStandardMaterial map={tex.art[art!]} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </>
  );
}

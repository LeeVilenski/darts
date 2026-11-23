import { WORLD } from '../board/geometry';

export type Vec3 = { x: number; y: number; z: number };

export const GRAVITY = 9.81;
export const SIM_HZ = 240;

export interface FlightSample {
  t: number;
  p: Vec3;
  v: Vec3;
}

export interface Flight {
  samples: FlightSample[];
  /** Impact point on the board plane (world metres), or null if it never reached the board. */
  impact: Vec3 | null;
  impactVelocity: Vec3 | null;
  duration: number;
}

export interface FlightOptions {
  /** Quadratic drag coefficient (1/m). 0 = pure ballistic. */
  drag?: number;
  maxTime?: number;
  /** Plane the board face sits on. */
  boardZ?: number;
}

/**
 * Fixed-step (240 Hz) integration until the dart crosses
 * the board plane; the exact crossing is found by interpolating the last step.
 */
export function simulateFlight(p0: Vec3, v0: Vec3, opts: FlightOptions = {}): Flight {
  const { drag = 0, maxTime = 2, boardZ = 0 } = opts;
  const dt = 1 / SIM_HZ;
  const p = { ...p0 };
  const v = { ...v0 };
  const samples: FlightSample[] = [{ t: 0, p: { ...p }, v: { ...v } }];
  let t = 0;
  while (t < maxTime) {
    // Velocity Verlet with acceleration from the start of the step: exact under
    // constant gravity, second-order accurate with drag.
    const k = drag * Math.hypot(v.x, v.y, v.z);
    const ax = -k * v.x;
    const ay = -GRAVITY - k * v.y;
    const az = -k * v.z;
    const prev = { ...p };
    p.x += v.x * dt + 0.5 * ax * dt * dt;
    p.y += v.y * dt + 0.5 * ay * dt * dt;
    p.z += v.z * dt + 0.5 * az * dt * dt;
    v.x += ax * dt;
    v.y += ay * dt;
    v.z += az * dt;
    t += dt;
    if (p.z <= boardZ) {
      const f = (prev.z - boardZ) / (prev.z - p.z);
      const impact = {
        x: prev.x + (p.x - prev.x) * f,
        y: prev.y + (p.y - prev.y) * f,
        z: boardZ,
      };
      const tImpact = t - dt + dt * f;
      samples.push({ t: tImpact, p: impact, v: { ...v } });
      return { samples, impact, impactVelocity: { ...v }, duration: tImpact };
    }
    if (p.y < 0) break; // hit the floor
    samples.push({ t, p: { ...p }, v: { ...v } });
  }
  return { samples, impact: null, impactVelocity: null, duration: t };
}

/** Closed-form launch velocity (no drag) that reaches `target` after `flightTime` seconds. */
export function idealLaunch(p0: Vec3, target: Vec3, flightTime: number): Vec3 {
  const T = flightTime;
  return {
    x: (target.x - p0.x) / T,
    y: (target.y - p0.y) / T + 0.5 * GRAVITY * T,
    z: (target.z - p0.z) / T,
  };
}

/** Linear interpolation of a flight at time t. */
export function sampleFlight(flight: Flight, t: number): FlightSample {
  const s = flight.samples;
  if (t <= 0) return s[0]!;
  const last = s[s.length - 1]!;
  if (t >= last.t) return last;
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid]!.t <= t) lo = mid;
    else hi = mid;
  }
  const a = s[lo]!;
  const b = s[hi]!;
  const f = (t - a.t) / (b.t - a.t);
  const lerp = (u: Vec3, w: Vec3): Vec3 => ({
    x: u.x + (w.x - u.x) * f,
    y: u.y + (w.y - u.y) * f,
    z: u.z + (w.z - u.z) * f,
  });
  return { t, p: lerp(a.p, b.p), v: lerp(a.v, b.v) };
}

/** World (m) -> board-local (mm). */
export function worldToBoardMm(p: Vec3): { x: number; y: number } {
  return { x: p.x * 1000, y: (p.y - WORLD.bullHeight) * 1000 };
}

/** Board-local (mm) -> world (m) on the board plane. */
export function boardMmToWorld(x: number, y: number): Vec3 {
  return { x: x / 1000, y: WORLD.bullHeight + y / 1000, z: 0 };
}

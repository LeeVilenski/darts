import { checkCollision, type Collision, type StuckDart } from '../board/collision';
import { STICK_RADIUS, WORLD } from '../board/geometry';
import { resolveHit, scorePoint, type BounceSetting, type HitResult } from '../board/resolveHit';
import type { Rng } from '../rng';
import { simulateFlight, worldToBoardMm, type Flight, type FlightSample } from './ballistics';
import type { LaunchParams } from './throwModel';

export interface ResolvedDart {
  flight: Flight;
  result: HitResult;
  /** Contact with a dart already in the board, if any. */
  collision: Collision | null;
}

const onBoard = (p: { x: number; y: number }) =>
  Math.hypot(p.x, p.y - WORLD.bullHeight) <= STICK_RADIUS;

/**
 * Fly a launched dart and work out where it ends up: through the darts
 * already in the board (deflections, Robin Hoods), then wires and segments.
 * Used by both the game and the headless AI simulation.
 */
export function resolveDart(
  launch: LaunchParams,
  stuck: readonly StuckDart[],
  rng: Rng,
  bounce: BounceSetting,
): ResolvedDart {
  const flight = simulateFlight(launch.p0, launch.v0);
  if (!flight.impact || !flight.impactVelocity) {
    return { flight, result: { kind: 'miss', r: Infinity, angle: 0 }, collision: null };
  }
  const mm = worldToBoardMm(flight.impact);
  const v = flight.impactVelocity;
  const collision =
    stuck.length && onBoard(flight.impact)
      ? checkCollision(mm, { x: v.x / v.z, y: v.y / v.z }, stuck, rng, bounce)
      : null;

  if (!collision) return { flight, result: resolveHit(mm.x, mm.y, rng, bounce), collision };

  if (collision.kind === 'robinHood') {
    const lodged = truncateFlight(flight, collision.depth / 1000);
    const at = worldToBoardMm(lodged.impact!);
    const { r, angle } = scorePoint(at.x, at.y);
    return { flight: lodged, result: { kind: 'robinHood', r, angle }, collision };
  }

  const landing = {
    x: mm.x + collision.dir.x * collision.shift,
    y: mm.y + collision.dir.y * collision.shift,
  };
  const deflected = deflectFlight(flight, collision);
  if (collision.bounce) {
    const { r, angle } = scorePoint(landing.x, landing.y);
    return { flight: deflected, result: { kind: 'bounce', r, angle }, collision };
  }
  return { flight: deflected, result: resolveHit(landing.x, landing.y, rng, bounce), collision };
}

/** The obstacle a resolved dart leaves in the board, or null if it isn't stuck there. */
export function stuckDartOf(d: { flight: Flight; result: HitResult }): StuckDart | null {
  const { impact, impactVelocity: v } = d.flight;
  if (!impact || !v || d.result.kind === 'bounce' || !onBoard(impact)) return null;
  const mm = worldToBoardMm(impact);
  return { x: mm.x, y: mm.y, depth: impact.z * 1000, sx: v.x / v.z, sy: v.y / v.z };
}

/** Cut a flight short where it reaches height `z` (m) in front of the board. */
function truncateFlight(flight: Flight, z: number): Flight {
  const s = flight.samples;
  let i = s.findIndex((p) => p.p.z <= z);
  if (i <= 0) i = s.length - 1;
  const a = s[i - 1] ?? s[0]!;
  const b = s[i]!;
  const f = a.p.z === b.p.z ? 1 : (a.p.z - z) / (a.p.z - b.p.z);
  const lerp = (u: number, w: number) => u + (w - u) * f;
  const end: FlightSample = {
    t: lerp(a.t, b.t),
    p: { x: lerp(a.p.x, b.p.x), y: lerp(a.p.y, b.p.y), z },
    v: { ...b.v },
  };
  return {
    samples: [...s.slice(0, i), end],
    impact: end.p,
    impactVelocity: { ...b.v },
    duration: end.t,
  };
}

/**
 * Bend the end of a flight after it touched another dart: from the contact
 * height on, the dart drifts sideways to its new landing point and its axis
 * tilts by the deflection angle (which is how it then sits in the board).
 */
function deflectFlight(flight: Flight, c: Extract<Collision, { kind: 'deflect' }>): Flight {
  const zc = Math.max(c.depth / 1000, 1e-3);
  const shift = c.shift / 1000;
  const bend = (p: FlightSample): FlightSample => {
    if (p.p.z >= zc) return p;
    const f = 1 - Math.max(0, p.p.z) / zc;
    const speed = Math.hypot(p.v.x, p.v.y, p.v.z);
    const kick = speed * Math.tan(c.angle) * f;
    return {
      t: p.t,
      p: { x: p.p.x + c.dir.x * shift * f, y: p.p.y + c.dir.y * shift * f, z: p.p.z },
      v: { x: p.v.x + c.dir.x * kick, y: p.v.y + c.dir.y * kick, z: p.v.z },
    };
  };
  const samples = flight.samples.map(bend);
  const last = samples[samples.length - 1]!;
  return { ...flight, samples, impact: last.p, impactVelocity: last.v };
}

import type { Rng } from '../rng';
import { DART } from './geometry';
import type { BounceSetting } from './resolveHit';

/**
 * A dart already sitting in the board (or lodged in another dart), as an
 * obstacle for the next one. Positions are board-local mm; depth is measured
 * out from the board face toward the thrower.
 */
export interface StuckDart {
  /** Where its point entered (board mm). */
  x: number;
  y: number;
  /** Height (mm) in front of the board face where its point entered: 0 in the board, more for a Robin Hood. */
  depth: number;
  /** Lateral drift (mm per mm of depth) of its axis from the point toward the tail. */
  sx: number;
  sy: number;
}

/** What happened when an incoming dart met one already in the board. */
export type Collision =
  | {
      kind: 'robinHood';
      /** Index of the dart it lodged in. */
      target: number;
      /** Height (mm) of the struck dart's tail, where the new point entered. */
      depth: number;
    }
  | {
      kind: 'deflect';
      target: number;
      /** Height (mm) above the board where the darts touched. */
      depth: number;
      /** Unit direction (board plane) the incoming dart was pushed. */
      dir: { x: number; y: number };
      /** How far (mm) the landing point moved. */
      shift: number;
      /** How far (rad) the incoming dart was knocked off its line. */
      angle: number;
      /** 0 = glancing touch on the flights, 1 = square hit on a barrel. */
      severity: number;
      /** Knocked out of the board altogether. */
      bounce: boolean;
      /** Only brushed the flights (soft) rather than steel or shaft. */
      soft: boolean;
    };

// Profile of a stuck dart, as distance (mm) from where its point enters.
const EXPOSED_TIP = DART.tipLength - DART.embed;
const BARREL_END = EXPOSED_TIP + DART.barrelLength;
const SHAFT_END = BARREL_END + DART.shaftLength;
const FLIGHT_START = SHAFT_END - DART.flightOverlap;
/** How far (mm) a dart in the board sticks out toward the thrower. */
export const DART_PROTRUSION = FLIGHT_START + DART.flightLength;

/** Lateral offset (mm) under which a dart can bury its point in the back of another. */
export const ROBIN_HOOD_RADIUS = 0.9;
/** Chance a dart that dead-centres the back of another lodges in it rather than glancing off. */
export const ROBIN_HOOD_CHANCE = 0.35;
/** Chance a square hit on another dart's barrel knocks the new dart out, by bounce-out setting. */
const DEFLECT_BOUNCE: Record<BounceSetting, number> = { realistic: 0.2, low: 0.08, off: 0 };
const MAX_SHIFT_MM = 30;

/** Radius of a stuck dart's rigid parts (point, barrel, shaft) `a` mm out from where it entered. */
function rigidRadius(a: number): number {
  if (a < 0) return 0;
  if (a < EXPOSED_TIP) return DART.tipRadius;
  if (a < BARREL_END) return DART.barrelRadius;
  if (a <= SHAFT_END) return DART.shaftRadius;
  return 0;
}

/**
 * Widest rigid part of the incoming dart that passes through height `h` (mm)
 * before its point stops in the board: only the point gets close to the board,
 * the barrel sweeps everything above the exposed tip length.
 */
const sweptRadius = (h: number) => (h < EXPOSED_TIP ? DART.tipRadius : DART.barrelRadius);

interface Contact {
  target: number;
  depth: number;
  dx: number;
  dy: number;
  overlap: number;
  severity: number;
}

/**
 * Check an incoming dart against the darts already in the board.
 * `impact` is where its point would enter the board (mm) and `slope` its
 * lateral drift per mm of height (from its impact velocity, v.xy / v.z).
 * Deterministic for a given rng state; returns null if it flies clean.
 */
export function checkCollision(
  impact: { x: number; y: number },
  slope: { x: number; y: number },
  stuck: readonly StuckDart[],
  rng: Rng,
  bounce: BounceSetting,
): Collision | null {
  let rigid: Contact | null = null;
  let soft: { target: number; depth: number; dx: number; dy: number; d: number } | null = null;

  for (let j = 0; j < stuck.length; j++) {
    const s = stuck[j]!;
    // Offset of the incoming line from the stuck dart's axis at height z.
    const delta = (z: number) => {
      const a = z - s.depth;
      return {
        dx: impact.x + slope.x * z - (s.x + s.sx * a),
        dy: impact.y + slope.y * z - (s.y + s.sy * a),
      };
    };

    const tail = s.depth + DART_PROTRUSION;
    const t = delta(tail);
    if (Math.hypot(t.dx, t.dy) < ROBIN_HOOD_RADIUS) {
      if (rng.next() < ROBIN_HOOD_CHANCE) return { kind: 'robinHood', target: j, depth: tail };
      // Glanced off the back of the shaft: a hard, square deflection.
      const overlap = DART.shaftRadius + DART.tipRadius - Math.hypot(t.dx, t.dy);
      const c = { target: j, depth: s.depth + SHAFT_END, ...t, overlap, severity: 0.9 };
      if (!rigid || c.severity > rigid.severity) rigid = c;
      continue;
    }

    for (let z = Math.ceil(tail); z >= s.depth; z--) {
      const a = z - s.depth;
      const { dx, dy } = delta(z);
      const d = Math.hypot(dx, dy);
      const rs = rigidRadius(a);
      if (rs > 0) {
        const ri = sweptRadius(z);
        const overlap = rs + ri - d;
        if (overlap > 0) {
          const severity = Math.min(1, overlap / (rs + ri));
          if (!rigid || severity > rigid.severity)
            rigid = { target: j, depth: z, dx, dy, overlap, severity };
        }
      }
      if (a >= FLIGHT_START && d < DART.flightHalfSpan + DART.barrelRadius) {
        if (!soft || d < soft.d) soft = { target: j, depth: z, dx, dy, d };
      }
    }
  }

  if (rigid) {
    const dir = unit(rigid.dx, rigid.dy, rng);
    const angle = 0.05 + 0.25 * rigid.severity + 0.05 * rng.next();
    const shift = Math.min(
      MAX_SHIFT_MM,
      rigid.overlap * 0.8 + Math.tan(angle) * rigid.depth * 0.15 + 0.5 * rng.next(),
    );
    return {
      kind: 'deflect',
      target: rigid.target,
      depth: rigid.depth,
      dir,
      shift,
      angle,
      severity: rigid.severity,
      bounce: rng.next() < DEFLECT_BOUNCE[bounce] * rigid.severity,
      soft: false,
    };
  }

  if (soft) {
    // Flights form a thin cross: the chance of actually touching a vane falls
    // off with distance from the shaft.
    const w = DART.barrelRadius + 0.5;
    const pTouch = Math.min(1, (4 * w) / (Math.PI * Math.max(soft.d, w)));
    if (rng.next() < pTouch) {
      return {
        kind: 'deflect',
        target: soft.target,
        depth: soft.depth,
        dir: unit(soft.dx, soft.dy, rng),
        shift: 0.5 + 2 * rng.next(),
        angle: 0.02 + 0.04 * rng.next(),
        severity: 0,
        bounce: false,
        soft: true,
      };
    }
  }
  return null;
}

function unit(x: number, y: number, rng: Rng) {
  const len = Math.hypot(x, y);
  if (len > 1e-6) return { x: x / len, y: y / len };
  const a = rng.next() * 2 * Math.PI;
  return { x: Math.cos(a), y: Math.sin(a) };
}

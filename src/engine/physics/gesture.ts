import type { FlickMetrics } from './throwModel';

export interface PointerSample {
  x: number;
  y: number;
  /** Milliseconds. */
  t: number;
}

export interface FlickAnalysis extends FlickMetrics {
  isThrow: boolean;
  /** Timestamp (ms) at which the flick motion began; aim is taken from before this. */
  flickStart: number;
}

/** Window of pointer history (ms before release) used to measure the flick. */
export const FLICK_WINDOW_MS = 100;
/** Minimum upward speed (viewport heights / s) for a release to count as a throw. */
export const MIN_THROW_SPEED = 0.8;
const MAX_TILT = (60 * Math.PI) / 180;

/**
 * Analyse the pointer trail at release. Screen coordinates (y down).
 * A slow release is not a throw — it just finishes aiming.
 */
export function analyzeFlick(samples: PointerSample[], viewportHeight: number): FlickAnalysis {
  const none: FlickAnalysis = {
    isThrow: false,
    speed: 0,
    angle: 0,
    unsteadiness: 0,
    curvature: 0,
    flickStart: samples[samples.length - 1]?.t ?? 0,
  };
  if (samples.length < 2) return none;
  const end = samples[samples.length - 1]!;
  const win = samples.filter((s) => end.t - s.t <= FLICK_WINDOW_MS);
  if (win.length < 2) return none;
  const first = win[0]!;
  const dt = (end.t - first.t) / 1000;
  if (dt <= 0) return none;

  const h = Math.max(viewportHeight, 1);
  const vx = (end.x - first.x) / h / dt;
  const vy = -(end.y - first.y) / h / dt; // up positive
  const speed = Math.hypot(vx, vy);
  const angle = Math.atan2(vx, vy);
  const isThrow = vy >= MIN_THROW_SPEED && Math.abs(angle) <= MAX_TILT;

  // Segment speeds -> coefficient of variation = unsteadiness.
  const segSpeeds: number[] = [];
  for (let i = 1; i < win.length; i++) {
    const a = win[i - 1]!;
    const b = win[i]!;
    const sdt = (b.t - a.t) / 1000;
    if (sdt > 0) segSpeeds.push(Math.hypot(b.x - a.x, b.y - a.y) / h / sdt);
  }
  let unsteadiness = 0;
  if (segSpeeds.length > 2) {
    const mean = segSpeeds.reduce((s, v) => s + v, 0) / segSpeeds.length;
    const sd = Math.sqrt(segSpeeds.reduce((s, v) => s + (v - mean) ** 2, 0) / segSpeeds.length);
    unsteadiness = mean > 0 ? Math.min(1, sd / mean) : 0;
  }

  // Max perpendicular deviation from the chord, relative to chord length.
  const cx = end.x - first.x;
  const cy = end.y - first.y;
  const len = Math.hypot(cx, cy);
  let curvature = 0;
  if (len > 1) {
    for (const s of win) {
      const dev = Math.abs((s.x - first.x) * cy - (s.y - first.y) * cx) / len;
      curvature = Math.max(curvature, dev / len);
    }
    curvature = Math.min(1, curvature * 4);
  }

  // Walk back from release while the pointer was moving quickly to find the flick start.
  let flickStart = end.t;
  for (let i = samples.length - 1; i > 0; i--) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    const sdt = (b.t - a.t) / 1000;
    const moved = Math.hypot(b.x - a.x, b.y - a.y);
    // The release event usually repeats the last move's position; skip such pairs.
    if (sdt <= 0.002 || (moved === 0 && i === samples.length - 1)) continue;
    const v = moved / h / sdt;
    if (v < MIN_THROW_SPEED * 0.5) break;
    flickStart = a.t;
  }

  return { isThrow, speed, angle, unsteadiness, curvature, flickStart };
}

/**
 * How still the pointer must be (fraction of viewport height) and for how long (ms)
 * to count as a steady aim.
 */
export const STEADY_RADIUS = 0.012;
export const STEADY_MS = 120;
/** A throw must be released within this long (ms) of leaving a steady aim. */
export const ARM_MS = 350;

/**
 * Tells an aiming drag from a throw. Darts players aim, settle, then throw, so a
 * flick only counts if it starts from a steady aim: the pointer held still for
 * STEADY_MS (or just pressed down), then released within ARM_MS. Lifting your
 * finger part-way through a fast aiming drag is just the end of aiming.
 *
 * Feed it pointer samples (any units, with the viewport height in the same
 * units) and timestamps in ms.
 */
export class SteadyTracker {
  private ax = 0;
  private ay = 0;
  /** When the pointer arrived at the current anchor. */
  private at = -Infinity;
  /** When the pointer last left a steady aim (or was pressed down). */
  private restEnd = -Infinity;
  private eps = 1;

  /** Pointer pressed down: landing your finger counts as a steady start. */
  start(x: number, y: number, t: number, viewportHeight: number) {
    this.eps = STEADY_RADIUS * Math.max(viewportHeight, 1);
    this.ax = x;
    this.ay = y;
    this.at = t;
    this.restEnd = t;
  }

  add(x: number, y: number, t: number) {
    if (Math.hypot(x - this.ax, y - this.ay) <= this.eps) return; // still steady
    // Leaving the anchor: if we'd been there long enough, a steady aim just ended.
    if (t - this.at >= STEADY_MS) this.restEnd = t;
    this.ax = x;
    this.ay = y;
    this.at = t;
  }

  /** Is the pointer holding a steady aim right now? */
  steady(now: number): boolean {
    return now - this.at >= STEADY_MS;
  }

  /** Would a flick released at `now` count as a throw? */
  armed(now: number): boolean {
    return this.steady(now) || now - this.restEnd <= ARM_MS;
  }
}

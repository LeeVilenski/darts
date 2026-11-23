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

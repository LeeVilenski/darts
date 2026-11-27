import type { AssistLevel } from './throwModel';

/**
 * Pressure sway: under pressure your aim won't keep still. The aim point
 * wanders slowly in a small loop; the dart goes where it is when you let go,
 * so on a match dart you have to time your release. Holding a steady aim for a
 * moment settles it a little, like taking a breath.
 */

/** Sway radius (mm) at full pressure, per assist level. A double is 8 mm deep. */
export const SWAY_MM: Record<AssistLevel, number> = { casual: 5, standard: 9, pro: 12 };
/** Below this much pressure there's no sway at all. */
export const SWAY_FROM = 0.15;
/** How much a settled aim calms the sway (fraction), and how long settling takes (s). */
export const SETTLE = { calm: 0.4, after: 0.4, over: 0.8 } as const;
/** Seconds for the sway to build at the start of a dart. */
export const SWAY_RAMP_S = 0.6;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * Sway radius (mm) for a pressure (0–1), assist level, how long the aim has
 * been held steady (s) and how long this dart has been aimed (s).
 */
export function swayAmplitude(
  pressure: number,
  assist: AssistLevel,
  steadyFor = 0,
  aimingFor = Infinity,
): number {
  if (!(pressure > SWAY_FROM)) return 0;
  const p = (Math.min(1, pressure) - SWAY_FROM) / (1 - SWAY_FROM);
  const settle = 1 - SETTLE.calm * smooth((steadyFor - SETTLE.after) / SETTLE.over);
  const ramp = smooth(aimingFor / SWAY_RAMP_S);
  return SWAY_MM[assist] * p * settle * ramp;
}

/**
 * Where the sway has taken the aim at time t (s), in mm, for a sway radius.
 * Two slow, unrelated wobbles per axis, so it never quite repeats; `seed`
 * varies the pattern from dart to dart.
 */
export function swayOffset(t: number, amplitude: number, seed = 0): { x: number; y: number } {
  if (amplitude <= 0) return { x: 0, y: 0 };
  const ph = (k: number) => ((seed * 2654435761 + k * 40503) % 6283) / 1000;
  const TAU = Math.PI * 2;
  return {
    x:
      amplitude *
      (0.62 * Math.sin(TAU * 0.53 * t + ph(1)) + 0.38 * Math.sin(TAU * 1.31 * t + ph(2))),
    y:
      amplitude *
      (0.62 * Math.sin(TAU * 0.71 * t + ph(3)) + 0.38 * Math.sin(TAU * 1.07 * t + ph(4))),
  };
}

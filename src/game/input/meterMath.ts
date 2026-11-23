/** The meter sweeps 0 → 1 → 0 with this half-period (ms). Mirrored by the CSS animation. */
export const METER_HALF_PERIOD_MS = 700;
/** Meter level 0.5 is a perfectly weighted throw; the ends are 0.3× and 1.7× the ideal speed. */
export const SPEED_SPAN = 1.4;

export function meterLevel(elapsedMs: number): number {
  const phase = elapsedMs / METER_HALF_PERIOD_MS;
  const frac = phase % 1;
  return Math.floor(phase) % 2 === 0 ? frac : 1 - frac;
}

/** Meter band that counts as "good weight" for a given dead zone (fraction of ideal speed). */
export const sweetBand = (deadZone: number) =>
  [0.5 - deadZone / SPEED_SPAN, 0.5 + deadZone / SPEED_SPAN] as const;

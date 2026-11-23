import type { AssistTuning } from '../physics/throwModel';

export type AiLevel = 'pub' | 'club' | 'county' | 'pro';

export const AI_LEVELS: AiLevel[] = ['pub', 'club', 'county', 'pro'];

export interface AiSkill {
  label: string;
  /** Typical 3-dart average this level is calibrated to. */
  targetAverage: number;
  /** Per-axis scatter at the board (mm, 1σ). */
  sigmaMm: number;
  /** Chance of a loose dart thrown with OUTLIER_FACTOR × the scatter. */
  outlierChance: number;
  /** Think time before each dart (ms, min–max). */
  thinkMs: [number, number];
}

export const OUTLIER_FACTOR = 2.5;

/** Calibrated with src/engine/ai/calibration.test.ts (simulated 501 legs). */
export const AI_SKILL: Record<AiLevel, AiSkill> = {
  pub: { label: 'Pub', targetAverage: 40, sigmaMm: 20, outlierChance: 0.08, thinkMs: [700, 1300] },
  club: {
    label: 'Club',
    targetAverage: 60,
    sigmaMm: 13,
    outlierChance: 0.06,
    thinkMs: [600, 1100],
  },
  county: {
    label: 'County',
    targetAverage: 80,
    sigmaMm: 9,
    outlierChance: 0.04,
    thinkMs: [500, 900],
  },
  pro: { label: 'Pro', targetAverage: 100, sigmaMm: 6.2, outlierChance: 0.03, thinkMs: [400, 800] },
};

/** Launch tuning for an AI dart: a perfect flick with scatter as the only error. */
export function aiTuning(sigmaMm: number): AssistTuning {
  return {
    powerDeadZone: 1,
    powerGain: 0,
    lateralGain: 0,
    scatterMm: sigmaMm,
    unsteadyScatterMm: 0,
  };
}

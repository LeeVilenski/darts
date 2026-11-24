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
  /** Extra scatter, as a fraction of sigmaMm, under full pressure (a match dart). */
  nerve: number;
  /** Extra chance of a loose dart under full pressure: bottling it. */
  bottle: number;
  /** Notices a treble blocked by its own darts and aims around it, or switches to T19. */
  readsBlockers: boolean;
}

export const OUTLIER_FACTOR = 2.5;

/**
 * Calibrated with src/engine/ai/calibration.test.ts (simulated 501 legs, with
 * dart-on-dart collisions and nerves on finishing darts included).
 */
export const AI_SKILL: Record<AiLevel, AiSkill> = {
  pub: {
    label: 'Pub',
    targetAverage: 40,
    sigmaMm: 17,
    outlierChance: 0.08,
    thinkMs: [700, 1300],
    nerve: 0.5,
    bottle: 0.14,
    readsBlockers: false,
  },
  club: {
    label: 'Club',
    targetAverage: 60,
    sigmaMm: 12,
    outlierChance: 0.06,
    thinkMs: [600, 1100],
    nerve: 0.4,
    bottle: 0.08,
    readsBlockers: false,
  },
  county: {
    label: 'County',
    targetAverage: 80,
    sigmaMm: 8.4,
    outlierChance: 0.04,
    thinkMs: [500, 900],
    nerve: 0.25,
    bottle: 0.03,
    readsBlockers: true,
  },
  pro: {
    label: 'Pro',
    targetAverage: 100,
    sigmaMm: 5.5,
    outlierChance: 0.03,
    thinkMs: [400, 800],
    nerve: 0.15,
    bottle: 0.01,
    readsBlockers: true,
  },
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

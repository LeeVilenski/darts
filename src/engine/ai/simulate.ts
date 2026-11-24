import type { StuckDart } from '../board/collision';
import type { BounceSetting } from '../board/resolveHit';
import { toDartScore } from '../modes/dart';
import { applyDart, createX01, DEFAULT_X01, endTurn, type X01Options } from '../modes/x01';
import { resolveDart, stuckDartOf } from '../physics/resolveDart';
import { computeLaunch, PERFECT_FLICK, type LaunchParams } from '../physics/throwModel';
import type { Rng } from '../rng';
import { NEUTRAL_PERSONALITY, TEMPERAMENT, TEMPO, type AiPersonality } from './personality';
import { pressureOn } from './pressure';
import { AI_SKILL, aiTuning, OUTLIER_FACTOR, type AiLevel } from './skill';
import type { MatchState } from '../modes/match';
import { aimAround, chooseTargetFor, type AiTarget } from './strategy';

export interface AiContext {
  personality?: AiPersonality;
  /** Darts already in the board this turn. */
  stuck?: readonly StuckDart[];
}

export interface AiIntent {
  target: AiTarget;
  /** 0–1: how much rides on this dart. */
  pressure: number;
}

export interface AiThrow extends AiIntent {
  launch: LaunchParams;
}

/** What the AI will aim at and how much is riding on it (no randomness). */
export function aiIntent(state: MatchState, level: AiLevel, ctx: AiContext = {}): AiIntent {
  const personality = ctx.personality ?? NEUTRAL_PERSONALITY;
  let target = chooseTargetFor(state, personality.favouriteDouble);
  if (AI_SKILL[level].readsBlockers && ctx.stuck?.length)
    target = aimAround(target, ctx.stuck, state);
  return { target, pressure: pressureOn(state, target) };
}

/** Think time (ms) before a dart: the bot's tempo, plus a longer settle when it matters. */
export function aiThinkMs(
  level: AiLevel,
  personality: AiPersonality,
  pressure: number,
  u: number,
): number {
  const [lo, hi] = AI_SKILL[level].thinkMs;
  return (lo + u * (hi - lo) + pressure * 900) * TEMPO[personality.tempo].think;
}

/**
 * Plan one AI dart: choose a target, then launch at it with the level's
 * scatter, widened by nerves when the dart matters.
 */
export function planAiThrow(
  state: MatchState,
  level: AiLevel,
  rng: Rng,
  ctx: AiContext = {},
): AiThrow {
  const skill = AI_SKILL[level];
  const { target, pressure } = aiIntent(state, level, ctx);
  const nerves = pressure * TEMPERAMENT[(ctx.personality ?? NEUTRAL_PERSONALITY).temperament].nerve;
  const sigma = skill.sigmaMm * (1 + nerves * skill.nerve);
  const loose = rng.next() < skill.outlierChance + nerves * skill.bottle;
  const launch = computeLaunch(
    target.point,
    PERFECT_FLICK,
    aiTuning(loose ? sigma * OUTLIER_FACTOR : sigma),
    rng,
  );
  return { target, pressure, launch };
}

/** Play a full solo leg headlessly; returns darts used and the 3-dart average. */
export function simulateLeg(
  level: AiLevel,
  rng: Rng,
  options: X01Options = DEFAULT_X01,
  bounce: BounceSetting = 'realistic',
  maxDarts = 300,
  personality: AiPersonality = NEUTRAL_PERSONALITY,
): { darts: number; average: number; finished: boolean } {
  let s = createX01(['AI'], options);
  let stuck: StuckDart[] = [];
  while (s.status !== 'matchWon' && s.players[0]!.stats.darts < maxDarts) {
    if (s.status !== 'open') {
      s = endTurn(s);
      stuck = [];
    }
    const { launch } = planAiThrow(s, level, rng, { personality, stuck });
    const dart = resolveDart(launch, stuck, rng, bounce);
    const left = stuckDartOf(dart);
    if (left) stuck = [...stuck, left];
    s = applyDart(s, toDartScore(dart.result));
  }
  const stats = s.players[0]!.stats;
  return {
    darts: stats.darts,
    average: (stats.points / stats.darts) * 3,
    finished: s.status === 'matchWon',
  };
}

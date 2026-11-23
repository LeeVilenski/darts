import { resolveHit, type BounceSetting } from '../board/resolveHit';
import { toDartScore } from '../modes/dart';
import {
  applyDart,
  createX01,
  DEFAULT_X01,
  endTurn,
  type X01Options,
  type X01State,
} from '../modes/x01';
import { simulateFlight, worldToBoardMm } from '../physics/ballistics';
import { computeLaunch, PERFECT_FLICK, type LaunchParams } from '../physics/throwModel';
import type { Rng } from '../rng';
import { AI_SKILL, aiTuning, OUTLIER_FACTOR, type AiLevel } from './skill';
import { chooseTarget, type AiTarget } from './strategy';

export interface AiThrow {
  target: AiTarget;
  launch: LaunchParams;
}

/** Plan one AI dart: choose a target, then launch at it with the level's scatter. */
export function planAiThrow(state: X01State, level: AiLevel, rng: Rng): AiThrow {
  const skill = AI_SKILL[level];
  const target = chooseTarget(state);
  const sigma = rng.next() < skill.outlierChance ? skill.sigmaMm * OUTLIER_FACTOR : skill.sigmaMm;
  const launch = computeLaunch(target.point, PERFECT_FLICK, aiTuning(sigma), rng);
  return { target, launch };
}

/** Headless: throw one planned dart through the same physics and resolver as the game. */
export function resolveThrow(launch: LaunchParams, rng: Rng, bounce: BounceSetting) {
  const flight = simulateFlight(launch.p0, launch.v0);
  if (!flight.impact) return { flight, result: { kind: 'miss' as const, r: Infinity, angle: 0 } };
  const mm = worldToBoardMm(flight.impact);
  return { flight, result: resolveHit(mm.x, mm.y, rng, bounce) };
}

/** Play a full solo leg headlessly; returns darts used and the 3-dart average. */
export function simulateLeg(
  level: AiLevel,
  rng: Rng,
  options: X01Options = DEFAULT_X01,
  bounce: BounceSetting = 'realistic',
  maxDarts = 300,
): { darts: number; average: number; finished: boolean } {
  let s = createX01(['AI'], options);
  while (s.status !== 'matchWon' && s.players[0]!.stats.darts < maxDarts) {
    if (s.status !== 'open') s = endTurn(s);
    const { launch } = planAiThrow(s, level, rng);
    s = applyDart(s, toDartScore(resolveThrow(launch, rng, bounce).result));
  }
  const stats = s.players[0]!.stats;
  return {
    darts: stats.darts,
    average: (stats.points / stats.darts) * 3,
    finished: s.status === 'matchWon',
  };
}

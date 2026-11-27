import { scorePoint, type HitResult } from '../board/resolveHit';
import type { AssistTuning } from '../physics/throwModel';
import type { Rng } from '../rng';

/**
 * Your career player's throwing attributes. A low rating doesn't move your
 * aim: it makes the consequences of a slightly-off dart bigger (more scatter,
 * the odd wild dart, a shakier aim under pressure). At 99 you throw exactly as
 * in the normal game, and a touch steadier under pressure.
 */
export type Attr = 'scoring' | 'finishing' | 'nerve' | 'rhythm';
export const ATTRS: Attr[] = ['scoring', 'finishing', 'nerve', 'rhythm'];
export type Ratings = Record<Attr, number>;

export const ATTR_INFO: Record<Attr, { label: string; blurb: string; trainedBy: string }> = {
  scoring: {
    label: 'Scoring',
    blurb: 'How tightly your darts group. Low: they spray, and the odd one goes wild.',
    trainedBy: 'Trebles, tons and 180s',
  },
  finishing: {
    label: 'Finishing',
    blurb: 'Accuracy on doubles and the bull.',
    trainedBy: 'Doubles hit and checkouts',
  },
  nerve: {
    label: 'Nerve',
    blurb: 'How much pressure shakes your aim on big darts.',
    trainedBy: 'Hitting under pressure, winning deciders',
  },
  rhythm: {
    label: 'Rhythm',
    blurb: 'How forgiving the game is of a snatched or mistimed release.',
    trainedBy: 'Clean, steady releases',
  },
};

export const MIN_RATING = 1;
export const MAX_RATING = 99;
/** Your ceiling per tier: you can't max out at the pub. */
export const TIER_CAPS = [40, 60, 80, 99];
export const START_RATING = 10;

export interface PlayerAttributes {
  ratings: Ratings;
  /** XP banked towards the next point of each attribute. */
  progress: Ratings;
  level: number;
  /** XP towards the next level. */
  xp: number;
  /** Unspent skill points. */
  points: number;
}

const each = (f: (a: Attr) => number): Ratings =>
  Object.fromEntries(ATTRS.map((a) => [a, f(a)])) as Ratings;

export function newAttributes(start = START_RATING): PlayerAttributes {
  return { ratings: each(() => start), progress: each(() => 0), level: 1, xp: 0, points: 0 };
}

/** Attributes for a career already on a tier (old saves): middling for that tier. */
export function attributesForTier(tier: number): PlayerAttributes {
  const lo = tier === 0 ? START_RATING : TIER_CAPS[tier - 1]!;
  return { ...newAttributes(Math.round(lo + (TIER_CAPS[tier]! - lo) * 0.2)), level: 1 + tier * 5 };
}

/** Attribute XP needed to go from rating r to r+1. */
export const attrCost = (r: number) => 10 + r;
/** Player XP needed to go from level L to L+1. */
export const levelCost = (level: number) => 80 + 40 * level;
/** Skill points per level-up. */
export const POINTS_PER_LEVEL = 2;

/** XP earned, per attribute and for your level. */
export interface XpGain {
  attrs: Ratings;
  player: number;
}

export interface AttributeChange {
  attrs: PlayerAttributes;
  /** Attributes that went up, from → to. */
  raised: { attr: Attr; from: number; to: number }[];
  levelsGained: number;
}

/** Bank XP: raise attributes (up to the tier cap) and your level. */
export function applyXp(a: PlayerAttributes, gain: XpGain, tier: number): AttributeChange {
  const cap = TIER_CAPS[tier] ?? MAX_RATING;
  const ratings = { ...a.ratings };
  const progress = { ...a.progress };
  const raised: AttributeChange['raised'] = [];
  for (const attr of ATTRS) {
    const from = ratings[attr];
    progress[attr] += Math.max(0, Math.round(gain.attrs[attr]));
    while (ratings[attr] < cap && progress[attr] >= attrCost(ratings[attr])) {
      progress[attr] -= attrCost(ratings[attr]);
      ratings[attr]++;
    }
    // At the cap, XP still banks (up to one point's worth) for when the cap rises.
    if (ratings[attr] >= cap) progress[attr] = Math.min(progress[attr], attrCost(ratings[attr]));
    if (ratings[attr] > from) raised.push({ attr, from, to: ratings[attr] });
  }
  let { level, xp, points } = a;
  xp += Math.max(0, Math.round(gain.player));
  let levelsGained = 0;
  while (xp >= levelCost(level)) {
    xp -= levelCost(level);
    level++;
    levelsGained++;
    points += POINTS_PER_LEVEL;
  }
  return { attrs: { ratings, progress, level, xp, points }, raised, levelsGained };
}

/** Spend a skill point on an attribute (if you have one and it's under the cap). */
export function spendPoint(a: PlayerAttributes, attr: Attr, tier: number): PlayerAttributes {
  const cap = TIER_CAPS[tier] ?? MAX_RATING;
  if (a.points <= 0 || a.ratings[attr] >= cap) return a;
  return { ...a, points: a.points - 1, ratings: { ...a.ratings, [attr]: a.ratings[attr] + 1 } };
}

/** When the cap rises (promotion), banked XP can raise ratings straight away. */
export const recheck = (a: PlayerAttributes, tier: number) =>
  applyXp(a, { attrs: each(() => 0), player: 0 }, tier);

/* ------------------------------------------------------------------ the throw */

/** 0 at rating 1, 1 at rating 99. */
const t = (r: number) => Math.min(1, Math.max(0, (r - MIN_RATING) / (MAX_RATING - MIN_RATING)));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const SCATTER = { worst: 1.55, best: 1.0 };
export const WILD = { chance: 0.08, factor: 2.5 };
export const DOUBLES = { worst: 1.6, best: 1.0 };
export const SWAY = { worst: 1.8, best: 0.7 };
export const PRESSURE_SCATTER = 0.6;
export const RELEASE = { worst: 2.0, best: 0.8 };
export const DEAD_ZONE = { worst: 0.5, best: 1.2 };

/** The aim point is on a double or the bull: Finishing applies. */
export function aimsAtFinish(aim: { x: number; y: number }): boolean {
  const hit = scorePoint(aim.x, aim.y);
  return hit.kind === 'score' && (hit.ring === 'double' || hit.ring === 'innerBull');
}

/** How much the pressure sway is scaled for your Nerve. */
export const swayScale = (r: Ratings) => lerp(SWAY.worst, SWAY.best, t(r.nerve));

/**
 * Your throw, adjusted for your attributes. `pressure` is 0–1 as for the
 * sway. Uses one random draw (for a wild dart).
 */
export function careerTuning(
  base: AssistTuning,
  r: Ratings,
  aim: { x: number; y: number },
  pressure: number,
  rng: Rng,
): { tuning: AssistTuning; wild: boolean } {
  let scatter = lerp(SCATTER.worst, SCATTER.best, t(r.scoring));
  if (aimsAtFinish(aim)) scatter *= lerp(DOUBLES.worst, DOUBLES.best, t(r.finishing));
  scatter *= 1 + Math.min(1, Math.max(0, pressure)) * PRESSURE_SCATTER * (1 - t(r.nerve));
  const wild = rng.next() < WILD.chance * (1 - t(r.scoring));
  if (wild) scatter *= WILD.factor;
  return {
    wild,
    tuning: {
      ...base,
      scatterMm: base.scatterMm * scatter,
      unsteadyScatterMm:
        base.unsteadyScatterMm * scatter * lerp(RELEASE.worst, RELEASE.best, t(r.rhythm)),
      powerDeadZone: base.powerDeadZone * lerp(DEAD_ZONE.worst, DEAD_ZONE.best, t(r.rhythm)),
    },
  };
}

/* ------------------------------------------------------------------ earning XP */

/** One of your darts in a career match or training session. */
export interface DartRecord {
  /** Where you aimed (before sway), board mm. */
  aim: { x: number; y: number };
  result: HitResult;
  pressure: number;
  unsteadiness: number;
}

/** The dart hit what it was aimed at (same bed). */
export function onTarget(d: DartRecord): boolean {
  const aimed = scorePoint(d.aim.x, d.aim.y);
  return d.result.kind === 'score' && aimed.kind === 'score' && d.result.label === aimed.label;
}

/** What a match's darts are worth, per attribute. */
export function xpFromDarts(darts: readonly DartRecord[]): Ratings {
  const gain = each(() => 0);
  for (const d of darts) {
    const aimed = scorePoint(d.aim.x, d.aim.y);
    const hit = d.result.kind === 'score' ? d.result : null;
    const onTarget = !!hit && aimed.kind === 'score' && hit.label === aimed.label;
    const atFinish =
      aimed.kind === 'score' && (aimed.ring === 'double' || aimed.ring === 'innerBull');
    if (hit?.ring === 'treble') gain.scoring += 2;
    else if (hit && hit.points >= 15) gain.scoring += 0.5;
    if (atFinish) gain.finishing += onTarget ? 5 : 0.5;
    if (d.pressure > 0.3) gain.nerve += onTarget ? 6 : 0.5;
    if (d.unsteadiness < 0.25) gain.rhythm += 0.6;
  }
  return gain;
}

/** Bonus XP for big visits: tons and 180s train Scoring. */
export function xpFromVisits(tons: number, oneEighties: number): number {
  return tons * 3 + oneEighties * 12;
}

/** Player XP for a match: playing, winning, legs, and beating a stronger player. */
export function matchXp(won: boolean, legsWon: number, upset: boolean, tier: number): number {
  return Math.round(
    (20 + legsWon * 6 + (won ? 25 : 0) + (won && upset ? 20 : 0)) * (1 + tier * 0.25),
  );
}

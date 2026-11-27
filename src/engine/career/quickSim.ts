import type { AiLevel } from '../ai/skill';
import type { X01Options } from '../modes/x01';
import type { Rng } from '../rng';

/**
 * Fast match results for AI-only matches the player isn't in. Each leg, each
 * player's darts-to-finish is drawn from their level's distribution (fitted
 * to full physics simulations: see quickSim.test.ts); fewer visits wins, and
 * the player throwing first wins a tie.
 */
export const LEG_DARTS: Record<AiLevel, { mean: number; sd: number }> = {
  pub: { mean: 39.5, sd: 14 },
  club: { mean: 26.7, sd: 7.1 },
  county: { mean: 19.6, sd: 4.1 },
  pro: { mean: 15.2, sd: 2.4 },
};

/** Lognormal draw with the given mean and sd (right-skewed, like real legs). */
function legDarts(level: AiLevel, rng: Rng): number {
  const { mean, sd } = LEG_DARTS[level];
  const s2 = Math.log(1 + (sd * sd) / (mean * mean));
  const mu = Math.log(mean) - s2 / 2;
  return Math.max(9, Math.exp(mu + Math.sqrt(s2) * rng.gaussian()));
}

/** One leg: true if a wins. */
export function quickLeg(a: AiLevel, b: AiLevel, aStarts: boolean, rng: Rng): boolean {
  const va = Math.ceil(legDarts(a, rng) / 3);
  const vb = Math.ceil(legDarts(b, rng) / 3);
  return va === vb ? aStarts : va < vb;
}

/** A whole match in the given format. Returns the winner (0 = a) and legs/sets won. */
export function quickMatch(
  a: AiLevel,
  b: AiLevel,
  o: X01Options,
  rng: Rng,
): { winner: 0 | 1; score: [number, number] } {
  let aStarts = rng.next() < 0.5;
  const playSet = (): boolean => {
    let la = 0;
    let lb = 0;
    while (la < o.legsToWin && lb < o.legsToWin) {
      if (quickLeg(a, b, aStarts, rng)) la++;
      else lb++;
      aStarts = !aStarts;
    }
    return la > lb;
  };
  if (!o.setsToWin) {
    let la = 0;
    let lb = 0;
    while (la < o.legsToWin && lb < o.legsToWin) {
      if (quickLeg(a, b, aStarts, rng)) la++;
      else lb++;
      aStarts = !aStarts;
    }
    return { winner: la > lb ? 0 : 1, score: [la, lb] };
  }
  let sa = 0;
  let sb = 0;
  while (sa < o.setsToWin && sb < o.setsToWin) {
    if (playSet()) sa++;
    else sb++;
  }
  return { winner: sa > sb ? 0 : 1, score: [sa, sb] };
}

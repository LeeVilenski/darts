/**
 * Helpers for games played in rounds (everyone throws once per round) where
 * some players can drop out (Killer, Bob's 27) or finish early (121).
 */

/** Seat position within a round, 0 for whoever started the leg. */
export const seat = (i: number, legStarter: number, n: number) => (i - legStarter + n) % n;

/** Nobody still playing throws after player `i` in this round. */
export function endsRound(i: number, legStarter: number, active: readonly boolean[]): boolean {
  const n = active.length;
  return active.every((a, j) => !a || j === i || seat(j, legStarter, n) < seat(i, legStarter, n));
}

/** Next player still in the game after `i`, and whether that starts a new round. */
export function nextActive(
  i: number,
  legStarter: number,
  active: readonly boolean[],
): { next: number; newRound: boolean } {
  const n = active.length;
  for (let k = 1; k <= n; k++) {
    const j = (i + k) % n;
    if (active[j]) return { next: j, newRound: seat(j, legStarter, n) <= seat(i, legStarter, n) };
  }
  return { next: i, newRound: true };
}

/**
 * Index of the best player by `score` (higher is better), ties broken by
 * `tiebreak` (higher is better), then by who threw first in the leg.
 */
export function leader(
  scores: readonly number[],
  tiebreak: readonly number[],
  legStarter: number,
): number {
  const n = scores.length;
  let best = legStarter;
  for (let k = 1; k < n; k++) {
    const j = (legStarter + k) % n;
    if (
      scores[j]! > scores[best]! ||
      (scores[j] === scores[best] && tiebreak[j]! > tiebreak[best]!)
    )
      best = j;
  }
  return best;
}

/** Seeded single-elimination draws. */

export interface BracketMatch {
  a: string;
  b: string;
  winner: string | null;
  /** Legs (or sets) won by a and b. */
  score: [number, number] | null;
}

/**
 * Standard seeding order for a power-of-two field: seed 1 meets the lowest
 * seed, and 1 and 2 can only meet in the final. Returns 0-based seed indices.
 */
export function seedOrder(size: number): number[] {
  let order = [0];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n - 1 - s]);
  }
  return order;
}

/** First-round matches for a field listed best seed first. */
export function drawBracket(seeded: readonly string[]): BracketMatch[] {
  const order = seedOrder(seeded.length);
  const out: BracketMatch[] = [];
  for (let k = 0; k < order.length; k += 2)
    out.push({ a: seeded[order[k]!]!, b: seeded[order[k + 1]!]!, winner: null, score: null });
  return out;
}

/** Pair the winners of a finished round. */
export function nextRound(round: readonly BracketMatch[]): BracketMatch[] {
  const out: BracketMatch[] = [];
  for (let k = 0; k < round.length; k += 2)
    out.push({ a: round[k]!.winner!, b: round[k + 1]!.winner!, winner: null, score: null });
  return out;
}

/** The round each player went out in (rounds.length for the winner). */
export function reachedRounds(rounds: readonly BracketMatch[][]): Record<string, number> {
  const out: Record<string, number> = {};
  rounds.forEach((round, r) =>
    round.forEach((m) => {
      out[m.a] = r;
      out[m.b] = r;
    }),
  );
  const final = rounds.at(-1)?.[0];
  if (final?.winner && rounds.at(-1)!.length === 1) out[final.winner] = rounds.length;
  return out;
}

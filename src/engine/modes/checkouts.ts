/** A target a player can aim at, with its label and value. */
interface Seg {
  label: string;
  points: number;
  double: boolean;
  /** Higher = harder / less desirable as a set-up dart. */
  cost: number;
}

const SEGMENTS: Seg[] = (() => {
  const out: Seg[] = [];
  for (let n = 1; n <= 20; n++) {
    out.push({ label: `S${n}`, points: n, double: false, cost: 1 });
    // T20 is the natural target; lower trebles are progressively less desirable.
    out.push({
      label: `T${n}`,
      points: n * 3,
      double: false,
      cost: n === 20 ? 1.8 : 2 + (20 - n) * 0.1,
    });
    out.push({ label: `D${n}`, points: n * 2, double: true, cost: 4 });
  }
  out.push({ label: '25', points: 25, double: false, cost: 4 });
  out.push({ label: 'BULL', points: 50, double: true, cost: 5 });
  return out;
})();

/** Preferred finishing doubles, best first (common professional preferences). */
const DOUBLE_PREF = [
  'D20',
  'D16',
  'D8',
  'D10',
  'D18',
  'D12',
  'D4',
  'D6',
  'D2',
  'D14',
  'D9',
  'D5',
  'D7',
  'D15',
  'D3',
  'D11',
  'D13',
  'D17',
  'D19',
  'D1',
  'BULL',
];
const doubleRank = (label: string) => {
  const i = DOUBLE_PREF.indexOf(label);
  return i < 0 ? DOUBLE_PREF.length : i;
};

const FINISHERS = SEGMENTS.filter((s) => s.double);
const cache = new Map<string, string[] | null>();

/**
 * Suggested checkout route for a double-out finish of `remaining` using at most
 * `dartsLeft` darts, e.g. 170 -> ["T20", "T20", "BULL"]. Null when no finish exists.
 */
export function suggestCheckout(remaining: number, dartsLeft: number): string[] | null {
  if (remaining < 2 || remaining > 170 || dartsLeft < 1) return null;
  const key = `${remaining}/${dartsLeft}`;
  if (cache.has(key)) return cache.get(key)!;

  let best: { route: string[]; score: number } | null = null;
  const consider = (setup: Seg[], fin: Seg) => {
    // Fewer darts dominates; then easier set-up darts; then preferred double.
    const score =
      setup.length * 1000 + setup.reduce((s, x) => s + x.cost, 0) * 10 + doubleRank(fin.label);
    if (!best || score < best.score)
      best = { route: [...setup.map((x) => x.label), fin.label], score };
  };

  for (const fin of FINISHERS) {
    const r1 = remaining - fin.points;
    if (r1 === 0) consider([], fin);
    if (r1 <= 0 || dartsLeft < 2) continue;
    for (const a of SEGMENTS) {
      const r2 = r1 - a.points;
      if (r2 === 0) consider([a], fin);
      if (r2 <= 0 || dartsLeft < 3) continue;
      for (const b of SEGMENTS) {
        if (b.points === r2 && b.points <= a.points) consider([a, b], fin);
      }
    }
  }
  const result = best ? (best as { route: string[] }).route : null;
  cache.set(key, result);
  return result;
}

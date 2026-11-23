import { marksPerRound } from '../modes/cricket';
import type { MatchState } from '../modes/match';
import { threeDartAverage } from '../modes/x01';

export interface PlayerLifetime {
  matches: number;
  wins: number;
  x01: {
    matches: number;
    darts: number;
    points: number;
    bestAverage: number;
    bestCheckout: number;
    oneEighties: number;
    tons: number;
  };
  cricket: { matches: number; darts: number; marks: number; bestMpr: number };
  atc: { matches: number; completed: number; bestDarts: number | null };
  /** Last time this record changed (ms since epoch) — used to merge local and cloud copies. */
  updatedAt: number;
}

/** Lifetime stats keyed by player name (humans only). */
export type LifetimeStats = Record<string, PlayerLifetime>;

export const emptyLifetime = (): PlayerLifetime => ({
  matches: 0,
  wins: 0,
  x01: {
    matches: 0,
    darts: 0,
    points: 0,
    bestAverage: 0,
    bestCheckout: 0,
    oneEighties: 0,
    tons: 0,
  },
  cricket: { matches: 0, darts: 0, marks: 0, bestMpr: 0 },
  atc: { matches: 0, completed: 0, bestDarts: null },
  updatedAt: 0,
});

/** Fold a finished match into lifetime stats for the players marked as human. */
export function recordMatchInto(
  stats: LifetimeStats,
  match: MatchState,
  isHuman: (index: number) => boolean,
  now = Date.now(),
): LifetimeStats {
  const out = { ...stats };
  match.players.forEach((p, i) => {
    if (!isHuman(i)) return;
    const prev = out[p.name] ?? emptyLifetime();
    const won = match.winner === i;
    const next: PlayerLifetime = {
      ...prev,
      matches: prev.matches + 1,
      wins: prev.wins + (won ? 1 : 0),
      updatedAt: now,
    };
    if (match.mode === 'x01') {
      const s = match.players[i]!.stats;
      next.x01 = {
        matches: prev.x01.matches + 1,
        darts: prev.x01.darts + s.darts,
        points: prev.x01.points + s.points,
        bestAverage: Math.max(prev.x01.bestAverage, threeDartAverage(s)),
        bestCheckout: Math.max(prev.x01.bestCheckout, s.bestCheckout),
        oneEighties: prev.x01.oneEighties + s.oneEighties,
        tons: prev.x01.tons + s.tons + s.ton40s,
      };
    } else if (match.mode === 'cricket') {
      const pl = match.players[i]!;
      next.cricket = {
        matches: prev.cricket.matches + 1,
        darts: prev.cricket.darts + pl.stats.darts,
        marks: prev.cricket.marks + pl.stats.marks,
        bestMpr: Math.max(prev.cricket.bestMpr, marksPerRound(pl)),
      };
    } else {
      const pl = match.players[i]!;
      next.atc = {
        matches: prev.atc.matches + 1,
        completed: prev.atc.completed + (won ? 1 : 0),
        bestDarts: won
          ? Math.min(prev.atc.bestDarts ?? Infinity, pl.stats.darts)
          : prev.atc.bestDarts,
      };
    }
    out[p.name] = next;
  });
  return out;
}

/** Merge two copies (e.g. local and cloud): per player, the most recently updated record wins. */
export function mergeLifetime(a: LifetimeStats, b: LifetimeStats): LifetimeStats {
  const out: LifetimeStats = { ...a };
  for (const [name, rec] of Object.entries(b)) {
    const mine = out[name];
    if (!mine || rec.updatedAt > mine.updatedAt) out[name] = rec;
  }
  return out;
}

export const lifetimeAverage = (p: PlayerLifetime) =>
  p.x01.darts ? (p.x01.points / p.x01.darts) * 3 : 0;
export const lifetimeMpr = (p: PlayerLifetime) =>
  p.cricket.darts ? (p.cricket.marks / p.cricket.darts) * 3 : 0;

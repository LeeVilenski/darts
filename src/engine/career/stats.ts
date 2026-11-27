import type { PlayerStats } from '../modes/x01';

/** One of your career matches, for the form guide and career history. */
export interface CareerMatchLog {
  season: number;
  tier: number;
  event: string;
  round: number;
  /** "Quarter-final", "Last 32"... (older logs: missing). */
  roundName?: string;
  opponent: string;
  /** Opponent's name at the time (older logs: missing). */
  opponentName?: string;
  won: boolean;
  /** Your legs/sets, then theirs. */
  score: [number, number];
  average: number;
}

/** Your record across every career match. */
export interface CareerStats {
  matches: number;
  wins: number;
  legsWon: number;
  legsLost: number;
  darts: number;
  points: number;
  bestAverage: number;
  oneEighties: number;
  /** 100+ visits (including 140+). */
  tons: number;
  highestCheckout: number;
  /** Head-to-head by opponent id: [your wins, their wins]. */
  h2h: Record<string, [number, number]>;
  /** Most recent last, capped at LOG_SIZE. */
  log: CareerMatchLog[];
}

export const LOG_SIZE = 60;

export const emptyCareerStats = (): CareerStats => ({
  matches: 0,
  wins: 0,
  legsWon: 0,
  legsLost: 0,
  darts: 0,
  points: 0,
  bestAverage: 0,
  oneEighties: 0,
  tons: 0,
  highestCheckout: 0,
  h2h: {},
  log: [],
});

export interface MatchSummary {
  opponent: string;
  opponentName?: string;
  won: boolean;
  /** Your legs/sets, then theirs. */
  score: [number, number];
  /** Legs won and lost across the whole match (equal to score without sets). */
  legs: [number, number];
  /** Your x01 stats for the match. */
  stats: PlayerStats;
}

const avg = (s: Pick<PlayerStats, 'darts' | 'points'>) => (s.darts ? (s.points / s.darts) * 3 : 0);

export function addMatch(
  prev: CareerStats,
  m: MatchSummary,
  where: { season: number; tier: number; event: string; round: number; roundName?: string },
): CareerStats {
  const average = avg(m.stats);
  const [w, l] = prev.h2h[m.opponent] ?? [0, 0];
  return {
    matches: prev.matches + 1,
    wins: prev.wins + (m.won ? 1 : 0),
    legsWon: prev.legsWon + m.legs[0],
    legsLost: prev.legsLost + m.legs[1],
    darts: prev.darts + m.stats.darts,
    points: prev.points + m.stats.points,
    bestAverage: Math.max(prev.bestAverage, average),
    oneEighties: prev.oneEighties + m.stats.oneEighties,
    tons: prev.tons + m.stats.tons + m.stats.ton40s + m.stats.oneEighties,
    highestCheckout: Math.max(prev.highestCheckout, m.stats.bestCheckout),
    h2h: { ...prev.h2h, [m.opponent]: m.won ? [w + 1, l] : [w, l + 1] },
    log: [
      ...prev.log,
      {
        ...where,
        opponent: m.opponent,
        opponentName: m.opponentName,
        won: m.won,
        score: m.score,
        average,
      },
    ].slice(-LOG_SIZE),
  };
}

export const careerAverage = (s: CareerStats) => avg(s);
export const winRate = (s: CareerStats) => (s.matches ? s.wins / s.matches : 0);
/** Last n results, oldest first. */
export const form = (s: CareerStats, n = 5) => s.log.slice(-n).map((m) => (m.won ? 'W' : 'L'));

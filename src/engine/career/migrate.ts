import { attributesForTier, type PlayerAttributes } from './attributes';
import {
  buildCalendar,
  grantCard,
  newCareer,
  type CareerState,
  type EventResult,
  type Trophy,
} from './career';
import { CIRCUITS } from './circuits';
import { emptyCareerStats, type CareerStats } from './stats';

/** The parts of a version-1 save that carry over. */
interface CareerV1 {
  version: 1;
  seed: number;
  you: string;
  tier: number;
  season: number;
  roster: { id: string; name: string }[];
  results: {
    season: number;
    tier: number;
    name: string;
    reached: 'QF' | 'SF' | 'F' | 'W';
    points: number;
    prize: number;
  }[];
  trophies: { season: number; tier: number; name: string }[];
  earnings: number;
  stats?: CareerStats;
  attributes?: PlayerAttributes;
}

const REACHED = { QF: 0, SF: 1, F: 2, W: 3 } as const;

/**
 * Bring an old (8-player, four-tier) career into the season calendar: your
 * tier becomes the cards you hold, and your results, trophies, earnings, stats
 * and attributes carry over. You start the current season afresh at week 1.
 */
export function migrateV1(old: CareerV1): CareerState {
  let c = newCareer(old.you, old.seed);
  const tier = Math.min(3, Math.max(0, old.tier));
  if (tier >= 3) c = grantCard({ ...c, season: old.season - 1 }, 'tour');
  else if (tier === 2) c = grantCard(c, 'challenge');
  else if (tier === 1) c = grantCard(c, 'county');
  const names = new Map(old.roster.map((p) => [p.id, p.name]));
  const stats = old.stats ?? emptyCareerStats();
  const results: EventResult[] = old.results.map((r, i) => ({
    season: r.season,
    week: 0,
    id: `v1-${i}`,
    name: r.name,
    circuit: CIRCUITS[r.tier] ?? 'pub',
    kind: 'open',
    field: 8,
    round: REACHED[r.reached],
    points: r.points,
    prize: r.prize,
  }));
  const trophies: Trophy[] = old.trophies.map((t) => ({
    season: t.season,
    name: t.name,
    circuit: CIRCUITS[t.tier] ?? 'pub',
    tier: t.tier,
  }));
  return {
    ...c,
    season: old.season,
    calendar: buildCalendar(old.season),
    results,
    trophies,
    earnings: old.earnings,
    attributes: old.attributes ?? attributesForTier(tier),
    stats: {
      ...stats,
      // Old opponent ids belong to the old roster: keep their names, drop head-to-heads.
      h2h: {},
      log: stats.log.map((m) => ({ ...m, opponentName: m.opponentName ?? names.get(m.opponent) })),
    },
  };
}

/** Load any saved career version. */
export function loadCareer(raw: unknown): CareerState | null {
  const c = raw as { version?: number } | null;
  if (c?.version === 2) return c as CareerState;
  if (c?.version === 1) return migrateV1(c as CareerV1);
  return null;
}

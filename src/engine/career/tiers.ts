import type { AiLevel } from '../ai/skill';
import { DEFAULT_X01, type X01Options } from '../modes/x01';

/** Rounds of an 8-player knockout. */
export const ROUND_NAMES = ['Quarter-final', 'Semi-final', 'Final'] as const;
export type Reached = 'QF' | 'SF' | 'F' | 'W';

export interface Tier {
  name: string;
  /** Skill of the 12 regulars on this tier. */
  levels: AiLevel[];
  /** Event names, one per event of the season. */
  events: string[];
  /** Match format per round (QF, SF, F). */
  formats: [X01Options, X01Options, X01Options];
  /** Order-of-merit points by how far you got. */
  points: Record<Reached, number>;
  /** Winner's prize; earlier exits get a share. */
  prize: number;
}

const legs = (n: number): X01Options => ({ ...DEFAULT_X01, legsToWin: n });
const sets = (s: number, l: number): X01Options => ({ ...DEFAULT_X01, legsToWin: l, setsToWin: s });
/** e.g. regulars(['pub', 8], ['club', 4]) */
const regulars = (...groups: [AiLevel, number][]): AiLevel[] =>
  groups.flatMap(([level, n]) => Array<AiLevel>(n).fill(level));
const POINTS: Record<Reached, number> = { QF: 1, SF: 3, F: 6, W: 10 };

export const TIERS: Tier[] = [
  {
    name: 'Pub League',
    levels: regulars(['pub', 8], ['club', 4]),
    events: ['Red Lion Open', 'Anchor Arms Cup', 'Fox & Feathers Classic', 'League Finals Night'],
    formats: [legs(1), legs(2), legs(2)],
    points: POINTS,
    prize: 100,
  },
  {
    name: 'County Circuit',
    levels: regulars(['club', 8], ['county', 4]),
    events: ['Northfield Open', 'Riverside Masters', 'Three Counties Cup', 'County Championship'],
    formats: [legs(2), legs(3), legs(3)],
    points: POINTS,
    prize: 500,
  },
  {
    name: 'Challenge Tour',
    levels: regulars(['county', 8], ['pro', 4]),
    events: [
      'Harbour City Open',
      'Challenge Tour Event 2',
      'Highlands Classic',
      'Challenge Tour Finals',
    ],
    formats: [legs(3), legs(4), legs(5)],
    points: POINTS,
    prize: 2500,
  },
  {
    name: 'Pro Tour',
    levels: regulars(['county', 4], ['pro', 8]),
    events: ['Grand Prix', 'Masters', 'Open Championship', 'World Championship'],
    formats: [legs(4), legs(5), sets(2, 3)],
    points: POINTS,
    prize: 25000,
  },
];

export const EVENTS_PER_SEASON = 4;
/** Finish this high on the order of merit to move up a tier. */
export const PROMOTION_PLACES = 2;

export const PRIZE_SHARE: Record<Reached, number> = { QF: 0.1, SF: 0.25, F: 0.5, W: 1 };

/** "First to 3 legs", "First to 2 sets (best of 5 legs)". */
export function describeFormat(o: X01Options): string {
  if (o.setsToWin) return `First to ${o.setsToWin} sets (best of ${o.legsToWin * 2 - 1} legs)`;
  return o.legsToWin === 1 ? 'One leg' : `First to ${o.legsToWin} legs`;
}

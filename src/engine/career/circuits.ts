import type { AiLevel } from '../ai/skill';
import { DEFAULT_X01, type X01Options } from '../modes/x01';

/**
 * The career world: four circuits you climb through, and the season calendar
 * of events on each. All data: the engine reads it, the UI describes it.
 */
export type CircuitId = 'pub' | 'county' | 'challenge' | 'tour';
export const CIRCUITS: CircuitId[] = ['pub', 'county', 'challenge', 'tour'];

/** Status you hold: each opens a circuit's events. */
export type Card = 'county' | 'challenge' | 'tour';

export type EventKind = 'open' | 'finals' | 'major' | 'qualifier' | 'qschool';
export type Venue = 'pub' | 'hall' | 'floor' | 'stage';

/** Who may enter an event. */
export type Entry =
  | { kind: 'open' }
  /** Holders of a card (or an invitation). */
  | { kind: 'card'; card: Card }
  /** The top N of a circuit's order of merit this season (or an invitation). */
  | { kind: 'meritTop'; circuit: CircuitId; top: number; card?: Card }
  /** The top N of the tour ranking, or a qualifier's finalists. */
  | { kind: 'rankingTop'; top: number; qualifier?: string }
  /** A Q-School place, or pay the fee once you hold a county card. */
  | { kind: 'qschool' };

export interface EventTemplate {
  /** Unique within a season. */
  slug: string;
  week: number;
  name: string;
  circuit: CircuitId;
  kind: EventKind;
  field: 8 | 16 | 32;
  /** x01 format per round, first round first. */
  formats: X01Options[];
  /** Winner's prize; earlier exits get a share. */
  prize: number;
  entry: Entry;
  venue: Venue;
  fee?: number;
  /** For a qualifier: the event its finalists go on to. */
  feeds?: string;
}

export interface CircuitInfo {
  name: string;
  short: string;
  /** Skill of the circuit's regulars. */
  levels: [AiLevel, number][];
  /** Merit points by round reached (losing in round r), then the winner's. */
  points: (field: number) => number[];
  /** Stage number (theme, attribute caps). */
  stage: number;
}

const legs = (...ns: number[]): X01Options[] => ns.map((n) => ({ ...DEFAULT_X01, legsToWin: n }));
const sets = (s: number, l: number): X01Options => ({ ...DEFAULT_X01, legsToWin: l, setsToWin: s });

/** 8 players: QF 1, SF 3, F 6, W 10. Bigger fields add rounds below. */
const meritPoints = (field: number) => {
  const top = [1, 3, 6, 10];
  const extra = Math.log2(field) - 3;
  return [...Array.from({ length: extra }, () => 0), ...top].map((p, i) =>
    i < extra ? i : p + extra,
  );
};

export const CIRCUIT_INFO: Record<CircuitId, CircuitInfo> = {
  pub: {
    name: 'Pub League',
    short: 'Pub',
    levels: [
      ['pub', 10],
      ['club', 5],
    ],
    points: meritPoints,
    stage: 0,
  },
  county: {
    name: 'County Circuit',
    short: 'County',
    levels: [
      ['club', 20],
      ['county', 11],
    ],
    points: meritPoints,
    stage: 1,
  },
  challenge: {
    name: 'Challenge Tour',
    short: 'Challenge',
    levels: [
      ['county', 20],
      ['pro', 11],
    ],
    points: meritPoints,
    stage: 2,
  },
  tour: {
    name: 'Pro Tour',
    short: 'Tour',
    levels: [
      ['county', 20],
      ['pro', 43],
    ],
    points: meritPoints,
    stage: 3,
  },
};

export const WEEKS_PER_SEASON = 13;
/** Tour cards last this many seasons (the one you win it for, and the next). */
export const TOUR_CARD_SEASONS = 2;
/** Keep your card by finishing inside this many on the tour ranking when it expires. */
export const TOUR_CARD_KEEP = 48;
/** Automatic places in the majors (the rest come through qualifiers). */
export const MAJOR_PLACES = 14;
/** The tour ranking counts prize money over this many seasons. */
export const RANKING_SEASONS = 2;
export const QSCHOOL_FEE = 500;

const pub = (slug: string, week: number, name: string): EventTemplate => ({
  slug,
  week,
  name,
  circuit: 'pub',
  kind: 'open',
  field: 8,
  formats: legs(1, 2, 2),
  prize: 100,
  entry: { kind: 'open' },
  venue: 'pub',
});
const county = (slug: string, week: number, name: string): EventTemplate => ({
  slug,
  week,
  name,
  circuit: 'county',
  kind: 'open',
  field: 16,
  formats: legs(2, 2, 3, 3),
  prize: 500,
  entry: { kind: 'card', card: 'county' },
  venue: 'hall',
  fee: 25,
});
const challenge = (slug: string, week: number, name: string): EventTemplate => ({
  slug,
  week,
  name,
  circuit: 'challenge',
  kind: 'open',
  field: 16,
  formats: legs(3, 3, 4, 5),
  prize: 2500,
  entry: { kind: 'card', card: 'challenge' },
  venue: 'floor',
  fee: 100,
});
const pc = (n: number, week: number): EventTemplate => ({
  slug: `pc${n}`,
  week,
  name: `Players Championship ${n}`,
  circuit: 'tour',
  kind: 'open',
  field: 32,
  formats: legs(3, 3, 4, 4, 5),
  prize: 10000,
  entry: { kind: 'card', card: 'tour' },
  venue: 'floor',
});
const major = (
  slug: string,
  week: number,
  name: string,
  field: 16 | 32,
  formats: X01Options[],
  prize: number,
  top: number,
): EventTemplate => ({
  slug,
  week,
  name,
  circuit: 'tour',
  kind: 'major',
  field,
  formats,
  prize,
  entry: { kind: 'rankingTop', top, qualifier: `${slug}-q` },
  venue: 'stage',
});
const qualifier = (feeds: string, week: number, name: string): EventTemplate => ({
  slug: `${feeds}-q`,
  week,
  name: `${name} Qualifier`,
  circuit: 'tour',
  kind: 'qualifier',
  field: 16,
  formats: legs(3, 3, 4, 4),
  prize: 0,
  entry: { kind: 'card', card: 'tour' },
  venue: 'floor',
  feeds,
});

/** Every season's calendar. One event per week for you; the rest play on without you. */
export const SEASON: EventTemplate[] = [
  // The Local: a knockout most weeks, and Finals Night for the top 8.
  pub('red-lion', 1, 'Red Lion Open'),
  pub('anchor', 2, 'Anchor Arms Cup'),
  pub('fox', 3, 'Fox & Feathers Classic'),
  pub('crown', 5, 'Crown & Cushion Cup'),
  pub('plough', 6, 'Plough Inn Open'),
  pub('kings-head', 8, "King's Head Classic"),
  pub('rose', 9, 'Rose & Crown Open'),
  pub('black-bull', 11, 'Black Bull Bash'),
  {
    ...pub('finals-night', 12, 'Pub League Finals Night'),
    kind: 'finals',
    prize: 250,
    entry: { kind: 'meritTop', circuit: 'pub', top: 8 },
  },

  // County: opens for card holders, and the County Championship for the top 16.
  county('northfield', 3, 'Northfield County Open'),
  county('riverside', 5, 'Riverside Masters'),
  county('three-counties', 7, 'Three Counties Cup'),
  county('westmoor', 9, 'Westmoor Open'),
  {
    ...county('county-champs', 12, 'County Championship'),
    kind: 'finals',
    fee: undefined,
    prize: 1500,
    entry: { kind: 'meritTop', circuit: 'county', top: 16, card: 'county' },
  },

  // Challenge Tour: the step below the tour.
  challenge('harbour', 2, 'Harbour City Open'),
  challenge('highlands', 4, 'Highlands Classic'),
  challenge('eastgate', 7, 'Eastgate Open'),
  challenge('lakeside', 10, 'Lakeside Challenge'),
  {
    ...challenge('challenge-finals', 12, 'Challenge Tour Finals'),
    kind: 'finals',
    fee: undefined,
    prize: 6000,
    entry: { kind: 'meritTop', circuit: 'challenge', top: 16, card: 'challenge' },
  },

  // Pro Tour: Players Championships, and the majors with their qualifiers.
  pc(1, 1),
  pc(2, 2),
  qualifier('grand-prix', 3, 'Grand Prix'),
  major('grand-prix', 4, 'Grand Prix', 16, legs(3, 4, 5, 6), 60000, 14),
  pc(3, 5),
  qualifier('matchplay', 6, 'Matchplay'),
  major('matchplay', 7, 'Matchplay', 16, legs(5, 6, 7, 9), 80000, 14),
  pc(4, 8),
  qualifier('masters', 9, 'Masters'),
  major('masters', 10, 'Masters', 16, legs(4, 5, 6, 7), 70000, 14),
  pc(5, 11),
  major(
    'worlds',
    12,
    'World Championship',
    32,
    [sets(1, 3), sets(2, 3), sets(2, 3), sets(3, 3), sets(4, 3)],
    250000,
    28,
  ),

  // Q-School: the end-of-season shot at a tour card.
  {
    slug: 'qschool',
    week: 13,
    name: 'Q-School',
    circuit: 'challenge',
    kind: 'qschool',
    field: 32,
    formats: legs(3, 3, 4, 4, 5),
    prize: 0,
    entry: { kind: 'qschool' },
    venue: 'floor',
    fee: QSCHOOL_FEE,
  },
];

/** Round names for a field: "Last 32", "Last 16", "Quarter-final", "Semi-final", "Final". */
export function roundNames(field: number): string[] {
  const names: string[] = [];
  for (let n = field; n >= 2; n /= 2)
    names.push(
      n === 2 ? 'Final' : n === 4 ? 'Semi-final' : n === 8 ? 'Quarter-final' : `Last ${n}`,
    );
  return names;
}

/** "Winner", "Runner-up", "Semi-finals", "Last 16"... for losing in round r (r = rounds: winner). */
export function reachedLabel(field: number, round: number): string {
  const rounds = Math.log2(field);
  if (round >= rounds) return 'Winner';
  if (round === rounds - 1) return 'Runner-up';
  const n = roundNames(field)[round]!;
  return n.endsWith('final') ? `${n}s` : n;
}

/** Prize share for losing in round r of `rounds` (r = rounds: the winner). */
export function prizeShare(rounds: number, round: number): number {
  const fromTop = rounds - round; // 0 = winner, 1 = runner-up, 2 = SF...
  return [1, 0.5, 0.25, 0.1, 0.05, 0.025][fromTop] ?? 0;
}

/** "First to 3 legs", "First to 2 sets (best of 5 legs)". */
export function describeFormat(o: X01Options): string {
  if (o.setsToWin) return `First to ${o.setsToWin} sets (best of ${o.legsToWin * 2 - 1} legs)`;
  return o.legsToWin === 1 ? 'One leg' : `First to ${o.legsToWin} legs`;
}

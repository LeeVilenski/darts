import { personalityFor } from '../ai/personality';
import { planAiThrow } from '../ai/simulate';
import type { AiLevel } from '../ai/skill';
import type { StuckDart } from '../board/collision';
import { toDartScore } from '../modes/dart';
import { withStarter } from '../modes/types';
import { applyDart, createX01, endTurn, type X01Options } from '../modes/x01';
import { resolveDart, stuckDartOf } from '../physics/resolveDart';
import { createRng, type Rng } from '../rng';
import {
  applyXp,
  ATTRS,
  attributesForTier,
  matchXp,
  newAttributes,
  onTarget,
  recheck,
  xpFromDarts,
  xpFromVisits,
  type Attr,
  type AttributeChange,
  type DartRecord,
  type PlayerAttributes,
  type Ratings,
} from './attributes';
import { AI_LEVELS } from '../ai/skill';
import { addMatch, emptyCareerStats, type CareerStats, type MatchSummary } from './stats';
import { EVENTS_PER_SEASON, PRIZE_SHARE, PROMOTION_PLACES, TIERS, type Reached } from './tiers';

/** The player's id in brackets and standings. */
export const YOU = 'you';

export interface CareerPlayer {
  id: string;
  name: string;
  level: AiLevel;
  tier: number;
}

export interface BracketMatch {
  a: string;
  b: string;
  winner: string | null;
  /** Legs (or sets) won by a and b. */
  score: [number, number] | null;
}

export interface CareerEvent {
  name: string;
  tier: number;
  /** rounds[0]: 4 quarter-finals, [1]: 2 semis, [2]: the final. */
  rounds: BracketMatch[][];
}

export interface EventResult {
  season: number;
  tier: number;
  name: string;
  reached: Reached;
  points: number;
  prize: number;
}

export interface Trophy {
  season: number;
  tier: number;
  name: string;
}

export interface SeasonSummary {
  season: number;
  tier: number;
  position: number;
  promoted: boolean;
}

export interface CareerState {
  version: 1;
  seed: number;
  /** Your name. */
  you: string;
  tier: number;
  season: number;
  /** Event of the season being played (0-based). */
  eventIndex: number;
  roster: CareerPlayer[];
  /** Order-of-merit points this season, by player id (YOU included). */
  merit: Record<string, number>;
  event: CareerEvent;
  results: EventResult[];
  trophies: Trophy[];
  earnings: number;
  /** Set when a season has just ended, until the player dismisses it. */
  lastSeason: SeasonSummary | null;
  /** Your record across career matches (missing in saves from before it was added). */
  stats?: CareerStats;
  /** Your throwing attributes (filled in on load for older saves). */
  attributes?: PlayerAttributes;
  /** XP from your last match or training session, for the post-match screen. */
  lastGain?: GainReport | null;
  /** Event you've already trained before (one session per event). */
  trainedFor?: string | null;
}

export interface GainReport {
  source: 'match' | 'training';
  player: number;
  attrs: Ratings;
  raised: AttributeChange['raised'];
  levelsGained: number;
}

// Fictional names only.
const FIRST = [
  'Alfie',
  'Bea',
  'Callum',
  'Dee',
  'Eamon',
  'Fern',
  'Gus',
  'Hattie',
  'Ivo',
  'Jo',
  'Kit',
  'Lena',
  'Marek',
  'Nell',
  'Oz',
  'Pip',
  'Quinn',
  'Rory',
  'Sian',
  'Tam',
  'Uri',
  'Vic',
  'Wren',
  'Yusuf',
];
const LAST = [
  'Ashby',
  'Brannock',
  'Corrie',
  'Dunmore',
  'Elsworth',
  'Farrant',
  'Gilroy',
  'Hale',
  'Inchley',
  'Jessop',
  'Kettering',
  'Lomax',
  'Marlow',
  'Nesbit',
  'Orme',
  'Pettigrew',
  'Quarry',
  'Rook',
  'Stannard',
  'Thursby',
  'Upton',
  'Varley',
  'Whitlock',
  'Yeats',
];
const NICKNAMES = [
  'The Hammer',
  'Steady',
  'The Viking',
  'Ice',
  'Showtime',
  'The Owl',
  'Bullseye',
  'Tungsten',
  'The Postman',
  'Lucky',
  'The Professor',
  'Rocket',
];

/** Small integer hash mixing, for per-event seeds. */
function mix(...xs: number[]): number {
  let h = 0x9e3779b9;
  for (const x of xs) {
    h ^= x + 0x7f4a7c15 + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  }
  return h >>> 0;
}

function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function createRoster(seed: number): CareerPlayer[] {
  const rng = createRng(mix(seed, 1));
  const firsts = shuffle(FIRST, rng);
  const lasts = shuffle(LAST, rng);
  const nicks = shuffle(NICKNAMES, rng);
  const roster: CareerPlayer[] = [];
  TIERS.forEach((tier, t) =>
    tier.levels.forEach((level, k) => {
      const n = roster.length;
      // The best players on the top tiers get a nickname.
      const nick = t >= 2 && k >= 8 ? ` "${nicks[(n * 7) % nicks.length]}"` : '';
      const name = `${firsts[n % firsts.length]}${nick} ${lasts[(n * 5 + Math.floor(n / 24)) % lasts.length]}`;
      roster.push({ id: `p${n}`, name, level, tier: t });
    }),
  );
  return roster;
}

export function playerById(c: CareerState, id: string): CareerPlayer | null {
  return c.roster.find((p) => p.id === id) ?? null;
}
export const nameOf = (c: CareerState, id: string) =>
  id === YOU ? c.you : (playerById(c, id)?.name ?? id);

function drawEvent(c: Omit<CareerState, 'event'>): CareerEvent {
  const rng = createRng(mix(c.seed, c.season, c.tier, c.eventIndex, 2));
  const regulars = c.roster.filter((p) => p.tier === c.tier).map((p) => p.id);
  const field = shuffle([YOU, ...shuffle(regulars, rng).slice(0, 7)], rng);
  const qf: BracketMatch[] = [0, 2, 4, 6].map((k) => ({
    a: field[k]!,
    b: field[k + 1]!,
    winner: null,
    score: null,
  }));
  return { name: TIERS[c.tier]!.events[c.eventIndex]!, tier: c.tier, rounds: [qf] };
}

export function newCareer(you: string, seed: number): CareerState {
  const base = {
    version: 1 as const,
    seed: seed >>> 0,
    you: you.trim() || 'Player 1',
    tier: 0,
    season: 1,
    eventIndex: 0,
    roster: createRoster(seed),
    merit: {},
    results: [],
    trophies: [],
    earnings: 0,
    lastSeason: null,
    stats: emptyCareerStats(),
    attributes: newAttributes(),
    lastGain: null,
    trainedFor: null,
  };
  return { ...base, event: drawEvent(base) };
}

export interface NextMatch {
  round: number;
  opponent: CareerPlayer;
  format: X01Options;
}

/** Your next match in the current event, or null if you're out. */
export function nextMatch(c: CareerState): NextMatch | null {
  const round = c.event.rounds.length - 1;
  const m = c.event.rounds[round]!.find((x) => x.winner === null && (x.a === YOU || x.b === YOU));
  if (!m) return null;
  const opponent = playerById(c, m.a === YOU ? m.b : m.a)!;
  return { round, opponent, format: TIERS[c.tier]!.formats[round]! };
}

/** Play an AI-vs-AI x01 match headlessly through the real physics. */
export function simulateMatch(
  players: [CareerPlayer, CareerPlayer],
  options: X01Options,
  rng: Rng,
): { winner: 0 | 1; score: [number, number] } {
  let m = withStarter(
    createX01(
      players.map((p) => p.name),
      options,
    ),
    rng.next() < 0.5 ? 0 : 1,
  );
  const personalities = players.map((p) => personalityFor(p.name));
  let stuck: StuckDart[] = [];
  for (let thrown = 0; m.status !== 'matchWon' && thrown < 5000; thrown++) {
    if (m.status !== 'open') {
      m = endTurn(m);
      stuck = [];
    }
    const i = m.current;
    const { launch } = planAiThrow(m, players[i]!.level, rng, {
      personality: personalities[i],
      stuck,
    });
    const d = resolveDart(launch, stuck, rng, 'realistic');
    const left = stuckDartOf(d);
    if (left) stuck = [...stuck, left];
    m = applyDart(m, toDartScore(d.result));
  }
  const winner = (m.winner ?? 0) as 0 | 1;
  const tally = (p: (typeof m.players)[number]) => (options.setsToWin ? p.setsWon : p.legsWon);
  return { winner, score: [tally(m.players[0]!), tally(m.players[1]!)] };
}

/** Simulate every unplayed AI-only match of the current round. */
function simulateRound(c: CareerState): CareerState {
  const r = c.event.rounds.length - 1;
  const rng = createRng(mix(c.seed, c.season, c.tier, c.eventIndex, 3, r));
  const format = TIERS[c.tier]!.formats[r]!;
  const round = c.event.rounds[r]!.map((m) => {
    if (m.winner !== null || m.a === YOU || m.b === YOU) return m;
    const pair: [CareerPlayer, CareerPlayer] = [playerById(c, m.a)!, playerById(c, m.b)!];
    const { winner, score } = simulateMatch(pair, format, rng);
    return { ...m, winner: winner === 0 ? m.a : m.b, score };
  });
  return { ...c, event: { ...c.event, rounds: [...c.event.rounds.slice(0, r), round] } };
}

/** All matches of the round done: draw the next one, or finish the event. */
function advance(c: CareerState): CareerState {
  const rounds = c.event.rounds;
  const last = rounds[rounds.length - 1]!;
  if (last.some((m) => m.winner === null)) return c;
  if (last.length === 1) return finishEvent(c);
  const next: BracketMatch[] = [];
  for (let k = 0; k < last.length; k += 2)
    next.push({ a: last[k]!.winner!, b: last[k + 1]!.winner!, winner: null, score: null });
  const c2 = { ...c, event: { ...c.event, rounds: [...rounds, next] } };
  // Out of the event: play the rest out.
  return nextMatch(c2) ? c2 : advance(simulateRound(c2));
}

/** How far each player got in a finished event. */
function reachedIn(e: CareerEvent): Record<string, Reached> {
  const out: Record<string, Reached> = {};
  const stage: Reached[] = ['QF', 'SF', 'F'];
  e.rounds.forEach((round, r) =>
    round.forEach((m) => {
      out[m.a] = stage[r]!;
      out[m.b] = stage[r]!;
    }),
  );
  out[e.rounds[2]![0]!.winner!] = 'W';
  return out;
}

function finishEvent(c: CareerState): CareerState {
  const tier = TIERS[c.tier]!;
  const reached = reachedIn(c.event);
  const merit = { ...c.merit };
  for (const [id, r] of Object.entries(reached)) merit[id] = (merit[id] ?? 0) + tier.points[r];
  const mine = reached[YOU]!;
  const prize = Math.round(tier.prize * PRIZE_SHARE[mine]);
  const result: EventResult = {
    season: c.season,
    tier: c.tier,
    name: c.event.name,
    reached: mine,
    points: tier.points[mine],
    prize,
  };
  let next: CareerState = {
    ...c,
    merit,
    results: [...c.results, result],
    trophies:
      mine === 'W'
        ? [...c.trophies, { season: c.season, tier: c.tier, name: c.event.name }]
        : c.trophies,
    earnings: c.earnings + prize,
    eventIndex: c.eventIndex + 1,
  };
  if (next.eventIndex >= EVENTS_PER_SEASON) next = endSeason(next);
  return { ...next, event: drawEvent(next) };
}

/** Order of merit for the current tier, best first. */
export function standings(c: CareerState): { id: string; name: string; points: number }[] {
  const ids = [YOU, ...c.roster.filter((p) => p.tier === c.tier).map((p) => p.id)];
  return ids
    .map((id) => ({ id, name: nameOf(c, id), points: c.merit[id] ?? 0 }))
    .sort((a, b) => b.points - a.points || (a.id === YOU ? -1 : b.id === YOU ? 1 : 0));
}

function endSeason(c: CareerState): CareerState {
  const position = standings(c).findIndex((s) => s.id === YOU) + 1;
  const top = c.tier === TIERS.length - 1;
  const promoted = !top && position <= PROMOTION_PLACES;
  const trophies =
    position === 1
      ? [
          ...c.trophies,
          { season: c.season, tier: c.tier, name: `${TIERS[c.tier]!.name} Order of Merit` },
        ]
      : c.trophies;
  const tier = promoted ? c.tier + 1 : c.tier;
  return {
    ...c,
    attributes: c.attributes && promoted ? recheck(c.attributes, tier).attrs : c.attributes,
    trophies,
    lastSeason: { season: c.season, tier: c.tier, position, promoted },
    season: c.season + 1,
    tier,
    eventIndex: 0,
    merit: {},
  };
}

/**
 * Record your match (won or lost, with your legs/sets and theirs), then play
 * out the rest of the round and the event as far as it goes without you.
 */
export function recordResult(
  c: CareerState,
  won: boolean,
  score: [number, number],
  summary?: Omit<MatchSummary, 'opponent' | 'won' | 'score'> & {
    darts?: readonly DartRecord[];
    /** You won a deciding leg. */
    decider?: boolean;
  },
): CareerState {
  const next = nextMatch(c);
  if (!next) return c;
  const r = next.round;
  if (summary?.darts) {
    const attrs = xpFromDarts(summary.darts);
    attrs.scoring += xpFromVisits(
      summary.stats.tons + summary.stats.ton40s,
      summary.stats.oneEighties,
    );
    if (summary.stats.bestCheckout >= 100) attrs.finishing += 15;
    if (won && summary.decider) attrs.nerve += 20;
    const upset = AI_LEVELS.indexOf(next.opponent.level) > c.tier;
    c = gainXp(c, 'match', { attrs, player: matchXp(won, score[0], upset, c.tier) });
  }
  if (summary)
    c = {
      ...c,
      stats: addMatch(
        c.stats ?? emptyCareerStats(),
        { ...summary, opponent: next.opponent.id, won, score },
        { season: c.season, tier: c.tier, event: c.event.name, round: r },
      ),
    };
  const round = c.event.rounds[r]!.map((m) => {
    if (m.winner !== null || (m.a !== YOU && m.b !== YOU)) return m;
    const youA = m.a === YOU;
    const winner = won ? YOU : youA ? m.b : m.a;
    return { ...m, winner, score: (youA ? score : [score[1], score[0]]) as [number, number] };
  });
  const c2 = { ...c, event: { ...c.event, rounds: [...c.event.rounds.slice(0, r), round] } };
  return advance(simulateRound(c2));
}

/** Bank XP into your attributes and remember it for the post-match screen. */
function gainXp(
  c: CareerState,
  source: GainReport['source'],
  gain: { attrs: Ratings; player: number },
): CareerState {
  const before = c.attributes ?? attributesForTier(c.tier);
  const change = applyXp(before, gain, c.tier);
  return {
    ...c,
    attributes: change.attrs,
    lastGain: {
      source,
      player: Math.round(gain.player),
      attrs: Object.fromEntries(ATTRS.map((a) => [a, Math.round(gain.attrs[a])])) as Ratings,
      raised: change.raised,
      levelsGained: change.levelsGained,
    },
  };
}

/** Training drills between events: each works one attribute hardest. */
export const DRILLS: Record<Attr, { mode: 'atc' | 'bobs27' | 'ladder' | 'halveit'; name: string }> =
  {
    scoring: { mode: 'atc', name: 'Around the Clock' },
    finishing: { mode: 'bobs27', name: "Bob's 27" },
    nerve: { mode: 'ladder', name: '121 checkout ladder' },
    rhythm: { mode: 'halveit', name: 'Halve-It' },
  };

/** Key of the event you're about to play, for the one-session-per-event training rule. */
export const eventKey = (c: CareerState) => `${c.season}:${c.tier}:${c.eventIndex}`;
export const canTrain = (c: CareerState) => c.trainedFor !== eventKey(c) && !!nextMatch(c);

/** Record a finished training session. `bonus` is drill-specific (e.g. 121 checkouts). */
export function recordTraining(
  c: CareerState,
  focus: Attr,
  darts: readonly DartRecord[],
  bonus = 0,
): CareerState {
  if (!canTrain(c)) return c;
  const raw = xpFromDarts(darts);
  const hits = darts.filter(onTarget).length;
  // The drill's attribute gets the full value; the others half.
  const attrs = Object.fromEntries(ATTRS.map((a) => [a, raw[a] * 0.5])) as Ratings;
  attrs[focus] = raw[focus] * 0.8 + hits + bonus;
  return {
    ...gainXp(c, 'training', { attrs, player: 10 + Math.round(darts.length / 6) }),
    trainedFor: eventKey(c),
  };
}

export type ScheduleStatus = 'done' | 'current' | 'upcoming';

/** This season's events in order, with your result for the ones played. */
export function seasonSchedule(
  c: CareerState,
): { index: number; name: string; status: ScheduleStatus; result: EventResult | null }[] {
  const played = c.results.filter((r) => r.season === c.season && r.tier === c.tier);
  return TIERS[c.tier]!.events.map((name, index) => ({
    index,
    name,
    status: index < c.eventIndex ? 'done' : index === c.eventIndex ? 'current' : 'upcoming',
    result: index < c.eventIndex ? (played[index] ?? null) : null,
  }));
}

/** Where you stand in the promotion race. */
export function promotionRace(c: CareerState): {
  position: number;
  points: number;
  /** Points behind the last promotion place (0 if you're in one). */
  gap: number;
  eventsLeft: number;
  /** Most points still available to you this season. */
  maxToCome: number;
  top: boolean;
} {
  const table = standings(c);
  const position = table.findIndex((s) => s.id === YOU) + 1;
  const points = c.merit[YOU] ?? 0;
  const line = table.filter((s) => s.id !== YOU)[PROMOTION_PLACES - 1]?.points ?? 0;
  const eventsLeft = EVENTS_PER_SEASON - c.eventIndex;
  return {
    position,
    points,
    gap: position <= PROMOTION_PLACES ? 0 : Math.max(0, line - points),
    eventsLeft,
    maxToCome: eventsLeft * TIERS[c.tier]!.points.W,
    top: c.tier === TIERS.length - 1,
  };
}

export const dismissSeason = (c: CareerState): CareerState => ({ ...c, lastSeason: null });

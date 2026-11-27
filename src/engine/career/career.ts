import { personalityFor } from '../ai/personality';
import { planAiThrow } from '../ai/simulate';
import { AI_LEVELS, type AiLevel } from '../ai/skill';
import type { StuckDart } from '../board/collision';
import { toDartScore } from '../modes/dart';
import { withStarter } from '../modes/types';
import { applyDart, createX01, endTurn, type X01Options } from '../modes/x01';
import { resolveDart, stuckDartOf } from '../physics/resolveDart';
import { createRng, type Rng } from '../rng';
import {
  applyXp,
  ATTRS,
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
import { drawBracket, nextRound, reachedRounds, type BracketMatch } from './bracket';
import {
  CIRCUIT_INFO,
  CIRCUITS,
  prizeShare,
  QSCHOOL_FEE,
  TOUR_CARD_KEEP,
  TOUR_CARD_SEASONS,
  RANKING_SEASONS,
  reachedLabel,
  roundNames,
  SEASON,
  WEEKS_PER_SEASON,
  type Card,
  type CircuitId,
  type EventTemplate,
} from './circuits';
import { quickMatch } from './quickSim';
import { eventRep, matchRep, type Message } from './story';
import { addMatch, emptyCareerStats, type CareerStats, type MatchSummary } from './stats';

export type { BracketMatch } from './bracket';

/** The player's id in brackets and standings. */
export const YOU = 'you';

export interface CareerPlayer {
  id: string;
  name: string;
  level: AiLevel;
  circuit: CircuitId;
}

/** An event on this season's calendar. */
export interface CalEvent extends EventTemplate {
  id: string;
  /** Filled in once the event has been played. */
  result: { winner: string; runnerUp: string } | null;
}

/** The draw of an event in progress (or just finished). */
export interface LiveEvent {
  id: string;
  rounds: BracketMatch[][];
}

export interface EventResult {
  season: number;
  week: number;
  id: string;
  name: string;
  circuit: CircuitId;
  kind: EventTemplate['kind'];
  field: number;
  /** Round you went out in; equal to the number of rounds if you won. */
  round: number;
  points: number;
  prize: number;
}

export interface Trophy {
  season: number;
  name: string;
  circuit: CircuitId;
  /** Stage (0 pub … 3 tour) for the cabinet's look. */
  tier: number;
}

export interface SeasonSummary {
  season: number;
  /** Your finishing place on each circuit you scored on. */
  places: { circuit: CircuitId; position: number; of: number }[];
  /** What changed: "County card earned", "Tour card lost"... */
  changes: string[];
  promoted: boolean;
}

export interface Cards {
  county: boolean;
  challenge: boolean;
  /** Last season your tour card is valid for, or null. */
  tour: number | null;
}

export interface GainReport {
  source: 'match' | 'training';
  player: number;
  attrs: Ratings;
  raised: AttributeChange['raised'];
  levelsGained: number;
}

export interface CareerState {
  version: 2;
  seed: number;
  /** Your name. */
  you: string;
  season: number;
  /** 1-based week of the season. */
  week: number;
  cards: Cards;
  /** Your stage: 0 pub, 1 county, 2 challenge, 3 tour (from your cards). */
  tier: number;
  roster: CareerPlayer[];
  calendar: CalEvent[];
  /** The event you're playing this week. */
  event: LiveEvent | null;
  /** The last event you played, to show its draw. */
  lastEvent: LiveEvent | null;
  /** Order-of-merit points this season by circuit, by player id (YOU included). */
  merit: Record<CircuitId, Record<string, number>>;
  /** Tour prize money by player and season (the tour ranking). */
  money: Record<string, Record<number, number>>;
  /** Events you have a place in regardless of the entry rule (wildcards, qualifiers). */
  invites: string[];
  /** A Q-School place for this season. */
  qschoolPlace: boolean;
  results: EventResult[];
  trophies: Trophy[];
  earnings: number;
  /** Set when a season has just ended, until the player dismisses it. */
  lastSeason: SeasonSummary | null;
  stats: CareerStats;
  attributes: PlayerAttributes;
  /** XP from your last match or training session, for the post-match screen. */
  lastGain: GainReport | null;
  /** Week you've already trained in (one session per week). */
  trainedFor: string | null;
  /** How well known you are: opens wildcards and invitations. */
  reputation: number;
  inbox: Message[];
  /** Story milestones that have fired (see milestones.ts). */
  milestones: string[];
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
  'The Bishop',
  'Thunder',
  'The Miner',
  'Snakebite',
  'The Chef',
  'Mr Smooth',
];

/** Small integer hash mixing, for per-event seeds. */
export function mix(...xs: number[]): number {
  let h = 0x9e3779b9;
  for (const x of xs) {
    h ^= x + 0x7f4a7c15 + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  }
  return h >>> 0;
}
const hashStr = (s: string) => [...s].reduce((h, ch) => mix(h, ch.charCodeAt(0)), 7);

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
  let nick = 0;
  for (const circuit of CIRCUITS)
    for (const [level, count] of CIRCUIT_INFO[circuit].levels)
      for (let k = 0; k < count; k++) {
        const n = roster.length;
        // The best players on the tour have a nickname.
        const named = level === 'pro' && nick < nicks.length && (circuit === 'tour' || k < 4);
        const nickname = named ? ` "${nicks[nick++]}"` : '';
        const name = `${firsts[n % 24]}${nickname} ${lasts[(n * 5 + Math.floor(n / 24)) % 24]}`;
        roster.push({ id: `p${n}`, name, level, circuit });
      }
  return roster;
}

export function playerById(c: CareerState, id: string): CareerPlayer | null {
  return c.roster.find((p) => p.id === id) ?? null;
}
export const nameOf = (c: CareerState, id: string) =>
  id === YOU ? c.you : (playerById(c, id)?.name ?? id);
const levelOf = (c: CareerState, id: string): AiLevel => playerById(c, id)?.level ?? 'club';

export const eventById = (c: CareerState, id: string) => c.calendar.find((e) => e.id === id);
export const weekEvents = (c: CareerState, week = c.week) =>
  c.calendar.filter((e) => e.week === week);

export function buildCalendar(season: number): CalEvent[] {
  return SEASON.map((t) => ({ ...t, id: `s${season}-${t.slug}`, result: null }));
}

const emptyMerit = (): CareerState['merit'] => ({ pub: {}, county: {}, challenge: {}, tour: {} });

export function stageOf(cards: Cards, season: number): number {
  if (cards.tour !== null && cards.tour >= season) return 3;
  if (cards.challenge) return 2;
  if (cards.county) return 1;
  return 0;
}

/** Last season's tour money for the regulars, so the ranking has shape from day one. */
function seedMoney(roster: CareerPlayer[], seed: number): CareerState['money'] {
  const rng = createRng(mix(seed, 5));
  const money: CareerState['money'] = {};
  for (const p of roster) {
    if (p.circuit !== 'tour') continue;
    const [lo, hi] = p.level === 'pro' ? [40000, 220000] : [6000, 45000];
    money[p.id] = { 0: Math.round((lo + rng.next() ** 2 * (hi - lo)) / 250) * 250 };
  }
  return money;
}

export function newCareer(you: string, seed: number): CareerState {
  const roster = createRoster(seed);
  return {
    version: 2,
    seed: seed >>> 0,
    you: you.trim() || 'Player 1',
    season: 1,
    week: 1,
    cards: { county: false, challenge: false, tour: null },
    tier: 0,
    roster,
    calendar: buildCalendar(1),
    event: null,
    lastEvent: null,
    merit: emptyMerit(),
    money: seedMoney(roster, seed),
    invites: [],
    qschoolPlace: false,
    results: [],
    trophies: [],
    earnings: 0,
    lastSeason: null,
    stats: emptyCareerStats(),
    attributes: newAttributes(),
    lastGain: null,
    trainedFor: null,
    reputation: 0,
    inbox: [],
    milestones: [],
  };
}

/* ------------------------------------------------------------------ rankings */

/** Tour prize money over the ranking window, by player. */
export function rankingMoney(c: CareerState, id: string): number {
  const m = c.money[id];
  if (!m) return 0;
  let sum = 0;
  for (let s = c.season - RANKING_SEASONS + 1; s <= c.season; s++) sum += m[s] ?? 0;
  return sum;
}

/** The tour ranking: tour regulars, plus you if you've earned tour money or hold a card. */
export function tourRanking(c: CareerState): { id: string; name: string; money: number }[] {
  const ids = c.roster.filter((p) => p.circuit === 'tour').map((p) => p.id);
  if (c.cards.tour !== null || rankingMoney(c, YOU) > 0) ids.push(YOU);
  return ids
    .map((id) => ({ id, name: nameOf(c, id), money: rankingMoney(c, id) }))
    .sort(
      (a, b) =>
        b.money - a.money ||
        AI_LEVELS.indexOf(levelOf(c, b.id)) - AI_LEVELS.indexOf(levelOf(c, a.id)) ||
        a.id.localeCompare(b.id),
    );
}
export const tourPosition = (c: CareerState, id = YOU) =>
  tourRanking(c).findIndex((r) => r.id === id) + 1 || null;

/** A circuit's order of merit this season, best first (you included if you've scored or play it). */
export function standings(
  c: CareerState,
  circuit: CircuitId = (['pub', 'county', 'challenge', 'tour'] as const)[Math.min(c.tier, 2)]!,
): { id: string; name: string; points: number }[] {
  if (circuit === 'tour')
    return tourRanking(c).map((r) => ({ id: r.id, name: r.name, points: r.money }));
  const merit = c.merit[circuit];
  const ids = c.roster.filter((p) => p.circuit === circuit).map((p) => p.id);
  if (merit[YOU] !== undefined || canPlayCircuit(c, circuit)) ids.push(YOU);
  return ids
    .map((id) => ({ id, name: nameOf(c, id), points: merit[id] ?? 0 }))
    .sort((a, b) => b.points - a.points || (a.id === YOU ? -1 : b.id === YOU ? 1 : 0));
}

const canPlayCircuit = (c: CareerState, circuit: CircuitId) =>
  circuit === 'pub' ||
  (circuit === 'county' && c.cards.county) ||
  (circuit === 'challenge' && c.cards.challenge);

/* ------------------------------------------------------------------ entry */

export type Eligibility = { ok: true; via?: 'invite' | 'fee' } | { ok: false; reason: string };

export function holdsCard(c: CareerState, card: Card): boolean {
  return card === 'tour' ? c.cards.tour !== null && c.cards.tour >= c.season : c.cards[card];
}

const CARD_NAMES: Record<Card, string> = {
  county: 'a County card',
  challenge: 'a Challenge Tour card',
  tour: 'a Tour Card',
};

/** Can you enter this event, and if not, why not. */
export function eligibility(c: CareerState, e: CalEvent): Eligibility {
  if (e.result) return { ok: false, reason: 'Already played' };
  if (c.invites.includes(e.id)) return { ok: true, via: 'invite' };
  const entry = e.entry;
  switch (entry.kind) {
    case 'open':
      // Pros don't go back to the pub.
      return c.tier >= 2 && e.circuit === 'pub'
        ? { ok: false, reason: 'Pub events are for amateurs' }
        : { ok: true };
    case 'card':
      return holdsCard(c, entry.card)
        ? { ok: true }
        : { ok: false, reason: `Needs ${CARD_NAMES[entry.card]}` };
    case 'meritTop': {
      if (entry.card && !holdsCard(c, entry.card))
        return { ok: false, reason: `Needs ${CARD_NAMES[entry.card]}` };
      const pos = standings(c, entry.circuit).findIndex((s) => s.id === YOU) + 1;
      return pos > 0 && pos <= entry.top
        ? { ok: true }
        : {
            ok: false,
            reason: `Top ${entry.top} of the ${CIRCUIT_INFO[entry.circuit].name}${pos ? ` (you're ${ordinal(pos)})` : ''}`,
          };
    }
    case 'rankingTop': {
      const pos = tourPosition(c);
      if (holdsCard(c, 'tour') && pos !== null && pos <= entry.top) return { ok: true };
      return {
        ok: false,
        reason: `Top ${entry.top} on the tour ranking${pos ? ` (you're ${ordinal(pos)})` : ''}, or reach the qualifier final`,
      };
    }
    case 'qschool':
      if (holdsCard(c, 'tour')) return { ok: false, reason: 'You already hold a Tour Card' };
      if (c.qschoolPlace) return { ok: true };
      if (!c.cards.county) return { ok: false, reason: 'Needs a Q-School place or a County card' };
      return c.earnings >= QSCHOOL_FEE
        ? { ok: true, via: 'fee' }
        : { ok: false, reason: `Entry fee £${QSCHOOL_FEE} (you have £${c.earnings})` };
  }
}

export const ordinal = (n: number) => {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
};

/* ------------------------------------------------------------------ fields */

/** Seeding score: merit on the circuit, or tour money. */
function seedScore(c: CareerState, e: CalEvent, id: string): number {
  return e.circuit === 'tour' ? rankingMoney(c, id) : (c.merit[e.circuit][id] ?? 0);
}

/** AI players who enter an event, best seeds first (one slot left for you if `withYou`). */
function fieldFor(c: CareerState, e: CalEvent, withYou: boolean): string[] {
  const rng = createRng(mix(c.seed, c.season, hashStr(e.id), 11));
  const size = e.field - (withYou ? 1 : 0);
  const of = (circuit: CircuitId) => c.roster.filter((p) => p.circuit === circuit).map((p) => p.id);
  let pool: string[];
  const entry = e.entry;
  if (entry.kind === 'meritTop')
    pool = standings(c, entry.circuit)
      .filter((s) => s.id !== YOU)
      .map((s) => s.id);
  else if (entry.kind === 'rankingTop') {
    const ranked = tourRanking(c)
      .filter((r) => r.id !== YOU)
      .map((r) => r.id);
    const q = entry.qualifier ? eventById(c, `s${c.season}-${entry.qualifier}`)?.result : null;
    const qualified = q ? [q.winner, q.runnerUp].filter((id) => id !== YOU) : [];
    pool = [...new Set([...ranked.slice(0, entry.top), ...qualified, ...ranked.slice(entry.top)])];
  } else if (e.kind === 'qualifier') {
    // Card holders outside the major's automatic places.
    const major = SEASON.find((t) => t.slug === e.feeds);
    const top = major?.entry.kind === 'rankingTop' ? major.entry.top : 0;
    pool = shuffle(
      tourRanking(c)
        .slice(top)
        .filter((r) => r.id !== YOU)
        .map((r) => r.id),
      rng,
    );
  } else if (e.kind === 'qschool')
    pool = shuffle([...of('challenge'), ...of('county').slice(0, 12)], rng);
  else pool = shuffle(of(e.circuit), rng);
  const picked = pool.slice(0, size);
  return picked.sort((a, b) => seedScore(c, e, b) - seedScore(c, e, a));
}

/** Seed you into a field by your own score. */
function withYouSeeded(c: CareerState, e: CalEvent, field: string[]): string[] {
  const mine = seedScore(c, e, YOU);
  const at = field.findIndex((id) => seedScore(c, e, id) < mine);
  const out = [...field];
  out.splice(at < 0 ? out.length : at, 0, YOU);
  return out;
}

/* ------------------------------------------------------------------ playing */

export interface NextMatch {
  event: CalEvent;
  round: number;
  roundName: string;
  opponent: CareerPlayer;
  format: X01Options;
}

/** Your next match in the event you've entered, or null. */
export function nextMatch(c: CareerState): NextMatch | null {
  if (!c.event) return null;
  const event = eventById(c, c.event.id)!;
  const round = c.event.rounds.length - 1;
  const m = c.event.rounds[round]!.find((x) => x.winner === null && (x.a === YOU || x.b === YOU));
  if (!m) return null;
  return {
    event,
    round,
    roundName: roundNames(event.field)[round]!,
    opponent: playerById(c, m.a === YOU ? m.b : m.a)!,
    format: event.formats[round]!,
  };
}

/** Enter one of this week's events. */
export function enterEvent(c: CareerState, id: string): CareerState {
  const e = eventById(c, id);
  if (!e || c.event || e.week !== c.week) return c;
  const ok = eligibility(c, e);
  if (!ok.ok) return c;
  const field = withYouSeeded(c, e, fieldFor(c, e, true));
  return {
    ...c,
    earnings: ok.via === 'fee' ? c.earnings - (e.fee ?? 0) : c.earnings,
    invites: c.invites.filter((x) => x !== id),
    event: { id, rounds: [drawBracket(field)] },
  };
}

/** Play an AI-vs-AI x01 match headlessly through the real physics (slow; for tests and tools). */
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

/** Simulate every unplayed AI-only match of the last round. */
function simulateRound(c: CareerState, e: CalEvent, rounds: BracketMatch[][]): BracketMatch[][] {
  const r = rounds.length - 1;
  const rng = createRng(mix(c.seed, c.season, hashStr(e.id), 3, r));
  const format = e.formats[r]!;
  const round = rounds[r]!.map((m) => {
    if (m.winner !== null || m.a === YOU || m.b === YOU) return m;
    const { winner, score } = quickMatch(levelOf(c, m.a), levelOf(c, m.b), format, rng);
    return { ...m, winner: winner === 0 ? m.a : m.b, score };
  });
  return [...rounds.slice(0, r), round];
}

/** Play rounds out (without you) until you have a match to play or the event is over. */
function playOn(c: CareerState, e: CalEvent, rounds: BracketMatch[][]): BracketMatch[][] {
  for (;;) {
    rounds = simulateRound(c, e, rounds);
    const last = rounds.at(-1)!;
    if (last.some((m) => m.winner === null) || last.length === 1) return rounds;
    rounds = [...rounds, nextRound(last)];
    if (rounds.at(-1)!.some((m) => m.a === YOU || m.b === YOU)) return rounds;
  }
}

const isOver = (rounds: BracketMatch[][]) => {
  const last = rounds.at(-1)!;
  return last.length === 1 && last[0]!.winner !== null;
};

/** Award points, prize money, trophies and spots from a finished event. */
function settleEvent(c: CareerState, e: CalEvent, rounds: BracketMatch[][]): CareerState {
  const reached = reachedRounds(rounds);
  const nRounds = rounds.length;
  const final = rounds.at(-1)![0]!;
  const winner = final.winner!;
  const runnerUp = final.a === winner ? final.b : final.a;
  const pts = CIRCUIT_INFO[e.circuit].points(e.field);
  const merit = { ...c.merit, [e.circuit]: { ...c.merit[e.circuit] } };
  const money = { ...c.money };
  for (const [id, r] of Object.entries(reached)) {
    if (e.circuit !== 'tour' && e.kind !== 'qschool')
      merit[e.circuit][id] = (merit[e.circuit][id] ?? 0) + (pts[r] ?? 0);
    const prize = Math.round(e.prize * prizeShare(nRounds, r));
    if (e.circuit === 'tour' && prize > 0)
      money[id] = { ...money[id], [c.season]: (money[id]?.[c.season] ?? 0) + prize };
  }
  let next: CareerState = {
    ...c,
    merit,
    money,
    calendar: c.calendar.map((x) => (x.id === e.id ? { ...x, result: { winner, runnerUp } } : x)),
  };
  const mine = reached[YOU];
  if (mine !== undefined) {
    const prize = Math.round(e.prize * prizeShare(nRounds, mine));
    next = {
      ...next,
      results: [
        ...next.results,
        {
          season: c.season,
          week: e.week,
          id: e.id,
          name: e.name,
          circuit: e.circuit,
          kind: e.kind,
          field: e.field,
          round: mine,
          points: e.circuit === 'tour' || e.kind === 'qschool' ? 0 : (pts[mine] ?? 0),
          prize,
        },
      ],
      trophies:
        mine === nRounds && e.kind !== 'qualifier' && e.kind !== 'qschool'
          ? [
              ...next.trophies,
              {
                season: c.season,
                name: e.name,
                circuit: e.circuit,
                tier: CIRCUIT_INFO[e.circuit].stage,
              },
            ]
          : next.trophies,
      earnings: next.earnings + prize,
      reputation:
        next.reputation +
        eventRep(nRounds - mine, CIRCUIT_INFO[e.circuit].stage, e.kind === 'major'),
    };
    // A qualifier's finalists go through to the major.
    if (e.kind === 'qualifier' && e.feeds && mine >= nRounds - 1)
      next = { ...next, invites: [...next.invites, `s${c.season}-${e.feeds}`] };
    if (e.kind === 'qschool') next = qschoolOutcome(next, mine, nRounds);
  }
  return next;
}

/** Q-School: the semi-finalists win a Tour Card, the quarter-finalists a Challenge Tour card. */
export const QSCHOOL_TOUR_FROM = 2; // rounds from the end: SF
function qschoolOutcome(c: CareerState, round: number, nRounds: number): CareerState {
  const fromEnd = nRounds - round;
  if (fromEnd <= QSCHOOL_TOUR_FROM) return grantCard(c, 'tour');
  if (fromEnd === QSCHOOL_TOUR_FROM + 1) return grantCard(c, 'challenge');
  return c;
}

/** Give you a card (and raise your attribute ceiling to match). */
export function grantCard(c: CareerState, card: Card): CareerState {
  const cards: Cards =
    card === 'tour'
      ? // Valid for the coming season and the one after.
        { ...c.cards, county: true, challenge: true, tour: c.season + TOUR_CARD_SEASONS }
      : card === 'challenge'
        ? { ...c.cards, county: true, challenge: true }
        : { ...c.cards, county: true };
  return restage({ ...c, cards });
}

function restage(c: CareerState): CareerState {
  const tier = stageOf(c.cards, c.season);
  if (tier === c.tier) return c;
  // Moving up raises your ceiling; dropping down keeps what you've built.
  return {
    ...c,
    tier,
    attributes: tier > c.tier ? recheck(c.attributes, tier).attrs : c.attributes,
  };
}

/** Simulate a whole event without you. */
function simulateEvent(c: CareerState, e: CalEvent): CareerState {
  const rounds = playOn(c, e, [drawBracket(fieldFor(c, e, false))]);
  return settleEvent(c, e, rounds);
}

/** Your event is over: settle it and move on. */
function finishYourEvent(c: CareerState, rounds: BracketMatch[][]): CareerState {
  const e = eventById(c, c.event!.id)!;
  while (!isOver(rounds)) {
    rounds = playOn(c, e, rounds);
    if (!isOver(rounds) && rounds.at(-1)!.every((m) => m.winner !== null))
      rounds = [...rounds, nextRound(rounds.at(-1)!)];
  }
  const settled = settleEvent(c, e, rounds);
  return finishWeek({ ...settled, event: null, lastEvent: { id: e.id, rounds } });
}

/** Play out the rest of the week's events and move to the next week (or season). */
export function finishWeek(c: CareerState): CareerState {
  if (c.event) return c;
  let next = c;
  for (const e of weekEvents(c)) if (!e.result) next = simulateEvent(next, eventById(next, e.id)!);
  next = { ...next, week: next.week + 1 };
  return next.week > WEEKS_PER_SEASON ? endSeason(next) : next;
}

/** Skip this week: no event for you. */
export const skipWeek = (c: CareerState) => (c.event ? c : finishWeek(c));

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
  if (!next || !c.event) return c;
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
  if (summary) {
    const s = summary.stats;
    c = {
      ...c,
      reputation:
        c.reputation +
        matchRep({
          won,
          stage: c.tier,
          upset: AI_LEVELS.indexOf(next.opponent.level) > c.tier,
          average: s.darts ? (s.points / s.darts) * 3 : 0,
          oneEighties: s.oneEighties,
          bestCheckout: s.bestCheckout,
        }),
    };
  }
  if (summary)
    c = {
      ...c,
      stats: addMatch(
        c.stats,
        { ...summary, opponent: next.opponent.id, opponentName: next.opponent.name, won, score },
        {
          season: c.season,
          tier: c.tier,
          event: next.event.name,
          round: r,
          roundName: next.roundName,
        },
      ),
    };
  const round = c.event!.rounds[r]!.map((m) => {
    if (m.winner !== null || (m.a !== YOU && m.b !== YOU)) return m;
    const youA = m.a === YOU;
    const winner = won ? YOU : youA ? m.b : m.a;
    return { ...m, winner, score: (youA ? score : [score[1], score[0]]) as [number, number] };
  });
  let rounds = [...c.event!.rounds.slice(0, r), round];
  if (won && !isOver(rounds)) {
    rounds = playOn(c, next.event, rounds);
    if (!isOver(rounds) && rounds.at(-1)!.every((m) => m.winner !== null))
      rounds = playOn(c, next.event, [...rounds, nextRound(rounds.at(-1)!)]);
  }
  const stillIn = won && !isOver(rounds);
  return stillIn ? { ...c, event: { ...c.event!, rounds } } : finishYourEvent(c, rounds);
}

/* ------------------------------------------------------------------ seasons */

/** Interim promotion rule: the top 2 of a circuit's merit earn the next card. */
export const PROMOTION_PLACES = 2;
const NEXT_CARD: Partial<Record<CircuitId, Card>> = {
  pub: 'county',
  county: 'challenge',
  challenge: 'tour',
};

function endSeason(c: CareerState): CareerState {
  const places: SeasonSummary['places'] = [];
  const changes: string[] = [];
  let next = c;
  const trophies = [...c.trophies];
  for (const circuit of ['pub', 'county', 'challenge'] as const) {
    if (c.merit[circuit][YOU] === undefined) continue;
    const table = standings(c, circuit);
    const position = table.findIndex((s) => s.id === YOU) + 1;
    places.push({ circuit, position, of: table.length });
    if (position === 1)
      trophies.push({
        season: c.season,
        name: `${CIRCUIT_INFO[circuit].name} Order of Merit`,
        circuit,
        tier: CIRCUIT_INFO[circuit].stage,
      });
    const card = NEXT_CARD[circuit];
    if (card && position <= PROMOTION_PLACES && !holdsCard(next, card)) {
      next = grantCard(next, card);
      changes.push(`${cap(CARD_NAMES[card].replace(/^an? /, ''))} earned`);
    }
  }
  // Tour Cards run out: keep yours by finishing inside the top TOUR_CARD_KEEP.
  if (next.cards.tour !== null && next.cards.tour <= c.season) {
    const pos = tourPosition(next) ?? Infinity;
    places.push({ circuit: 'tour', position: pos, of: tourRanking(next).length });
    if (pos <= TOUR_CARD_KEEP) {
      next = { ...next, cards: { ...next.cards, tour: c.season + TOUR_CARD_SEASONS } };
      changes.push(`Tour Card kept (${ordinal(pos)} on the ranking)`);
    } else {
      next = { ...next, cards: { ...next.cards, tour: null } };
      changes.push(`Tour Card lost (${ordinal(pos)}): back to Q-School`);
    }
  } else if (holdsCard(next, 'tour') && c.tier === 3) {
    const pos = tourPosition(next) ?? 0;
    places.push({ circuit: 'tour', position: pos, of: tourRanking(next).length });
  }
  const before = c.tier;
  const season = c.season + 1;
  next = restage({ ...next, trophies, season });
  return {
    ...next,
    season,
    week: 1,
    calendar: buildCalendar(season),
    merit: emptyMerit(),
    invites: [],
    qschoolPlace: false,
    lastSeason: { season: c.season, places, changes, promoted: next.tier > before },
  };
}
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export const dismissSeason = (c: CareerState): CareerState => ({ ...c, lastSeason: null });

/* ------------------------------------------------------------------ XP and training */

/** Bank XP into your attributes and remember it for the post-match screen. */
function gainXp(
  c: CareerState,
  source: GainReport['source'],
  gain: { attrs: Ratings; player: number },
): CareerState {
  const change = applyXp(c.attributes, gain, c.tier);
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

/** Training drills: each works one attribute hardest. */
export const DRILLS: Record<Attr, { mode: 'atc' | 'bobs27' | 'ladder' | 'halveit'; name: string }> =
  {
    scoring: { mode: 'atc', name: 'Around the Clock' },
    finishing: { mode: 'bobs27', name: "Bob's 27" },
    nerve: { mode: 'ladder', name: '121 checkout ladder' },
    rhythm: { mode: 'halveit', name: 'Halve-It' },
  };

/** One training session per week. */
export const weekKey = (c: CareerState) => `${c.season}:${c.week}`;
export const canTrain = (c: CareerState) => c.trainedFor !== weekKey(c);

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
    trainedFor: weekKey(c),
  };
}

/* ------------------------------------------------------------------ views */

/** How you did in an event (for the calendar). */
export function resultFor(c: CareerState, id: string): EventResult | null {
  return c.results.find((r) => r.id === id) ?? null;
}

export const describeReached = (r: EventResult) => reachedLabel(r.field, r.round);

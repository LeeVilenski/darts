import { describe, expect, it } from 'vitest';
import { simulateLeg } from '../ai/simulate';
import { AI_LEVELS } from '../ai/skill';
import { DEFAULT_X01 } from '../modes/x01';
import { createRng } from '../rng';
import { drawBracket, seedOrder } from './bracket';
import {
  createRoster,
  dismissSeason,
  eligibility,
  enterEvent,
  eventById,
  grantCard,
  newCareer,
  nextMatch,
  recordResult,
  simulateMatch,
  skipWeek,
  standings,
  weekEvents,
  YOU,
  type CareerState,
} from './career';
import { CIRCUIT_INFO, WEEKS_PER_SEASON } from './circuits';
import { migrateV1 } from './migrate';
import { LEG_DARTS, quickMatch } from './quickSim';

const win = (c: CareerState) => recordResult(c, true, [1, 0]);
const lose = (c: CareerState) => recordResult(c, false, [0, 1]);
const winAll = (c: CareerState) => {
  while (nextMatch(c)) c = win(c);
  return c;
};
/** Enter the first event you can this week (preferring `circuit`), or skip. */
const playWeek = (c: CareerState, play: (c: CareerState) => CareerState, prefer?: string) => {
  const open = weekEvents(c).filter((e) => eligibility(c, e).ok);
  const e = open.find((x) => x.circuit === prefer) ?? open[0];
  return e ? play(enterEvent(c, e.id)) : skipWeek(c);
};

describe('career world', () => {
  it('builds a roster of unique fictional players for every circuit', () => {
    const roster = createRoster(42);
    const total = Object.values(CIRCUIT_INFO).reduce(
      (n, ci) => n + ci.levels.reduce((m, [, k]) => m + k, 0),
      0,
    );
    expect(roster).toHaveLength(total);
    expect(new Set(roster.map((p) => p.name)).size).toBe(roster.length);
    expect(createRoster(42)).toEqual(roster);
  });

  it('starts you at the pub in week 1, with the bigger circuits locked', () => {
    const c = newCareer('Sam', 7);
    expect(c.week).toBe(1);
    const week = weekEvents(c);
    const pub = week.find((e) => e.circuit === 'pub')!;
    const pc = week.find((e) => e.circuit === 'tour')!;
    expect(eligibility(c, pub).ok).toBe(true);
    expect(eligibility(c, pc)).toEqual({ ok: false, reason: 'Needs a Tour Card' });
  });

  it('seeds a draw so the top two seeds can only meet in the final', () => {
    expect(seedOrder(8)).toEqual([0, 7, 3, 4, 1, 6, 2, 5]);
    const d = drawBracket(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(d[0]).toMatchObject({ a: '1', b: '8' });
    expect(d.slice(2).some((m) => m.a === '2' || m.b === '2')).toBe(true);
  });
});

describe('playing an event', () => {
  it('entering puts you in a quarter-final against a pub regular', () => {
    const c0 = newCareer('Sam', 7);
    const pub = weekEvents(c0).find((e) => e.circuit === 'pub')!;
    const c = enterEvent(c0, pub.id);
    const next = nextMatch(c)!;
    expect(next.roundName).toBe('Quarter-final');
    expect(next.opponent.circuit).toBe('pub');
    const field = c.event!.rounds[0]!.flatMap((m) => [m.a, m.b]);
    expect(new Set(field).size).toBe(8);
    expect(field).toContain(YOU);
  });

  it('winning three matches wins the event and moves to next week', () => {
    let c = newCareer('Sam', 7);
    const pub = weekEvents(c).find((e) => e.circuit === 'pub')!;
    c = enterEvent(c, pub.id);
    c = win(c);
    expect(nextMatch(c)!.roundName).toBe('Semi-final');
    c = win(win(c));
    expect(c.event).toBeNull();
    expect(c.week).toBe(2);
    expect(c.results.at(-1)).toMatchObject({ name: pub.name, round: 3, prize: 100 });
    expect(c.trophies).toHaveLength(1);
    expect(c.merit.pub[YOU]).toBe(10);
    expect(eventById(c, pub.id)!.result!.winner).toBe(YOU);
    expect(c.lastEvent!.rounds).toHaveLength(3);
  });

  it('losing plays the event out without you, and the week’s other events too', () => {
    let c = newCareer('Sam', 7);
    c = lose(enterEvent(c, weekEvents(c).find((e) => e.circuit === 'pub')!.id));
    expect(c.results.at(-1)!.round).toBe(0);
    expect(c.week).toBe(2);
    for (const e of weekEvents(c, 1)) expect(e.result).not.toBeNull();
    const pubTotal = Object.values(c.merit.pub).reduce((a, b) => a + b, 0);
    expect(pubTotal).toBe(4 * 1 + 2 * 3 + 6 + 10);
    // Tour events played without you put money on the ranking.
    expect(Object.keys(c.money).length).toBeGreaterThan(0);
  });

  it('skipping a week plays it without you', () => {
    const c = skipWeek(newCareer('Sam', 7));
    expect(c.week).toBe(2);
    expect(c.results).toHaveLength(0);
  });

  it('is deterministic for a seed', () => {
    const run = () => playWeek(playWeek(newCareer('Sam', 99), winAll), lose);
    expect(run()).toEqual(run());
  });
});

describe('seasons and cards', () => {
  it('dominating the pub earns a County card for next season', () => {
    let c = newCareer('Sam', 3);
    while (c.season === 1) c = playWeek(c, winAll, 'pub');
    expect(c.cards.county).toBe(true);
    expect(c.tier).toBe(1);
    expect(c.lastSeason!.changes).toContain('County card earned');
    expect(c.lastSeason!.places[0]).toMatchObject({ circuit: 'pub', position: 1 });
    expect(c.trophies.some((t) => t.name.includes('Order of Merit'))).toBe(true);
    expect(c.week).toBe(1);
    expect(dismissSeason(c).lastSeason).toBeNull();
    const county = c.calendar.find((e) => e.circuit === 'county' && e.kind === 'open')!;
    expect(eligibility(c, county).ok).toBe(true);
  });

  it('a losing season leaves you at the pub', () => {
    let c = newCareer('Sam', 3);
    while (c.season === 1) c = playWeek(c, lose);
    expect(c.cards.county).toBe(false);
    expect(c.lastSeason!.promoted).toBe(false);
    expect(standings(c, 'pub').length).toBe(16);
  });

  it('Pub League Finals Night is for the top 8 only', () => {
    let c = newCareer('Sam', 3);
    while (c.week < 12) c = skipWeek(c);
    const finals = weekEvents(c).find((e) => e.kind === 'finals' && e.circuit === 'pub')!;
    expect(eligibility(c, finals)).toMatchObject({ ok: false });
  });

  it('Q-School semi-finalists win a Tour Card', () => {
    let c = grantCard(newCareer('Sam', 5), 'county');
    c = { ...c, earnings: 1000 };
    while (c.week < WEEKS_PER_SEASON) c = skipWeek(c);
    const q = weekEvents(c).find((e) => e.kind === 'qschool')!;
    expect(eligibility(c, q)).toEqual({ ok: true, via: 'fee' });
    c = enterEvent(c, q.id);
    expect(c.spent).toBe(500);
    for (let i = 0; i < 3; i++) c = win(c); // to the semi-final
    c = lose(c);
    expect(c.season).toBe(2);
    expect(c.tier).toBe(3);
    expect(c.cards.tour).toBe(3);
  });

  it('reaching a qualifier final earns a place in the major', () => {
    let c: CareerState = grantCard(newCareer('Sam', 5), 'tour');
    while (c.week < 3) c = skipWeek(c);
    const q = weekEvents(c).find((e) => e.kind === 'qualifier')!;
    c = enterEvent(c, q.id);
    for (let i = 0; i < 3; i++) c = win(c);
    c = lose(c); // lose the qualifier final
    const gp = weekEvents(c).find((e) => e.kind === 'major')!;
    expect(c.week).toBe(4);
    expect(eligibility(c, gp)).toEqual({ ok: true, via: 'invite' });
    c = enterEvent(c, gp.id);
    expect(nextMatch(c)!.roundName).toBe('Last 16');
  });
});

describe('match simulation', () => {
  it('physics-simulated matches respect skill and format', () => {
    const roster = createRoster(1);
    const pub = roster.find((p) => p.level === 'pub')!;
    const pro = roster.find((p) => p.level === 'pro')!;
    let proWins = 0;
    for (let i = 0; i < 10; i++) {
      const r = simulateMatch([pub, pro], { ...DEFAULT_X01, legsToWin: 2 }, createRng(i));
      expect(Math.max(...r.score)).toBe(2);
      if (r.winner === 1) proWins++;
    }
    expect(proWins).toBeGreaterThan(7);
  });

  it('quick sim leg lengths match the physics, level by level', () => {
    for (const level of AI_LEVELS) {
      const rng = createRng(31);
      let darts = 0;
      for (let i = 0; i < 60; i++) darts += simulateLeg(level, rng).darts;
      expect(Math.abs(darts / 60 - LEG_DARTS[level].mean)).toBeLessThan(
        LEG_DARTS[level].mean * 0.15,
      );
    }
  });

  it('quick sim: stronger players usually win, and the format holds', () => {
    const rng = createRng(2);
    let county = 0;
    for (let i = 0; i < 400; i++) {
      const r = quickMatch('club', 'county', { ...DEFAULT_X01, legsToWin: 3 }, rng);
      expect(Math.max(...r.score)).toBe(3);
      if (r.winner === 1) county++;
    }
    expect(county / 400).toBeGreaterThan(0.7);
    const sets = quickMatch('pro', 'pro', { ...DEFAULT_X01, legsToWin: 3, setsToWin: 2 }, rng);
    expect(Math.max(...sets.score)).toBe(2);
  });
});

describe('old saves', () => {
  it('migrates a version-1 career onto the calendar', () => {
    const old = {
      version: 1 as const,
      seed: 9,
      you: 'Sam',
      tier: 1,
      season: 3,
      roster: [{ id: 'p4', name: 'Gus Hale' }],
      results: [
        {
          season: 1,
          tier: 0,
          name: 'Red Lion Open',
          reached: 'W' as const,
          points: 10,
          prize: 100,
        },
      ],
      trophies: [{ season: 1, tier: 0, name: 'Red Lion Open' }],
      earnings: 640,
    };
    const c = migrateV1(old);
    expect(c.version).toBe(2);
    expect(c.season).toBe(3);
    expect(c.week).toBe(1);
    expect(c.cards.county).toBe(true);
    expect(c.tier).toBe(1);
    expect(c.results[0]).toMatchObject({ circuit: 'pub', round: 3, name: 'Red Lion Open' });
    expect(c.trophies).toHaveLength(1);
    expect(c.earnings).toBe(640);
    expect(c.calendar[0]!.id.startsWith('s3-')).toBe(true);
  });
});

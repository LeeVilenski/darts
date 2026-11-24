import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import {
  createRoster,
  dismissSeason,
  newCareer,
  nextMatch,
  recordResult,
  simulateMatch,
  standings,
  YOU,
  type CareerState,
} from './career';
import { EVENTS_PER_SEASON, TIERS } from './tiers';

const win = (c: CareerState) => recordResult(c, true, [1, 0]);
const lose = (c: CareerState) => recordResult(c, false, [0, 1]);

describe('career', () => {
  it('builds a roster of unique fictional players for every tier', () => {
    const roster = createRoster(42);
    expect(roster).toHaveLength(TIERS.length * 12);
    expect(new Set(roster.map((p) => p.name)).size).toBe(roster.length);
    expect(createRoster(42)).toEqual(roster);
  });

  it('starts you in a Pub League quarter-final', () => {
    const c = newCareer('Sam', 7);
    expect(c.tier).toBe(0);
    expect(c.event.rounds[0]).toHaveLength(4);
    const field = c.event.rounds[0]!.flatMap((m) => [m.a, m.b]);
    expect(new Set(field).size).toBe(8);
    expect(field).toContain(YOU);
    const next = nextMatch(c)!;
    expect(next.round).toBe(0);
    expect(next.opponent.tier).toBe(0);
  });

  it('winning three matches wins the event', () => {
    let c = newCareer('Sam', 7);
    c = win(c);
    expect(nextMatch(c)!.round).toBe(1);
    c = win(win(c));
    expect(c.results.at(-1)).toMatchObject({ reached: 'W', name: TIERS[0]!.events[0] });
    expect(c.trophies).toHaveLength(1);
    expect(c.earnings).toBe(TIERS[0]!.prize);
    expect(c.eventIndex).toBe(1);
    expect(c.merit[YOU]).toBe(TIERS[0]!.points.W);
    // The next event is drawn straight away.
    expect(nextMatch(c)!.round).toBe(0);
  });

  it('losing plays out the rest of the event without you', () => {
    const c = lose(newCareer('Sam', 7));
    expect(c.results.at(-1)!.reached).toBe('QF');
    expect(c.eventIndex).toBe(1);
    const total = Object.values(c.merit).reduce((a, b) => a + b, 0);
    const p = TIERS[0]!.points;
    expect(total).toBe(4 * p.QF + 2 * p.SF + p.F + p.W);
  });

  it('winning the season promotes you', () => {
    let c = newCareer('Sam', 3);
    for (let e = 0; e < EVENTS_PER_SEASON; e++) c = win(win(win(c)));
    expect(c.lastSeason).toMatchObject({ season: 1, tier: 0, position: 1, promoted: true });
    expect(c.tier).toBe(1);
    expect(c.season).toBe(2);
    expect(c.merit).toEqual({});
    expect(c.trophies.some((t) => t.name.includes('Order of Merit'))).toBe(true);
    expect(nextMatch(c)!.opponent.tier).toBe(1);
    expect(dismissSeason(c).lastSeason).toBeNull();
  });

  it('a poor season keeps you on the same tier', () => {
    let c = newCareer('Sam', 3);
    for (let e = 0; e < EVENTS_PER_SEASON; e++) c = lose(c);
    expect(c.lastSeason!.promoted).toBe(false);
    expect(c.tier).toBe(0);
    expect(standings(c)).toHaveLength(13);
  });

  it('simulated matches respect skill and format', () => {
    const roster = createRoster(1);
    const pub = roster.find((p) => p.level === 'pub')!;
    const pro = roster.find((p) => p.level === 'pro')!;
    let proWins = 0;
    for (let i = 0; i < 20; i++) {
      const r = simulateMatch([pub, pro], TIERS[0]!.formats[1]!, createRng(i));
      expect(Math.max(...r.score)).toBe(2);
      if (r.winner === 1) proWins++;
    }
    expect(proWins).toBeGreaterThan(15);
  });

  it('is deterministic for a seed', () => {
    const run = () => lose(win(newCareer('Sam', 99)));
    expect(run()).toEqual(run());
  });
});

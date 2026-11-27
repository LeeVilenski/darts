import { describe, expect, it } from 'vitest';
import {
  eligibility,
  enterEvent,
  newCareer,
  nextMatch,
  recordResult,
  skipWeek,
  weekEvents,
  type CareerState,
} from './career';
import { answerOffer, evaluate, unread, withStory } from './milestones';
import { repBand } from './story';

const stats = { darts: 15, points: 501, tons: 1, ton40s: 0, oneEighties: 1, bestCheckout: 120 };
const win = (c: CareerState) =>
  withStory(c, (x) => recordResult(x, true, [1, 0], { legs: [1, 0], stats }));
const lose = (c: CareerState) =>
  withStory(c, (x) => recordResult(x, false, [0, 1], { legs: [0, 1], stats }));
const enter = (c: CareerState, circuit: string) =>
  withStory(c, (x) => enterEvent(x, weekEvents(x).find((e) => e.circuit === circuit)!.id));
const winAll = (c: CareerState) => {
  while (nextMatch(c)) c = win(c);
  return c;
};

describe('the story: pub to county', () => {
  it('a pub title brings messages and a county wildcard you can accept', () => {
    let c = winAll(enter(newCareer('Sam', 4), 'pub'));
    const subjects = c.inbox.map((m) => m.subject);
    expect(subjects).toContain('First win on the board');
    expect(subjects.some((s) => s.startsWith('First title'))).toBe(true);
    const offer = c.inbox.find((m) => m.offer)!;
    expect(offer.from).toBe('secretary');
    expect(c.reputation).toBeGreaterThan(0);
    expect(unread(c)).toBe(c.inbox.length);

    const target = c.calendar.find((e) => e.id === offer.offer!.eventId)!;
    expect(target.circuit).toBe('county');
    expect(eligibility(c, target).ok).toBe(false);
    c = answerOffer(c, offer.id, true);
    expect(eligibility(c, target)).toEqual({ ok: true, via: 'invite' });

    // Play on to the wildcard event and win a match there: County card.
    while (c.week < target.week) c = withStory(c, skipWeek);
    c = withStory(c, (x) => enterEvent(x, target.id));
    c = lose(win(c));
    expect(c.cards.county).toBe(true);
    expect(c.tier).toBe(1);
    expect(c.inbox.some((m) => m.subject === "You've got your County card")).toBe(true);
    expect(c.inbox.some((m) => m.from === 'coach')).toBe(true);
  });

  it('a wildcard you lose in the first round leaves you at the pub, with another chance later', () => {
    let c = winAll(enter(newCareer('Sam', 4), 'pub'));
    const offer = c.inbox.find((m) => m.offer)!;
    c = answerOffer(c, offer.id, true);
    const target = c.calendar.find((e) => e.id === offer.offer!.eventId)!;
    while (c.week < target.week) c = withStory(c, skipWeek);
    c = lose(withStory(c, (x) => enterEvent(x, target.id)));
    expect(c.cards.county).toBe(false);
    // Win another pub event: a second wildcard.
    while (!weekEvents(c).some((e) => e.circuit === 'pub' && eligibility(c, e).ok))
      c = withStory(c, skipWeek);
    c = winAll(enter(c, 'pub'));
    expect(c.inbox.filter((m) => m.offer).length).toBe(2);
  });

  it('rules fire once', () => {
    const c = winAll(enter(newCareer('Sam', 4), 'pub'));
    expect(evaluate(c)).toEqual(c);
  });

  it('reputation has named bands', () => {
    expect(repBand(0).name).toBe('Unknown');
    expect(repBand(130)).toMatchObject({ name: 'Pub legend', next: 250 });
  });
});

describe('the story: the pro game', () => {
  it('a Tour Card brings a welcome, and the ranking decides your majors', async () => {
    const { grantCard, tourPosition } = await import('./career');
    const c = evaluate(grantCard(newCareer('Sam', 6), 'tour'));
    expect(c.inbox.some((m) => m.subject === 'Welcome to the Pro Tour')).toBe(true);
    // Fresh on tour with no money: outside the majors' automatic places.
    expect(tourPosition(c)).toBeGreaterThan(14);
    const gp = c.calendar.find((e) => e.slug === 'grand-prix')!;
    expect(eligibility(c, gp).ok).toBe(false);
  });

  it('an expiring card is lost outside the top 48, and kept inside it', async () => {
    const { grantCard, tourPosition } = await import('./career');
    let c = grantCard(newCareer('Sam', 6), 'tour');
    c = { ...c, cards: { ...c.cards, tour: 1 } }; // runs out this season
    let lost = c;
    while (lost.season === 1) lost = withStory(lost, skipWeek);
    expect(lost.cards.tour).toBeNull();
    expect(lost.tier).toBe(2);
    expect(lost.inbox.some((m) => m.subject === 'Your Tour Card has expired')).toBe(true);
    expect(lost.inbox.some((m) => m.subject === 'Your Tour Card is at risk')).toBe(true);
    expect(lost.inbox.some((m) => m.subject === 'Season 1 in review')).toBe(true);

    // Rich enough to be ranked: kept for two more seasons.
    let kept: CareerState = { ...c, money: { ...c.money, you: { 1: 500000 } } };
    expect(tourPosition(kept)).toBe(1);
    while (kept.season === 1) kept = withStory(kept, skipWeek);
    expect(kept.cards.tour).toBe(3);
    expect(kept.lastSeason!.changes[0]).toMatch(/^Tour Card kept/);
  });
});

describe('flavour: rivals, nicknames, kit and fees', () => {
  it('losing twice to the same player makes them your rival', async () => {
    const { rivalOf } = await import('./milestones');
    let c = newCareer('Sam', 4);
    c = { ...c, stats: { ...c.stats, h2h: { p3: [0, 2], p5: [3, 2] } } };
    expect(rivalOf(c)).toMatchObject({ id: 'p3', losses: 2 });
    c = evaluate(c);
    expect(c.inbox.some((m) => m.subject.startsWith('A rivalry'))).toBe(true);
  });

  it('the press offer three nicknames; you pick one', async () => {
    const { answerChoice } = await import('./milestones');
    const { displayName } = await import('./career');
    let c = evaluate({ ...newCareer('Sam Rowe', 4), reputation: 260 });
    const msg = c.inbox.find((m) => m.choice)!;
    expect(msg.choice!.options).toHaveLength(3);
    c = answerChoice(c, msg.id, msg.choice!.options[1]!);
    expect(c.nickname).toBe(msg.choice!.options[1]);
    expect(displayName(c)).toBe(`Sam "${c.nickname}" Rowe`);
    expect(answerChoice(c, msg.id, msg.choice!.options[0]!)).toBe(c);
  });

  it('kit costs money from your balance, and stays yours', async () => {
    const { buyKit, owns } = await import('./kit');
    const { balance } = await import('./career');
    let c = { ...newCareer('Sam', 4), earnings: 200 };
    c = buyKit(c, { kind: 'shirt', index: 2 });
    expect(balance(c)).toBe(50);
    expect(c.kit.shirt).toBe(2);
    expect(buyKit(c, { kind: 'pattern', pattern: 'flames' })).toBe(c); // can't afford
    c = buyKit({ ...c, kit: { ...c.kit, shirt: null } }, { kind: 'shirt', index: 2 });
    expect(balance(c)).toBe(50); // owned: free to wear again
    expect(owns(c, { kind: 'shirt', index: 2 })).toBe(true);
  });

  it('county opens charge an entry fee', async () => {
    const { grantCard } = await import('./career');
    let c = grantCard(newCareer('Sam', 4), 'county');
    while (c.week < 3) c = skipWeek(c);
    const open = weekEvents(c).find((e) => e.circuit === 'county')!;
    expect(eligibility(c, open)).toMatchObject({
      ok: false,
      reason: 'Entry fee £25 (you have £0)',
    });
    c = { ...c, earnings: 30 };
    expect(eligibility(c, open)).toEqual({ ok: true, via: 'fee' });
    c = enterEvent(c, open.id);
    expect(c.spent).toBe(25);
  });
});

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
    expect(subjects.some((s) => s.startsWith('Local winner'))).toBe(true);
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

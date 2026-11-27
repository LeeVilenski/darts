import { describe, expect, it } from 'vitest';
import { appearanceFor, backNameFor, SHIRTS } from './appearance';
import { createRoster } from '../../engine/career/career';

describe('appearanceFor', () => {
  it('is stable: the same name always gets the same look', () => {
    expect(appearanceFor('Lena Varley')).toEqual(appearanceFor('Lena Varley'));
    expect(appearanceFor('  lena varley ')).toEqual(appearanceFor('Lena Varley'));
  });

  it('gives a career roster plenty of different looks', () => {
    const roster = createRoster(1234);
    const looks = roster.map((p) => appearanceFor(p.name));
    const key = (l: ReturnType<typeof appearanceFor>) =>
      `${l.shirt}|${l.pattern}|${l.hairStyle}|${l.hair}|${l.skin}`;
    // Nearly everyone is distinct, and every shirt colour turns up somewhere.
    expect(new Set(looks.map(key)).size).toBeGreaterThan(roster.length * 0.9);
    expect(new Set(looks.map((l) => l.shirt)).size).toBe(SHIRTS.length);
    expect(new Set(looks.map((l) => l.hairStyle)).size).toBeGreaterThanOrEqual(6);
  });

  it('keeps builds in a believable range', () => {
    for (let i = 0; i < 200; i++) {
      const l = appearanceFor(`Player ${i}`);
      expect(l.height).toBeGreaterThanOrEqual(0.95);
      expect(l.height).toBeLessThanOrEqual(1.05);
      expect(l.girth).toBeGreaterThanOrEqual(0.92);
      expect(l.girth).toBeLessThanOrEqual(1.22);
    }
  });
});

describe('backNameFor', () => {
  it('prints the nickname if there is one, else the surname', () => {
    expect(backNameFor('Gus "The Hammer" Marlow')).toBe('THE HAMMER');
    expect(backNameFor('Lena Varley')).toBe('VARLEY');
  });
  it('keeps generic names readable', () => {
    expect(backNameFor('Player 2')).toBe('PLAYER 2');
    expect(backNameFor('Club Bot')).toBe('CLUB BOT');
    expect(backNameFor('Cher')).toBe('CHER');
  });
});

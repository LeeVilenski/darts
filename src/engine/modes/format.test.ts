import { describe, expect, it } from 'vitest';
import { applyBullUpDart, bullUpThrower, bullUpTied, createBullUp, rethrowBullUp } from './bullUp';
import { applyCricketDart, createCricket, endCricketTurn, type CricketState } from './cricket';
import { dart } from './testDarts';
import { createX01, DEFAULT_X01, endTurn, type X01State } from './x01';
import { setJustWon, withStarter } from './types';

/** Give player `i` the leg: put them on 40 and hit D20. */
const winLeg = (s: X01State, i: number): X01State => {
  let m = { ...s, current: i, turn: { ...s.turn, player: i, startRemaining: 40 } };
  m = { ...m, players: m.players.map((p, j) => (j === i ? { ...p, remaining: 40 } : p)) };
  return applyDartX01(m, 'D20');
};
import { applyDart as applyX01 } from './x01';
const applyDartX01 = (s: X01State, l: string) => applyX01(s, dart(l));

describe('sets', () => {
  const sets = { ...DEFAULT_X01, legsToWin: 2, setsToWin: 2 };

  it('legs win sets and sets win the match', () => {
    let s = createX01(['A', 'B'], sets);
    s = endTurn(winLeg(s, 0));
    expect(s.players[0]).toMatchObject({ legsWon: 1, setsWon: 0 });
    const setDone = winLeg(s, 0);
    expect(setJustWon(setDone)).toBe(true);
    expect(setDone.status).toBe('legWon');
    s = endTurn(setDone);
    // Leg counts reset for the new set.
    expect(s.players.map((p) => p.legsWon)).toEqual([0, 0]);
    expect(s.players[0]!.setsWon).toBe(1);
    expect(s.set).toBe(2);
    s = endTurn(winLeg(s, 0));
    const won = winLeg(s, 0);
    expect(won.status).toBe('matchWon');
    expect(won.winner).toBe(0);
  });

  it('throw alternates every leg, and the first leg of each set alternates', () => {
    let s = createX01(['A', 'B'], { ...DEFAULT_X01, legsToWin: 3, setsToWin: 3 });
    const starters: number[] = [s.legStarter];
    // Set 1: A wins 3-0 (legs started A, B, A); set 2 must start with B.
    for (let leg = 0; leg < 3; leg++) {
      s = endTurn(winLeg(s, 0));
      starters.push(s.legStarter);
    }
    expect(starters).toEqual([0, 1, 0, 1]);
    expect(s.set).toBe(2);
    expect(s.current).toBe(1);
  });

  it('without sets, legs alone decide it', () => {
    const s = winLeg(createX01(['A', 'B'], { ...DEFAULT_X01, legsToWin: 1 }), 1);
    expect(s.status).toBe('matchWon');
    expect(setJustWon(s)).toBe(false);
  });
});

describe('withStarter', () => {
  it('makes the bull-up winner throw first', () => {
    const s = withStarter(createX01(['A', 'B', 'C'], { ...DEFAULT_X01, legsToWin: 2 }), 2);
    expect([s.current, s.legStarter, s.turn.player]).toEqual([2, 2, 2]);
    expect(endTurn(winLeg(s, 2)).legStarter).toBe(0);
  });
});

describe('bull-up', () => {
  it('closest to the bull wins', () => {
    let b = createBullUp(3);
    for (const d of [12, 4, 30]) {
      expect(bullUpThrower(b)).not.toBeNull();
      b = applyBullUpDart(b, d);
    }
    expect(b.winner).toBe(1);
    expect(bullUpThrower(b)).toBeNull();
  });

  it('tied players throw again', () => {
    let b = createBullUp(3);
    for (const d of [5, 5, 30]) b = applyBullUpDart(b, d);
    expect(bullUpTied(b)).toBe(true);
    b = rethrowBullUp(b);
    expect(b.throwers).toEqual([0, 1]);
    expect(b.round).toBe(2);
    b = applyBullUpDart(applyBullUpDart(b, 9), 2);
    expect(b.winner).toBe(1);
  });

  it('everyone off the board throws again', () => {
    let b = createBullUp(2);
    b = applyBullUpDart(applyBullUpDart(b, Infinity), Infinity);
    expect(rethrowBullUp(b).throwers).toEqual([0, 1]);
  });
});

describe('cut-throat cricket', () => {
  const throwAll = (s: CricketState, labels: string[]) =>
    labels.reduce((m, l) => applyCricketDart(m, dart(l)), s);

  it('extra marks score for the opponents still open', () => {
    let s = createCricket(['A', 'B'], { legsToWin: 1, cutThroat: true });
    s = throwAll(s, ['T20', 'T20', 'MISS']);
    expect(s.players.map((p) => p.points)).toEqual([0, 60]);
  });

  it('the lowest score wins once everything is closed', () => {
    let s = createCricket(['A', 'B'], { legsToWin: 1, cutThroat: true });
    const close = ['T20', 'T19', 'T18', 'T17', 'T16', 'T15', 'BULL', '25'];
    s = {
      ...s,
      players: [
        { ...s.players[0]!, points: 0 },
        { ...s.players[1]!, points: 40 },
      ],
    };
    for (const label of close) {
      s = applyCricketDart(s, dart(label));
      if (s.status === 'complete') {
        // B misses a whole turn, back to A.
        s = throwAll(endCricketTurn(s), ['MISS', 'MISS', 'MISS']);
        s = endCricketTurn(s);
      }
    }
    expect(s.status).toBe('matchWon');
    expect(s.winner).toBe(0);
  });
});

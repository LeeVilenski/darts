import { describe, expect, it } from 'vitest';
import {
  applyCricketDart,
  createCricket,
  endCricketTurn,
  marksPerRound,
  type CricketState,
} from './cricket';
import { dart } from './testDarts';

const play = (s: CricketState, labels: string[]) =>
  labels.reduce((acc, l) => applyCricketDart(acc, dart(l)), s);

describe('cricket', () => {
  it('adds marks and closes at three', () => {
    const s = play(createCricket(['A', 'B']), ['S20', 'D20', 'S19']);
    expect(s.players[0]!.marks[20]).toBe(3);
    expect(s.players[0]!.marks[19]).toBe(1);
    expect(s.players[0]!.points).toBe(0);
    expect(s.status).toBe('complete');
  });

  it('scores extra marks while an opponent is open', () => {
    const s = play(createCricket(['A', 'B']), ['T20', 'T20', 'S20']);
    expect(s.players[0]!.points).toBe(80);
    expect(s.turn.points).toBe(80);
    expect(s.turn.marks).toBe(7);
  });

  it('does not score once every opponent has closed the number', () => {
    let s = play(createCricket(['A', 'B']), ['T20', 'MISS', 'MISS']);
    s = play(endCricketTurn(s), ['T20', 'MISS', 'MISS']);
    s = play(endCricketTurn(s), ['T20', 'MISS', 'MISS']);
    expect(s.players[0]!.points).toBe(0);
  });

  it('counts the bull as two marks and the outer bull as one', () => {
    const s = play(createCricket(['A', 'B']), ['BULL', '25', '25']);
    expect(s.players[0]!.marks[25]).toBe(3);
    expect(s.players[0]!.points).toBe(25);
  });

  it('ignores numbers outside 15–20', () => {
    const s = play(createCricket(['A']), ['T14', 'S1', 'MISS']);
    expect(Object.values(s.players[0]!.marks).every((m) => m === 0)).toBe(true);
  });

  it('wins when all closed and not behind on points', () => {
    let s = createCricket(['A', 'B']);
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, marks: { 20: 3, 19: 3, 18: 3, 17: 3, 16: 3, 15: 3, 25: 1 } } : p,
      ),
    };
    s = play(s, ['BULL']);
    expect(s.status).toBe('matchWon');
    expect(s.winner).toBe(0);
  });

  it('cannot win while behind on points', () => {
    let s = createCricket(['A', 'B']);
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, marks: { 20: 3, 19: 3, 18: 3, 17: 3, 16: 3, 15: 3, 25: 1 } }
          : { ...p, points: 40 },
      ),
    };
    s = play(s, ['BULL']);
    expect(s.status).toBe('open');
  });

  it('tracks marks per round', () => {
    const s = play(createCricket(['A', 'B']), ['T20', 'T19', 'MISS']);
    expect(marksPerRound(s.players[0]!)).toBe(6);
  });

  it('resets the board for the next leg', () => {
    let s = createCricket(['A', 'B'], { legsToWin: 2 });
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, marks: { 20: 3, 19: 3, 18: 3, 17: 3, 16: 3, 15: 3, 25: 2 } } : p,
      ),
    };
    s = endCricketTurn(play(s, ['25']));
    expect(s.leg).toBe(2);
    expect(s.current).toBe(1);
    expect(s.players[0]!.legsWon).toBe(1);
    expect(s.players[0]!.marks[20]).toBe(0);
  });
});

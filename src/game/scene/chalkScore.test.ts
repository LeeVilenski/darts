import { describe, expect, it } from 'vitest';
import type { DartScore } from '../../engine/modes/dart';
import {
  applyMatchDart,
  createMatch,
  endMatchTurn,
  type MatchState,
} from '../../engine/modes/match';
import { DEFAULT_X01 } from '../../engine/modes/x01';
import { DEFAULT_CRICKET } from '../../engine/modes/cricket';
import { chalkSheet, MAX_ROWS, updateChalk, type ChalkLog } from './chalkScore';

const T20: DartScore = { points: 60, multiplier: 3, label: 'T20' };
const S1: DartScore = { points: 1, multiplier: 1, label: 'S1' };
const T19: DartScore = { points: 57, multiplier: 3, label: 'T19' };

/** Play darts through the engine, updating the chalk log after every step like the game does. */
function play(m: MatchState, turns: DartScore[][]) {
  let log: ChalkLog | null = updateChalk(null, m);
  for (const turn of turns) {
    for (const d of turn) {
      m = applyMatchDart(m, d);
      log = updateChalk(log, m);
    }
    if (m.status === 'matchWon') break;
    m = endMatchTurn(m);
    log = updateChalk(log, m);
  }
  return { m, log: log! };
}

describe('x01 chalkboard', () => {
  const start = () =>
    createMatch(['Lena Varley', 'Gus "The Hammer" Marlow'], { mode: 'x01', options: DEFAULT_X01 });

  it('starts each column with the start score', () => {
    const m = start();
    const sheet = chalkSheet(m, updateChalk(null, m));
    expect(sheet.kind).toBe('x01');
    if (sheet.kind !== 'x01') return;
    expect(sheet.names).toEqual(['VARLEY', 'THE HAM.']);
    expect(sheet.columns.map((c) => c.scores)).toEqual([[501], [501]]);
  });

  it('chalks each remaining score once the turn is over, not dart by dart', () => {
    const { log, m } = play(start(), [
      [T20, T20, T20], // Varley 321
      [T20, T19, S1], // Marlow 383
      [T20, T20, S1], // Varley 200
    ]);
    expect(log.scores).toEqual([
      [501, 321, 200],
      [501, 383],
    ]);
    // Mid-turn darts don't get chalked.
    const mid = updateChalk(log, applyMatchDart(m, T20));
    expect(mid.scores[1]).toEqual([501, 383]);
  });

  it('a bust or no-score turn leaves the column as it was', () => {
    const { log } = play(start(), [
      [S1, { points: 0, multiplier: 0, label: 'MISS' }, S1], // 499
      [
        { points: 0, multiplier: 0, label: 'MISS' },
        { points: 0, multiplier: 0, label: 'MISS' },
        { points: 0, multiplier: 0, label: 'MISS' },
      ],
    ]);
    expect(log.scores).toEqual([[501, 499], [501]]);
  });

  it('works for a single player (the same player throws every turn)', () => {
    const solo = createMatch(['Pip Gilroy'], { mode: 'x01', options: DEFAULT_X01 });
    const { log } = play(solo, [
      [T20, T20, T20],
      [T20, T20, T20],
    ]);
    expect(log.scores).toEqual([[501, 321, 141]]);
  });

  it('wipes the board for a new leg', () => {
    const first = start();
    const log = updateChalk(null, first);
    const nextLeg = { ...first, leg: 2 };
    expect(updateChalk({ ...log, scores: [[501, 1], [501]] }, nextLeg).scores).toEqual([
      [501],
      [501],
    ]);
  });

  it('keeps the columns level when old rows scroll off', () => {
    const m = start();
    const long = Array.from({ length: MAX_ROWS + 4 }, (_, i) => 501 - i);
    const sheet = chalkSheet(m, {
      key: 'k',
      scores: [long, long.slice(0, -1)],
      turnPlayer: 0,
      turnDarts: 0,
    });
    if (sheet.kind !== 'x01') throw new Error('x01 expected');
    expect(sheet.columns[0]!.scores.length).toBe(MAX_ROWS);
    expect(sheet.columns[0]!.scores.at(-1)).toBe(long.at(-1));
    // Both columns drop the same rows, so their scores stay side by side.
    expect(sheet.columns[1]!.scores[0]).toBe(sheet.columns[0]!.scores[0]);
  });
});

describe('cricket chalkboard', () => {
  it('shows marks per number and points', () => {
    let m = createMatch(['A Player', 'B Player'], { mode: 'cricket', options: DEFAULT_CRICKET });
    m = applyMatchDart(m, T20);
    m = applyMatchDart(m, { points: 20, multiplier: 1, label: 'S20' });
    const sheet = chalkSheet(m, null);
    if (sheet.kind !== 'cricket') throw new Error('cricket expected');
    expect(sheet.targets[0]).toBe('20');
    expect(sheet.targets.at(-1)).toBe('B');
    expect(sheet.marks[0]![0]).toBe(3);
    expect(sheet.points[0]).toBe(20);
  });
});

describe('no match', () => {
  it('shows the idle board', () => {
    expect(chalkSheet(null, null).kind).toBe('idle');
  });
});

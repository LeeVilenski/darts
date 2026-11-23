import { describe, expect, it } from 'vitest';
import { createCricket } from '../engine/modes/cricket';
import { dart } from '../engine/modes/testDarts';
import { applyDart, createX01, endTurn, type X01State } from '../engine/modes/x01';
import { callForTurnEnd, callForTurnStart } from './calls';
import { voiceLines } from './voiceLines';

const play = (s: X01State, labels: string[]) =>
  labels.reduce((acc, l) => applyDart(acc, dart(l)), s);
const at = (rem: number) => {
  const s = createX01(['A', 'B']);
  return {
    ...s,
    players: s.players.map((p, i) => (i === 0 ? { ...p, remaining: rem } : p)),
    turn: { ...s.turn, startRemaining: rem },
  };
};

describe('caller', () => {
  it('calls the turn total, with a roar for 180', () => {
    expect(callForTurnEnd(play(createX01(['A']), ['T20', 'T20', 'T20']))).toEqual({
      keys: ['score_180'],
      cheer: 1,
    });
    expect(callForTurnEnd(play(createX01(['A']), ['S1', 'S5', 'S20']))).toEqual({
      keys: ['score_26'],
      cheer: 0,
    });
  });
  it('calls no score on a bust and game shot on a checkout', () => {
    expect(callForTurnEnd(play(at(10), ['S20'])).keys).toEqual(['no_score']);
    expect(callForTurnEnd(play(at(40), ['D20'])).keys).toEqual(['game_shot_match']);
  });
  it('asks "you require" only when a finish is on', () => {
    expect(callForTurnStart(at(40))).toEqual(['you_require', 'num_40']);
    expect(callForTurnStart(at(169))).toEqual([]);
    expect(callForTurnStart(createX01(['A']))).toEqual([]);
    expect(callForTurnStart(endTurn(play(at(40), ['S1', 'S1', 'S1'])))).toEqual([]);
  });
  it('stays quiet mid-leg in cricket', () => {
    expect(callForTurnEnd(createCricket(['A'])).keys).toEqual([]);
  });
  it('has a line for every key it can call', () => {
    const lines = voiceLines();
    for (let n = 0; n <= 180; n++) expect(lines[`score_${n}`]).toBeTruthy();
    for (let n = 2; n <= 170; n++) expect(lines[`num_${n}`]).toBeTruthy();
    expect(lines.score_140).toBe('one hundred and forty');
    expect(lines.num_57).toBe('fifty-seven');
  });
});

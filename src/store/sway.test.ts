import { describe, expect, it } from 'vitest';
import { setAimSway, useGameStore } from './useGameStore';
import { PERFECT_FLICK } from '../engine/physics/throwModel';

describe('throwing under pressure', () => {
  it('throws at where the swayed aim is at the moment of release', () => {
    useGameStore.getState().startGame({
      kind: 'x01',
      options: { startScore: 501, doubleIn: false, doubleOut: true, legsToWin: 1 },
      players: [{ name: 'You' }, { name: 'Them' }],
    });
    setAimSway(() => ({ x: 4, y: -3 }));
    useGameStore.getState().throwDart({ x: 0, y: 103 }, PERFECT_FLICK);
    expect(useGameStore.getState().aim).toEqual({ x: 4, y: 100 });
    setAimSway(null);
  });
});

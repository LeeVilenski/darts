import { describe, expect, it } from 'vitest';
import { BOARD } from '../../engine/board/geometry';
import { DIGITS, numberStrokesMm } from './wireNumbers';

describe('wire numbers', () => {
  it('has a shape for every digit', () => {
    for (const d of '0123456789') {
      expect(DIGITS[d]!.length).toBeGreaterThan(0);
      for (const s of DIGITS[d]!) {
        expect(s.length).toBeGreaterThan(1);
        for (const [x, y] of s) {
          expect(x).toBeGreaterThanOrEqual(-0.25);
          expect(x).toBeLessThanOrEqual(0.8);
          expect(y).toBeGreaterThanOrEqual(-0.01);
          expect(y).toBeLessThanOrEqual(1.01);
        }
      }
    }
  });

  it('keeps every number on the black ring, clear of the doubles and the board edge', () => {
    for (const s of numberStrokesMm()) {
      for (const [x, y] of s) {
        const r = Math.hypot(x, y);
        expect(r).toBeGreaterThan(BOARD.doubleOuter + 3);
        expect(r).toBeLessThan(BOARD.boardRadius - 2);
      }
    }
  });
});

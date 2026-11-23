import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { BOARD, SECTORS, pointInSector } from './geometry';
import { distanceToWire, resolveHit, scorePoint } from './resolveHit';

const mid = (a: number, b: number) => (a + b) / 2;

describe('scorePoint', () => {
  it('scores the bulls', () => {
    expect(scorePoint(0, 0)).toMatchObject({
      kind: 'score',
      label: 'BULL',
      points: 50,
      multiplier: 2,
    });
    expect(scorePoint(10, 0)).toMatchObject({
      kind: 'score',
      label: '25',
      points: 25,
      multiplier: 1,
    });
  });

  it.each(SECTORS.map((s) => [s]))('resolves every ring of sector %i', (sector) => {
    const at = (r: number) => {
      const p = pointInSector(sector, r);
      return scorePoint(p.x, p.y);
    };
    expect(at(mid(BOARD.outerBull, BOARD.trebleInner))).toMatchObject({
      label: `S${sector}`,
      points: sector,
    });
    expect(at(mid(BOARD.trebleInner, BOARD.trebleOuter))).toMatchObject({
      label: `T${sector}`,
      points: sector * 3,
    });
    expect(at(mid(BOARD.trebleOuter, BOARD.doubleInner))).toMatchObject({
      label: `S${sector}`,
      points: sector,
    });
    expect(at(mid(BOARD.doubleInner, BOARD.doubleOuter))).toMatchObject({
      label: `D${sector}`,
      points: sector * 2,
    });
    expect(at(BOARD.doubleOuter + 5)).toMatchObject({ kind: 'miss' });
  });

  it('puts 20 at the top, 6 at the right, 3 at the bottom, 11 at the left', () => {
    expect(scorePoint(0, 50)).toMatchObject({ sector: 20 });
    expect(scorePoint(50, 0)).toMatchObject({ sector: 6 });
    expect(scorePoint(0, -50)).toMatchObject({ sector: 3 });
    expect(scorePoint(-50, 0)).toMatchObject({ sector: 11 });
  });

  it('splits sectors exactly on the 9° boundary', () => {
    const a = (9 * Math.PI) / 180;
    const eps = 1e-4;
    expect(scorePoint(Math.sin(a - eps) * 50, Math.cos(a - eps) * 50)).toMatchObject({
      sector: 20,
    });
    expect(scorePoint(Math.sin(a + eps) * 50, Math.cos(a + eps) * 50)).toMatchObject({ sector: 1 });
  });

  it('treats ring radii as inclusive on the inner side', () => {
    expect(scorePoint(0, BOARD.trebleInner + 0.01)).toMatchObject({ label: 'T20' });
    expect(scorePoint(0, BOARD.trebleInner - 0.01)).toMatchObject({ label: 'S20' });
  });
});

describe('wires', () => {
  it('measures distance to ring and radial wires', () => {
    expect(distanceToWire(0, BOARD.trebleInner)).toBeCloseTo(0);
    const a = (9 * Math.PI) / 180;
    expect(distanceToWire(Math.sin(a) * 60, Math.cos(a) * 60)).toBeCloseTo(0, 5);
    const p = pointInSector(20, 50);
    expect(distanceToWire(p.x, p.y)).toBeGreaterThan(5);
  });

  it('never bounces with the setting off, sometimes bounces on realistic', () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++)
      expect(resolveHit(0, BOARD.trebleInner, rng, 'off').kind).toBe('score');
    let bounces = 0;
    for (let i = 0; i < 2000; i++)
      if (resolveHit(0, BOARD.trebleInner, rng, 'realistic').kind === 'bounce') bounces++;
    expect(bounces / 2000).toBeGreaterThan(0.18);
    expect(bounces / 2000).toBeLessThan(0.32);
  });

  it('caps bounce rate at 10% on low', () => {
    const rng = createRng(2);
    let bounces = 0;
    for (let i = 0; i < 4000; i++)
      if (resolveHit(0, BOARD.doubleOuter, rng, 'low').kind === 'bounce') bounces++;
    expect(bounces / 4000).toBeLessThan(0.13);
  });

  it('does not bounce away from wires', () => {
    const rng = createRng(3);
    const p = pointInSector(19, 60);
    for (let i = 0; i < 500; i++) expect(resolveHit(p.x, p.y, rng, 'realistic').kind).toBe('score');
  });
});

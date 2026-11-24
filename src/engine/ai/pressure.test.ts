import { describe, expect, it } from 'vitest';
import { simulateFlight, worldToBoardMm } from '../physics/ballistics';
import { createRng } from '../rng';
import { createX01, DEFAULT_X01, type X01State } from '../modes/x01';
import { createCricket } from '../modes/cricket';
import { createAtc } from '../modes/aroundTheClock';
import { describePersonality, personalityFor, TEMPERAMENT } from './personality';
import { pressureOn } from './pressure';
import { aiIntent, aiThinkMs, planAiThrow } from './simulate';
import { aimAround, aimPointFor, chooseTarget } from './strategy';

const t = (label: string) => ({ label, point: aimPointFor(label) });

/** Two-player x01 with the AI (player 0) and its opponent on the given scores. */
const x01 = (me: number, them: number, legsToWin = 1, myLegs = 0, theirLegs = 0): X01State => {
  const s = createX01(['AI', 'Opp'], { ...DEFAULT_X01, legsToWin });
  return {
    ...s,
    players: [
      { ...s.players[0]!, remaining: me, legsWon: myLegs },
      { ...s.players[1]!, remaining: them, legsWon: theirLegs },
    ],
    turn: { ...s.turn, startRemaining: me },
  };
};

describe('pressureOn (x01)', () => {
  it('is calm scoring early in a leg', () => {
    expect(pressureOn(x01(501, 501), t('T20'))).toBe(0);
  });
  it('rises for a leg dart and more for a match dart', () => {
    const leg = pressureOn(x01(40, 501, 3), t('D20'));
    const match = pressureOn(x01(40, 501, 1), t('D20'));
    expect(leg).toBeGreaterThan(0.3);
    expect(match).toBeGreaterThan(leg);
  });
  it('rises when the opponent is waiting on a finish', () => {
    expect(pressureOn(x01(301, 32), t('T20'))).toBeGreaterThan(pressureOn(x01(301, 301), t('T20')));
  });
  it('builds with each missed double this turn', () => {
    const s = x01(40, 501, 3);
    const missed = {
      ...s,
      turn: { ...s.turn, darts: [{ label: 'MISS', points: 0, multiplier: 0 as const }] },
    };
    expect(pressureOn(missed, t('D20'))).toBeGreaterThan(pressureOn(s, t('D20')));
  });
  it('adds a little in a deciding leg and never exceeds 1', () => {
    expect(pressureOn(x01(501, 501, 3, 2, 2), t('T20'))).toBeGreaterThan(0);
    expect(pressureOn(x01(40, 20, 3, 2, 2), t('D20'))).toBeLessThanOrEqual(1);
  });
});

describe('pressureOn (other modes)', () => {
  it('cricket: closing the last number to win', () => {
    const s = createCricket(['AI', 'Opp']);
    const me = s.players[0]!;
    const marks = { ...me.marks, 20: 3, 19: 3, 18: 3, 17: 3, 16: 3, 15: 3 };
    const near = { ...s, players: [{ ...me, marks }, s.players[1]!] };
    expect(pressureOn(near, t('BULL'))).toBeGreaterThan(0.5);
    expect(pressureOn(s, t('T20'))).toBe(0);
  });
  it('around the clock: on the bull', () => {
    const s = createAtc(['AI', 'Opp']);
    const onBull = { ...s, players: [{ ...s.players[0]!, next: 20 }, s.players[1]!] };
    expect(pressureOn(onBull, t('BULL'))).toBeGreaterThan(0.5);
    expect(pressureOn(s, t('S1'))).toBe(0);
  });
});

describe('nerves', () => {
  /** Mean distance (mm) of landed darts from the aim point. */
  const spread = (s: X01State, name = 'Club Bot', level: 'club' | 'pro' = 'club') => {
    const rng = createRng(11);
    const personality = personalityFor(name);
    let sum = 0;
    const N = 1500;
    for (let i = 0; i < N; i++) {
      const { launch, target } = planAiThrow(s, level, rng, { personality });
      const mm = worldToBoardMm(simulateFlight(launch.p0, launch.v0).impact!);
      sum += Math.hypot(mm.x - target.point.x, mm.y - target.point.y);
    }
    return sum / N;
  };

  it('a match dart lands wider than a calm one', () => {
    expect(spread(x01(40, 501, 1))).toBeGreaterThan(spread(x01(501, 501)) * 1.1);
  });

  it('pros hold their nerve better than club players', () => {
    const ratio = (level: 'club' | 'pro') =>
      spread(x01(40, 501, 1), 'Club Bot', level) / spread(x01(501, 501), 'Club Bot', level);
    expect(ratio('pro')).toBeLessThan(ratio('club'));
  });

  it('nervy bots feel it more than ice-cold ones', () => {
    expect(TEMPERAMENT.nervy.nerve).toBeGreaterThan(TEMPERAMENT.ice.nerve);
  });

  it('take longer over a dart that matters, faster bots less so', () => {
    const p = personalityFor('Club Bot');
    expect(aiThinkMs('club', p, 1, 0.5)).toBeGreaterThan(aiThinkMs('club', p, 0, 0.5));
    const quick = { ...p, tempo: 'quick' as const };
    const slow = { ...p, tempo: 'deliberate' as const };
    expect(aiThinkMs('club', quick, 0, 0.5)).toBeLessThan(aiThinkMs('club', slow, 0, 0.5));
  });
});

describe('personality', () => {
  it('is stable for a name and varies between names', () => {
    expect(personalityFor('Club Bot')).toEqual(personalityFor(' club bot '));
    const names = ['Club Bot', 'Pro Bot', 'Pub Bot', 'County Bot', 'Ada', 'Bob', 'Cleo', 'Dev'];
    const kinds = new Set(names.map((n) => describePersonality(personalityFor(n))));
    expect(kinds.size).toBeGreaterThan(3);
  });

  it('sets up its favourite double', () => {
    // 52 with one dart left (no finish): leave 32 for D16, or 40 for D20.
    const s = x01(52, 501);
    const one = { ...s, turn: { ...s.turn, darts: [miss(), miss()] } };
    expect(52 - value(chooseTarget(one, 16).label)).toBe(32);
    expect(52 - value(chooseTarget(one, 20).label)).toBe(40);
  });
});

describe('aimAround', () => {
  const blocker = (label: string) => ({ ...aimPointFor(label), depth: 0, sx: 0, sy: 0.23 });

  it('leaves the aim alone when the treble is clear', () => {
    const s = x01(501, 501);
    expect(aimAround(t('T20'), [blocker('T5')], s)).toEqual(t('T20'));
  });

  it('aims at the open side of a blocked treble', () => {
    const s = x01(501, 501);
    const aim = aimAround(t('T20'), [blocker('T20')], s);
    expect(aim.label).toBe('T20');
    expect(
      Math.hypot(aim.point.x - t('T20').point.x, aim.point.y - t('T20').point.y),
    ).toBeGreaterThan(5);
  });

  it('switches to T19 when the whole T20 bed is covered', () => {
    const s = x01(501, 501);
    const p = t('T20').point;
    const wall = [-8, 0, 8].map((dx) => ({ x: p.x + dx, y: p.y, depth: 0, sx: 0, sy: 0.23 }));
    expect(aimAround(t('T20'), wall, s).label).toBe('T19');
    // ...but not when T20 is a set-up shot.
    expect(aimAround(t('T20'), wall, x01(100, 501)).label).toBe('T20');
  });

  it('only stronger levels read the board', () => {
    const s = x01(501, 501);
    const stuck = [blocker('T20')];
    expect(aiIntent(s, 'pub', { stuck }).target).toEqual(t('T20'));
    expect(aiIntent(s, 'pro', { stuck }).target.point).not.toEqual(t('T20').point);
  });
});

function miss() {
  return { label: 'MISS', points: 0, multiplier: 0 as const };
}
function value(label: string) {
  const n = Number(label.slice(1));
  return label[0] === 'T' ? n * 3 : label[0] === 'D' ? n * 2 : n;
}

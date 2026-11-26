import { describe, expect, it } from 'vitest';
import type { StuckDart } from '../board/collision';
import { planAiThrow } from '../ai/simulate';
import type { AiLevel } from '../ai/skill';
import { resolveDart, stuckDartOf } from '../physics/resolveDart';
import { createRng } from '../rng';
import { applyBobs27Dart, BOBS27_START, createBobs27, endBobs27Turn } from './bobs27';
import { toDartScore } from './dart';
import { applyHalveItDart, createHalveIt, endHalveItTurn, HALVE_IT_START } from './halveIt';
import { applyKillerDart, createKiller, endKillerTurn, killerNumbers } from './killer';
import { applyLadderDart, createLadder, endLadderTurn, LADDER_START } from './ladder';
import {
  applyMatchDart,
  createMatch,
  endMatchTurn,
  MODE_DEFAULTS,
  type MatchConfig,
  type MatchState,
} from './match';
import { applyShanghaiDart, createShanghai, endShanghaiTurn } from './shanghai';
import { dart } from './testDarts';

const darts = <S>(s: S, apply: (s: S, d: ReturnType<typeof dart>) => S, labels: string[]) =>
  labels.reduce((m, l) => apply(m, dart(l)), s);

describe('Shanghai', () => {
  it('only the round number scores', () => {
    const s = darts(createShanghai(['A', 'B']), applyShanghaiDart, ['T1', 'S20', 'D1']);
    expect(s.players[0]!.score).toBe(5);
    expect(s.status).toBe('complete');
    const next = endShanghaiTurn(s);
    expect([next.current, next.round]).toEqual([1, 1]);
    expect(endShanghaiTurn(darts(next, applyShanghaiDart, ['S1', 'S1', 'S1'])).round).toBe(2);
  });

  it('single, double and treble in one turn wins outright', () => {
    const s = darts(createShanghai(['A', 'B']), applyShanghaiDart, ['S1', 'T1', 'D1']);
    expect(s.status).toBe('matchWon');
    expect(s.winner).toBe(0);
    expect(s.turn.shanghai).toBe(true);
  });

  it('highest score after the last round wins', () => {
    let s = createShanghai(['A', 'B'], { legsToWin: 1, rounds: 7 });
    for (let r = 1; r <= 7; r++) {
      s = endShanghaiTurn(darts(s, applyShanghaiDart, [`S${r}`, 'MISS', 'MISS']));
      s = darts(s, applyShanghaiDart, [`T${r}`, 'MISS', 'MISS']);
      if (r < 7) s = endShanghaiTurn(s);
    }
    expect(s.status).toBe('matchWon');
    expect(s.winner).toBe(1);
    expect(s.legWinner).toBe(1);
  });
});

describe("Bob's 27", () => {
  it('hits add the double, a blank round takes it away', () => {
    let s = darts(createBobs27(['A']), applyBobs27Dart, ['D1', 'S1', 'D1']);
    expect(s.players[0]!.score).toBe(BOBS27_START + 4);
    s = darts(endBobs27Turn(s), applyBobs27Dart, ['S2', 'MISS', 'T2']);
    expect(s.players[0]!.score).toBe(BOBS27_START + 4 - 4);
    expect(s.round).toBe(2);
  });

  it('drops out at zero or below', () => {
    let s = createBobs27(['A']);
    for (let r = 1; r <= 5 && s.status !== 'matchWon'; r++) {
      s = darts(s, applyBobs27Dart, ['MISS', 'MISS', 'MISS']);
      if (s.status === 'complete') s = endBobs27Turn(s);
    }
    // 27 - 2 - 4 - 6 - 8 = 7, then -10 → out.
    expect(s.players[0]!.out).toBe(true);
    expect(s.status).toBe('matchWon');
  });

  it('skips players who are out', () => {
    let s = createBobs27(['A', 'B']);
    s = { ...s, players: [{ ...s.players[0]!, score: 2 }, s.players[1]!] };
    s = darts(s, applyBobs27Dart, ['MISS', 'MISS', 'MISS']);
    expect(s.players[0]!.out).toBe(true);
    s = endBobs27Turn(darts(endBobs27Turn(s), applyBobs27Dart, ['D1', 'MISS', 'MISS']));
    expect(s.current).toBe(1);
    expect(s.round).toBe(2);
  });
});

describe('Halve-It', () => {
  it('scores hits on the target and halves a blank round', () => {
    let s = darts(createHalveIt(['A']), applyHalveItDart, ['T15', 'S20', 'MISS']);
    expect(s.players[0]!.score).toBe(HALVE_IT_START + 45);
    s = darts(endHalveItTurn(s), applyHalveItDart, ['S15', 'MISS', 'MISS']);
    expect(s.players[0]!.score).toBe(Math.floor((HALVE_IT_START + 45) / 2));
    expect(s.turn.halved).toBe(true);
    // Round 3: any double.
    s = darts(endHalveItTurn(s), applyHalveItDart, ['D7', 'BULL', 'MISS']);
    expect(s.turn.points).toBe(64);
  });
});

describe('Killer', () => {
  it('hands out distinct numbers', () => {
    const n = killerNumbers(['A', 'B', 'C', 'D']);
    expect(new Set(n).size).toBe(4);
    expect(n.every((x) => x >= 1 && x <= 20)).toBe(true);
  });

  it('own double makes you a killer, then opponents’ doubles take lives', () => {
    let s = createKiller(['A', 'B'], { legsToWin: 1, lives: 3 });
    const [a, b] = s.players.map((p) => p.number);
    s = darts(s, applyKillerDart, [`D${b}`, `D${a}`, `D${b}`]);
    expect(s.players[0]!.killer).toBe(true);
    expect(s.players[1]!.lives).toBe(2); // the first D-b came before A was a killer
    s = darts(endKillerTurn(s), applyKillerDart, ['MISS', 'MISS', 'MISS']);
    s = darts(endKillerTurn(s), applyKillerDart, [`D${b}`, `D${b}`]);
    expect(s.status).toBe('matchWon');
    expect(s.winner).toBe(0);
  });

  it('a killer hitting their own double loses a life, and can knock themselves out', () => {
    let s = createKiller(['A', 'B', 'C'], { legsToWin: 1, lives: 3 });
    const a = s.players[0]!.number;
    s = { ...s, players: [{ ...s.players[0]!, killer: true, lives: 1 }, ...s.players.slice(1)] };
    s = applyKillerDart(s, dart(`D${a}`));
    expect(s.players[0]!.lives).toBe(0);
    expect(s.status).toBe('complete');
    s = endKillerTurn(s);
    expect(s.current).toBe(1);
    s = endKillerTurn(
      darts(endKillerTurn(darts(s, applyKillerDart, ['MISS', 'MISS', 'MISS'])), applyKillerDart, [
        'MISS',
        'MISS',
        'MISS',
      ]),
    );
    expect(s.current).toBe(1); // A is skipped
  });

  it('needs two players', () => {
    expect(() => createKiller(['A'])).toThrow();
  });
});

describe('121 ladder', () => {
  it('a checkout moves the target up one', () => {
    let s = darts(createLadder(['A']), applyLadderDart, ['T20', 'T11', 'D14']);
    expect(s.turn.checkedOut).toBe(true);
    expect(s.players[0]).toMatchObject({ target: 122, best: 121, attempt: 2, checkouts: 1 });
    s = endLadderTurn(s);
    expect(s.turn.startRemaining).toBe(122);
  });

  it('three visits without a checkout drops it one, not below 121', () => {
    let s = createLadder(['A']);
    for (let v = 0; v < 3; v++) s = endLadderTurn(darts(s, applyLadderDart, ['S1', 'S1', 'S1']));
    expect(s.players[0]).toMatchObject({ target: LADDER_START, attempt: 2, visit: 1 });
  });

  it('a bust ends the visit and restores the score', () => {
    const s = darts(createLadder(['A']), applyLadderDart, ['T20', 'T20', 'T20']);
    expect(s.turn.bust).toBe(true);
    expect(s.players[0]!.remaining).toBe(LADDER_START);
  });

  it('ends after the last attempt', () => {
    let s = createLadder(['A'], { legsToWin: 1, attempts: 5 });
    for (let i = 0; i < 15 && s.status !== 'matchWon'; i++)
      s = endLadderTurn(darts(s, applyLadderDart, ['S1', 'S1', 'S1']));
    expect(s.status).toBe('matchWon');
  });
});

describe('every mode plays to a finish with AI players', () => {
  const play = (config: MatchConfig, levels: AiLevel[], seed: number) => {
    const rng = createRng(seed);
    let m: MatchState = createMatch(
      levels.map((_, i) => `Bot ${i}`),
      config,
    );
    let stuck: StuckDart[] = [];
    let thrown = 0;
    while (m.status !== 'matchWon' && thrown < 3000) {
      if (m.status !== 'open') {
        m = endMatchTurn(m);
        stuck = [];
        continue;
      }
      const level = levels[m.current]!;
      const { launch } = planAiThrow(m, level, rng, { stuck });
      const d = resolveDart(launch, stuck, rng, 'realistic');
      const left = stuckDartOf(d);
      if (left) stuck = [...stuck, left];
      m = applyMatchDart(m, toDartScore(d.result));
      thrown++;
    }
    return { m, thrown };
  };

  const modes = Object.keys(MODE_DEFAULTS) as MatchConfig['mode'][];
  it.each(modes)('%s', (mode) => {
    for (const levels of [
      ['pro', 'pub'],
      ['club', 'county', 'club'],
    ] as AiLevel[][]) {
      for (const seed of [1, 2, 3]) {
        const options = { ...MODE_DEFAULTS[mode], legsToWin: mode === 'ladder' ? 1 : 2 };
        const { m, thrown } = play({ mode, options } as MatchConfig, levels, seed);
        expect(m.status, `${mode} seed ${seed} after ${thrown} darts`).toBe('matchWon');
        expect(m.winner).not.toBeNull();
      }
    }
  });

  it('x01 in sets', () => {
    const { m } = play(
      { mode: 'x01', options: { ...MODE_DEFAULTS.x01, legsToWin: 2, setsToWin: 2 } },
      ['pro', 'county'],
      5,
    );
    expect(m.status).toBe('matchWon');
    expect(m.players[m.winner!]!.setsWon).toBe(2);
  });
});

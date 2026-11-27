import { CRICKET_TARGETS } from '../../engine/modes/cricket';
import type { MatchState } from '../../engine/modes/match';
import { MODE_NAMES, primaryValue } from '../../ui/modeView';
import { backNameFor } from './appearance';

/**
 * The pub chalkboard on the cabinet door, kept like a real chalker would.
 *
 * x01: each player has a column; their start score at the top, then their
 * remaining score chalked underneath after each turn, older scores struck
 * through. Cricket: the marks grid (/, X, circled X) and points. Killer: each
 * player's number, their lives as strokes crossed off, K once they're a killer. Other games:
 * each player's score. Legs won are tally marks under the names.
 */

export interface ChalkLog {
  /** Which leg this log is for (cleared when a new leg or match starts). */
  key: string;
  /** Per player, the x01 scores chalked so far (start score first). */
  scores: number[][];
  /** The turn last seen, to notice when it ends. */
  turnPlayer: number;
  turnDarts: number;
}

const legKey = (m: MatchState) =>
  `${m.mode}|${m.players.map((p) => p.name).join(',')}|${m.set ?? 0}|${m.leg}`;

/**
 * Update the log for the latest match state. A turn's score is chalked when
 * the turn is over: when a new turn starts, or the leg is won.
 */
export function updateChalk(log: ChalkLog | null, m: MatchState): ChalkLog {
  const key = legKey(m);
  const start = m.mode === 'x01' ? m.options.startScore : 0;
  const fresh =
    !log || log.key !== key
      ? {
          key,
          scores: m.players.map(() => (m.mode === 'x01' ? [start] : [])),
          turnPlayer: m.turn.player,
          turnDarts: m.turn.darts.length,
        }
      : { ...log, scores: log.scores.map((s) => [...s]) };
  if (m.mode !== 'x01')
    return { ...fresh, turnPlayer: m.turn.player, turnDarts: m.turn.darts.length };

  const write = (i: number) => {
    const col = fresh.scores[i];
    const now = m.players[i]?.remaining;
    if (col && now !== undefined && col[col.length - 1] !== now) col.push(now);
  };
  // The previous turn ended: a different player is up, or the same player has started afresh.
  const newTurn =
    log?.key === key && (m.turn.player !== log.turnPlayer || m.turn.darts.length < log.turnDarts);
  if (newTurn) write(log!.turnPlayer);
  // A checkout: chalk the winner's 0 straight away.
  if (m.status === 'legWon' || m.status === 'matchWon') write(m.turn.player);
  fresh.turnPlayer = m.turn.player;
  fresh.turnDarts = m.turn.darts.length;
  return fresh;
}

/** What goes on the board, independent of how it's drawn. */
export type ChalkSheet =
  | {
      kind: 'x01';
      title: string;
      names: string[];
      legs: number[];
      columns: { scores: number[] }[];
      current: number;
    }
  | {
      kind: 'cricket';
      title: string;
      names: string[];
      legs: number[];
      targets: string[];
      /** marks[player][target], 0–3. */
      marks: number[][];
      points: number[];
      current: number;
    }
  | {
      kind: 'killer';
      title: string;
      names: string[];
      legs: number[];
      /** Each player's own number. */
      numbers: number[];
      lives: number[];
      startLives: number;
      killer: boolean[];
      current: number;
    }
  | {
      kind: 'scores';
      title: string;
      names: string[];
      legs: number[];
      values: string[];
      current: number;
    }
  | { kind: 'idle'; title: string };

/** Short name for a chalkboard column. */
const chalkName = (name: string) => {
  const n = backNameFor(name);
  return n.length > 8 ? n.slice(0, 7) + '.' : n;
};

/** Rows of x01 scores that fit on the board; older rows scroll off the top. */
export const MAX_ROWS = 9;

export function chalkSheet(m: MatchState | null, log: ChalkLog | null): ChalkSheet {
  if (!m) return { kind: 'idle', title: 'DARTS' };
  const names = m.players.map((p) => chalkName(p.name));
  const legs = m.players.map((p) => p.legsWon);
  const current = m.current;
  if (m.mode === 'x01') {
    const cols = (log?.scores ?? m.players.map((p) => [p.remaining])).map((s) => s.slice());
    // Keep columns level: drop the same number of old rows from each.
    const rows = Math.max(...cols.map((c) => c.length));
    const drop = Math.max(0, rows - MAX_ROWS);
    return {
      kind: 'x01',
      title: String(m.options.startScore),
      names,
      legs,
      columns: cols.map((c) => ({ scores: c.slice(Math.min(drop, Math.max(0, c.length - 1))) })),
      current,
    };
  }
  if (m.mode === 'cricket') {
    return {
      kind: 'cricket',
      title: 'CRICKET',
      names,
      legs,
      targets: CRICKET_TARGETS.map((t) => (t === 25 ? 'B' : String(t))),
      marks: m.players.map((p) => CRICKET_TARGETS.map((t) => p.marks[t])),
      points: m.players.map((p) => p.points),
      current,
    };
  }
  if (m.mode === 'killer') {
    return {
      kind: 'killer',
      title: 'KILLER',
      names,
      legs,
      numbers: m.players.map((p) => p.number),
      lives: m.players.map((p) => p.lives),
      startLives: m.options.lives,
      killer: m.players.map((p) => p.killer),
      current,
    };
  }
  return {
    kind: 'scores',
    title: MODE_NAMES[m.mode].toUpperCase(),
    names,
    legs,
    values: m.players.map((_, i) => primaryValue(m, i)),
    current,
  };
}

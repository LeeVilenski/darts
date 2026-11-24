import { ATC_SEQUENCE, atcTarget, type AtcState } from '../modes/aroundTheClock';
import { suggestCheckout } from '../modes/checkouts';
import { CRICKET_TARGETS, type CricketState } from '../modes/cricket';
import type { MatchState } from '../modes/match';
import type { X01State } from '../modes/x01';
import { labelValue, type AiTarget } from './strategy';

/** A dart that wins the leg, and one that wins the match. */
const LEG_DART = 0.45;
const MATCH_DART = 0.75;
/** Each dart already missed at a finishing double this turn. */
const PER_MISSED_DOUBLE = 0.12;
/** The opponent is on a finish / very close to winning. */
const OPPONENT_ON_A_FINISH = 0.2;
const OPPONENT_CLOSE = 0.3;
/** Everyone is one leg from the match. */
const DECIDER = 0.1;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * How much is riding on this dart, 0 (nothing) to 1 (everything).
 * The AI's nerves scale with it; the target is what it is about to aim at.
 */
export function pressureOn(match: MatchState, target: AiTarget): number {
  const base = (() => {
    switch (match.mode) {
      case 'x01':
        return x01Pressure(match, target);
      case 'cricket':
        return cricketPressure(match, target);
      case 'atc':
        return atcPressure(match);
    }
  })();
  const { legsToWin } = match.options;
  const decider =
    legsToWin > 1 && match.players.every((p) => p.legsWon === legsToWin - 1) ? DECIDER : 0;
  return clamp01(base + decider);
}

const winsMatch = (match: MatchState) =>
  match.players[match.current]!.legsWon + 1 >= match.options.legsToWin;

const oneDartFinish = (rem: number, doubleOut: boolean) =>
  doubleOut ? rem === 50 || (rem >= 2 && rem <= 40 && rem % 2 === 0) : rem >= 1 && rem <= 60;

function x01Pressure(s: X01State, target: AiTarget): number {
  const me = s.players[s.current]!;
  const { doubleOut } = s.options;
  let pressure = 0;

  const isDouble = target.label === 'BULL' || target.label[0] === 'D';
  if (me.opened && labelValue(target.label) === me.remaining && (isDouble || !doubleOut))
    pressure += winsMatch(s) ? MATCH_DART : LEG_DART;

  // Darts already thrown at a finish this turn and missed.
  let rem = s.turn.startRemaining;
  for (const d of s.turn.darts) {
    if (me.opened && oneDartFinish(rem, doubleOut)) pressure += PER_MISSED_DOUBLE;
    if (me.opened) rem -= d.points;
  }

  const others = s.players.filter((_, i) => i !== s.current);
  const finishable = (r: number) => (doubleOut ? !!suggestCheckout(r, 3) : r <= 180);
  if (others.some((o) => o.opened && o.remaining <= 60 && finishable(o.remaining)))
    pressure += OPPONENT_CLOSE;
  else if (others.some((o) => o.opened && finishable(o.remaining)))
    pressure += OPPONENT_ON_A_FINISH;
  return pressure;
}

function cricketPressure(s: CricketState, target: AiTarget): number {
  const me = s.players[s.current]!;
  const others = s.players.filter((_, i) => i !== s.current);
  const open = (p: (typeof s.players)[number]) => CRICKET_TARGETS.filter((t) => p.marks[t] < 3);
  let pressure = 0;

  const mine = open(me);
  const leader = Math.max(0, ...others.map((o) => o.points));
  const aimed = target.label === 'BULL' || target.label === '25' ? 25 : labelValue(target.label);
  const onLast = mine.length === 1 && (mine[0] === aimed || mine[0] === aimed / 3);
  if (onLast && me.points >= leader) pressure += winsMatch(s) ? MATCH_DART : LEG_DART;

  if (others.some((o) => open(o).length <= 1)) pressure += OPPONENT_CLOSE;
  else if (others.some((o) => open(o).length <= 2)) pressure += OPPONENT_ON_A_FINISH;
  return pressure;
}

function atcPressure(s: AtcState): number {
  const me = s.players[s.current]!;
  const last = ATC_SEQUENCE.length - 1;
  let pressure = 0;
  if (atcTarget(me) === ATC_SEQUENCE[last]) pressure += winsMatch(s) ? MATCH_DART : LEG_DART;
  const others = s.players.filter((_, i) => i !== s.current);
  if (others.some((o) => o.next >= last)) pressure += OPPONENT_CLOSE;
  else if (others.some((o) => o.next >= last - 3)) pressure += OPPONENT_ON_A_FINISH;
  return pressure;
}

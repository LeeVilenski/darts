/**
 * Bull-up: before a match, each player throws one dart at the bull and the
 * closest throws first. Tied players throw again. Darts stay in the board
 * for the whole round, so a later dart can be blocked by an earlier one.
 */
export interface BullUpState {
  /** Players (match indices) throwing in this round, in order. */
  throwers: number[];
  /** Position in `throwers` of whoever throws next. */
  next: number;
  /** Distance (mm) from the bull centre this round, by match index; Infinity = off the board. */
  distances: Record<number, number>;
  round: number;
  /** Set once a single closest player is found. */
  winner: number | null;
}

export function createBullUp(players: number): BullUpState {
  return {
    throwers: Array.from({ length: players }, (_, i) => i),
    next: 0,
    distances: {},
    round: 1,
    winner: null,
  };
}

export const bullUpThrower = (b: BullUpState): number | null =>
  b.winner === null && b.next < b.throwers.length ? b.throwers[b.next]! : null;

/** Round finished (everyone in it has thrown) but no winner yet: a tie to rethrow. */
export const bullUpTied = (b: BullUpState) => b.winner === null && b.next >= b.throwers.length;

/** Record the current thrower's dart, `distance` mm from the bull centre. */
export function applyBullUpDart(b: BullUpState, distance: number): BullUpState {
  const who = bullUpThrower(b);
  if (who === null) return b;
  const distances = { ...b.distances, [who]: distance };
  const next = b.next + 1;
  if (next < b.throwers.length) return { ...b, distances, next };
  const best = Math.min(...b.throwers.map((i) => distances[i]!));
  const closest = b.throwers.filter((i) => distances[i] === best);
  return { ...b, distances, next, winner: closest.length === 1 ? closest[0]! : null };
}

/** After a tie, the tied players throw again (everyone, if nobody hit the board). */
export function rethrowBullUp(b: BullUpState): BullUpState {
  if (!bullUpTied(b)) return b;
  const best = Math.min(...b.throwers.map((i) => b.distances[i]!));
  const tied = b.throwers.filter((i) => b.distances[i] === best);
  return { throwers: tied, next: 0, distances: {}, round: b.round + 1, winner: null };
}

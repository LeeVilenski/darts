import {
  applyAtcDart,
  createAtc,
  endAtcTurn,
  type AtcOptions,
  type AtcState,
} from './aroundTheClock';
import {
  applyCricketDart,
  createCricket,
  endCricketTurn,
  type CricketOptions,
  type CricketState,
} from './cricket';
import type { DartScore } from './dart';
import {
  applyDart as applyX01Dart,
  createX01,
  endTurn as endX01Turn,
  type X01Options,
  type X01State,
} from './x01';

export type MatchState = X01State | CricketState | AtcState;

export type MatchConfig =
  | { mode: 'x01'; options: X01Options }
  | { mode: 'cricket'; options: CricketOptions }
  | { mode: 'atc'; options: AtcOptions };

export function createMatch(names: string[], config: MatchConfig): MatchState {
  switch (config.mode) {
    case 'x01':
      return createX01(names, config.options);
    case 'cricket':
      return createCricket(names, config.options);
    case 'atc':
      return createAtc(names, config.options);
  }
}

export function applyMatchDart(m: MatchState, dart: DartScore): MatchState {
  switch (m.mode) {
    case 'x01':
      return applyX01Dart(m, dart);
    case 'cricket':
      return applyCricketDart(m, dart);
    case 'atc':
      return applyAtcDart(m, dart);
  }
}

export function endMatchTurn(m: MatchState): MatchState {
  switch (m.mode) {
    case 'x01':
      return endX01Turn(m);
    case 'cricket':
      return endCricketTurn(m);
    case 'atc':
      return endAtcTurn(m);
  }
}

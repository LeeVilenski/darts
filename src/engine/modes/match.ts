import {
  applyAtcDart,
  createAtc,
  DEFAULT_ATC,
  endAtcTurn,
  type AtcOptions,
  type AtcState,
} from './aroundTheClock';
import {
  applyBobs27Dart,
  createBobs27,
  DEFAULT_BOBS27,
  endBobs27Turn,
  type Bobs27Options,
  type Bobs27State,
} from './bobs27';
import {
  applyCricketDart,
  createCricket,
  DEFAULT_CRICKET,
  endCricketTurn,
  type CricketOptions,
  type CricketState,
} from './cricket';
import type { DartScore } from './dart';
import {
  applyHalveItDart,
  createHalveIt,
  DEFAULT_HALVE_IT,
  endHalveItTurn,
  type HalveItOptions,
  type HalveItState,
} from './halveIt';
import {
  applyKillerDart,
  createKiller,
  DEFAULT_KILLER,
  endKillerTurn,
  type KillerOptions,
  type KillerState,
} from './killer';
import {
  applyLadderDart,
  createLadder,
  DEFAULT_LADDER,
  endLadderTurn,
  type LadderOptions,
  type LadderState,
} from './ladder';
import {
  applyShanghaiDart,
  createShanghai,
  DEFAULT_SHANGHAI,
  endShanghaiTurn,
  type ShanghaiOptions,
  type ShanghaiState,
} from './shanghai';
import {
  applyDart as applyX01Dart,
  createX01,
  DEFAULT_X01,
  endTurn as endX01Turn,
  type X01Options,
  type X01State,
} from './x01';

export type MatchState =
  | X01State
  | CricketState
  | AtcState
  | ShanghaiState
  | KillerState
  | Bobs27State
  | HalveItState
  | LadderState;

export type MatchConfig =
  | { mode: 'x01'; options: X01Options }
  | { mode: 'cricket'; options: CricketOptions }
  | { mode: 'atc'; options: AtcOptions }
  | { mode: 'shanghai'; options: ShanghaiOptions }
  | { mode: 'killer'; options: KillerOptions }
  | { mode: 'bobs27'; options: Bobs27Options }
  | { mode: 'halveit'; options: HalveItOptions }
  | { mode: 'ladder'; options: LadderOptions };

export type ModeOptions<M extends MatchConfig['mode']> = Extract<
  MatchConfig,
  { mode: M }
>['options'];

export type ModeId = MatchConfig['mode'];

/** Default options for each mode. */
export const MODE_DEFAULTS: { [M in ModeId]: ModeOptions<M> } = {
  x01: DEFAULT_X01,
  cricket: DEFAULT_CRICKET,
  atc: DEFAULT_ATC,
  shanghai: DEFAULT_SHANGHAI,
  killer: DEFAULT_KILLER,
  bobs27: DEFAULT_BOBS27,
  halveit: DEFAULT_HALVE_IT,
  ladder: DEFAULT_LADDER,
};

/** Fewest players each mode needs. */
export const MIN_PLAYERS: Partial<Record<ModeId, number>> = { killer: 2 };

export function createMatch(names: string[], config: MatchConfig): MatchState {
  switch (config.mode) {
    case 'x01':
      return createX01(names, config.options);
    case 'cricket':
      return createCricket(names, config.options);
    case 'atc':
      return createAtc(names, config.options);
    case 'shanghai':
      return createShanghai(names, config.options);
    case 'killer':
      return createKiller(names, config.options);
    case 'bobs27':
      return createBobs27(names, config.options);
    case 'halveit':
      return createHalveIt(names, config.options);
    case 'ladder':
      return createLadder(names, config.options);
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
    case 'shanghai':
      return applyShanghaiDart(m, dart);
    case 'killer':
      return applyKillerDart(m, dart);
    case 'bobs27':
      return applyBobs27Dart(m, dart);
    case 'halveit':
      return applyHalveItDart(m, dart);
    case 'ladder':
      return applyLadderDart(m, dart);
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
    case 'shanghai':
      return endShanghaiTurn(m);
    case 'killer':
      return endKillerTurn(m);
    case 'bobs27':
      return endBobs27Turn(m);
    case 'halveit':
      return endHalveItTurn(m);
    case 'ladder':
      return endLadderTurn(m);
  }
}

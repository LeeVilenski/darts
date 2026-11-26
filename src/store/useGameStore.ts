import { create } from 'zustand';
import { personalityFor, type AiPersonality } from '../engine/ai/personality';
import { aiIntent, planAiThrow } from '../engine/ai/simulate';
import type { Collision, StuckDart } from '../engine/board/collision';
import type { AiLevel } from '../engine/ai/skill';
import type { BounceSetting, HitResult } from '../engine/board/resolveHit';
import { toDartScore } from '../engine/modes/dart';
import {
  applyMatchDart,
  createMatch,
  endMatchTurn,
  MODE_DEFAULTS,
  type MatchConfig,
  type MatchState,
  type ModeId,
  type ModeOptions,
} from '../engine/modes/match';
import { DEFAULT_X01 } from '../engine/modes/x01';
import {
  applyBullUpDart,
  bullUpThrower,
  createBullUp,
  rethrowBullUp,
  type BullUpState,
} from '../engine/modes/bullUp';
import { withStarter } from '../engine/modes/types';
import { recordMatch } from './lifetimeStats';
import { worldToBoardMm, type Flight } from '../engine/physics/ballistics';
import { resolveDart, stuckDartOf } from '../engine/physics/resolveDart';
import {
  computeLaunch,
  type AssistLevel,
  type FlickMetrics,
  type LaunchParams,
} from '../engine/physics/throwModel';
import { createRng, type Rng } from '../engine/rng';

export const DARTS_PER_TURN = 3;

export interface ThrownDart {
  id: number;
  launch: LaunchParams;
  flight: Flight;
  result: HitResult;
  /** Contact with a dart already in the board (deflection or Robin Hood), if any. */
  collision: Collision | null;
  /** True once the flight animation reached the board/floor. */
  landed: boolean;
}

/**
 * aiming   – player may throw
 * flight   – a dart is in the air
 * impact   – short hold on the landed dart (camera close-up); tap to skip
 * turnOver – turn finished (3 darts, bust or checkout); tap to collect
 */
export type Phase = 'aiming' | 'flight' | 'impact' | 'replay' | 'turnOver';
export type Quality = 'auto' | 'high' | 'low';

/** A slow-motion replay of one dart, then continue to `then`. */
export interface Replay {
  dartId: number;
  reason: '180' | 'checkout' | 'bounce' | 'robinHood';
  then: Exclude<Phase, 'replay'>;
}
export type Screen = 'menu' | 'game';
export type CameraStyle = 'cinematic' | 'reduced';

/** A seat at the oche: a person, or an AI opponent at the given level. */
export interface PlayerSetup {
  name: string;
  ai?: AiLevel;
}

/** Options every match setup shares. */
interface MatchExtras {
  players: PlayerSetup[];
  /** Decide who throws first with a bull-up (2+ players). */
  bullUp?: boolean;
  /** A career match: player 0 is you; the result goes to the career. */
  career?: boolean;
}

/** A match of mode M: its options plus the players. */
export type ModeSetup<M extends ModeId = ModeId> = {
  [K in M]: { kind: K; options: ModeOptions<K> } & MatchExtras;
}[M];

export type GameSetup = { kind: 'practice' } | ModeSetup;
export type MatchSetup = Exclude<GameSetup, { kind: 'practice' }>;

/** A dart's landing spot in Practice, for the heatmap (board mm). */
export interface PracticeHit {
  x: number;
  y: number;
}
const MAX_PRACTICE_HITS = 400;

export interface Settings {
  assist: AssistLevel;
  bounce: BounceSetting;
  camera: CameraStyle;
  sound: boolean;
  caller: boolean;
  ambience: boolean;
  replays: boolean;
  quality: Quality;
  /** Flick gestures, or a hold-to-charge power meter (also used for keyboard play). */
  throwControl: 'flick' | 'meter';
  /** Board colours: classic red/green, or a colour-blind-safe blue/orange. */
  palette: 'classic' | 'contrast';
}

interface GameState extends Settings {
  screen: Screen;
  setup: GameSetup;
  match: MatchState | null;
  phase: Phase;
  /** Aim point in board-local millimetres. */
  aim: { x: number; y: number };
  darts: ThrownDart[];
  practice: { darts: number; points: number; hits: PracticeHit[] };
  /** Speed up the current AI turn (skip button). */
  aiFast: boolean;
  replay: Replay | null;
  /** Pre-match bull-up in progress (match.current tracks whoever is throwing). */
  bullUp: BullUpState | null;
  startGame(setup: GameSetup): void;
  /** Remember a setup (e.g. a renamed player) without starting it. */
  saveSetup(setup: GameSetup): void;
  quitToMenu(): void;
  setAim(aim: { x: number; y: number }): void;
  throwDart(aim: { x: number; y: number }, flick: FlickMetrics): void;
  aiThrow(): void;
  setAiFast(fast: boolean): void;
  landDart(id: number): void;
  finishImpact(): void;
  finishReplay(): void;
  collectDarts(): void;
  resetPractice(): void;
  updateSettings(patch: Partial<Settings>): void;
}

const SETTINGS_KEY = 'darts.settings.v1';

/** Every persisted (and cloud-synced) setting. */
export const SETTING_KEYS: (keyof Settings)[] = [
  'assist',
  'bounce',
  'camera',
  'sound',
  'caller',
  'ambience',
  'replays',
  'quality',
  'throwControl',
  'palette',
];
const SETUP_KEY = 'darts.setup.v1';

function readJson<T>(key: string): Partial<T> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: preferences just won't persist */
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function loadSettings(): Settings {
  const fallback: Settings = {
    assist: 'standard',
    bounce: 'realistic',
    camera: prefersReducedMotion() ? 'reduced' : 'cinematic',
    sound: true,
    caller: true,
    ambience: true,
    replays: true,
    quality: 'auto',
    throwControl: 'flick',
    palette: 'classic',
  };
  return { ...fallback, ...readJson<Settings>(SETTINGS_KEY) };
}

export const DEFAULT_SETUP: GameSetup = {
  kind: 'x01',
  options: DEFAULT_X01,
  players: [{ name: 'Player 1' }, { name: 'Club Bot', ai: 'club' }],
};
export function loadSetup(): GameSetup {
  const saved = readJson<GameSetup>(SETUP_KEY) as GameSetup | null;
  if (saved?.kind === 'practice') return saved;
  if (!saved || !('players' in saved) || !Array.isArray(saved.players) || !saved.players.length) {
    return DEFAULT_SETUP;
  }
  // Older saves stored plain names.
  const players = (saved.players as (PlayerSetup | string)[])
    .slice(0, 4)
    .map((p) => (typeof p === 'string' ? { name: p } : p));
  if (!(saved.kind in MODE_DEFAULTS)) return DEFAULT_SETUP;
  const options = { ...MODE_DEFAULTS[saved.kind], ...saved.options };
  return { ...saved, options, players } as GameSetup;
}

function matchFor(setup: GameSetup): MatchState | null {
  if (setup.kind === 'practice') return null;
  const names = setup.players.map((p) => p.name);
  return createMatch(names, { mode: setup.kind, options: setup.options } as MatchConfig);
}

const emptyPractice = () => ({ darts: 0, points: 0, hits: [] as PracticeHit[] });

const AIM_LIMIT_MM = 260;
const START_AIM = { x: 0, y: 103 }; // treble 20
let rng: Rng = createRng((Date.now() ^ 0x5eed) >>> 0);
let nextId = 1;

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  ...loadSettings(),
  screen: 'menu',
  setup: loadSetup(),
  match: null,
  phase: 'aiming',
  aim: START_AIM,
  darts: [],
  practice: emptyPractice(),
  aiFast: false,
  replay: null,
  bullUp: null,

  startGame(setup) {
    // Career matches are set up by the career, not remembered as the menu's choice.
    if (setup.kind === 'practice' || !setup.career) writeJson(SETUP_KEY, setup);
    const bullUp =
      setup.kind !== 'practice' && setup.bullUp && setup.players.length > 1
        ? createBullUp(setup.players.length)
        : null;
    set({
      screen: 'game',
      setup,
      bullUp,
      replay: null,
      match: matchFor(setup),
      aiFast: false,
      phase: 'aiming',
      aim: START_AIM,
      darts: [],
      practice: emptyPractice(),
    });
  },

  saveSetup(setup) {
    writeJson(SETUP_KEY, setup);
    set({ setup });
  },

  quitToMenu() {
    set({ screen: 'menu', match: null, darts: [], phase: 'aiming', replay: null, bullUp: null });
  },

  setAim(aim) {
    const r = Math.hypot(aim.x, aim.y);
    const k = r > AIM_LIMIT_MM ? AIM_LIMIT_MM / r : 1;
    set({ aim: { x: aim.x * k, y: aim.y * k } });
  },

  throwDart(aim, flick) {
    const s = get();
    const full = s.bullUp ? bullUpThrower(s.bullUp) === null : s.darts.length >= DARTS_PER_TURN;
    if (s.phase !== 'aiming' || full || currentAi(s)) return;
    launchDart(aim, computeLaunch(aim, flick, s.assist, rng));
  },

  aiThrow() {
    const s = get();
    const level = currentAi(s);
    if (!level || !s.match || s.phase !== 'aiming' || s.match.status !== 'open') return;
    const { target, launch } = planAiThrow(s.match, level, rng, {
      personality: currentAiPersonality(s) ?? undefined,
      stuck: stuckDarts(s.darts),
      target: s.bullUp ? { label: 'BULL', point: { x: 0, y: 0 } } : undefined,
    });
    launchDart(target.point, launch);
  },

  setAiFast(aiFast) {
    set({ aiFast });
  },

  landDart(id) {
    const s = get();
    const dart = s.darts.find((d) => d.id === id);
    if (!dart || dart.landed) return;
    const darts = s.darts.map((d) => (d.id === id ? { ...d, landed: true } : d));
    vibrate(dart.result.kind === 'bounce' ? 30 : 12);

    if (s.match && s.bullUp) {
      const bullUp = applyBullUpDart(s.bullUp, bullUpDistance(dart));
      const next = bullUpThrower(bullUp);
      set({
        darts,
        bullUp,
        match: next === null ? s.match : { ...s.match, current: next },
        phase: next === null ? 'turnOver' : 'impact',
      });
      return;
    }

    if (s.match) {
      const match = applyMatchDart(s.match, toDartScore(dart.result));
      if (match.status === 'matchWon' && s.setup.kind !== 'practice')
        recordMatch(match, s.setup.players);
      const then = match.status === 'open' ? 'impact' : 'turnOver';
      const reason = replayReason(match, dart);
      if (reason && s.replays && s.camera !== 'reduced' && !s.aiFast) {
        set({ darts, match, phase: 'replay', replay: { dartId: id, reason, then } });
      } else {
        set({ darts, match, phase: then });
      }
      return;
    }
    const points = dart.result.kind === 'score' ? dart.result.points : 0;
    const imp = dart.flight.impact;
    const hits = imp
      ? [...s.practice.hits, worldToBoardMm(imp)].slice(-MAX_PRACTICE_HITS)
      : s.practice.hits;
    set({
      darts,
      phase: darts.length >= DARTS_PER_TURN ? 'turnOver' : 'impact',
      practice: { darts: s.practice.darts + 1, points: s.practice.points + points, hits },
    });
  },

  finishImpact() {
    if (get().phase === 'impact') set({ phase: 'aiming' });
  },

  finishReplay() {
    const { phase, replay } = get();
    if (phase === 'replay' && replay) set({ phase: replay.then, replay: null });
  },

  collectDarts() {
    const s = get();
    if (s.phase !== 'turnOver' || s.match?.status === 'matchWon') return;
    if (s.bullUp && s.match) {
      if (s.bullUp.winner !== null) {
        set({
          bullUp: null,
          match: withStarter(s.match, s.bullUp.winner),
          darts: [],
          phase: 'aiming',
        });
      } else {
        const bullUp = rethrowBullUp(s.bullUp);
        set({
          bullUp,
          match: { ...s.match, current: bullUp.throwers[0]! },
          darts: [],
          phase: 'aiming',
        });
      }
      return;
    }
    set({
      darts: [],
      phase: 'aiming',
      match: s.match ? endMatchTurn(s.match) : null,
      aiFast: false,
    });
  },

  resetPractice() {
    set({ practice: emptyPractice() });
  },

  updateSettings(patch) {
    set(patch);
    const s = get();
    const saved = Object.fromEntries(SETTING_KEYS.map((k) => [k, s[k]])) as unknown as Settings;
    writeJson(SETTINGS_KEY, saved);
  },
}));

/** Big moments get a slow-motion replay: a 180, a checkout, a bounce-out or a Robin Hood. */
function replayReason(match: MatchState, dart: ThrownDart): Replay['reason'] | null {
  if (dart.result.kind === 'robinHood') return 'robinHood';
  if (dart.result.kind === 'bounce') return 'bounce';
  if (match.status === 'legWon' || match.status === 'matchWon') return 'checkout';
  if (match.mode === 'x01' && match.turn.points === 180) return '180';
  return null;
}

/** How far (mm) a bull-up dart finished from the bull centre; off the board counts as infinitely far. */
function bullUpDistance(d: ThrownDart): number {
  if (d.result.kind === 'bounce' || !d.flight.impact) return Infinity;
  return d.result.r;
}

/** Darts of this turn still in the board, as obstacles for the next one. */
export function stuckDarts(darts: ThrownDart[]): StuckDart[] {
  return darts.map(stuckDartOf).filter((d): d is StuckDart => d !== null);
}

/**
 * Fly a launched dart: precompute its flight and result (including any
 * collision with darts already in the board), then animate it.
 */
function launchDart(aim: { x: number; y: number }, launch: LaunchParams) {
  const s = useGameStore.getState();
  const { flight, result, collision } = resolveDart(launch, stuckDarts(s.darts), rng, s.bounce);
  useGameStore.setState({
    phase: 'flight',
    aim,
    darts: [...s.darts, { id: nextId++, launch, flight, result, collision, landed: false }],
  });
}

/** AI level of the player whose turn it is, or null for a human / practice. */
export function currentAi(s: Pick<GameState, 'setup' | 'match'>): AiLevel | null {
  if (s.setup.kind === 'practice' || !s.match) return null;
  return s.setup.players[s.match.current]?.ai ?? null;
}

/** The current AI player's character (derived from its name), or null for a human. */
export function currentAiPersonality(s: Pick<GameState, 'setup' | 'match'>): AiPersonality | null {
  if (!currentAi(s) || s.setup.kind === 'practice' || !s.match) return null;
  return personalityFor(s.setup.players[s.match.current]!.name);
}

/** What the current AI will aim at next and how much rides on it, or null for a human. */
export function currentAiIntent(s: Pick<GameState, 'setup' | 'match' | 'darts'>) {
  const level = currentAi(s);
  const personality = currentAiPersonality(s);
  if (!level || !personality || !s.match || s.match.status !== 'open') return null;
  return aiIntent(s.match, level, { personality, stuck: stuckDarts(s.darts) });
}

/** Reset the RNG (tests / future replays). */
export function reseed(s: number) {
  rng = createRng(s);
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __darts: typeof useGameStore }).__darts = useGameStore;
}

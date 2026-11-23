import { create } from 'zustand';
import { planAiThrow } from '../engine/ai/simulate';
import type { AiLevel } from '../engine/ai/skill';
import type { BounceSetting, HitResult } from '../engine/board/resolveHit';
import { resolveHit } from '../engine/board/resolveHit';
import { DEFAULT_ATC, type AtcOptions } from '../engine/modes/aroundTheClock';
import { DEFAULT_CRICKET, type CricketOptions } from '../engine/modes/cricket';
import { toDartScore } from '../engine/modes/dart';
import { applyMatchDart, createMatch, endMatchTurn, type MatchState } from '../engine/modes/match';
import { DEFAULT_X01, type X01Options } from '../engine/modes/x01';
import { recordMatch } from './lifetimeStats';
import { simulateFlight, worldToBoardMm, type Flight } from '../engine/physics/ballistics';
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
  reason: '180' | 'checkout' | 'bounce';
  then: Exclude<Phase, 'replay'>;
}
export type Screen = 'menu' | 'game';
export type CameraStyle = 'cinematic' | 'reduced';

/** A seat at the oche: a person, or an AI opponent at the given level. */
export interface PlayerSetup {
  name: string;
  ai?: AiLevel;
}

export type GameSetup =
  | { kind: 'practice' }
  | { kind: 'x01'; options: X01Options; players: PlayerSetup[] }
  | { kind: 'cricket'; options: CricketOptions; players: PlayerSetup[] }
  | { kind: 'atc'; options: AtcOptions; players: PlayerSetup[] };
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
  startGame(setup: GameSetup): void;
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
  switch (saved.kind) {
    case 'x01':
      return { kind: 'x01', options: { ...DEFAULT_X01, ...saved.options }, players };
    case 'cricket':
      return { kind: 'cricket', options: { ...DEFAULT_CRICKET, ...saved.options }, players };
    case 'atc':
      return { kind: 'atc', options: { ...DEFAULT_ATC, ...saved.options }, players };
    default:
      return DEFAULT_SETUP;
  }
}

function matchFor(setup: GameSetup): MatchState | null {
  if (setup.kind === 'practice') return null;
  const names = setup.players.map((p) => p.name);
  switch (setup.kind) {
    case 'x01':
      return createMatch(names, { mode: 'x01', options: setup.options });
    case 'cricket':
      return createMatch(names, { mode: 'cricket', options: setup.options });
    case 'atc':
      return createMatch(names, { mode: 'atc', options: setup.options });
  }
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

  startGame(setup) {
    writeJson(SETUP_KEY, setup);
    set({
      screen: 'game',
      setup,
      match: matchFor(setup),
      aiFast: false,
      phase: 'aiming',
      aim: START_AIM,
      darts: [],
      practice: emptyPractice(),
    });
  },

  quitToMenu() {
    set({ screen: 'menu', match: null, darts: [], phase: 'aiming', replay: null });
  },

  setAim(aim) {
    const r = Math.hypot(aim.x, aim.y);
    const k = r > AIM_LIMIT_MM ? AIM_LIMIT_MM / r : 1;
    set({ aim: { x: aim.x * k, y: aim.y * k } });
  },

  throwDart(aim, flick) {
    const s = get();
    if (s.phase !== 'aiming' || s.darts.length >= DARTS_PER_TURN || currentAi(s)) return;
    launchDart(aim, computeLaunch(aim, flick, s.assist, rng));
  },

  aiThrow() {
    const s = get();
    const level = currentAi(s);
    if (!level || !s.match || s.phase !== 'aiming' || s.match.status !== 'open') return;
    const { target, launch } = planAiThrow(s.match, level, rng);
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
    const { assist, bounce, camera, sound, caller, ambience, replays, quality } = get();
    const saved: Settings = { assist, bounce, camera, sound, caller, ambience, replays, quality };
    writeJson(SETTINGS_KEY, saved);
  },
}));

/** Big moments get a slow-motion replay: a 180, a checkout, or a bounce-out. */
function replayReason(match: MatchState, dart: ThrownDart): Replay['reason'] | null {
  if (dart.result.kind === 'bounce') return 'bounce';
  if (match.status === 'legWon' || match.status === 'matchWon') return 'checkout';
  if (match.mode === 'x01' && match.turn.points === 180) return '180';
  return null;
}

/** Fly a launched dart: precompute its flight and result, then animate it. */
function launchDart(aim: { x: number; y: number }, launch: LaunchParams) {
  const s = useGameStore.getState();
  const flight = simulateFlight(launch.p0, launch.v0);
  let result: HitResult;
  if (flight.impact) {
    const mm = worldToBoardMm(flight.impact);
    result = resolveHit(mm.x, mm.y, rng, s.bounce);
  } else {
    result = { kind: 'miss', r: Infinity, angle: 0 };
  }
  useGameStore.setState({
    phase: 'flight',
    aim,
    darts: [...s.darts, { id: nextId++, launch, flight, result, landed: false }],
  });
}

/** AI level of the player whose turn it is, or null for a human / practice. */
export function currentAi(s: Pick<GameState, 'setup' | 'match'>): AiLevel | null {
  if (s.setup.kind === 'practice' || !s.match) return null;
  return s.setup.players[s.match.current]?.ai ?? null;
}

/** Reset the RNG (tests / future replays). */
export function reseed(s: number) {
  rng = createRng(s);
}

if (import.meta.env.DEV) {
  (window as unknown as { __darts: typeof useGameStore }).__darts = useGameStore;
}

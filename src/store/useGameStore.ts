import { create } from 'zustand';
import type { BounceSetting, HitResult } from '../engine/board/resolveHit';
import { resolveHit } from '../engine/board/resolveHit';
import { toDartScore } from '../engine/modes/dart';
import {
  applyDart,
  createX01,
  DEFAULT_X01,
  endTurn,
  type X01Options,
  type X01State,
} from '../engine/modes/x01';
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
export type Phase = 'aiming' | 'flight' | 'impact' | 'turnOver';
export type Screen = 'menu' | 'game';
export type CameraStyle = 'cinematic' | 'reduced';

export type GameSetup =
  { kind: 'practice' } | { kind: 'x01'; options: X01Options; players: string[] };

export interface Settings {
  assist: AssistLevel;
  bounce: BounceSetting;
  camera: CameraStyle;
}

interface GameState extends Settings {
  screen: Screen;
  setup: GameSetup;
  match: X01State | null;
  phase: Phase;
  /** Aim point in board-local millimetres. */
  aim: { x: number; y: number };
  darts: ThrownDart[];
  practice: { darts: number; points: number };
  startGame(setup: GameSetup): void;
  quitToMenu(): void;
  setAim(aim: { x: number; y: number }): void;
  throwDart(aim: { x: number; y: number }, flick: FlickMetrics): void;
  landDart(id: number): void;
  finishImpact(): void;
  collectDarts(): void;
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
  };
  return { ...fallback, ...readJson<Settings>(SETTINGS_KEY) };
}

export const DEFAULT_SETUP: GameSetup = {
  kind: 'x01',
  options: DEFAULT_X01,
  players: ['Player 1'],
};
export function loadSetup(): GameSetup {
  const saved = readJson<GameSetup>(SETUP_KEY) as GameSetup | null;
  if (saved?.kind === 'practice') return saved;
  if (saved?.kind === 'x01' && Array.isArray(saved.players) && saved.players.length) {
    return {
      kind: 'x01',
      options: { ...DEFAULT_X01, ...saved.options },
      players: saved.players.slice(0, 4),
    };
  }
  return DEFAULT_SETUP;
}

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
  practice: { darts: 0, points: 0 },

  startGame(setup) {
    writeJson(SETUP_KEY, setup);
    set({
      screen: 'game',
      setup,
      match: setup.kind === 'x01' ? createX01(setup.players, setup.options) : null,
      phase: 'aiming',
      aim: START_AIM,
      darts: [],
      practice: { darts: 0, points: 0 },
    });
  },

  quitToMenu() {
    set({ screen: 'menu', match: null, darts: [], phase: 'aiming' });
  },

  setAim(aim) {
    const r = Math.hypot(aim.x, aim.y);
    const k = r > AIM_LIMIT_MM ? AIM_LIMIT_MM / r : 1;
    set({ aim: { x: aim.x * k, y: aim.y * k } });
  },

  throwDart(aim, flick) {
    const s = get();
    if (s.phase !== 'aiming' || s.darts.length >= DARTS_PER_TURN) return;
    const launch = computeLaunch(aim, flick, s.assist, rng);
    const flight = simulateFlight(launch.p0, launch.v0);
    let result: HitResult;
    if (flight.impact) {
      const mm = worldToBoardMm(flight.impact);
      result = resolveHit(mm.x, mm.y, rng, s.bounce);
    } else {
      result = { kind: 'miss', r: Infinity, angle: 0 };
    }
    set({
      phase: 'flight',
      aim,
      darts: [...s.darts, { id: nextId++, launch, flight, result, landed: false }],
    });
  },

  landDart(id) {
    const s = get();
    const dart = s.darts.find((d) => d.id === id);
    if (!dart || dart.landed) return;
    const darts = s.darts.map((d) => (d.id === id ? { ...d, landed: true } : d));
    vibrate(dart.result.kind === 'bounce' ? 30 : 12);

    if (s.match) {
      const match = applyDart(s.match, toDartScore(dart.result));
      set({ darts, match, phase: match.status === 'open' ? 'impact' : 'turnOver' });
      return;
    }
    const points = dart.result.kind === 'score' ? dart.result.points : 0;
    set({
      darts,
      phase: darts.length >= DARTS_PER_TURN ? 'turnOver' : 'impact',
      practice: { darts: s.practice.darts + 1, points: s.practice.points + points },
    });
  },

  finishImpact() {
    if (get().phase === 'impact') set({ phase: 'aiming' });
  },

  collectDarts() {
    const s = get();
    if (s.phase !== 'turnOver' || s.match?.status === 'matchWon') return;
    set({ darts: [], phase: 'aiming', match: s.match ? endTurn(s.match) : null });
  },

  updateSettings(patch) {
    set(patch);
    const { assist, bounce, camera } = get();
    writeJson(SETTINGS_KEY, { assist, bounce, camera });
  },
}));

/** Reset the RNG (tests / future replays). */
export function reseed(s: number) {
  rng = createRng(s);
}

if (import.meta.env.DEV) {
  (window as unknown as { __darts: typeof useGameStore }).__darts = useGameStore;
}

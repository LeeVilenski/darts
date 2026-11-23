import { create } from 'zustand';
import type { BounceSetting, HitResult } from '../engine/board/resolveHit';
import { resolveHit } from '../engine/board/resolveHit';
import { simulateFlight, worldToBoardMm, type Flight } from '../engine/physics/ballistics';
import type { FlickMetrics, LaunchParams } from '../engine/physics/throwModel';
import { computeLaunch, type AssistLevel } from '../engine/physics/throwModel';
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

export type Phase = 'aiming' | 'flight' | 'turnOver';

interface Settings {
  assist: AssistLevel;
  bounce: BounceSetting;
}

interface GameState extends Settings {
  phase: Phase;
  /** Aim point in board-local millimetres. */
  aim: { x: number; y: number };
  darts: ThrownDart[];
  seed: number;
  session: { darts: number; points: number };
  setAim(aim: { x: number; y: number }): void;
  throwDart(aim: { x: number; y: number }, flick: FlickMetrics): void;
  landDart(id: number): void;
  collectDarts(): void;
  setAssist(a: AssistLevel): void;
  setBounce(b: BounceSetting): void;
}

const SETTINGS_KEY = 'darts.settings.v1';
function loadSettings(): Settings {
  const fallback: Settings = { assist: 'standard', bounce: 'realistic' };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Settings>) } : fallback;
  } catch {
    return fallback;
  }
}
function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}

const AIM_LIMIT_MM = 260;
const seed = (Date.now() ^ 0x5eed) >>> 0;
let rng: Rng = createRng(seed);
let nextId = 1;

export const useGameStore = create<GameState>((set, get) => ({
  ...loadSettings(),
  phase: 'aiming',
  aim: { x: 0, y: 103 }, // start on treble 20
  darts: [],
  seed,
  session: { darts: 0, points: 0 },

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
    const darts = s.darts.map((d) => (d.id === id ? { ...d, landed: true } : d));
    const dart = darts.find((d) => d.id === id);
    if (!dart || s.darts.find((d) => d.id === id)?.landed) return;
    const points = dart.result.kind === 'score' ? dart.result.points : 0;
    set({
      darts,
      phase: darts.length >= DARTS_PER_TURN ? 'turnOver' : 'aiming',
      session: { darts: s.session.darts + 1, points: s.session.points + points },
    });
  },

  collectDarts() {
    if (get().phase !== 'turnOver') return;
    set({ darts: [], phase: 'aiming' });
  },

  setAssist(assist) {
    set({ assist });
    saveSettings({ assist, bounce: get().bounce });
  },
  setBounce(bounce) {
    set({ bounce });
    saveSettings({ assist: get().assist, bounce });
  },
}));

/** Reset the RNG (tests / future replays). */
export function reseed(s: number) {
  rng = createRng(s);
}

if (import.meta.env.DEV) {
  (window as unknown as { __darts: typeof useGameStore }).__darts = useGameStore;
}

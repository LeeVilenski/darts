import { create } from 'zustand';
import type { MatchState } from '../engine/modes/match';
import { mergeLifetime, recordMatchInto, type LifetimeStats } from '../engine/stats/lifetime';
import type { PlayerSetup } from './useGameStore';

const KEY = 'darts.lifetime.v1';

function load(): LifetimeStats {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LifetimeStats) : {};
  } catch {
    return {};
  }
}
function save(stats: LifetimeStats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* storage unavailable: stats last for this session only */
  }
}

interface LifetimeStore {
  stats: LifetimeStats;
  /** Replace with a merged copy (cloud sync). */
  merge(incoming: LifetimeStats): void;
  reset(): void;
}

export const useLifetimeStats = create<LifetimeStore>((set, get) => ({
  stats: load(),
  merge(incoming) {
    const stats = mergeLifetime(get().stats, incoming);
    save(stats);
    set({ stats });
  },
  reset() {
    save({});
    set({ stats: {} });
  },
}));

/** Record a finished match for its human players. */
export function recordMatch(match: MatchState, players: PlayerSetup[]) {
  const stats = recordMatchInto(useLifetimeStats.getState().stats, match, (i) => !players[i]?.ai);
  save(stats);
  useLifetimeStats.setState({ stats });
}

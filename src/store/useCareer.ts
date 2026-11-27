import { create } from 'zustand';
import {
  dismissSeason,
  newCareer,
  nextMatch,
  recordResult,
  type CareerState,
} from '../engine/career/career';
import { emptyCareerStats } from '../engine/career/stats';
import { useGameStore } from './useGameStore';

const KEY = 'darts.career.v1';

function load(): CareerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    const c = raw ? (JSON.parse(raw) as CareerState) : null;
    return c?.version === 1 ? { ...c, stats: c.stats ?? emptyCareerStats() } : null;
  } catch {
    return null;
  }
}
function save(c: CareerState | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the career lasts for this session only */
  }
}

interface CareerStore {
  career: CareerState | null;
  /** Career screen showing (UI state, not saved). */
  open: boolean;
  setOpen(open: boolean): void;
  start(name: string): void;
  /** Start your next match. */
  play(): void;
  dismissSeason(): void;
  retire(): void;
}

const update = (career: CareerState | null) => {
  save(career);
  useCareer.setState({ career });
};

export const useCareer = create<CareerStore>((set, get) => ({
  career: load(),
  open: false,
  setOpen(open) {
    set({ open });
  },
  start(name) {
    update(newCareer(name, (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0));
  },
  play() {
    const c = get().career;
    const next = c && nextMatch(c);
    if (!c || !next) return;
    set({ open: false });
    useGameStore.getState().startGame({
      kind: 'x01',
      options: next.format,
      players: [{ name: c.you }, { name: next.opponent.name, ai: next.opponent.level }],
      bullUp: true,
      career: true,
    });
  },
  dismissSeason() {
    const c = get().career;
    if (c) update(dismissSeason(c));
  },
  retire() {
    update(null);
  },
}));

// When a career match finishes, feed the result back into the career.
useGameStore.subscribe((s, prev) => {
  const m = s.match;
  if (!m || m.status !== 'matchWon' || prev.match?.status === 'matchWon') return;
  if (s.setup.kind === 'practice' || !s.setup.career || m.mode !== 'x01') return;
  const c = useCareer.getState().career;
  if (!c) return;
  const tally = (i: number) =>
    m.options.setsToWin ? m.players[i]!.setsWon : m.players[i]!.legsWon;
  const score: [number, number] = [tally(0), tally(1)];
  update(
    recordResult(c, m.winner === 0, score, {
      // With sets, legs restart every set, so only count them in legs-only matches.
      legs: m.options.setsToWin ? [0, 0] : score,
      stats: m.players[0]!.stats,
    }),
  );
});

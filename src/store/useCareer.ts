import { create } from 'zustand';
import {
  attributesForTier,
  careerTuning,
  spendPoint,
  swayScale,
  type Attr,
  type DartRecord,
} from '../engine/career/attributes';
import {
  canTrain,
  dismissSeason,
  DRILLS,
  newCareer,
  nextMatch,
  recordResult,
  recordTraining,
  type CareerState,
} from '../engine/career/career';
import { emptyCareerStats } from '../engine/career/stats';
import { MODE_DEFAULTS } from '../engine/modes/match';
import { ASSIST } from '../engine/physics/throwModel';
import { setCareerThrow, useGameStore, type MatchSetup } from './useGameStore';

const KEY = 'darts.career.v1';

/** Fill in fields added since a save was written. */
export function upgrade(c: CareerState): CareerState {
  return {
    ...c,
    stats: c.stats ?? emptyCareerStats(),
    attributes: c.attributes ?? attributesForTier(c.tier),
    lastGain: c.lastGain ?? null,
    trainedFor: c.trainedFor ?? null,
  };
}

function load(): CareerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    const c = raw ? (JSON.parse(raw) as CareerState) : null;
    return c?.version === 1 ? upgrade(c) : null;
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
  /** Start a training session for an attribute. */
  train(attr: Attr): void;
  spendPoint(attr: Attr): void;
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
  train(attr) {
    const c = get().career;
    if (!c || !canTrain(c)) return;
    set({ open: false });
    const mode = DRILLS[attr].mode;
    useGameStore.getState().startGame({
      kind: mode,
      options: MODE_DEFAULTS[mode],
      players: [{ name: c.you }],
      training: attr,
    } as MatchSetup);
  },
  spendPoint(attr) {
    const c = get().career;
    if (c?.attributes) update({ ...c, attributes: spendPoint(c.attributes, attr, c.tier) });
  },
  dismissSeason() {
    const c = get().career;
    if (c) update(dismissSeason(c));
  },
  retire() {
    update(null);
  },
}));

// Your attributes shape your throw in career matches and training.
setCareerThrow(
  (aim, pressure, rng) => {
    const r = useCareer.getState().career?.attributes?.ratings;
    if (!r) return null;
    return careerTuning(ASSIST[useGameStore.getState().assist], r, aim, pressure, rng).tuning;
  },
  () => {
    const r = useCareer.getState().career?.attributes?.ratings;
    return r ? swayScale(r) : 1;
  },
);

/** Your darts this career match / training session, for XP. */
let session: DartRecord[] = [];

useGameStore.subscribe((s, prev) => {
  if (s.setup !== prev.setup) session = [];
  // Collect your darts as they land (not the bull-up).
  if (s.darts !== prev.darts && !s.bullUp && s.setup.kind !== 'practice') {
    const career = s.setup.career || s.setup.training;
    for (const d of s.darts) {
      const was = prev.darts.find((p) => p.id === d.id);
      if (career && d.landed && !was?.landed && d.intent)
        session.push({ ...d.intent, result: d.result });
    }
  }

  // When a career match or session finishes, feed the result back into the career.
  const m = s.match;
  if (!m || m.status !== 'matchWon' || prev.match?.status === 'matchWon') return;
  if (s.setup.kind === 'practice') return;
  const c = useCareer.getState().career;
  if (!c) return;

  if (s.setup.training) {
    // 121: every checkout is a pressure finish.
    const bonus = m.mode === 'ladder' ? m.players[0]!.checkouts * 15 : 0;
    update(recordTraining(c, s.setup.training, session, bonus));
    session = [];
    return;
  }
  if (!s.setup.career || m.mode !== 'x01') return;
  const tally = (i: number) =>
    m.options.setsToWin ? m.players[i]!.setsWon : m.players[i]!.legsWon;
  const score: [number, number] = [tally(0), tally(1)];
  const lastLeg = m.options.setsToWin ? 0 : m.options.legsToWin - 1;
  update(
    recordResult(c, m.winner === 0, score, {
      // With sets, legs restart every set, so only count them in legs-only matches.
      legs: m.options.setsToWin ? [0, 0] : score,
      stats: m.players[0]!.stats,
      darts: session,
      decider: lastLeg > 0 && score[0] === lastLeg + 1 && score[1] === lastLeg,
    }),
  );
  session = [];
});

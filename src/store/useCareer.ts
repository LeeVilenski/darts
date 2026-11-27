import { create } from 'zustand';
import {
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
  enterEvent,
  newCareer,
  nextMatch,
  recordResult,
  recordTraining,
  skipWeek,
  type CareerState,
} from '../engine/career/career';
import { loadCareer } from '../engine/career/migrate';
import { answerChoice, answerOffer, markRead, withStory } from '../engine/career/milestones';
import { buyKit, plainKit, type KitItem } from '../engine/career/kit';
import { SHIRTS, setLookOverride } from '../game/scene/appearance';
import { MODE_DEFAULTS } from '../engine/modes/match';
import { ASSIST } from '../engine/physics/throwModel';
import { setCareerThrow, useGameStore, type MatchSetup } from './useGameStore';

const KEY = 'darts.career.v2';
const OLD_KEY = 'darts.career.v1';

function load(): CareerState | null {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    return raw ? loadCareer(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function save(c: CareerState | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else {
      localStorage.removeItem(KEY);
      localStorage.removeItem(OLD_KEY);
    }
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
  /** Enter one of this week's events. */
  enter(id: string): void;
  /** Play this week without you. */
  skipWeek(): void;
  /** Accept or decline an offer in a message. */
  answer(messageId: string, accept: boolean): void;
  read(messageId: string): void;
  /** Pick an option in a message (a nickname). */
  choose(messageId: string, option: string): void;
  /** Buy (or wear, if owned) a kit item. */
  buy(item: KitItem): void;
  plainKit(): void;
  /** Start your next match. */
  play(): void;
  /** Start a training session for an attribute. */
  train(attr: Attr): void;
  spendPoint(attr: Attr): void;
  dismissSeason(): void;
  retire(): void;
}

/** Apply an action and let the story react (wildcards, cards, messages). */
const act = (f: (c: CareerState) => CareerState) => {
  const c = useCareer.getState().career;
  if (c) update(withStory(c, f));
};

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
  enter(id) {
    act((c) => enterEvent(c, id));
  },
  skipWeek() {
    act(skipWeek);
  },
  answer(id, accept) {
    act((c) => answerOffer(c, id, accept));
  },
  choose(id, option) {
    act((c) => answerChoice(c, id, option));
  },
  buy(item) {
    act((c) => buyKit(c, item));
  },
  plainKit() {
    act(plainKit);
  },
  read(id) {
    act((c) => markRead(c, id));
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
      venue: next.event.venue,
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
    if (c) update({ ...c, attributes: spendPoint(c.attributes, attr, c.tier) });
  },
  dismissSeason() {
    const c = get().career;
    if (c) update(dismissSeason(c));
  },
  retire() {
    update(null);
  },
}));

/** Your kit and nickname, on your player at the oche and on the scoreboard. */
function applyLook(c: CareerState | null, prev: CareerState | null) {
  if (prev && prev.you !== c?.you) setLookOverride(prev.you, null);
  if (!c) return;
  const patch: Parameters<typeof setLookOverride>[1] = {};
  const shirt = c.kit.shirt !== null ? SHIRTS[c.kit.shirt] : undefined;
  if (shirt) [patch.shirt, patch.trim] = shirt;
  if (c.kit.pattern) patch.pattern = c.kit.pattern;
  if (c.nickname) patch.backName = c.nickname.toUpperCase();
  setLookOverride(c.you, Object.keys(patch).length ? patch : null);
}
applyLook(useCareer.getState().career, null);
useCareer.subscribe((s, prev) => {
  if (s.career !== prev.career) applyLook(s.career, prev.career);
});

// Your attributes shape your throw in career matches and training.
setCareerThrow(
  (aim, pressure, rng) => {
    const r = useCareer.getState().career?.attributes.ratings;
    if (!r) return null;
    return careerTuning(ASSIST[useGameStore.getState().assist], r, aim, pressure, rng).tuning;
  },
  () => {
    const r = useCareer.getState().career?.attributes.ratings;
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

  const focus = s.setup.training;
  if (focus) {
    // 121: every checkout is a pressure finish.
    const bonus = m.mode === 'ladder' ? m.players[0]!.checkouts * 15 : 0;
    const darts = session;
    act((c) => recordTraining(c, focus, darts, bonus));
    session = [];
    return;
  }
  if (!s.setup.career || m.mode !== 'x01') return;
  const tally = (i: number) =>
    m.options.setsToWin ? m.players[i]!.setsWon : m.players[i]!.legsWon;
  const score: [number, number] = [tally(0), tally(1)];
  const lastLeg = m.options.setsToWin ? 0 : m.options.legsToWin - 1;
  const darts = session;
  act((c) =>
    recordResult(c, m.winner === 0, score, {
      // With sets, legs restart every set, so only count them in legs-only matches.
      legs: m.options.setsToWin ? [0, 0] : score,
      stats: m.players[0]!.stats,
      darts,
      decider: lastLeg > 0 && score[0] === lastLeg + 1 && score[1] === lastLeg,
    }),
  );
  session = [];
});

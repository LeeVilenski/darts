import { create } from 'zustand';
import {
  cloudConfigured,
  currentUser,
  fetchProfile,
  onAuthChange,
  saveMatch,
  saveProfile,
  signOut as cloudSignOut,
  type CloudUser,
} from '../services/cloud';
import { planSync } from '../services/sync';
import { useLifetimeStats } from './lifetimeStats';
import { useGameStore, type Settings } from './useGameStore';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface AccountState {
  user: CloudUser | null;
  status: SyncStatus;
  error: string | null;
  init(): Promise<void>;
  syncNow(): Promise<void>;
  signOut(): Promise<void>;
}

const SETTING_KEYS: (keyof Settings)[] = [
  'assist',
  'bounce',
  'camera',
  'sound',
  'caller',
  'ambience',
  'replays',
  'quality',
];
const pickSettings = (): Partial<Settings> => {
  const s = useGameStore.getState();
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, s[k]])) as Partial<Settings>;
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

let initialised = false;
let pushTimer: number | undefined;

export const useAccount = create<AccountState>((set, get) => ({
  user: null,
  status: 'idle',
  error: null,

  async init() {
    if (!cloudConfigured || initialised) return;
    initialised = true;
    try {
      const handle = (user: CloudUser | null) => {
        const changed = user?.id !== get().user?.id;
        set({ user, status: user ? get().status : 'idle', error: null });
        if (user && changed) void get().syncNow();
      };
      await onAuthChange(handle);
      handle(await currentUser());
      watchForChanges();
    } catch (e) {
      set({ status: 'error', error: message(e) });
    }
  },

  async syncNow() {
    const user = get().user;
    if (!user) return;
    set({ status: 'syncing', error: null });
    try {
      const plan = planSync(useLifetimeStats.getState().stats, await fetchProfile(user.id));
      useLifetimeStats.getState().merge(plan.lifetime);
      if (plan.settings) {
        const known = Object.fromEntries(
          Object.entries(plan.settings).filter(([k]) => (SETTING_KEYS as string[]).includes(k)),
        );
        useGameStore.getState().updateSettings(known as Partial<Settings>);
      }
      if (plan.push) await saveProfile(user.id, pickSettings(), useLifetimeStats.getState().stats);
      set({ status: 'synced' });
    } catch (e) {
      set({ status: 'error', error: message(e) });
    }
  },

  async signOut() {
    await cloudSignOut();
    set({ user: null, status: 'idle' });
  },
}));

/** Push settings/stats changes (debounced) and log finished matches while signed in. */
function watchForChanges() {
  const schedulePush = () => {
    const user = useAccount.getState().user;
    if (!user) return;
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(async () => {
      try {
        await saveProfile(user.id, pickSettings(), useLifetimeStats.getState().stats);
        useAccount.setState({ status: 'synced', error: null });
      } catch (e) {
        useAccount.setState({ status: 'error', error: message(e) });
      }
    }, 1500);
  };
  useLifetimeStats.subscribe((s, prev) => s.stats !== prev.stats && schedulePush());
  useGameStore.subscribe((s, prev) => {
    if (SETTING_KEYS.some((k) => s[k] !== prev[k])) schedulePush();
    const user = useAccount.getState().user;
    const m = s.match;
    if (user && m && m.status === 'matchWon' && prev.match?.status !== 'matchWon') {
      const summary = {
        players: m.players.map((p, i) => ({
          name: p.name,
          ai: s.setup.kind !== 'practice' ? (s.setup.players[i]?.ai ?? null) : null,
          stats: p.stats,
        })),
        winner: m.winner,
        legs: m.players.map((p) => p.legsWon),
      };
      saveMatch(user.id, m.mode, summary).catch((e) =>
        useAccount.setState({ status: 'error', error: message(e) }),
      );
    }
  });
}
